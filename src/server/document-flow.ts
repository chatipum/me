import { eq } from 'drizzle-orm';
import { documents } from '@/db/schema';
import type { Db } from '@/db/types';
import { addDays } from '@/lib/dates';
import { allowedTransitions, type DocStatus, type DocType, nextConversion, type PaymentMethod } from '@/lib/doc-status';
import type { DocumentInput } from '@/lib/schemas';
import { type DocumentWithItems, getDocument, insertDocument } from './documents';
import { DomainError } from './errors';
import { getSettings } from './settings';

function inputFrom(doc: DocumentWithItems, overrides: Partial<DocumentInput>): DocumentInput {
  return {
    customerId: doc.customerId,
    issueDate: doc.issueDate,
    validUntil: null,
    dueDate: null,
    paidDate: null,
    paymentMethod: null,
    vatEnabled: doc.vatEnabled,
    withholdingEnabled: doc.withholdingEnabled,
    withholdingRateBp: doc.withholdingRateBp,
    notes: doc.notes,
    items: doc.items.map((item) => ({
      description: item.description,
      hoursHundredths: item.hoursHundredths,
      quantityHundredths: item.quantityHundredths,
      unit: item.unit,
      unitPriceSatang: item.unitPriceSatang,
      withholding: item.withholding,
    })),
    ...overrides,
  };
}

async function requireConvertible(db: Db, id: number, target: DocType): Promise<DocumentWithItems> {
  const doc = await getDocument(db, id);
  if (!doc) throw new DomainError('ไม่พบเอกสาร');
  if (nextConversion(doc.type, doc.status, doc.childId !== null) !== target) {
    throw new DomainError('แปลงเอกสารนี้ไม่ได้');
  }
  return doc;
}

export async function setQuotationStatus(db: Db, id: number, to: DocStatus): Promise<void> {
  const doc = await getDocument(db, id);
  if (!doc) throw new DomainError('ไม่พบเอกสาร');
  if (!allowedTransitions(doc.type, doc.status, doc.childId !== null).includes(to)) {
    throw new DomainError('เปลี่ยนสถานะนี้ไม่ได้');
  }
  await db.update(documents).set({ status: to }).where(eq(documents.id, id));
}

export function convertToInvoice(db: Db, id: number, today: string): Promise<number> {
  return db.transaction(async (tx) => {
    const quotation = await requireConvertible(tx, id, 'invoice');
    const settings = await getSettings(tx);
    return insertDocument(tx, {
      type: 'invoice',
      status: 'unpaid',
      parentId: quotation.id,
      hourlyRateSatang: quotation.hourlyRateSatang,
      snapshot: quotation.customerSnapshot,
      input: inputFrom(quotation, { issueDate: today, dueDate: addDays(today, settings.defaultInvoiceDueDays) }),
    });
  });
}

export function convertToReceipt(
  db: Db,
  id: number,
  payment: { paidDate: string; paymentMethod: PaymentMethod },
  today: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    const invoice = await requireConvertible(tx, id, 'receipt');
    const receiptId = await insertDocument(tx, {
      type: 'receipt',
      status: 'issued',
      parentId: invoice.id,
      hourlyRateSatang: invoice.hourlyRateSatang,
      snapshot: invoice.customerSnapshot,
      input: inputFrom(invoice, { issueDate: today, ...payment }),
    });
    await tx.update(documents).set({ status: 'paid' }).where(eq(documents.id, invoice.id));
    return receiptId;
  });
}

export function duplicateAsQuotation(db: Db, id: number, today: string): Promise<number> {
  return db.transaction(async (tx) => {
    const source = await getDocument(tx, id);
    if (!source) throw new DomainError('ไม่พบเอกสาร');
    const settings = await getSettings(tx);
    return insertDocument(tx, {
      type: 'quotation',
      status: 'draft',
      parentId: null,
      hourlyRateSatang: settings.hourlyRateSatang,
      input: inputFrom(source, { issueDate: today, validUntil: addDays(today, settings.defaultQuoteValidityDays) }),
    });
  });
}
