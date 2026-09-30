'use client';

import { useState, useTransition } from 'react';
import { buttonClass, Field, inputClass } from '@/components/field';
import type { Settings } from '@/db/schema';
import { parseDecimal2, toInputString } from '@/lib/money';
import { updateSettingsAction } from './actions';

type TextKey =
  | 'businessName'
  | 'address'
  | 'taxId'
  | 'phone'
  | 'email'
  | 'bankName'
  | 'bankAccountName'
  | 'bankAccountNumber'
  | 'defaultNotes';

const TEXT_FIELDS: { key: TextKey; label: string; multiline?: boolean }[] = [
  { key: 'businessName', label: 'ชื่อผู้ออกเอกสาร' },
  { key: 'address', label: 'ที่อยู่', multiline: true },
  { key: 'taxId', label: 'เลขประจำตัวผู้เสียภาษี' },
  { key: 'phone', label: 'โทรศัพท์' },
  { key: 'email', label: 'อีเมล' },
  { key: 'bankName', label: 'ธนาคาร' },
  { key: 'bankAccountName', label: 'ชื่อบัญชี' },
  { key: 'bankAccountNumber', label: 'เลขที่บัญชี' },
  { key: 'defaultNotes', label: 'หมายเหตุเริ่มต้น', multiline: true },
];

export function SettingsForm({ initial }: { initial: Settings }) {
  const [values, setValues] = useState(initial);
  const [rate, setRate] = useState(toInputString(initial.defaultWithholdingRateBp));
  const [hourlyRate, setHourlyRate] = useState(toInputString(initial.hourlyRateSatang));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const rateBp = parseDecimal2(rate);
    const hourlyRateSatang = parseDecimal2(hourlyRate);
    if (rateBp === null || hourlyRateSatang === null) {
      setErrors({
        ...(rateBp === null && { defaultWithholdingRateBp: 'ตัวเลขไม่ถูกต้อง' }),
        ...(hourlyRateSatang === null && { hourlyRateSatang: 'ตัวเลขไม่ถูกต้อง' }),
      });
      return;
    }
    startTransition(async () => {
      const { id: _id, ...rest } = values;
      const result = await updateSettingsAction({ ...rest, defaultWithholdingRateBp: rateBp, hourlyRateSatang });
      setErrors(result.ok ? {} : (result.fieldErrors ?? {}));
      setMessage(result.ok ? 'บันทึกแล้ว' : result.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg bg-white p-6 shadow">
      {TEXT_FIELDS.map(({ key, label, multiline }) => (
        <Field key={key} label={label} error={errors[key]}>
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
      ))}
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="ค่าตัวต่อชั่วโมง (บาท)" error={errors.hourlyRateSatang}>
          <input
            className={inputClass}
            inputMode="decimal"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
          />
        </Field>
        <Field label="หัก ณ ที่จ่ายเริ่มต้น (%)" error={errors.defaultWithholdingRateBp}>
          <input className={inputClass} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field label="ยืนราคา (วัน)" error={errors.defaultQuoteValidityDays}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={values.defaultQuoteValidityDays}
            onChange={(e) => setValues({ ...values, defaultQuoteValidityDays: Number(e.target.value) })}
          />
        </Field>
        <Field label="ครบกำหนดชำระ (วัน)" error={errors.defaultInvoiceDueDays}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={values.defaultInvoiceDueDays}
            onChange={(e) => setValues({ ...values, defaultInvoiceDueDays: Number(e.target.value) })}
          />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          บันทึก
        </button>
        {message && <span className="text-sm text-slate-600">{message}</span>}
      </div>
    </form>
  );
}
