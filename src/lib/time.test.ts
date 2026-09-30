import { describe, expect, test } from 'bun:test';
import {
  bangkokDateTime,
  entryMinutes,
  estimatedMinutes,
  formatDuration,
  formatElapsed,
  toBangkokParts,
  variancePercent,
} from './time';

describe('entryMinutes', () => {
  test('whole minutes between start and end', () => {
    expect(entryMinutes(new Date('2026-09-29T02:00:00Z'), new Date('2026-09-29T04:30:59Z'))).toBe(150);
  });
  test('running entry counts up to now', () => {
    const now = new Date('2026-09-29T03:00:00Z');
    expect(entryMinutes(new Date('2026-09-29T02:00:00Z'), null, now)).toBe(60);
  });
  test('never negative', () => {
    expect(entryMinutes(new Date('2026-09-29T02:00:00Z'), new Date('2026-09-29T01:00:00Z'))).toBe(0);
  });
});

describe('estimatedMinutes', () => {
  test('sums hours × quantity of hourly items only', () => {
    expect(
      estimatedMinutes([
        { hoursHundredths: 1000, quantityHundredths: 100 }, // 10 h
        { hoursHundredths: 0, quantityHundredths: 100 }, // fixed price
        { hoursHundredths: 150, quantityHundredths: 200 }, // 1.5 h × 2 = 3 h
      ]),
    ).toBe(780);
  });
});

describe('variancePercent', () => {
  test('over and under estimate', () => {
    expect(variancePercent(750, 600)).toBe(25);
    expect(variancePercent(450, 600)).toBe(-25);
    expect(variancePercent(600, 600)).toBe(0);
  });
  test('no estimate → null', () => {
    expect(variancePercent(100, 0)).toBeNull();
  });
});

describe('formatting', () => {
  test('formatDuration', () => {
    expect(formatDuration(750)).toBe('12:30');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(0)).toBe('0:00');
  });
  test('formatElapsed', () => {
    expect(formatElapsed(5_025_000)).toBe('01:23:45');
    expect(formatElapsed(-10)).toBe('00:00:00');
  });
});

describe('Bangkok time conversion', () => {
  test('bangkokDateTime', () => {
    expect(bangkokDateTime('2026-09-29', '09:00').toISOString()).toBe('2026-09-29T02:00:00.000Z');
  });
  test('toBangkokParts crosses midnight', () => {
    expect(toBangkokParts(new Date('2026-09-29T17:30:00Z'))).toEqual({ date: '2026-09-30', time: '00:30' });
  });
});
