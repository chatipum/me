import { cookies } from 'next/headers';
import { isValidSession, SESSION_COOKIE } from '@/lib/auth';
import { type ActionResult, runAction } from './action-result';
import { DomainError } from './errors';

export async function hasSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidSession(process.env.SESSION_SECRET, cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<void> {
  if (!(await hasSession())) throw new DomainError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
}

// runAction + session check; unauthenticated calls resolve to { ok: false, error }.
export function runAuthedAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  return runAction(async () => {
    await requireSession();
    return fn();
  });
}
