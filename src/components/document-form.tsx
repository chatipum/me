'use client';

import { useState, useTransition } from 'react';
import { quickCreateCustomerAction } from '@/app/(app)/customers/actions';
import { type DocType, PAYMENT_METHOD_LABEL, PAYMENT_METHODS, type PaymentMethod, TYPE_LABEL } from '@/lib/doc-status';
import {
  computeTotals,
  divRoundHalfUp,
  formatDecimal2,
  formatQuantity,
  hourlyUnitPrice,
  parseDecimal2,
} from '@/lib/money';
import type { DocumentInput } from '@/lib/schemas';
import type { ActionResult } from '@/server/action-result';
import { CustomerForm, EMPTY_CUSTOMER } from './customer-form';
import { buttonClass, Field, inputClass, secondaryButtonClass } from './field';

type ItemRow = { key: number; description: string; hours: string; quantity: string; unit: string; unitPrice: string };

export type DocumentFormValues = {
  customerId: number | null;
  issueDate: string;
  validUntil: string | null;
  dueDate: string | null;
  paidDate: string | null;
  paymentMethod: PaymentMethod | null;
  vatEnabled: boolean;
  withholdingEnabled: boolean;
  withholdingRate: string; // percent, e.g. "3"
  notes: string;
  items: Omit<ItemRow, 'key'>[];
};

let nextKey = 1;
const emptyItem = (): ItemRow => ({
  key: nextKey++,
  description: '',
  hours: '',
  quantity: '1',
  unit: '',
  unitPrice: '',
});

