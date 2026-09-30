import { and, desc, eq, gte, inArray, isNull, lte, type SQL, sql } from 'drizzle-orm';
import { documentItems, documents, type TimeEntry, timeEntries } from '@/db/schema';
import type { Db } from '@/db/types';
import type { DocStatus } from '@/lib/doc-status';
import type { TimeEntryInput } from '@/lib/schemas';
import { bangkokDateTime, entryMinutes, estimatedMinutes, variancePercent } from '@/lib/time';
import { DomainError } from './errors';

export type RunningTimer = { entryId: number; jobId: number; jobNumber: string; startedAt: Date };

export type JobTimeSummary = {
  jobId: number;
  jobNumber: string;
  customerName: string;
  status: DocStatus;
  issueDate: string;
  estimatedMinutes: number;
  actualMinutes: number;
  variancePercent: number | null;
};

async function findDoc(db: Db, id: number) {
  const [doc] = await db
    .select({ id: documents.id, type: documents.type, parentId: documents.parentId })
    .from(documents)
    .where(eq(documents.id, id));
  return doc;
}

export async function resolveJobId(db: Db, documentId: number): Promise<number> {
  let doc = await findDoc(db, documentId);
  if (!doc) throw new DomainError('ไม่พบเอกสาร');
  // receipt → invoice → quotation
  while (doc.type !== 'quotation') {
    if (!doc.parentId) throw new DomainError('ไม่พบใบเสนอราคาต้นทาง');
    const parent = await findDoc(db, doc.parentId);
    if (!parent) throw new DomainError('ไม่พบใบเสนอราคาต้นทาง');
    doc = parent;
  }
  return doc.id;
}

export function startTimer(db: Db, documentId: number, now: Date = new Date()): Promise<void> {
  return db.transaction(async (tx) => {
    const jobId = await resolveJobId(tx, documentId);
    await tx.update(timeEntries).set({ endedAt: now }).where(isNull(timeEntries.endedAt));
    await tx.insert(timeEntries).values({ jobId, startedAt: now });
  });
}

export async function stopTimer(db: Db, now: Date = new Date()): Promise<void> {
  await db.update(timeEntries).set({ endedAt: now }).where(isNull(timeEntries.endedAt));
}

export async function getRunningTimer(db: Db): Promise<RunningTimer | null> {
  const [row] = await db
    .select({
      entryId: timeEntries.id,
      jobId: timeEntries.jobId,
      jobNumber: documents.number,
      startedAt: timeEntries.startedAt,
    })
    .from(timeEntries)
    .innerJoin(documents, eq(documents.id, timeEntries.jobId))
    .where(isNull(timeEntries.endedAt));
  return row ?? null;
}

export function listTimeEntries(db: Db, jobId: number): Promise<TimeEntry[]> {
  return db
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.jobId, jobId))
    .orderBy(desc(timeEntries.startedAt), desc(timeEntries.id));
}

function toRange(input: TimeEntryInput) {
  const startedAt = bangkokDateTime(input.date, input.startTime);
  const endedAt = bangkokDateTime(input.date, input.endTime);
  if (endedAt <= startedAt) throw new DomainError('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม');
  return { startedAt, endedAt, note: input.note };
}

export async function createTimeEntry(db: Db, documentId: number, input: TimeEntryInput): Promise<void> {
  const range = toRange(input);
  const jobId = await resolveJobId(db, documentId);
  await db.insert(timeEntries).values({ jobId, ...range });
}

export async function updateTimeEntry(db: Db, id: number, input: TimeEntryInput): Promise<void> {
  const [row] = await db
    .update(timeEntries)
    .set(toRange(input))
    .where(eq(timeEntries.id, id))
    .returning({ id: timeEntries.id });
  if (!row) throw new DomainError('ไม่พบรายการเวลา');
}

export async function deleteTimeEntry(db: Db, id: number): Promise<void> {
  await db.delete(timeEntries).where(eq(timeEntries.id, id));
}

async function summarize(db: Db, conditions: SQL[], now: Date): Promise<JobTimeSummary[]> {
  const jobs = await db
    .select({
      id: documents.id,
      number: documents.number,
      status: documents.status,
      issueDate: documents.issueDate,
      customerName: sql<string>`${documents.customerSnapshot}->>'name'`,
    })
    .from(documents)
    .where(and(eq(documents.type, 'quotation'), ...conditions))
    .orderBy(desc(documents.id));
  if (jobs.length === 0) return [];
  const ids = jobs.map((job) => job.id);
  const items = await db
    .select({
      documentId: documentItems.documentId,
      hoursHundredths: documentItems.hoursHundredths,
      quantityHundredths: documentItems.quantityHundredths,
    })
    .from(documentItems)
    .where(inArray(documentItems.documentId, ids));
  const entries = await db
    .select({ jobId: timeEntries.jobId, startedAt: timeEntries.startedAt, endedAt: timeEntries.endedAt })
    .from(timeEntries)
    .where(inArray(timeEntries.jobId, ids));

  return jobs.map((job) => {
    const estimated = estimatedMinutes(items.filter((item) => item.documentId === job.id));
    const actual = entries
      .filter((entry) => entry.jobId === job.id)
      .reduce((sum, entry) => sum + entryMinutes(entry.startedAt, entry.endedAt, now), 0);
    return {
      jobId: job.id,
      jobNumber: job.number,
      customerName: job.customerName,
      status: job.status,
      issueDate: job.issueDate,
      estimatedMinutes: estimated,
      actualMinutes: actual,
      variancePercent: variancePercent(actual, estimated),
    };
  });
}

export async function getJobTimeSummary(db: Db, documentId: number, now: Date = new Date()): Promise<JobTimeSummary> {
  const jobId = await resolveJobId(db, documentId);
  const [summary] = await summarize(db, [eq(documents.id, jobId)], now);
  if (!summary) throw new DomainError('ไม่พบเอกสาร');
  return summary;
}

export async function listJobSummaries(
  db: Db,
  filter: { from?: string; to?: string } = {},
  now: Date = new Date(),
): Promise<JobTimeSummary[]> {
  const conditions: SQL[] = [];
  if (filter.from) conditions.push(gte(documents.issueDate, filter.from));
  if (filter.to) conditions.push(lte(documents.issueDate, filter.to));
  const rows = await summarize(db, conditions, now);
  return rows.filter((row) => row.estimatedMinutes > 0 || row.actualMinutes > 0);
}
