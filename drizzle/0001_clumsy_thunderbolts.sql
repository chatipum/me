ALTER TABLE "document_items" ADD COLUMN "withholding" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "signature_data_url" text DEFAULT '' NOT NULL;