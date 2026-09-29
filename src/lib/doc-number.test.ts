import { expect, test } from 'bun:test';
import { formatDocNumber } from './doc-number';

test('formats with type prefix, year and 4-digit sequence', () => {
  expect(formatDocNumber('quotation', 2026, 1)).toBe('QT-2026-0001');
  expect(formatDocNumber('invoice', 2026, 42)).toBe('INV-2026-0042');
  expect(formatDocNumber('receipt', 2027, 12345)).toBe('RC-2027-12345');
});
