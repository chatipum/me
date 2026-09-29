export const SESSION_COOKIE = 'session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PRINT_TTL_MS = 60 * 1000;

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data))));
}

async function sha256Hex(data: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(data))));
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function makeToken(secret: string, scope: string, ttlMs: number, now: number): Promise<string> {
  const exp = now + ttlMs;
  return `${exp}.${await hmacHex(secret, `${scope}:${exp}`)}`;
}

async function checkToken(secret: string, scope: string, token: string, now: number): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const exp = Number(parts[0]);
  if (!Number.isSafeInteger(exp) || exp < now) return false;
  return safeEqual(parts[1], await hmacHex(secret, `${scope}:${exp}`));
}

export function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  return makeToken(secret, 'session', SESSION_TTL_MS, now);
}

export function verifySessionToken(secret: string, token: string, now = Date.now()): Promise<boolean> {
  return checkToken(secret, 'session', token, now);
}

export function createPrintToken(secret: string, docId: number, now = Date.now()): Promise<string> {
  return makeToken(secret, `print:${docId}`, PRINT_TTL_MS, now);
}

export function verifyPrintToken(secret: string, docId: number, token: string, now = Date.now()): Promise<boolean> {
  return checkToken(secret, `print:${docId}`, token, now);
}

export async function checkPassword(input: string, expected: string): Promise<boolean> {
  if (!expected) return false;
  const [a, b] = await Promise.all([sha256Hex(input), sha256Hex(expected)]);
  return safeEqual(a, b);
}