export function DocumentForm({
  docType,
  customers: initialCustomers,
  hourlyRateSatang,
  initial,
  onSubmit,
  submitLabel,
}: {
  docType: DocType;
  customers: { id: number; name: string }[];
  hourlyRateSatang: number; // the document's rate: settings for new docs, snapshot when editing
  initial: DocumentFormValues;
  onSubmit: (input: DocumentInput) => Promise<ActionResult<unknown>>;
  submitLabel: string;
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [values, setValues] = useState(initial);
  const [items, setItems] = useState<ItemRow[]>(() =>
    initial.items.length ? initial.items.map((item) => ({ ...item, key: nextKey++ })) : [emptyItem()],
  );
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsedItems = items.map((row) => {
    const hoursHundredths = row.hours.trim() === '' ? 0 : parseDecimal2(row.hours);
    return {
      description: row.description,
      unit: row.unit,
      hoursHundredths,
      quantityHundredths: parseDecimal2(row.quantity),
      // Hourly items show the computed price; the server recomputes it the same way.
      unitPriceSatang: hoursHundredths
        ? hourlyUnitPrice(hoursHundredths, hourlyRateSatang)
        : parseDecimal2(row.unitPrice),
    };
  });
  const rateBp = parseDecimal2(values.withholdingRate);
  const estimatedHoursHundredths = parsedItems.reduce(
    (sum, i) => sum + divRoundHalfUp((i.hoursHundredths ?? 0) * (i.quantityHundredths ?? 0), 100),
    0,
  );

  const totals = computeTotals({
    items: parsedItems.map((i) => ({
      quantityHundredths: i.quantityHundredths ?? 0,
      unitPriceSatang: i.unitPriceSatang ?? 0,
    })),
    vatEnabled: values.vatEnabled,
    withholdingEnabled: values.withholdingEnabled,
    withholdingRateBp: rateBp ?? 0,
  });

  function updateItem(key: number, patch: Partial<ItemRow>) {
    setItems(items.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function moveItem(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const copy = [...items];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setItems(copy);
  }

  function submit() {
    const localErrors: Record<string, string> = {};
    parsedItems.forEach((item, i) => {
      if (item.hoursHundredths === null) localErrors[`items.${i}.hoursHundredths`] = 'ตัวเลขไม่ถูกต้อง';
      if (item.quantityHundredths === null) localErrors[`items.${i}.quantityHundredths`] = 'ตัวเลขไม่ถูกต้อง';
      if (item.unitPriceSatang === null) localErrors[`items.${i}.unitPriceSatang`] = 'ตัวเลขไม่ถูกต้อง';
    });
    if (rateBp === null) localErrors.withholdingRateBp = 'ตัวเลขไม่ถูกต้อง';
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      setError('ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบ');
      return;
    }
    const input: DocumentInput = {
      customerId: values.customerId ?? 0,
      issueDate: values.issueDate,
      validUntil: values.validUntil,
      dueDate: values.dueDate,
      paidDate: values.paidDate,
      paymentMethod: values.paymentMethod,
      vatEnabled: values.vatEnabled,
      withholdingEnabled: values.withholdingEnabled,
      withholdingRateBp: rateBp ?? 0,
      notes: values.notes,
      items: parsedItems.map((i) => ({
        description: i.description,
        unit: i.unit,
        hoursHundredths: i.hoursHundredths ?? 0,
        quantityHundredths: i.quantityHundredths ?? 0,
        unitPriceSatang: i.unitPriceSatang ?? 0,
      })),
    };
    startTransition(async () => {
      const result = await onSubmit(input);
      if (result && !result.ok) {
        setErrors(result.fieldErrors ?? {});
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg bg-white p-6 shadow">
        <h2 className="font-bold">ลูกค้า</h2>
        {addingCustomer ? (
          <CustomerForm
            initial={EMPTY_CUSTOMER}
            submitLabel="เพิ่มลูกค้า"
            onCancel={() => setAddingCustomer(false)}
            onSubmit={async (customerInput) => {
              const result = await quickCreateCustomerAction(customerInput);
              if (result.ok) {
                setCustomers([...customers, result.data]);
                setValues({ ...values, customerId: result.data.id });
                setAddingCustomer(false);
              }
              return result;
            }}
          />
        ) : (
          <div className="flex gap-2">
            <Field label="เลือกลูกค้า" error={errors.customerId}>
              <select
                className={inputClass}
                value={values.customerId ?? ''}
                onChange={(e) => setValues({ ...values, customerId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">— เลือก —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={() => setAddingCustomer(true)}
              className={`${secondaryButtonClass} self-end`}
            >
              + ลูกค้าใหม่
            </button>
          </div>
        )}
      </section>

      <section className="grid gap-4 rounded-lg bg-white p-6 shadow sm:grid-cols-3">
        <Field label="วันที่" error={errors.issueDate}>
          <input
            type="date"
            className={inputClass}
            value={values.issueDate}
            onChange={(e) => setValues({ ...values, issueDate: e.target.value })}
          />
        </Field>
        {docType === 'quotation' && (
          <Field label="ยืนราคาถึง" error={errors.validUntil}>
            <input
              type="date"
              className={inputClass}
              value={values.validUntil ?? ''}
              onChange={(e) => setValues({ ...values, validUntil: e.target.value || null })}
            />
          </Field>
        )}
        {docType === 'invoice' && (
          <Field label="ครบกำหนดชำระ" error={errors.dueDate}>
            <input
              type="date"
              className={inputClass}
              value={values.dueDate ?? ''}
              onChange={(e) => setValues({ ...values, dueDate: e.target.value || null })}
            />
          </Field>
        )}
        {docType === 'receipt' && (
          <>
            <Field label="วันที่รับเงิน" error={errors.paidDate}>
              <input
                type="date"
                className={inputClass}
                value={values.paidDate ?? ''}
                onChange={(e) => setValues({ ...values, paidDate: e.target.value || null })}
              />
            </Field>
            <Field label="วิธีชำระ" error={errors.paymentMethod}>
              <select
                className={inputClass}
                value={values.paymentMethod ?? 'transfer'}
                onChange={(e) => setValues({ ...values, paymentMethod: e.target.value as PaymentMethod })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-lg bg-white p-6 shadow">
        <h2 className="font-bold">รายการ</h2>
        {errors.items && <p className="text-sm text-red-600">{errors.items}</p>}
        {items.map((row, index) => (
          <div key={row.key} className="grid gap-2 border-b border-slate-100 pb-3 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <Field label={`รายการที่ ${index + 1}`} error={errors[`items.${index}.description`]}>
                <textarea
                  rows={2}
                  className={inputClass}
                  value={row.description}
                  onChange={(e) => updateItem(row.key, { description: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-1">
              <Field label="ชั่วโมง" error={errors[`items.${index}.hoursHundredths`]}>
                <input
                  inputMode="decimal"
                  placeholder="—"
                  className={inputClass}
                  value={row.hours}
                  onChange={(e) => updateItem(row.key, { hours: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="จำนวน" error={errors[`items.${index}.quantityHundredths`]}>
                <input
                  inputMode="decimal"
                  className={inputClass}
                  value={row.quantity}
                  onChange={(e) => updateItem(row.key, { quantity: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-1">
              <Field label="หน่วย">
                <input
                  className={inputClass}
                  value={row.unit}
                  onChange={(e) => updateItem(row.key, { unit: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="ราคาต่อหน่วย" error={errors[`items.${index}.unitPriceSatang`]}>
                {parsedItems[index].hoursHundredths ? (
                  <input
                    disabled
                    className={`${inputClass} bg-slate-100`}
                    value={formatDecimal2(parsedItems[index].unitPriceSatang ?? 0)}
                  />
                ) : (
                  <input
                    inputMode="decimal"
                    className={inputClass}
                    value={row.unitPrice}
                    onChange={(e) => updateItem(row.key, { unitPrice: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <div className="flex items-end gap-1 sm:col-span-2">
              <button
                type="button"
                aria-label="ขึ้น"
                onClick={() => moveItem(index, -1)}
                className={secondaryButtonClass}
              >
                ↑
              </button>
              <button type="button" aria-label="ลง" onClick={() => moveItem(index, 1)} className={secondaryButtonClass}>
                ↓
              </button>
              <button
                type="button"
                aria-label="ลบ"
                disabled={items.length === 1}
                onClick={() => setItems(items.filter((r) => r.key !== row.key))}
                className={secondaryButtonClass}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setItems([...items, emptyItem()])} className={secondaryButtonClass}>
          + เพิ่มรายการ
        </button>
        {estimatedHoursHundredths > 0 && (
          <p className="text-sm text-slate-600">
            ชั่วโมงประเมินรวม {formatQuantity(estimatedHoursHundredths)} ชม. × ค่าตัว {formatDecimal2(hourlyRateSatang)}{' '}
            บาท/ชม.
          </p>
        )}
        {estimatedHoursHundredths > 0 && hourlyRateSatang === 0 && (
          <p className="text-sm text-amber-700">ยังไม่ได้ตั้งค่าตัวต่อชั่วโมงในหน้าตั้งค่า รายการรายชั่วโมงจะมีราคา 0</p>
        )}
      </section>

      <section className="grid gap-6 rounded-lg bg-white p-6 shadow sm:grid-cols-2">
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.vatEnabled}
              onChange={(e) => setValues({ ...values, vatEnabled: e.target.checked })}
            />
            ภาษีมูลค่าเพิ่ม 7%
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={values.withholdingEnabled}
              onChange={(e) => setValues({ ...values, withholdingEnabled: e.target.checked })}
            />
            หัก ณ ที่จ่าย
            <input
              inputMode="decimal"
              className={`${inputClass} w-20`}
              value={values.withholdingRate}
              disabled={!values.withholdingEnabled}
              onChange={(e) => setValues({ ...values, withholdingRate: e.target.value })}
            />
            %
          </label>
          {errors.withholdingRateBp && <p className="text-sm text-red-600">{errors.withholdingRateBp}</p>}
          <Field label="หมายเหตุ">
            <textarea
              rows={3}
              className={inputClass}
              value={values.notes}
              onChange={(e) => setValues({ ...values, notes: e.target.value })}
            />
          </Field>
        </div>
        <dl className="space-y-1 self-end text-sm tabular-nums">
          <div className="flex justify-between">
            <dt>รวมเป็นเงิน</dt>
            <dd>{formatDecimal2(totals.subtotal)}</dd>
          </div>
          {values.vatEnabled && (
            <div className="flex justify-between">
              <dt>VAT 7%</dt>
              <dd>{formatDecimal2(totals.vatAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>รวมทั้งสิ้น</dt>
            <dd>{formatDecimal2(totals.total)}</dd>
          </div>
          {values.withholdingEnabled && (
            <div className="flex justify-between">
              <dt>หัก ณ ที่จ่าย</dt>
              <dd>-{formatDecimal2(totals.withholdingAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-bold">
            <dt>ยอดชำระสุทธิ</dt>
            <dd>{formatDecimal2(totals.netPayable)}</dd>
          </div>
        </dl>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" onClick={submit} disabled={pending || addingCustomer} className={buttonClass}>
        {pending ? 'กำลังบันทึก…' : `${submitLabel}${TYPE_LABEL[docType]}`}
      </button>
    </div>
  );
}
