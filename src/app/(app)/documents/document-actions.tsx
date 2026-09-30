'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { buttonClass, inputClass, secondaryButtonClass } from '@/components/field';
import { todayIso } from '@/lib/dates';
import {
  allowedTransitions,
  type DocStatus,
  type DocType,
  isLocked,
  nextConversion,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  type PaymentMethod,
  STATUS_LABEL,
  TYPE_LABEL,
} from '@/lib/doc-status';
import type { ActionResult } from '@/server/action-result';
import {
  convertToInvoiceAction,
  convertToReceiptAction,
  deleteDocumentAction,
  duplicateAction,
  setStatusAction,
} from './actions';

export function DocumentActions({
  id,
  type,
  status,
  hasChild,
  hasPdf,
  pdfStale,
}: {
  id: number;
  type: DocType;
  status: DocStatus;
  hasChild: boolean;
  hasPdf: boolean;
  pdfStale: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [paidDate, setPaidDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const conversion = nextConversion(type, status, hasChild);

  function run(action: () => Promise<ActionResult<unknown> | undefined>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) setError(result.error);
    });
  }

  function generatePdf() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/documents/${id}/pdf`, { method: 'POST' });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? 'สร้าง PDF ไม่สำเร็จ ลองใหม่อีกครั้ง');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-slate-100 px-2 py-1 text-sm font-bold">{STATUS_LABEL[status]}</span>
        {allowedTransitions(type, status, hasChild).map((to) => (
          <button
            type="button"
            key={to}
            disabled={pending}
            onClick={() => run(() => setStatusAction(id, to))}
            className={secondaryButtonClass}
          >
            → {STATUS_LABEL[to]}
          </button>
        ))}
        {!isLocked(hasChild) && (
          <Link href={`/documents/${id}/edit`} className={secondaryButtonClass}>
            แก้ไข
          </Link>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => duplicateAction(id))}
          className={secondaryButtonClass}
        >
          คัดลอกเป็นใบเสนอราคาใหม่
        </button>
        {!isLocked(hasChild) && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              confirm(type === 'quotation' ? 'ลบเอกสารนี้? เวลาที่จับไว้ของงานนี้จะถูกลบด้วย' : 'ลบเอกสารนี้?') &&
              run(() => deleteDocumentAction(id))
            }
            className={`${secondaryButtonClass} text-red-600`}
          >
            ลบ
          </button>
        )}
      </div>

      {conversion === 'invoice' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => convertToInvoiceAction(id))}
          className={buttonClass}
        >
          แปลงเป็น{TYPE_LABEL.invoice}
        </button>
      )}
      {conversion === 'receipt' && (
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            className={`${inputClass} w-44`}
          />
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className={`${inputClass} w-32`}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => convertToReceiptAction(id, { paidDate, paymentMethod }))}
            className={buttonClass}
          >
            รับเงินแล้ว → ออก{TYPE_LABEL.receipt}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button type="button" disabled={pending} onClick={generatePdf} className={buttonClass}>
          {pending ? 'กำลังทำงาน…' : hasPdf ? 'สร้าง PDF ใหม่' : 'สร้าง PDF'}
        </button>
        {hasPdf && (
          <a href={`/api/documents/${id}/pdf`} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
            ดาวน์โหลด PDF
          </a>
        )}
        {pdfStale && <span className="rounded bg-amber-100 px-2 py-1 text-sm text-amber-800">PDF ไม่ตรงกับข้อมูลล่าสุด</span>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
