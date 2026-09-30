import Link from 'next/link';
import { formatThaiDate } from '@/lib/dates';
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/doc-status';
import { formatDecimal2 } from '@/lib/money';
import type { DocumentListItem } from '@/server/documents';

export function DocumentTable({ rows }: { rows: DocumentListItem[] }) {
  if (rows.length === 0) {
    return <p className="rounded-lg bg-white px-4 py-6 text-center text-slate-500 shadow">ไม่มีเอกสาร</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2">เลขที่</th>
            <th className="px-4 py-2">ประเภท</th>
            <th className="px-4 py-2">ลูกค้า</th>
            <th className="px-4 py-2">วันที่</th>
            <th className="px-4 py-2">สถานะ</th>
            <th className="px-4 py-2 text-right">ยอดสุทธิ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-bold">
                <Link href={`/documents/${row.id}`} className="hover:underline">
                  {row.number}
                </Link>
              </td>
              <td className="px-4 py-2">{TYPE_LABEL[row.type]}</td>
              <td className="px-4 py-2">{row.customerName}</td>
              <td className="px-4 py-2">{formatThaiDate(row.issueDate)}</td>
              <td className="px-4 py-2">{STATUS_LABEL[row.status]}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatDecimal2(row.netPayable)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
