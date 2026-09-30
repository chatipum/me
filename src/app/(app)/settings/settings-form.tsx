'use client';

import { useState, useTransition } from 'react';
import { buttonClass, Field, inputClass } from '@/components/field';
import type { Settings } from '@/db/schema';
import { hourlyRateFromSalary, parseDecimal2, toInputString } from '@/lib/money';
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

const INTEGER = /^\d+$/;

export function SettingsForm({ initial }: { initial: Settings }) {
  const [values, setValues] = useState(initial);
  const [rate, setRate] = useState(toInputString(initial.defaultWithholdingRateBp));
  const [hourlyRate, setHourlyRate] = useState(toInputString(initial.hourlyRateSatang));
  const [salary, setSalary] = useState('');
  const [workDays, setWorkDays] = useState('22');
  const [hoursPerDay, setHoursPerDay] = useState('8');
  const [markup, setMarkup] = useState('1.5');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function recalcHourly(next: { salary?: string; workDays?: string; hoursPerDay?: string; markup?: string }) {
    const salaryText = next.salary ?? salary;
    const daysText = (next.workDays ?? workDays).trim();
    const salarySatang = parseDecimal2(salaryText);
    const hoursHundredths = parseDecimal2(next.hoursPerDay ?? hoursPerDay);
    const markupHundredths = parseDecimal2(next.markup ?? markup);
    if (salarySatang === null || hoursHundredths === null || markupHundredths === null || !INTEGER.test(daysText)) {
      return;
    }
    const result = hourlyRateFromSalary(salarySatang, Number(daysText), hoursHundredths, markupHundredths);
    if (result !== null) setHourlyRate(toInputString(result));
  }

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
      <fieldset className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">คำนวณจากเงินเดือน</legend>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="เงินเดือน (บาท)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={salary}
              onChange={(e) => {
                setSalary(e.target.value);
                recalcHourly({ salary: e.target.value });
              }}
            />
          </Field>
          <Field label="วันทำงานต่อเดือน">
            <input
              className={inputClass}
              inputMode="numeric"
              value={workDays}
              onChange={(e) => {
                setWorkDays(e.target.value);
                recalcHourly({ workDays: e.target.value });
              }}
            />
          </Field>
          <Field label="ชั่วโมงต่อวัน">
            <input
              className={inputClass}
              inputMode="decimal"
              value={hoursPerDay}
              onChange={(e) => {
                setHoursPerDay(e.target.value);
                recalcHourly({ hoursPerDay: e.target.value });
              }}
            />
          </Field>
          <Field label="ตัวคูณ markup">
            <input
              className={inputClass}
              inputMode="decimal"
              value={markup}
              onChange={(e) => {
                setMarkup(e.target.value);
                recalcHourly({ markup: e.target.value });
              }}
            />
          </Field>
        </div>
        <p className="text-xs text-slate-500">เงินเดือน × ตัวคูณ ÷ (วันทำงาน × ชั่วโมงต่อวัน) จะเติมใน “ค่าตัวต่อชั่วโมง” อัตโนมัติ</p>
      </fieldset>
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
