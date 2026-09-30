'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { type TimeEntryInput, timeEntryInput } from '@/lib/schemas';
import { type ActionResult, runAction } from '@/server/action-result';
import { createTimeEntry, deleteTimeEntry, startTimer, stopTimer, updateTimeEntry } from '@/server/time';

async function run(fn: () => Promise<void>): Promise<ActionResult<void>> {
  const result = await runAction(fn);
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

export async function startTimerAction(documentId: number) {
  return run(() => startTimer(getDb(), documentId));
}

export async function stopTimerAction() {
  return run(() => stopTimer(getDb()));
}

export async function createTimeEntryAction(documentId: number, input: TimeEntryInput) {
  return run(() => createTimeEntry(getDb(), documentId, timeEntryInput.parse(input)));
}

export async function updateTimeEntryAction(id: number, input: TimeEntryInput) {
  return run(() => updateTimeEntry(getDb(), id, timeEntryInput.parse(input)));
}

export async function deleteTimeEntryAction(id: number) {
  return run(() => deleteTimeEntry(getDb(), id));
}
