'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { todayIso } from '@/lib/dates';
import type { DocStatus, PaymentMethod } from '@/lib/doc-status';
import { PAYMENT_METHODS } from '@/lib/doc-status';
import { type DocumentInput, documentInput } from '@/lib/schemas';
import { convertToInvoice, convertToReceipt, duplicateAsQuotation, setQuotationStatus } from '@/server/document-flow';
import { createQuotation, deleteDocument, updateDocument } from '@/server/documents';
import { DomainError } from '@/server/errors';
import { runAuthedAction } from '@/server/session';

function goTo(id: number): never {
  revalidatePath('/', 'layout');
  redirect(`/documents/${id}`);
}

export async function createQuotationAction(input: DocumentInput) {
  const result = await runAuthedAction(() => createQuotation(getDb(), documentInput.parse(input)));
  if (!result.ok) return result;
  goTo(result.data);
}

export async function updateDocumentAction(id: number, input: DocumentInput) {
  const result = await runAuthedAction(() => updateDocument(getDb(), id, documentInput.parse(input)));
  if (!result.ok) return result;
  goTo(id);
}

export async function setStatusAction(id: number, to: DocStatus) {
  const result = await runAuthedAction(() => setQuotationStatus(getDb(), id, to));
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

export async function convertToInvoiceAction(id: number) {
  const result = await runAuthedAction(() => convertToInvoice(getDb(), id, todayIso()));
  if (!result.ok) return result;
  goTo(result.data);
}

export async function convertToReceiptAction(id: number, payment: { paidDate: string; paymentMethod: PaymentMethod }) {
  const result = await runAuthedAction(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payment.paidDate) || !PAYMENT_METHODS.includes(payment.paymentMethod)) {
      throw new DomainError('กรุณาระบุวันที่รับเงินและวิธีชำระ');
    }
    return convertToReceipt(getDb(), id, payment, todayIso());
  });
  if (!result.ok) return result;
  goTo(result.data);
}

export async function duplicateAction(id: number) {
  const result = await runAuthedAction(() => duplicateAsQuotation(getDb(), id, todayIso()));
  if (!result.ok) return result;
  goTo(result.data);
}

export async function deleteDocumentAction(id: number) {
  const result = await runAuthedAction(() => deleteDocument(getDb(), id));
  if (!result.ok) return result;
  revalidatePath('/', 'layout');
  redirect('/');
}
