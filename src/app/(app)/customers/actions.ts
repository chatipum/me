'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { type CustomerInput, customerInput } from '@/lib/schemas';
import { createCustomer, updateCustomer } from '@/server/customers';
import { runAuthedAction } from '@/server/session';

export async function createCustomerAction(input: CustomerInput) {
  const result = await runAuthedAction(() => createCustomer(getDb(), customerInput.parse(input)));
  if (!result.ok) return result;
  revalidatePath('/customers');
  redirect(`/customers/${result.data.id}`);
}

export async function updateCustomerAction(id: number, input: CustomerInput) {
  const result = await runAuthedAction(() => updateCustomer(getDb(), id, customerInput.parse(input)));
  if (result.ok) revalidatePath(`/customers/${id}`);
  return result;
}

export async function quickCreateCustomerAction(input: CustomerInput) {
  return runAuthedAction(async () => {
    const customer = await createCustomer(getDb(), customerInput.parse(input));
    revalidatePath('/customers');
    return { id: customer.id, name: customer.name };
  });
}
