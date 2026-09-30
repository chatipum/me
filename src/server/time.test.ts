import { beforeEach, describe, expect, test } from 'bun:test';
import { isNull } from 'drizzle-orm';
import { timeEntries } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { sampleInput, seedCustomer } from '@/test/fixtures';
import { convertToInvoice, convertToReceipt, setQuotationStatus } from './document-flow';
import { createQuotation, deleteDocument } from './documents';
import {
  createTimeEntry,
  deleteTimeEntry,
  getJobTimeSummary,
  getRunningTimer,
  listJobSummaries,
  listTimeEntries,
  resolveJobId,
  startTimer,
  stopTimer,
  updateTimeEntry,
} from './time';

const T0 = new Date('2026-09-29T02:00:00Z'); // 09:00 Bangkok
const minutesLater = (m: number) => new Date(T0.getTime() + m * 60_000);
let db: Db;
let customerId: number;

beforeEach(async () => {
  db = await createTestDb();
  customerId = await seedCustomer(db);
});

// 10 h estimate (hourly item) + one fixed-price item
function hourlyQuotation(issueDate = '2026-09-29') {
  return createQuotation(
    db,
    sampleInput(customerId, {
      issueDate,
      items: [
        { description: 'ทำเว็บขายของ', hoursHundredths: 1000, quantityHundredths: 100, unit: '', unitPriceSatang: 0 },
        { description: 'ค่าโดเมน', hoursHundredths: 0, quantityHundredths: 100, unit: '', unitPriceSatang: 50000 },
      ],
    }),
  );
}

async function fullChain() {
  const qt = await hourlyQuotation();
  await setQuotationStatus(db, qt, 'sent');
  await setQuotationStatus(db, qt, 'accepted');
  const inv = await convertToInvoice(db, qt, '2026-10-01');
  const rc = await convertToReceipt(db, inv, { paidDate: '2026-10-02', paymentMethod: 'cash' }, '2026-10-02');
  return { qt, inv, rc };
}

describe('resolveJobId', () => {
  test('invoice and receipt resolve to the source quotation', async () => {
    const { qt, inv, rc } = await fullChain();
    expect(await resolveJobId(db, qt)).toBe(qt);
    expect(await resolveJobId(db, inv)).toBe(qt);
    expect(await resolveJobId(db, rc)).toBe(qt);
  });
  test('missing document', async () => {
    await expect(resolveJobId(db, 999)).rejects.toThrow('ไม่พบเอกสาร');
  });
});

describe('timer', () => {
  test('start from an invoice records time on the quotation', async () => {
    const { qt, inv } = await fullChain();
    await startTimer(db, inv, T0);
    const running = await getRunningTimer(db);
    expect(running).toMatchObject({ jobId: qt, jobNumber: 'QT-2026-0001' });
    expect(running?.startedAt.toISOString()).toBe(T0.toISOString());
  });

  test('starting a second job stops the first at the same instant', async () => {
    const a = await hourlyQuotation();
    const b = await hourlyQuotation();
    await startTimer(db, a, T0);
    await startTimer(db, b, minutesLater(90));
    const [entryA] = await listTimeEntries(db, a);
    expect(entryA?.endedAt?.toISOString()).toBe(minutesLater(90).toISOString());
    expect((await getRunningTimer(db))?.jobId).toBe(b);
    expect(await db.select().from(timeEntries).where(isNull(timeEntries.endedAt))).toHaveLength(1);
    // the old timer's time is kept
    expect((await getJobTimeSummary(db, a, minutesLater(200))).actualMinutes).toBe(90);
  });

  test('database rejects two running entries', async () => {
    const a = await hourlyQuotation();
    await db.insert(timeEntries).values({ jobId: a, startedAt: T0 });
    const secondRunning = async () => {
      await db.insert(timeEntries).values({ jobId: a, startedAt: minutesLater(1) });
    };
    await expect(secondRunning()).rejects.toThrow();
  });

  test('stopTimer ends the running entry', async () => {
    const a = await hourlyQuotation();
    await startTimer(db, a, T0);
    await stopTimer(db, minutesLater(30));
    expect(await getRunningTimer(db)).toBeNull();
    const [entry] = await listTimeEntries(db, a);
    expect(entry?.endedAt?.toISOString()).toBe(minutesLater(30).toISOString());
  });
});

