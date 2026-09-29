import { describe, expect, test } from 'bun:test';
import { allowedTransitions, INITIAL_STATUS, isLocked, nextConversion } from './doc-status';

describe('INITIAL_STATUS', () => {
  test('per type', () => {
    expect(INITIAL_STATUS).toEqual({ quotation: 'draft', invoice: 'unpaid', receipt: 'issued' });
  });
});

describe('allowedTransitions', () => {
  test('quotation flow', () => {
    expect(allowedTransitions('quotation', 'draft', false)).toEqual(['sent']);
    expect(allowedTransitions('quotation', 'sent', false)).toEqual(['accepted', 'rejected', 'draft']);
    expect(allowedTransitions('quotation', 'accepted', false)).toEqual(['draft']);
    expect(allowedTransitions('quotation', 'rejected', false)).toEqual(['draft']);
  });
  test('converted quotation cannot change status', () => {
    expect(allowedTransitions('quotation', 'accepted', true)).toEqual([]);
  });
  test('invoice and receipt have no manual transitions', () => {
    expect(allowedTransitions('invoice', 'unpaid', false)).toEqual([]);
    expect(allowedTransitions('receipt', 'issued', false)).toEqual([]);
  });
});

describe('nextConversion', () => {
  test('accepted quotation → invoice', () => {
    expect(nextConversion('quotation', 'accepted', false)).toBe('invoice');
  });
  test('unpaid invoice → receipt', () => {
    expect(nextConversion('invoice', 'unpaid', false)).toBe('receipt');
  });
  test('blocked when not accepted, already converted, or receipt', () => {
    expect(nextConversion('quotation', 'sent', false)).toBeNull();
    expect(nextConversion('quotation', 'accepted', true)).toBeNull();
    expect(nextConversion('invoice', 'paid', false)).toBeNull();
    expect(nextConversion('invoice', 'unpaid', true)).toBeNull();
    expect(nextConversion('receipt', 'issued', false)).toBeNull();
  });
});

test('isLocked', () => {
  expect(isLocked(true)).toBe(true);
  expect(isLocked(false)).toBe(false);
});
