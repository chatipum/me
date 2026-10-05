import { beforeEach, describe, expect, test } from 'bun:test';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { createCustomer, getCustomer, listCustomers, updateCustomer } from './customers';
import { getSettings, updateSettings } from './settings';

const input = {
  name: 'บริษัท บี จำกัด',
  taxId: '',
  branch: 'สำนักงานใหญ่',
  address: 'เชียงใหม่',
  contactName: '',
  email: '',
  phone: '',
  notes: '',
};

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('customers', () => {
  test('create, get, update, list with search', async () => {
    const created = await createCustomer(db, input);
    expect((await getCustomer(db, created.id))?.address).toBe('เชียงใหม่');
    await updateCustomer(db, created.id, { ...input, address: 'ลำพูน' });
    expect((await getCustomer(db, created.id))?.address).toBe('ลำพูน');
    await createCustomer(db, { ...input, name: 'ร้านซี' });
    expect((await listCustomers(db)).map((c) => c.name)).toEqual(['บริษัท บี จำกัด', 'ร้านซี']);
    expect((await listCustomers(db, 'ซี')).map((c) => c.name)).toEqual(['ร้านซี']);
  });
  test('getCustomer returns null when missing', async () => {
    expect(await getCustomer(db, 999)).toBeNull();
  });
});

describe('settings', () => {
  test('defaults exist on first read and can be updated', async () => {
    const s = await getSettings(db);
    expect(s.defaultWithholdingRateBp).toBe(300);
    await updateSettings(db, { ...s, businessName: 'สตูดิโอของฉัน', defaultQuoteValidityDays: 15 });
    const updated = await getSettings(db);
    expect(updated.businessName).toBe('สตูดิโอของฉัน');
    expect(updated.defaultQuoteValidityDays).toBe(15);
  });
  test('signature defaults to empty and can be stored', async () => {
    const s = await getSettings(db);
    expect(s.signatureDataUrl).toBe('');
    await updateSettings(db, { ...s, signatureDataUrl: 'data:image/png;base64,AAAA' });
    expect((await getSettings(db)).signatureDataUrl).toBe('data:image/png;base64,AAAA');
  });
});
