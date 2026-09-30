import { beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { documents } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { sampleInput, seedCustomer } from '@/test/fixtures';
import { updateCustomer } from './customers';
import {
  allocateNumber,
  createQuotation,
  deleteDocument,
  getDocument,
  listDocuments,
  markPdfGenerated,
  updateDocument,
} from './documents';
import { getSettings, updateSettings } from './settings';

let db: Db;
let customerId: number;
beforeEach(async () => {
  db = await createTestDb();
  customerId = await seedCustomer(db);
});

describe('allocateNumber', () => {
  test('sequential per type and year, restarts in a new year', async () => {
    expect(await allocateNumber(db, 'quotation', '2026-01-01')).toBe('QT-2026-0001');
    expect(await allocateNumber(db, 'quotation', '2026-12-31')).toBe('QT-2026-0002');
    expect(await allocateNumber(db, 'invoice', '2026-05-01')).toBe('INV-2026-0001');
    expect(await allocateNumber(db, 'quotation', '2027-01-01')).toBe('QT-2027-0001');
  });
});

describe('createQuotation', () => {
  test('stores draft with server-computed totals, items and customer snapshot', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    const doc = await getDocument(db, id);
    expect(doc).not.toBeNull();
    expect(doc!.number).toBe('QT-2026-0001');
    expect(doc!.status).toBe('draft');
    expect(doc!.subtotal).toBe(1150000);
    expect(doc!.vatAmount).toBe(80500);
    expect(doc!.withholdingAmount).toBe(34500);
    expect(doc!.netPayable).toBe(1196000);
    expect(doc!.items.map((i) => [i.position, i.amount])).toEqual([
      [0, 1000000],
      [1, 150000],
    ]);
    expect(doc!.customerSnapshot.name).toBe('บริษัท ตัวอย่าง จำกัด');
    expect(doc!.childId).toBeNull();
    expect(doc!.parentNumber).toBeNull();
  });

  test('unknown customer is rejected and does not consume a number', async () => {
    await expect(createQuotation(db, sampleInput(999))).rejects.toThrow('ไม่พบลูกค้า');
    const id = await createQuotation(db, sampleInput(customerId));
    expect((await getDocument(db, id))!.number).toBe('QT-2026-0001');
  });

  test('editing the customer later does not change the document snapshot', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    await updateCustomer(db, customerId, {
      name: 'ชื่อใหม่',
      taxId: '',
      branch: 'สำนักงานใหญ่',
      address: 'ที่อยู่ใหม่',
      contactName: '',
      email: '',
      phone: '',
      notes: '',
    });
    const doc = await getDocument(db, id);
    expect(doc!.customerSnapshot.name).toBe('บริษัท ตัวอย่าง จำกัด');
    expect(doc!.customerSnapshot.address).toBe('1 ถนนสุขุมวิท กรุงเทพฯ 10110');
  });
});

describe('updateDocument', () => {
  test('replaces items, recomputes totals and bumps updatedAt', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    const before = await getDocument(db, id);
    await updateDocument(
      db,
      id,
      sampleInput(customerId, {
        vatEnabled: false,
        withholdingEnabled: false,
        items: [
          { description: 'งานเดียว', hoursHundredths: 0, quantityHundredths: 100, unit: '', unitPriceSatang: 500000 },
        ],
      }),
    );
    const after = await getDocument(db, id);
    expect(after!.items).toHaveLength(1);
    expect(after!.netPayable).toBe(500000);
    expect(after!.number).toBe(before!.number);
    expect(after!.updatedAt.getTime()).toBeGreaterThanOrEqual(before!.updatedAt.getTime());
  });

  test('missing document', async () => {
    await expect(updateDocument(db, 999, sampleInput(customerId))).rejects.toThrow('ไม่พบเอกสาร');
  });
});

describe('deleteDocument', () => {
  test('deletes document and items; number is not reused', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    await deleteDocument(db, id);
    expect(await getDocument(db, id)).toBeNull();
    const next = await createQuotation(db, sampleInput(customerId));
    expect((await getDocument(db, next))!.number).toBe('QT-2026-0002');
  });
});

describe('listDocuments', () => {
  test('filters by type, status, customer, and searches number or customer name', async () => {
    const otherCustomer = await seedCustomer(db, { name: 'ร้านกาแฟดี' });
    const a = await createQuotation(db, sampleInput(customerId));
    const b = await createQuotation(db, sampleInput(otherCustomer));
    await db.update(documents).set({ status: 'sent' }).where(eq(documents.id, b));

    expect((await listDocuments(db)).map((d) => d.id)).toEqual([b, a]);
    expect((await listDocuments(db, { status: 'sent' })).map((d) => d.id)).toEqual([b]);
    expect((await listDocuments(db, { type: 'invoice' })).map((d) => d.id)).toEqual([]);
    expect((await listDocuments(db, { customerId })).map((d) => d.id)).toEqual([a]);
    expect((await listDocuments(db, { q: 'กาแฟ' })).map((d) => d.id)).toEqual([b]);
    expect((await listDocuments(db, { q: 'QT-2026-0001' })).map((d) => d.id)).toEqual([a]);
    expect((await listDocuments(db, { q: 'กาแฟ' }))[0].customerName).toBe('ร้านกาแฟดี');
  });
});

describe('hourly items', () => {
  const hourlyInput = (id: number) =>
    sampleInput(id, {
      vatEnabled: false,
      withholdingEnabled: false,
      items: [
        // client-sent price 0 must be ignored for hourly items
        {
          description: 'ทำเว็บขายของ',
          hoursHundredths: 1000,
          quantityHundredths: 100,
          unit: 'งาน',
          unitPriceSatang: 0,
        },
        { description: 'ค่าโดเมน', hoursHundredths: 0, quantityHundredths: 100, unit: 'ปี', unitPriceSatang: 50000 },
      ],
    });

  async function setRate(hourlyRateSatang: number) {
    const s = await getSettings(db);
    await updateSettings(db, { ...s, hourlyRateSatang });
  }

  test('hourly unit price comes from the settings rate and the rate is snapshotted', async () => {
    await setRate(50000);
    const id = await createQuotation(db, hourlyInput(customerId));
    const doc = await getDocument(db, id);
    expect(doc!.hourlyRateSatang).toBe(50000);
    expect(doc!.items.map((i) => [i.hoursHundredths, i.unitPriceSatang, i.amount])).toEqual([
      [1000, 500000, 500000],
      [0, 50000, 50000],
    ]);
    expect(doc!.subtotal).toBe(550000);
  });

  test('raising the rate later keeps existing documents (even when edited); new ones use the new rate', async () => {
    await setRate(50000);
    const id = await createQuotation(db, hourlyInput(customerId));
    await setRate(80000);
    await updateDocument(db, id, hourlyInput(customerId));
    const edited = await getDocument(db, id);
    expect(edited!.hourlyRateSatang).toBe(50000);
    expect(edited!.items[0].unitPriceSatang).toBe(500000);
    const newer = await getDocument(db, await createQuotation(db, hourlyInput(customerId)));
    expect(newer!.hourlyRateSatang).toBe(80000);
    expect(newer!.items[0].unitPriceSatang).toBe(800000);
  });
});

describe('markPdfGenerated', () => {
  test('stores pathname and timestamp', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    await markPdfGenerated(db, id, 'documents/1/QT-2026-0001.pdf');
    const doc = await getDocument(db, id);
    expect(doc!.pdfPathname).toBe('documents/1/QT-2026-0001.pdf');
    expect(doc!.pdfGeneratedAt).toBeInstanceOf(Date);
  });
});
