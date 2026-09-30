import { eq } from 'drizzle-orm';
import { type Settings, settings } from '@/db/schema';
import type { Db } from '@/db/types';
import type { SettingsInput } from '@/lib/schemas';

export async function getSettings(db: Db): Promise<Settings> {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return row;
}

export async function updateSettings(db: Db, input: SettingsInput): Promise<void> {
  await getSettings(db);
  await db.update(settings).set(input).where(eq(settings.id, 1));
}
