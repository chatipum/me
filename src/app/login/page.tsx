'use client';

import { useActionState } from 'react';
import { buttonClass, Field, inputClass } from '@/components/field';
import { loginAction } from './actions';

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, null);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-bold">เข้าสู่ระบบ</h1>
        <Field label="รหัสผ่าน" error={error ?? undefined}>
          {/* biome-ignore lint/a11y/noAutofocus: login page has a single field */}
          <input name="password" type="password" required autoFocus className={inputClass} />
        </Field>
        <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
          {pending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </main>
  );
}
