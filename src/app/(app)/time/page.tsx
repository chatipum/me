import Link from 'next/link';
import { inputClass, secondaryButtonClass } from '@/components/field';
import { getDb } from '@/db/client';
import { formatThaiDate } from '@/lib/dates';
import { STATUS_LABEL } from '@/lib/doc-status';
import { formatDuration, variancePercent } from '@/lib/time';
import { listJobSummaries } from '@/server/time';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function VarianceCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>;
  return (
    <span className={value > 0 ? 'font-bold text-red-600' : 'text-emerald-700'}>
      {value > 0 ? `+${value}` : value}%
    </span>
  );
}

export default async function TimePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const from = params.from && ISO_DATE.test(params.from) ? params.from : undefined;
  const to = params.to && ISO_DATE.test(params.to) ? params.to : undefined;
  const rows = await listJobSummaries(getDb(), { from, to });
  const totalEstimated = rows.reduce((sum, r) => sum + r.estimatedMinutes, 0);
  const totalActual = rows.reduce((sum, r) => sum + r.actualMinutes, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">เวลาทำงาน</h1>
      <form className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          วันที่ออกใบเสนอราคา ตั้งแต่
          <input type="date" name="from" defaultValue={from} className={`${inputClass} w-44`} />
        </label>
        <label className="text-sm">
          ถึง
          <input type="date" name="to" defaultValue={to} className={`${inputClass} w-44`} />
        </label>
        <button type="submit" className={secondaryButtonClass}>
          กรอง
        </button>
      </form>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">เลขที่</th>
              <th className="px-4 py-2">ลูกค้า</th>
              <th className="px-4 py-2">วันที่</th>
              <th className="px-4 py-2">สถานะ</th>
              <th className="px-4 py-2 text-right">ประเมิน</th>
              <th className="px-4 py-2 text-right">จริง</th>
              <th className="px-4 py-2 text-right">ส่วนต่าง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {rows.map((row) => (
              <tr key={row.jobId} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-bold">
                  <Link href={`/documents/${row.jobId}`} className="hover:underline">
                    {row.jobNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{row.customerName}</td>
                <td className="px-4 py-2">{formatThaiDate(row.issueDate)}</td>
                <td className="px-4 py-2">{STATUS_LABEL[row.status]}</td>
                <td className="px-4 py-2 text-right">{formatDuration(row.estimatedMinutes)}</td>
                <td className="px-4 py-2 text-right">{formatDuration(row.actualMinutes)}</td>
                <td className="px-4 py-2 text-right">
                  <VarianceCell value={row.variancePercent} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  ยังไม่มีงานที่มีชั่วโมงประเมินหรือเวลาที่บันทึก
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t border-slate-300 font-bold tabular-nums">
              <tr>
                <td colSpan={4} className="px-4 py-2">
                  รวม {rows.length} งาน
                </td>
                <td className="px-4 py-2 text-right">{formatDuration(totalEstimated)}</td>
                <td className="px-4 py-2 text-right">{formatDuration(totalActual)}</td>
                <td className="px-4 py-2 text-right">
                  <VarianceCell value={variancePercent(totalActual, totalEstimated)} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
