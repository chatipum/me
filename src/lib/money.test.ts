import { describe, expect, test } from 'bun:test';
import {
  computeTotals,
  divRoundHalfUp,
  formatDecimal2,
  formatQuantity,
  hourlyUnitPrice,
  lineAmount,
  parseDecimal2,
  priceItem,
  toInputString,
} from './money';

describe('divRoundHalfUp', () => {
  test('rounds half up', () => {
    expect(divRoundHalfUp(5, 10)).toBe(1);
    expect(divRoundHalfUp(4, 10)).toBe(0);
    expect(divRoundHalfUp(15, 10)).toBe(2);
    expect(divRoundHalfUp(0, 10)).toBe(0);
  });
});

describe('lineAmount', () => {
  test('whole quantity', () => {
    expect(lineAmount(200, 150000)).toBe(300000); // 2 × 1,500.00
  });
  test('fractional quantity rounds to satang', () => {
    expect(lineAmount(50, 3333)).toBe(1667); // 0.5 × 33.33 = 16.665 → 16.67
    expect(lineAmount(150, 100001)).toBe(150002); // 1.5 × 1,000.01 = 1,500.015 → 1,500.02
  });
});

describe('hourly pricing', () => {
  test('hourlyUnitPrice = hours × rate, rounded half up to satang', () => {
    expect(hourlyUnitPrice(1000, 50000)).toBe(500000); // 10 h × 500.00
    expect(hourlyUnitPrice(25, 33333)).toBe(8333); // 0.25 h × 333.33 = 83.3325 → 83.33
    expect(hourlyUnitPrice(1000, 0)).toBe(0);
  });
  test('priceItem uses hours when > 0, otherwise keeps the entered price', () => {
    expect(priceItem({ hoursHundredths: 1000, unitPriceSatang: 1 }, 50000).unitPriceSatang).toBe(500000);
    expect(priceItem({ hoursHundredths: 0, unitPriceSatang: 120000 }, 50000).unitPriceSatang).toBe(120000);
  });
});

describe('computeTotals', () => {
  const items = [
    { quantityHundredths: 100, unitPriceSatang: 1000000 }, // 10,000.00
    { quantityHundredths: 300, unitPriceSatang: 50000 }, // 1,500.00
  ];

  test('no tax', () => {
    expect(computeTotals({ items, vatEnabled: false, withholdingEnabled: false, withholdingRateBp: 300 })).toEqual({
      subtotal: 1150000,
      vatAmount: 0,
      total: 1150000,
      withholdingAmount: 0,
      netPayable: 1150000,
    });
  });

  test('VAT only', () => {
    expect(computeTotals({ items, vatEnabled: true, withholdingEnabled: false, withholdingRateBp: 300 })).toEqual({
      subtotal: 1150000,
      vatAmount: 80500,
      total: 1230500,
      withholdingAmount: 0,
      netPayable: 1230500,
    });
  });

  test('withholding is computed on pre-VAT subtotal', () => {
    expect(computeTotals({ items, vatEnabled: true, withholdingEnabled: true, withholdingRateBp: 300 })).toEqual({
      subtotal: 1150000,
      vatAmount: 80500,
      total: 1230500,
      withholdingAmount: 34500,
      netPayable: 1196000,
    });
  });

  test('withholding without VAT, custom rate', () => {
    const r = computeTotals({ items, vatEnabled: false, withholdingEnabled: true, withholdingRateBp: 150 });
    expect(r.withholdingAmount).toBe(17250);
    expect(r.netPayable).toBe(1132750);
  });

  test('VAT rounds half up', () => {
    // 0.07 × 1.50 = 0.105 → 0.11
    const r = computeTotals({
      items: [{ quantityHundredths: 100, unitPriceSatang: 150 }],
      vatEnabled: true,
      withholdingEnabled: false,
      withholdingRateBp: 0,
    });
    expect(r.vatAmount).toBe(11);
  });

  test('large amounts stay exact', () => {
    const r = computeTotals({
      items: [{ quantityHundredths: 100, unitPriceSatang: 99_999_999_999 }], // 999,999,999.99
      vatEnabled: true,
      withholdingEnabled: true,
      withholdingRateBp: 300,
    });
    expect(r.subtotal).toBe(99_999_999_999);
    expect(r.vatAmount).toBe(7_000_000_000); // 6,999,999,999.93 → rounds half up
    expect(r.withholdingAmount).toBe(3_000_000_000); // 2,999,999,999.97 → rounds half up
    expect(r.netPayable).toBe(99_999_999_999 + 7_000_000_000 - 3_000_000_000);
  });
});

describe('parseDecimal2', () => {
  test('parses plain and grouped numbers', () => {
    expect(parseDecimal2('1234.5')).toBe(123450);
    expect(parseDecimal2('1,234.50')).toBe(123450);
    expect(parseDecimal2(' 3 ')).toBe(300);
    expect(parseDecimal2('0.01')).toBe(1);
    expect(parseDecimal2('.5')).toBe(50);
  });
  test('rejects invalid input', () => {
    expect(parseDecimal2('')).toBeNull();
    expect(parseDecimal2('abc')).toBeNull();
    expect(parseDecimal2('1.234')).toBeNull();
    expect(parseDecimal2('-5')).toBeNull();
    expect(parseDecimal2('1..2')).toBeNull();
  });
});

describe('formatting', () => {
  test('formatDecimal2', () => {
    expect(formatDecimal2(123450)).toBe('1,234.50');
    expect(formatDecimal2(0)).toBe('0.00');
    expect(formatDecimal2(100000000)).toBe('1,000,000.00');
  });
  test('toInputString', () => {
    expect(toInputString(123450)).toBe('1234.50');
    expect(toInputString(5)).toBe('0.05');
  });
  test('formatQuantity', () => {
    expect(formatQuantity(150)).toBe('1.5');
    expect(formatQuantity(200)).toBe('2');
    expect(formatQuantity(125)).toBe('1.25');
    expect(formatQuantity(100000)).toBe('1,000');
  });
});
