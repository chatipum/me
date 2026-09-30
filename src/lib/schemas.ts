import { z } from 'zod';
import { PAYMENT_METHODS } from './doc-status';

const trimmed = z.string().trim();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ไม่ถูกต้อง');

export const customerInput = z.object({
  name: trimmed.min(1, 'กรุณากรอกชื่อลูกค้า'),
  taxId: trimmed.regex(/^(\d{13})?$/, 'เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก'),
  branch: trimmed,
  address: trimmed,
  contactName: trimmed,
  email: z.union([z.literal(''), trimmed.email('อีเมลไม่ถูกต้อง')]),
  phone: trimmed,
  notes: trimmed,
});
export type CustomerInput = z.infer<typeof customerInput>;

export const settingsInput = z.object({
  businessName: trimmed.min(1, 'กรุณากรอกชื่อผู้ออกเอกสาร'),
  address: trimmed,
  taxId: trimmed.regex(/^(\d{13})?$/, 'เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก'),
  phone: trimmed,
  email: z.union([z.literal(''), trimmed.email('อีเมลไม่ถูกต้อง')]),
  bankName: trimmed,
  bankAccountName: trimmed,
  bankAccountNumber: trimmed,
  defaultWithholdingRateBp: z.number().int().min(0).max(10000),
  defaultQuoteValidityDays: z.number().int().min(0).max(365),
  defaultInvoiceDueDays: z.number().int().min(0).max(365),
  defaultNotes: z.string(),
  hourlyRateSatang: z.number().int().min(0),
});
export type SettingsInput = z.infer<typeof settingsInput>;

export const itemInput = z.object({
  description: trimmed.min(1, 'กรุณากรอกรายละเอียด'),
  hoursHundredths: z.number().int().min(0, 'ชั่วโมงต้องไม่ติดลบ'),
  quantityHundredths: z.number().int().positive('จำนวนต้องมากกว่า 0'),
  unit: trimmed,
  unitPriceSatang: z.number().int().min(0, 'ราคาต้องไม่ติดลบ'),
});

export const documentInput = z.object({
  customerId: z.number().int().positive('กรุณาเลือกลูกค้า'),
  issueDate: isoDate,
  validUntil: isoDate.nullable(),
  dueDate: isoDate.nullable(),
  paidDate: isoDate.nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
  vatEnabled: z.boolean(),
  withholdingEnabled: z.boolean(),
  withholdingRateBp: z.number().int().min(0).max(10000),
  notes: z.string(),
  items: z.array(itemInput).min(1, 'ต้องมีอย่างน้อย 1 รายการ'),
});
export type DocumentInput = z.infer<typeof documentInput>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'รูปแบบเวลาไม่ถูกต้อง');

export const timeEntryInput = z.object({
  date: isoDate,
  startTime: hhmm,
  endTime: hhmm,
  note: trimmed,
});
export type TimeEntryInput = z.infer<typeof timeEntryInput>;
