import { and, asc, desc, eq, ilike, or, type SQL, sql } from 'drizzle-orm';
import {
  type CustomerSnapshot,
  counters,
  customers,
  type DocumentItem,
  type DocumentRow,
  documentItems,
  documents,
} from '@/db/schema';
import type { Db } from '@/db/types';
import { formatDocNumber } from '@/lib/doc-number';
import type { DocStatus, DocType } from '@/lib/doc-status';
import { isLocked } from '@/lib/doc-status';
import { computeTotals, lineAmount, priceItem } from '@/lib/money';
import type { DocumentInput } from '@/lib/schemas';
import { DomainError } from './errors';
import { getSettings } from './settings';

export type DocumentWithItems = DocumentRow & {
  items: DocumentItem[];
  childId: number | null;
  parentNumber: string | null;
};

export type DocumentListItem = {
  id: number;
  type: DocType;
  number: string;
  status: DocStatus;
  issueDate: string;
  customerName: string;
  netPayable: number;
};

export type DocumentFilter = { type?: DocType; status?: DocStatus; q?: string; customerId?: number };

export async function allocateNumber(db: Db, type: DocType, issueDate: string): Promise<string> {
  const year = Number(issueDate.slice(0, 4));
  const [row] = await db
    .insert(counters)
    .values({ type, year, lastValue: 1 })
    .onConflictDoUpdate({
      target: [counters.type, counters.year],
      set: { lastValue: sql`${counters.lastValue} + 1` },
    })
    .returning({ lastValue: counters.lastValue });
  return formatDocNumber(type, year, row.lastValue);
}

async function snapshotCustomer(db: Db, customerId: number): Promise<CustomerSnapshot> {
  const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!c) throw new DomainError('ไม่พบลูกค้า');
  return { name: c.name, taxId: c.taxId, branch: c.branch, address: c.address, contactName: c.contactName };
}

// Hourly items are always re-priced here; the client-sent price is ignored.
function pricedItems(input: DocumentInput, hourlyRateSatang: number) {
  return input.items.map((item) => priceItem(item, hourlyRateSatang));
}

function documentValues(input: DocumentInput, hourlyRateSatang: number) {
  return {
    customerId: input.customerId,
    issueDate: input.issueDate,
    validUntil: input.validUntil,
    dueDate: input.dueDate,
    paidDate: input.paidDate,
    paymentMethod: input.paymentMethod,
    vatEnabled: input.vatEnabled,
    withholdingEnabled: input.withholdingEnabled,
    withholdingRateBp: input.withholdingRateBp,
    notes: input.notes,
    hourlyRateSatang,
    ...computeTotals({ ...input, items: pricedItems(input, hourlyRateSatang) }),
  };
}

async function insertItems(db: Db, documentId: number, input: DocumentInput, hourlyRateSatang: number): Promise<void> {
  await db.insert(documentItems).values(
    pricedItems(input, hourlyRateSatang).map((item, position) => ({
      documentId,
      position,
      description: item.description,
      hoursHundredths: item.hoursHundredths,
      quantityHundredths: item.quantityHundredths,
      unit: item.unit,
      unitPriceSatang: item.unitPriceSatang,
      amount: lineAmount(item.quantityHundredths, item.unitPriceSatang),
      withholding: item.withholding,
    })),
  );
}

// Must run inside a transaction so a failure also rolls back the allocated number.
export async function insertDocument(
  db: Db,
  args: {
    type: DocType;
    status: DocStatus;
    parentId: number | null;
    input: DocumentInput;
    hourlyRateSatang: number;
    snapshot?: CustomerSnapshot;
  },
): Promise<number> {
  const customerSnapshot = args.snapshot ?? (await snapshotCustomer(db, args.input.customerId));
  const number = await allocateNumber(db, args.type, args.input.issueDate);
  const [row] = await db
    .insert(documents)
    .values({
      type: args.type,
      number,
      status: args.status,
      parentId: args.parentId,
      customerSnapshot,
      ...documentValues(args.input, args.hourlyRateSatang),
    })
    .returning({ id: documents.id });
  await insertItems(db, row.id, args.input, args.hourlyRateSatang);
  return row.id;
}

export function createQuotation(db: Db, input: DocumentInput): Promise<number> {
  return db.transaction(async (tx) => {
    const { hourlyRateSatang } = await getSettings(tx);
    return insertDocument(tx, { type: 'quotation', status: 'draft', parentId: null, input, hourlyRateSatang });
  });
}

export async function getDocument(db: Db, id: number): Promise<DocumentWithItems | null> {
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) return null;
  const items = await db
    .select()
    .from(documentItems)
    .where(eq(documentItems.documentId, id))
    .orderBy(asc(documentItems.position));
  const [child] = await db.select({ id: documents.id }).from(documents).where(eq(documents.parentId, id));
  const [parent] = doc.parentId
    ? await db.select({ number: documents.number }).from(documents).where(eq(documents.id, doc.parentId))
    : [];
  return { ...doc, items, childId: child?.id ?? null, parentNumber: parent?.number ?? null };
}

async function requireUnlocked(db: Db, id: number): Promise<DocumentWithItems> {
  const doc = await getDocument(db, id);
  if (!doc) throw new DomainError('ไม่พบเอกสาร');
  if (isLocked(doc.childId !== null)) throw new DomainError('เอกสารนี้ถูกแปลงไปแล้ว แก้ไขหรือลบไม่ได้');
  return doc;
}

export function updateDocument(db: Db, id: number, input: DocumentInput): Promise<void> {
  return db.transaction(async (tx) => {
    const doc = await requireUnlocked(tx, id);
    const customerSnapshot = await snapshotCustomer(tx, input.customerId);
    await tx
      .update(documents)
      .set({ ...documentValues(input, doc.hourlyRateSatang), customerSnapshot, updatedAt: new Date() })
      .where(eq(documents.id, id));
    await tx.delete(documentItems).where(eq(documentItems.documentId, id));
    await insertItems(tx, id, input, doc.hourlyRateSatang);
  });
}

export function deleteDocument(db: Db, id: number): Promise<void> {
  return db.transaction(async (tx) => {
    const doc = await requireUnlocked(tx, id);
    await tx.delete(documents).where(eq(documents.id, id));
    // Deleting a receipt reopens its invoice so it can be paid/converted again.
    if (doc.type === 'receipt' && doc.parentId) {
      await tx.update(documents).set({ status: 'unpaid' }).where(eq(documents.id, doc.parentId));
    }
  });
}

export async function listDocuments(db: Db, filter: DocumentFilter = {}): Promise<DocumentListItem[]> {
  const conditions: SQL[] = [];
  if (filter.type) conditions.push(eq(documents.type, filter.type));
  if (filter.status) conditions.push(eq(documents.status, filter.status));
  if (filter.customerId) conditions.push(eq(documents.customerId, filter.customerId));
  if (filter.q) {
    const pattern = `%${filter.q}%`;
    conditions.push(
      or(ilike(documents.number, pattern), sql`${documents.customerSnapshot}->>'name' ILIKE ${pattern}`)!,
    );
  }
  return db
    .select({
      id: documents.id,
      type: documents.type,
      number: documents.number,
      status: documents.status,
      issueDate: documents.issueDate,
      customerName: sql<string>`${documents.customerSnapshot}->>'name'`,
      netPayable: documents.netPayable,
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.id));
}

export async function markPdfGenerated(db: Db, id: number, pathname: string): Promise<void> {
  await db.update(documents).set({ pdfPathname: pathname, pdfGeneratedAt: new Date() }).where(eq(documents.id, id));
}
