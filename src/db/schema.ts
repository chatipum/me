import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { DOC_TYPES, type DocStatus, type PaymentMethod } from '@/lib/doc-status';

export const docTypeEnum = pgEnum('doc_type', DOC_TYPES);

export type CustomerSnapshot = {
  name: string;
  taxId: string;
  branch: string;
  address: string;
  contactName: string;
};

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  businessName: text('business_name').notNull().default(''),
  address: text('address').notNull().default(''),
  taxId: text('tax_id').notNull().default(''),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  bankName: text('bank_name').notNull().default(''),
  bankAccountName: text('bank_account_name').notNull().default(''),
  bankAccountNumber: text('bank_account_number').notNull().default(''),
  defaultWithholdingRateBp: integer('default_withholding_rate_bp').notNull().default(300),
  defaultQuoteValidityDays: integer('default_quote_validity_days').notNull().default(30),
  defaultInvoiceDueDays: integer('default_invoice_due_days').notNull().default(30),
  defaultNotes: text('default_notes').notNull().default(''),
  hourlyRateSatang: integer('hourly_rate_satang').notNull().default(0),
  // PNG data URL ('' = none), drawn on the issuer signature line of PDFs
  signatureDataUrl: text('signature_data_url').notNull().default(''),
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  taxId: text('tax_id').notNull().default(''),
  branch: text('branch').notNull().default('สำนักงานใหญ่'),
  address: text('address').notNull().default(''),
  contactName: text('contact_name').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  notes: text('notes').notNull().default(''),
  ...timestamps,
});

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  type: docTypeEnum('type').notNull(),
  number: text('number').notNull().unique(),
  parentId: integer('parent_id')
    .references((): AnyPgColumn => documents.id)
    .unique(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  customerSnapshot: jsonb('customer_snapshot').$type<CustomerSnapshot>().notNull(),
  issueDate: date('issue_date', { mode: 'string' }).notNull(),
  validUntil: date('valid_until', { mode: 'string' }),
  dueDate: date('due_date', { mode: 'string' }),
  paidDate: date('paid_date', { mode: 'string' }),
  paymentMethod: text('payment_method').$type<PaymentMethod>(),
  status: text('status').$type<DocStatus>().notNull(),
  vatEnabled: boolean('vat_enabled').notNull(),
  withholdingEnabled: boolean('withholding_enabled').notNull(),
  withholdingRateBp: integer('withholding_rate_bp').notNull(),
  subtotal: integer('subtotal').notNull(),
  vatAmount: integer('vat_amount').notNull(),
  total: integer('total').notNull(),
  withholdingAmount: integer('withholding_amount').notNull(),
  netPayable: integer('net_payable').notNull(),
  notes: text('notes').notNull().default(''),
  // snapshot of settings.hourlyRateSatang when the document was created
  hourlyRateSatang: integer('hourly_rate_satang').notNull().default(0),
  pdfPathname: text('pdf_pathname'),
  pdfGeneratedAt: timestamp('pdf_generated_at', { withTimezone: true }),
  ...timestamps,
});

export const documentItems = pgTable('document_items', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  description: text('description').notNull(),
  // hours per unit × 100; 0 = fixed-price item
  hoursHundredths: integer('hours_hundredths').notNull().default(0),
  quantityHundredths: integer('quantity_hundredths').notNull(),
  unit: text('unit').notNull().default(''),
  unitPriceSatang: integer('unit_price_satang').notNull(),
  amount: integer('amount').notNull(),
  // included in the withholding-tax base when the document has withholding enabled
  withholding: boolean('withholding').notNull().default(true),
});

export const counters = pgTable(
  'counters',
  {
    type: docTypeEnum('type').notNull(),
    year: integer('year').notNull(),
    lastValue: integer('last_value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.type, t.year] })],
);

export const timeEntries = pgTable(
  'time_entries',
  {
    id: serial('id').primaryKey(),
    jobId: integer('job_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    note: text('note').notNull().default(''),
  },
  // At most one running timer: every running row indexes the same value (true).
  () => [uniqueIndex('time_entries_one_running').on(sql`(ended_at IS NULL)`).where(sql`ended_at IS NULL`)],
);

export type Settings = typeof settings.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;
export type DocumentRow = typeof documents.$inferSelect;
export type DocumentItem = typeof documentItems.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
