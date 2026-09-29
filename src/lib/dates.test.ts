import { describe, expect, test } from 'bun:test';
import { addDays, formatThaiDate, todayIso } from './dates';

describe('todayIso', () => {
  test('uses Bangkok time zone', () => {
    expect(todayIso(new Date('2026-09-29T16:59:00Z'))).toBe('2026-09-29');
    expect(todayIso(new Date('2026-09-29T17:00:00Z'))).toBe('2026-09-30');
    expect(todayIso(new Date('2026-09-29T20:00:00Z'))).toBe('2026-09-30');
  });
});

describe('addDays', () => {
  test('crosses month and year boundaries', () => {
    expect(addDays('2026-09-29', 30)).toBe('2026-10-29');
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('formatThaiDate', () => {
  test('Buddhist era with Thai month', () => {
    expect(formatThaiDate('2026-09-29')).toBe('29 กันยายน 2569');
    expect(formatThaiDate('2027-01-05')).toBe('5 มกราคม 2570');
  });
});
