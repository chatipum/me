import type { Settings } from '@/db/schema';
import { bahtText } from '@/lib/baht-text';
import { formatThaiDate } from '@/lib/dates';
import { PAYMENT_METHOD_LABEL, TYPE_LABEL } from '@/lib/doc-status';
import { formatDecimal2, formatQuantity } from '@/lib/money';
import type { DocumentWithItems } from '@/server/documents';

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1 ${strong ? 'border-t border-slate-900 font-bold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatDecimal2(value)}</span>
    </div>
  );
}

export function DocumentTemplate({ doc, settings }: { doc: DocumentWithItems; settings: Settings }) {
  const c = doc.customerSnapshot;
  const rate = formatQuantity(doc.withholdingRateBp);
  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white text-[13px] leading-relaxed text-slate-900">
      <header className="flex justify-between gap-8 border-b-2 border-slate-900 pb-4">
        <div className="space-y-0.5">
          <div className="text-lg font-bold">{settings.businessName}</div>
          <div className="whitespace-pre-line">{settings.address}</div>
          {settings.taxId && <div>เลขประจำตัวผู้เสียภาษี {settings.taxId}</div>}
          <div>{[settings.phone, settings.email].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="min-w-[200px] space-y-1 text-right">
          <h1 className="text-2xl font-bold">{TYPE_LABEL[doc.type]}</h1>
          <MetaRow label="เลขที่" value={doc.number} />
          <MetaRow label="วันที่" value={formatThaiDate(doc.issueDate)} />
          {doc.validUntil && <MetaRow label="ยืนราคาถึง" value={formatThaiDate(doc.validUntil)} />}
          {doc.dueDate && <MetaRow label="ครบกำหนดชำระ" value={formatThaiDate(doc.dueDate)} />}
          {doc.parentNumber && <MetaRow label="อ้างอิง" value={doc.parentNumber} />}
        </div>
      </header>

      <section className="py-4">
        <div className="text-slate-500">ลูกค้า</div>
        <div className="font-bold">{c.name}</div>
        <div className="whitespace-pre-line">{c.address}</div>
        {c.taxId && (
          <div>
            เลขประจำตัวผู้เสียภาษี {c.taxId} {c.branch && `(${c.branch})`}
          </div>
        )}
        {c.contactName && <div>ผู้ติดต่อ {c.contactName}</div>}
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-slate-900 text-left">
            <th className="w-10 py-2">ลำดับ</th>
            <th className="py-2">รายละเอียด</th>
            <th className="w-20 py-2 text-right">จำนวน</th>
            <th className="w-16 py-2 pl-2 text-right">หน่วย</th>
            <th className="w-28 py-2 text-right">ราคาต่อหน่วย</th>
            <th className="w-28 py-2 text-right">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, index) => (
            <tr key={item.id} className="break-inside-avoid border-b border-slate-200 align-top">
              <td className="py-2">{index + 1}</td>
              <td className="whitespace-pre-line py-2 pr-2">
                {item.description}
                {item.hoursHundredths > 0 && ` (${formatQuantity(item.hoursHundredths)} ชั่วโมง)`}
              </td>
              <td className="py-2 text-right tabular-nums">{formatQuantity(item.quantityHundredths)}</td>
              <td className="py-2 pl-2 text-right">{item.unit}</td>
              <td className="py-2 text-right tabular-nums">{formatDecimal2(item.unitPriceSatang)}</td>
              <td className="py-2 text-right tabular-nums">{formatDecimal2(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="flex break-inside-avoid justify-between gap-8 pt-4">
        <div className="flex-1 self-end rounded bg-slate-100 px-3 py-2 font-bold">({bahtText(doc.netPayable)})</div>
        <div className="w-72">
          <TotalRow label="รวมเป็นเงิน" value={doc.subtotal} />
          {doc.vatEnabled && <TotalRow label="ภาษีมูลค่าเพิ่ม 7%" value={doc.vatAmount} />}
          <TotalRow label="จำนวนเงินรวมทั้งสิ้น" value={doc.total} strong={!doc.withholdingEnabled} />
          {doc.withholdingEnabled && (
            <>
              <TotalRow label={`หัก ณ ที่จ่าย ${rate}%`} value={doc.withholdingAmount} />
              <TotalRow label="ยอดชำระสุทธิ" value={doc.netPayable} strong />
            </>
          )}
        </div>
      </section>

      <footer className="break-inside-avoid space-y-4 pt-6">
        {doc.type === 'receipt' && doc.paidDate && doc.paymentMethod && (
          <div>
            ได้รับชำระเงินเมื่อ {formatThaiDate(doc.paidDate)} โดย{PAYMENT_METHOD_LABEL[doc.paymentMethod]}
          </div>
        )}
        {doc.type !== 'receipt' && settings.bankAccountNumber && (
          <div>
            <div className="font-bold">ช่องทางชำระเงิน</div>
            <div>
              {settings.bankName} เลขที่บัญชี {settings.bankAccountNumber} ชื่อบัญชี {settings.bankAccountName}
            </div>
          </div>
        )}
        {doc.notes && (
          <div>
            <div className="font-bold">หมายเหตุ</div>
            <div className="whitespace-pre-line">{doc.notes}</div>
          </div>
        )}
        <div className="grid grid-cols-2 items-end gap-16 pt-12 text-center">
          <div>
            <div className="border-t border-slate-400 pt-1">{doc.type === 'receipt' ? 'ผู้จ่ายเงิน' : 'ผู้อนุมัติ / ลูกค้า'}</div>
            <div className="text-slate-500">
              วันที่ <span className="inline-block w-1/2 border-b border-slate-400" />
            </div>
          </div>
          <div>
            {settings.signatureDataUrl && (
              // biome-ignore lint/performance/noImgElement: data URL rendered by Chromium for the PDF; next/image adds nothing
              <img src={settings.signatureDataUrl} alt="ลายเซ็น" className="mx-auto h-16 object-contain" />
            )}
            <div className="border-t border-slate-400 pt-1">{doc.type === 'receipt' ? 'ผู้รับเงิน' : 'ผู้ออกเอกสาร'}</div>
            <div className="text-slate-500">
              วันที่{' '}
              {settings.signatureDataUrl ? (
                formatThaiDate(doc.issueDate)
              ) : (
                <span className="inline-block w-1/2 border-b border-slate-400" />
              )}
            </div>
          </div>
        </div>
      </footer>
    </article>
  );
}
