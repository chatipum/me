import { ZodError } from 'zod';
import { DomainError } from './errors';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Do not call redirect() inside fn: the redirect error would be caught here.
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) fieldErrors[issue.path.join('.')] ??= issue.message;
      return { ok: false, error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบ', fieldErrors };
    }
    if (error instanceof DomainError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' };
  }
}
