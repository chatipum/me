import Link from 'next/link';
import { DocumentTable } from '@/components/document-table';
import { buttonClass, inputClass, secondaryButtonClass } from '@/components/field';
import { getDb } from '@/db/client';
import { DOC_STATUSES, DOC_TYPES, type DocStatus, type DocType, STATUS_LABEL, TYPE_LABEL } from '@/lib/doc-status';
import { listDocuments } from '@/server/documents';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const type = DOC_TYPES.includes(params.type as DocType) ? (params.type as DocType) : undefined;
  const status = DOC_STATUSES.includes(params.status as DocStatus) ? (params.status as DocStatus) : undefined;
  const rows = await listDocuments(getDb(), { type, status, q: params.q || undefined });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">เอกสาร</h1>
        <Link href="/documents/new" className={buttonClass}>
          + ใบเสนอราคาใหม่
        </Link>
      </div>
      <form className="flex flex-wrap gap-2">
        <select name="type" defaultValue={type ?? ''} className={`${inputClass} w-40`}>
          <option value="">ทุกประเภท</option>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ''} className={`${inputClass} w-40`}>
          <option value="">ทุกสถานะ</option>
          {DOC_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={params.q} placeholder="เลขที่ หรือ ชื่อลูกค้า" className={`${inputClass} w-60`} />
        <button type="submit" className={secondaryButtonClass}>
          ค้นหา
        </button>
      </form>
      <DocumentTable rows={rows} />
    </div>
  );
}
