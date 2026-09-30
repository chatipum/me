import { expect, test } from 'bun:test';
import { pdfPathname } from './storage';

test('pdf pathname is stable per document so regenerating overwrites', () => {
  expect(pdfPathname({ id: 12, number: 'QT-2026-0001' })).toBe('documents/12/QT-2026-0001.pdf');
});
