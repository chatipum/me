export const DOC_TYPES = ['quotation', 'invoice', 'receipt'] as const;
export const DOC_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'unpaid', 'paid', 'issued'] as const;
export const PAYMENT_METHODS = ['transfer', 'cash', 'cheque'] as const;

export type DocType = (typeof DOC_TYPES)[number];
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected';
export type InvoiceStatus = 'unpaid' | 'paid';
export type DocStatus = (typeof DOC_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TYPE_LABEL: Record<DocType, string> = {
  quotation: 'ใบเสนอราคา',
  invoice: 'ใบแจ้งหนี้',
  receipt: 'ใบเสร็จรับเงิน',
};

export const STATUS_LABEL: Record<DocStatus, string> = {
  draft: 'ร่าง',
  sent: 'ส่งแล้ว',
  accepted: 'ตกลง',
  rejected: 'ปฏิเสธ',
  unpaid: 'ค้างชำระ',
  paid: 'ชำระแล้ว',
  issued: 'ออกแล้ว',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transfer: 'โอนเงิน',
  cash: 'เงินสด',
  cheque: 'เช็ค',
};

export const INITIAL_STATUS: Record<DocType, DocStatus> = {
  quotation: 'draft',
  invoice: 'unpaid',
  receipt: 'issued',
};

const QUOTATION_TRANSITIONS: Partial<Record<DocStatus, DocStatus[]>> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'draft'],
  accepted: ['draft'],
  rejected: ['draft'],
};

export function allowedTransitions(type: DocType, from: DocStatus, hasChild: boolean): DocStatus[] {
  if (type !== 'quotation' || hasChild) return [];
  return QUOTATION_TRANSITIONS[from] ?? [];
}

export function nextConversion(type: DocType, status: DocStatus, hasChild: boolean): DocType | null {
  if (hasChild) return null;
  if (type === 'quotation' && status === 'accepted') return 'invoice';
  if (type === 'invoice' && status === 'unpaid') return 'receipt';
  return null;
}

export function isLocked(hasChild: boolean): boolean {
  return hasChild;
}
