import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CustomerForm } from '@/components/customer-form';
import { DocumentTable } from '@/components/document-table';
import { buttonClass } from '@/components/field';
import { getDb } from '@/db/client';
import { getCustomer } from '@/server/customers';
import { listDocuments } from '@/server/documents';
import { updateCustomerAction } from '../actions';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const db = getDb();
  const customer = Number.isInteger(id) ? await getCustomer(db, id) : null;
  if (!customer) notFound();
  const docs = await listDocuments(db, { customerId: id });
  const { id: _id, createdAt: _c, updatedAt: _u, ...initial } = customer;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{customer.name}</h1>
        <Link href={`/documents/new?customerId=${id}`} className={buttonClass}>
          + ใบเสนอราคาใหม่
        </Link>
      </div>
      <div className="rounded-lg bg-white p-6 shadow">
        <CustomerForm initial={initial} onSubmit={updateCustomerAction.bind(null, id)} submitLabel="บันทึก" />
      </div>
      <h2 className="text-lg font-bold">เอกสารของลูกค้า</h2>
      <DocumentTable rows={docs} />
    </div>
  );
}
