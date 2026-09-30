'use client';

import { useState, useTransition } from 'react';
import type { CustomerInput } from '@/lib/schemas';
import type { ActionResult } from '@/server/action-result';
import { buttonClass, Field, inputClass, secondaryButtonClass } from './field';

export const EMPTY_CUSTOMER: CustomerInput = {
  name: '',
  taxId: '',
  branch: 'สำนักงานใหญ่',
  address: '',
  contactName: '',
  email: '',
  phone: '',
  notes: '',
};

const FIELDS: { key: keyof CustomerInput; label: string; multiline?: boolean }[] = [
  { key: 'name', label: 'ชื่อลูกค้า / บริษัท' },
  { key: 'taxId', label: 'เลขประจำตัวผู้เสียภาษี (13 หลัก)' },
  { key: 'branch', label: 'สาขา' },
  { key: 'address', label: 'ที่อยู่', multiline: true },
  { key: 'contactName', label: 'ผู้ติดต่อ' },
  { key: 'email', label: 'อีเมล' },
  { key: 'phone', label: 'โทรศัพท์' },
  { key: 'notes', label: 'หมายเหตุ', multiline: true },
];

export function CustomerForm({
  initial,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  initial: CustomerInput;
  onSubmit: (input: CustomerInput) => Promise<ActionResult<unknown>>;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    startTransition(async () => {
      const result = await onSubmit(values);
      if (result && !result.ok) {
        setErrors(result.fieldErrors ?? {});
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ key, label, multiline }) => (
          <div key={key} className={multiline ? 'sm:col-span-2' : undefined}>
            <Field label={label} error={errors[key]}>
              {multiline ? (
                <textarea
                  rows={3}
                  className={inputClass}
                  value={values[key]}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                />
              ) : (
                <input
                  className={inputClass}
                  value={values[key]}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                />
              )}
            </Field>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            ยกเลิก
          </button>
        )}
      </div>
    </form>
  );
}
