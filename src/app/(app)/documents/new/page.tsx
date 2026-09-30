import { DocumentForm } from '@/components/document-form';
import { getDb } from '@/db/client';
import { addDays, todayIso } from '@/lib/dates';
import { toInputString } from '@/lib/money';
import { listCustomers } from '@/server/customers';
import { getSettings } from '@/server/settings';
import { createQuotationAction } from '../actions';

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const { customerId } = await searchParams;
  const db = getDb();
  const [customers, settings] = await Promise.all([listCustomers(db), getSettings(db)]);
  const today = todayIso();
  const preselected = customers.some((c) => c.id === Number(customerId)) ? Number(customerId) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">สร้างใบเสนอราคา</h1>
      <DocumentForm
        docType="quotation"
        hourlyRateSatang={settings.hourlyRateSatang}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        submitLabel="บันทึก"
        onSubmit={createQuotationAction}
        initial={{
          customerId: preselected,
          issueDate: today,
          validUntil: addDays(today, settings.defaultQuoteValidityDays),
          dueDate: null,
          paidDate: null,
          paymentMethod: null,
          vatEnabled: false,
          withholdingEnabled: false,
          withholdingRate: toInputString(settings.defaultWithholdingRateBp),
          notes: settings.defaultNotes,
          items: [],
        }}
      />
    </div>
  );
}
