import { notFound, redirect } from 'next/navigation';
import { DocumentForm } from '@/components/document-form';
import { getDb } from '@/db/client';
import { isLocked } from '@/lib/doc-status';
import { toInputString } from '@/lib/money';
import { listCustomers } from '@/server/customers';
import { getDocument } from '@/server/documents';
import { updateDocumentAction } from '../../actions';

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const db = getDb();
  const doc = Number.isInteger(id) ? await getDocument(db, id) : null;
  if (!doc) notFound();
  if (isLocked(doc.childId !== null)) redirect(`/documents/${id}`);
  const customers = await listCustomers(db);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">แก้ไข {doc.number}</h1>
      <DocumentForm
        docType={doc.type}
        hourlyRateSatang={doc.hourlyRateSatang}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        submitLabel="บันทึก"
        onSubmit={updateDocumentAction.bind(null, id)}
        initial={{
          customerId: doc.customerId,
          issueDate: doc.issueDate,
          validUntil: doc.validUntil,
          dueDate: doc.dueDate,
          paidDate: doc.paidDate,
          paymentMethod: doc.paymentMethod,
          vatEnabled: doc.vatEnabled,
          withholdingEnabled: doc.withholdingEnabled,
          withholdingRate: toInputString(doc.withholdingRateBp),
          notes: doc.notes,
          items: doc.items.map((item) => ({
            description: item.description,
            hours: item.hoursHundredths ? toInputString(item.hoursHundredths) : '',
            quantity: toInputString(item.quantityHundredths),
            unit: item.unit,
            unitPrice: toInputString(item.unitPriceSatang),
            withholding: item.withholding,
          })),
        }}
      />
    </div>
  );
}
