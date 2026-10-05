import { describe, expect, test } from 'bun:test';
import { customerInput, documentInput, settingsInput } from './schemas';

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
    items: [
      {
        description: 'งาน',
        hoursHundredths: 0,
        quantityHundredths: 100,
        unit: '',
        unitPriceSatang: 1000,
        withholding: true,
      },
    ],
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

describe('settingsInput signature', () => {
  const base = {
    businessName: 'สตูดิโอ',
    address: '',
    taxId: '',
    phone: '',
    email: '',
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: '',
    defaultWithholdingRateBp: 300,
    defaultQuoteValidityDays: 30,
    defaultInvoiceDueDays: 30,
    defaultNotes: '',
    hourlyRateSatang: 0,
  };
  const png = 'data:image/png;base64,';
  test('empty signature is allowed', () => {
    expect(settingsInput.safeParse({ ...base, signatureDataUrl: '' }).success).toBe(true);
  });
  test('png data URL is allowed up to the length limit', () => {
    expect(settingsInput.safeParse({ ...base, signatureDataUrl: `${png}iVBORw0KGgo=` }).success).toBe(true);
    const atLimit = png + 'A'.repeat(280_000 - png.length);
    expect(settingsInput.safeParse({ ...base, signatureDataUrl: atLimit }).success).toBe(true);
  });
  test('rejects other image types, plain text and over-length values', () => {
    expect(settingsInput.safeParse({ ...base, signatureDataUrl: 'data:image/jpeg;base64,/9j/' }).success).toBe(false);
    expect(settingsInput.safeParse({ ...base, signatureDataUrl: 'hello' }).success).toBe(false);
    const tooLong = png + 'A'.repeat(280_001 - png.length);
    expect(settingsInput.safeParse({ ...base, signatureDataUrl: tooLong }).success).toBe(false);
  });
});
