import { connection } from 'next/server';
import { getDb } from '@/db/client';
import { getSettings } from '@/server/settings';
import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  await connection(); // reads DB: never prerender at build
  const settings = await getSettings(getDb());
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ตั้งค่า</h1>
      <SettingsForm initial={settings} />
    </div>
  );
}
