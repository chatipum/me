'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { type SettingsInput, settingsInput } from '@/lib/schemas';
import { runAction } from '@/server/action-result';
import { updateSettings } from '@/server/settings';

export async function updateSettingsAction(input: SettingsInput) {
  const result = await runAction(() => updateSettings(getDb(), settingsInput.parse(input)));
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}