describe('manual entries', () => {
  test('create via receipt, interpreted as Bangkok time', async () => {
    const { qt, rc } = await fullChain();
    await createTimeEntry(db, rc, { date: '2026-09-29', startTime: '09:00', endTime: '11:30', note: 'ออกแบบหน้าแรก' });
    const [entry] = await listTimeEntries(db, qt);
    expect(entry?.startedAt.toISOString()).toBe('2026-09-29T02:00:00.000Z');
    expect(entry?.endedAt?.toISOString()).toBe('2026-09-29T04:30:00.000Z');
    expect(entry?.note).toBe('ออกแบบหน้าแรก');
  });

  test('end must be after start', async () => {
    const qt = await hourlyQuotation();
    const bad = { date: '2026-09-29', startTime: '10:00', endTime: '10:00', note: '' };
    await expect(createTimeEntry(db, qt, bad)).rejects.toThrow('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม');
    await expect(createTimeEntry(db, qt, { ...bad, endTime: '09:00' })).rejects.toThrow('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม');
  });

  test('update and delete', async () => {
    const qt = await hourlyQuotation();
    await createTimeEntry(db, qt, { date: '2026-09-29', startTime: '09:00', endTime: '10:00', note: '' });
    const [entry] = await listTimeEntries(db, qt);
    if (!entry) throw new Error('entry not created');
    await updateTimeEntry(db, entry.id, { date: '2026-09-29', startTime: '09:00', endTime: '12:00', note: 'แก้' });
    expect((await listTimeEntries(db, qt))[0]?.note).toBe('แก้');
    await deleteTimeEntry(db, entry.id);
    expect(await listTimeEntries(db, qt)).toHaveLength(0);
  });

  test('update of a missing entry', async () => {
    await expect(
      updateTimeEntry(db, 999, { date: '2026-09-29', startTime: '09:00', endTime: '10:00', note: '' }),
    ).rejects.toThrow('ไม่พบรายการเวลา');
  });

  test('deleting the quotation deletes its time', async () => {
    const qt = await hourlyQuotation();
    await createTimeEntry(db, qt, { date: '2026-09-29', startTime: '09:00', endTime: '10:00', note: '' });
    await deleteDocument(db, qt);
    expect(await db.select().from(timeEntries)).toHaveLength(0);
  });
});

describe('summaries', () => {
  test('job summary: estimate vs actual, running timer counted up to now', async () => {
    const qt = await hourlyQuotation();
    await createTimeEntry(db, qt, { date: '2026-09-29', startTime: '09:00', endTime: '19:00', note: '' }); // 10 h
    await startTimer(db, qt, T0);
    const summary = await getJobTimeSummary(db, qt, minutesLater(150)); // + 2.5 h running
    expect(summary).toMatchObject({
      jobId: qt,
      jobNumber: 'QT-2026-0001',
      estimatedMinutes: 600,
      actualMinutes: 750,
      variancePercent: 25,
    });
  });

  test('list: only jobs with estimate or time, filtered by quotation issue date', async () => {
    const withEstimate = await hourlyQuotation('2026-09-29');
    const fixedOnly = await createQuotation(db, sampleInput(customerId)); // no hours, no time
    const fixedWithTime = await createQuotation(db, sampleInput(customerId, { issueDate: '2026-10-15' }));
    await createTimeEntry(db, fixedWithTime, { date: '2026-10-15', startTime: '09:00', endTime: '10:00', note: '' });

    const all = await listJobSummaries(db, {}, T0);
    expect(all.map((r) => r.jobId)).toEqual([fixedWithTime, withEstimate]);
    expect(all.find((r) => r.jobId === fixedWithTime)?.variancePercent).toBeNull();
    expect(all.map((r) => r.jobId)).not.toContain(fixedOnly);

    const october = await listJobSummaries(db, { from: '2026-10-01', to: '2026-10-31' }, T0);
    expect(october.map((r) => r.jobId)).toEqual([fixedWithTime]);
  });
});
