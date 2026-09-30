import Link from 'next/link';
import { buttonClass, inputClass } from '@/components/field';
import { getDb } from '@/db/client';
import { listCustomers } from '@/server/customers';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const customers = await listCustomers(getDb(), q);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ลูกค้า</h1>
        <Link href="/customers/new" className={buttonClass}>
          + เพิ่มลูกค้า
        </Link>
      </div>
      <form className="max-w-sm">
        <input name="q" defaultValue={q} placeholder="ค้นหาชื่อลูกค้า" className={inputClass} />
      </form>
      <ul className="divide-y divide-slate-200 rounded-lg bg-white shadow">
        {customers.map((c) => (
          <li key={c.id}>
            <Link href={`/customers/${c.id}`} className="block px-4 py-3 hover:bg-slate-50">
              <div className="font-bold">{c.name}</div>
              <div className="text-sm text-slate-500">{c.contactName || c.email || c.phone}</div>
            </Link>
          </li>
        ))}
        {customers.length === 0 && <li className="px-4 py-6 text-center text-slate-500">ยังไม่มีลูกค้า</li>}
      </ul>
    </div>
  );
}
