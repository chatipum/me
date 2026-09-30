'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/auth';
import { requireEnv } from '@/lib/env';

export async function loginAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = String(formData.get('password') ?? '');
  if (!(await checkPassword(password, requireEnv('APP_PASSWORD')))) {
    return 'รหัสผ่านไม่ถูกต้อง';
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionToken(requireEnv('SESSION_SECRET')), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect('/login');
}
