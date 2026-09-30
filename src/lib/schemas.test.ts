import { describe, expect, test } from 'bun:test';
import { customerInput, documentInput } from './schemas';

const validCustomer = {
  name: ' บริษัท เอ ',
  taxId: '0105551234567',
  branch: 'สำนักงานใหญ่',
  address: '',
  contactName: '',
  email: '',
  phone: '',
  notes: '',
};

describe('customerInput', () => {
  test('trims and accepts valid data', () => {
    expect(customerInput.parse(validCustomer).name).toBe('บริษัท เอ');
  });
  test('tax id must be empty or 13 digits', () => {
    expect(customerInput.safeParse({ ...validCustomer, taxId: '' }).success).toBe(true);
    expect(customerInput.safeParse({ ...validCustomer, taxId: '123' }).success).toBe(false);
  });
  test('name required, email validated', () => {
    expect(customerInput.safeParse({ ...validCustomer, name: '  ' }).success).toBe(false);
    expect(customerInput.safeParse({ ...validCustomer, email: 'nope' }).success).toBe(false);
    expect(customerInput.safeParse({ ...validCustomer, email: 'a@b.co' }).success).toBe(true);
  });
});

describe('documentInput', () => {
  const base = {
    customerId: 1,
    issueDate: '2026-09-29',
    validUntil: '2026-10-29',
    dueDate: null,
    paidDate: null,
    paymentMethod: null,
    vatEnabled: false,
    withholdingEnabled: false,
    withholdingRateBp: 300,
    notes: '',
    items: [{ description: 'งาน', hoursHundredths: 0, quantityHundredths: 100, unit: '', unitPriceSatang: 1000 }],
  };
  test('valid', () => {
    expect(documentInput.safeParse(base).success).toBe(true);
  });
  test('needs at least one item', () => {
    expect(documentInput.safeParse({ ...base, items: [] }).success).toBe(false);
  });
  test('rejects bad dates, zero quantity, negative price, rate over 100%', () => {
    expect(documentInput.safeParse({ ...base, issueDate: '29/09/2026' }).success).toBe(false);
    expect(documentInput.safeParse({ ...base, items: [{ ...base.items[0], quantityHundredths: 0 }] }).success).toBe(
      false,
    );
    expect(documentInput.safeParse({ ...base, items: [{ ...base.items[0], unitPriceSatang: -1 }] }).success).toBe(
      false,
    );
    expect(documentInput.safeParse({ ...base, withholdingRateBp: 10001 }).success).toBe(false);
    expect(documentInput.safeParse({ ...base, items: [{ ...base.items[0], hoursHundredths: -1 }] }).success).toBe(
      false,
    );
  });
});
