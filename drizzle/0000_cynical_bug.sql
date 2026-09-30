CREATE TYPE "public"."doc_type" AS ENUM('quotation', 'invoice', 'receipt');--> statement-breakpoint
CREATE TABLE "counters" (
	"type" "doc_type" NOT NULL,
	"year" integer NOT NULL,
	"last_value" integer NOT NULL,
	CONSTRAINT "counters_type_year_pk" PRIMARY KEY("type","year")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tax_id" text DEFAULT '' NOT NULL,
	"branch" text DEFAULT 'สำนักงานใหญ่' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"hours_hundredths" integer DEFAULT 0 NOT NULL,
	"quantity_hundredths" integer NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"unit_price_satang" integer NOT NULL,
	"amount" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "doc_type" NOT NULL,
	"number" text NOT NULL,
	"parent_id" integer,
	"customer_id" integer NOT NULL,
	"customer_snapshot" jsonb NOT NULL,
	"issue_date" date NOT NULL,
	"valid_until" date,
	"due_date" date,
	"paid_date" date,
	"payment_method" text,
	"status" text NOT NULL,
	"vat_enabled" boolean NOT NULL,
	"withholding_enabled" boolean NOT NULL,
	"withholding_rate_bp" integer NOT NULL,
	"subtotal" integer NOT NULL,
	"vat_amount" integer NOT NULL,
	"total" integer NOT NULL,
	"withholding_amount" integer NOT NULL,
	"net_payable" integer NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"hourly_rate_satang" integer DEFAULT 0 NOT NULL,
	"pdf_pathname" text,
	"pdf_generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_number_unique" UNIQUE("number"),
	CONSTRAINT "documents_parent_id_unique" UNIQUE("parent_id")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"business_name" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"tax_id" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"bank_name" text DEFAULT '' NOT NULL,
	"bank_account_name" text DEFAULT '' NOT NULL,
	"bank_account_number" text DEFAULT '' NOT NULL,
	"default_withholding_rate_bp" integer DEFAULT 300 NOT NULL,
	"default_quote_validity_days" integer DEFAULT 30 NOT NULL,
	"default_invoice_due_days" integer DEFAULT 30 NOT NULL,
	"default_notes" text DEFAULT '' NOT NULL,
	"hourly_rate_satang" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_job_id_documents_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_one_running" ON "time_entries" USING btree ((ended_at IS NULL)) WHERE ended_at IS NULL;