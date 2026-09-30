import { beforeEach, describe, expect, test } from 'bun:test';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { sampleInput, seedCustomer } from '@/test/fixtures';
import { convertToInvoice, convertToReceipt, duplicateAsQuotation, setQuotationStatus } from './document-flow';
import { createQuotation, deleteDocument, getDocument, updateDocument } from './documents';
import { getSettings, updateSettings } from './settings';

const TODAY = '2026-10-05';
let db: Db;
let customerId: number;

beforeEach(async () => {
  db = await createTestDb();
  customerId = await seedCustomer(db);
});

async function acceptedQuotation(): Promise<number> {
  const id = await createQuotation(db, sampleInput(customerId));
  await setQuotationStatus(db, id, 'sent');
  await setQuotationStatus(db, id, 'accepted');
  return id;
}

describe('setQuotationStatus', () => {
  test('follows allowed transitions', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    await setQuotationStatus(db, id, 'sent');
    expect((await getDocument(db, id))!.status).toBe('sent');
    await expect(setQuotationStatus(db, id, 'paid')).rejects.toThrow('เปลี่ยนสถานะนี้ไม่ได้');
  });
  test('draft cannot jump to accepted', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    await expect(setQuotationStatus(db, id, 'accepted')).rejects.toThrow('เปลี่ยนสถานะนี้ไม่ได้');
  });
  test('status change does not mark the PDF stale', async () => {
    const id = await createQuotation(db, sampleInput(customerId));
    const before = (await getDocument(db, id))!.updatedAt;
    await setQuotationStatus(db, id, 'sent');
    expect((await getDocument(db, id))!.updatedAt).toEqual(before);
  });
});

describe('convertToInvoice', () => {
  test('copies items, taxes and snapshot; due date from settings', async () => {
    const qt = await acceptedQuotation();
    const inv = await convertToInvoice(db, qt, TODAY);
    const doc = await getDocument(db, inv);
    expect(doc!.type).toBe('invoice');
    expect(doc!.number).toBe('INV-2026-0001');
    expect(doc!.status).toBe('unpaid');
    expect(doc!.issueDate).toBe(TODAY);
    expect(doc!.dueDate).toBe('2026-11-04');
    expect(doc!.validUntil).toBeNull();
    expect(doc!.netPayable).toBe(1196000);
    expect(doc!.items).toHaveLength(2);
    expect(doc!.parentNumber).toBe('QT-2026-0001');
    expect((await getDocument(db, qt))!.childId).toBe(inv);
  });

  test('requires accepted quotation', async () => {
    const qt = await createQuotation(db, sampleInput(customerId));
    await expect(convertToInvoice(db, qt, TODAY)).rejects.toThrow('แปลงเอกสารนี้ไม่ได้');
  });

  test('second conversion is rejected (double click)', async () => {
    const qt = await acceptedQuotation();
    await convertToInvoice(db, qt, TODAY);
    await expect(convertToInvoice(db, qt, TODAY)).rejects.toThrow('แปลงเอกสารนี้ไม่ได้');
  });

  test('converted quotation is locked', async () => {
    const qt = await acceptedQuotation();
    await convertToInvoice(db, qt, TODAY);
    await expect(updateDocument(db, qt, sampleInput(customerId))).rejects.toThrow('แก้ไขหรือลบไม่ได้');
    await expect(deleteDocument(db, qt)).rejects.toThrow('แก้ไขหรือลบไม่ได้');
    await expect(setQuotationStatus(db, qt, 'draft')).rejects.toThrow('เปลี่ยนสถานะนี้ไม่ได้');
  });
});

describe('convertToReceipt', () => {
  test('creates receipt and marks invoice paid atomically', async () => {
    const inv = await convertToInvoice(db, await acceptedQuotation(), TODAY);
    const rc = await convertToReceipt(db, inv, { paidDate: '2026-10-10', paymentMethod: 'transfer' }, TODAY);
    const receipt = await getDocument(db, rc);
    expect(receipt!.type).toBe('receipt');
    expect(receipt!.number).toBe('RC-2026-0001');
    expect(receipt!.status).toBe('issued');
    expect(receipt!.paidDate).toBe('2026-10-10');
    expect(receipt!.paymentMethod).toBe('transfer');
    expect(receipt!.dueDate).toBeNull();
    expect((await getDocument(db, inv))!.status).toBe('paid');
  });

  test('deleting the receipt reopens the invoice for a new receipt', async () => {
    const inv = await convertToInvoice(db, await acceptedQuotation(), TODAY);
    const rc = await convertToReceipt(db, inv, { paidDate: TODAY, paymentMethod: 'cash' }, TODAY);
    await deleteDocument(db, rc);
    expect((await getDocument(db, inv))!.status).toBe('unpaid');
    const rc2 = await convertToReceipt(db, inv, { paidDate: TODAY, paymentMethod: 'cash' }, TODAY);
    expect((await getDocument(db, rc2))!.number).toBe('RC-2026-0002');
  });

  test('cannot convert a quotation straight to receipt', async () => {
    const qt = await acceptedQuotation();
    await expect(convertToReceipt(db, qt, { paidDate: TODAY, paymentMethod: 'cash' }, TODAY)).rejects.toThrow(
      'แปลงเอกสารนี้ไม่ได้',
    );
  });
});

describe('duplicateAsQuotation', () => {
  test('creates a new draft quotation with fresh number and dates', async () => {
    const inv = await convertToInvoice(db, await acceptedQuotation(), TODAY);
    const copy = await duplicateAsQuotation(db, inv, TODAY);
    const doc = await getDocument(db, copy);
    expect(doc!.type).toBe('quotation');
    expect(doc!.status).toBe('draft');
    expect(doc!.number).toBe('QT-2026-0002');
    expect(doc!.issueDate).toBe(TODAY);
    expect(doc!.validUntil).toBe('2026-11-04');
    expect(doc!.parentId).toBeNull();
    expect(doc!.items.map((i) => i.description)).toEqual(['ออกแบบเว็บไซต์', 'ดูแลระบบรายเดือน']);
  });

  test('conversion keeps the quotation rate; duplicate uses the current rate', async () => {
    const s = await getSettings(db);
    await updateSettings(db, { ...s, hourlyRateSatang: 50000 });
    const qt = await createQuotation(
      db,
      sampleInput(customerId, {
        items: [{ description: 'ทำเว็บ', hoursHundredths: 1000, quantityHundredths: 100, unit: '', unitPriceSatang: 0 }],
      }),
    );
    await setQuotationStatus(db, qt, 'sent');
    await setQuotationStatus(db, qt, 'accepted');
    await updateSettings(db, { ...s, hourlyRateSatang: 80000 });

    const invoice = await getDocument(db, await convertToInvoice(db, qt, TODAY));
    expect(invoice!.hourlyRateSatang).toBe(50000);
    expect(invoice!.items[0].hoursHundredths).toBe(1000);
    expect(invoice!.items[0].unitPriceSatang).toBe(500000);

    const copy = await getDocument(db, await duplicateAsQuotation(db, qt, TODAY));
    expect(copy!.hourlyRateSatang).toBe(80000);
    expect(copy!.items[0].unitPriceSatang).toBe(800000);
  });
});
