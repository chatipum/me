import { describe, expect, test } from 'bun:test';
import {
  checkPassword,
  createPrintToken,
  createSessionToken,
  isValidSession,
  PRINT_TTL_MS,
  SESSION_TTL_MS,
  safeEqual,
  verifyPrintToken,
  verifySessionToken,
} from './auth';

const SECRET = 'test-secret-that-is-long-enough-123456';
const NOW = 1_800_000_000_000;

describe('session token', () => {
  test('valid until expiry', async () => {
    const token = await createSessionToken(SECRET, NOW);
    expect(await verifySessionToken(SECRET, token, NOW)).toBe(true);
    expect(await verifySessionToken(SECRET, token, NOW + SESSION_TTL_MS)).toBe(true);
    expect(await verifySessionToken(SECRET, token, NOW + SESSION_TTL_MS + 1)).toBe(false);
  });
  test('rejects wrong secret, tampering and garbage', async () => {
    const token = await createSessionToken(SECRET, NOW);
    expect(await verifySessionToken('other-secret', token, NOW)).toBe(false);
    const [exp, sig] = token.split('.');
    expect(await verifySessionToken(SECRET, `${Number(exp) + 1000}.${sig}`, NOW)).toBe(false);
    expect(await verifySessionToken(SECRET, 'garbage', NOW)).toBe(false);
    expect(await verifySessionToken(SECRET, '', NOW)).toBe(false);
    expect(await verifySessionToken(SECRET, `${token}.extra`, NOW)).toBe(false);
  });
});

describe('print token', () => {
  test('bound to document id and short-lived', async () => {
    const token = await createPrintToken(SECRET, 7, NOW);
    expect(await verifyPrintToken(SECRET, 7, token, NOW)).toBe(true);
    expect(await verifyPrintToken(SECRET, 8, token, NOW)).toBe(false);
    expect(await verifyPrintToken(SECRET, 7, token, NOW + PRINT_TTL_MS + 1)).toBe(false);
  });
  test('print token is not a session token and vice versa', async () => {
    const print = await createPrintToken(SECRET, 7, NOW);
    const session = await createSessionToken(SECRET, NOW);
    expect(await verifySessionToken(SECRET, print, NOW)).toBe(false);
    expect(await verifyPrintToken(SECRET, 7, session, NOW)).toBe(false);
  });
});

describe('checkPassword', () => {
  test('matches exactly', async () => {
    expect(await checkPassword('hunter2', 'hunter2')).toBe(true);
    expect(await checkPassword('hunter3', 'hunter2')).toBe(false);
    expect(await checkPassword('', 'hunter2')).toBe(false);
  });
  test('empty expected password never matches', async () => {
    expect(await checkPassword('', '')).toBe(false);
  });
});

test('safeEqual', () => {
  expect(safeEqual('abc', 'abc')).toBe(true);
  expect(safeEqual('abc', 'abd')).toBe(false);
  expect(safeEqual('abc', 'abcd')).toBe(false);
});

describe('isValidSession', () => {
  test('accepts a valid token', async () => {
    const token = await createSessionToken(SECRET, NOW);
    expect(await isValidSession(SECRET, token, NOW)).toBe(true);
  });

  test('rejects missing secret or token', async () => {
    const token = await createSessionToken(SECRET, NOW);
    expect(await isValidSession(undefined, token, NOW)).toBe(false);
    expect(await isValidSession('', token, NOW)).toBe(false);
    expect(await isValidSession(SECRET, undefined, NOW)).toBe(false);
    expect(await isValidSession(SECRET, '', NOW)).toBe(false);
  });

  test('rejects bad, tampered or wrong-secret tokens', async () => {
    const token = await createSessionToken(SECRET, NOW);
    expect(await isValidSession(SECRET, 'garbage', NOW)).toBe(false);
    expect(await isValidSession(SECRET, `${token}0`, NOW)).toBe(false);
    expect(await isValidSession('other-secret', token, NOW)).toBe(false);
  });

  test('rejects expired token', async () => {
    const token = await createSessionToken(SECRET, NOW);
    expect(await isValidSession(SECRET, token, NOW + SESSION_TTL_MS + 1)).toBe(false);
  });
});
