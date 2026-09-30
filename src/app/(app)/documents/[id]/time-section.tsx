'use client';

import { useState, useTransition } from 'react';
import {
  createTimeEntryAction,
  deleteTimeEntryAction,
  startTimerAction,
  updateTimeEntryAction,
} from '@/app/(app)/time/actions';
import { buttonClass, inputClass, secondaryButtonClass } from '@/components/field';
import { todayIso } from '@/lib/dates';
import type { TimeEntryInput } from '@/lib/schemas';
import { entryMinutes, formatDuration, toBangkokParts } from '@/lib/time';
import type { ActionResult } from '@/server/action-result';

type EntryView = { id: number; startedAt: string; endedAt: string | null; note: string };
type Summary = { jobNumber: string; estimatedMinutes: number; actualMinutes: number; variancePercent: number | null };

function EntryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: TimeEntryInput;
  submitLabel: string;
  onSubmit: (input: TimeEntryInput) => Promise<ActionResult<void>>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(values);
      if (!result.ok) setError(result.error);
      else if (!onCancel) setValues({ ...initial, note: '' });
      else onCancel();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input
        type="date"
        required
        aria-label="วันที่"
        className={`${inputClass} w-40`}
        value={values.date}
        onChange={(e) => setValues({ ...values, date: e.target.value })}
      />
      <input
        type="time"
        required
        aria-label="เวลาเริ่ม"
        className={`${inputClass} w-28`}
        value={values.startTime}
        onChange={(e) => setValues({ ...values, startTime: e.target.value })}
      />
      <span className="pb-2">–</span>
      <input
        type="time"
        required
        aria-label="เวลาสิ้นสุด"
        className={`${inputClass} w-28`}
        value={values.endTime}
        onChange={(e) => setValues({ ...values, endTime: e.target.value })}
      />
      <input
        placeholder="โน้ต"
        aria-label="โน้ต"
        className={`${inputClass} w-56`}
        value={values.note}
        onChange={(e) => setValues({ ...values, note: e.target.value })}
      />
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        {submitLabel}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          ยกเลิก
        </button>
      )}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

function toFormValues(entry: EntryView): TimeEntryInput {
  const start = toBangkokParts(new Date(entry.startedAt));
  const end = entry.endedAt ? toBangkokParts(new Date(entry.endedAt)) : start;
  return { date: start.date, startTime: start.time, endTime: end.time, note: entry.note };
}

function varianceLabel(variance: number): string {
  if (variance > 0) return `เกิน ${variance}%`;
  if (variance < 0) return `ต่ำกว่า ${-variance}%`;
  return 'ตรงประเมิน';
}

export function TimeSection({
  documentId,
  summary,
  entries,
  runningHere,
}: {
  documentId: number;
  summary: Summary;
  entries: EntryView[];
  runningHere: boolean;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const variance = summary.variancePercent;

  function run(action: () => Promise<ActionResult<void>>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="space-y-4 rounded-lg bg-white p-4 shadow print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-bold">เวลาทำงาน · {summary.jobNumber}</h2>
        <span className="text-sm tabular-nums">
          ประเมิน {formatDuration(summary.estimatedMinutes)} · จริง {formatDuration(summary.actualMinutes)}
          {variance !== null && (
            <span className={variance > 0 ? 'text-red-600' : 'text-emerald-700'}> · {varianceLabel(variance)}</span>
          )}
        </span>
        <div className="ml-auto">
          {runningHere ? (
            <span className="text-sm text-red-600">กำลังจับเวลางานนี้ (หยุดได้จากแถบด้านบน)</span>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => startTimerAction(documentId))}
              className={buttonClass}
            >
              ▶ เริ่มจับเวลา
            </button>
          )}
        </div>
      </div>

      <EntryForm
        initial={{ date: todayIso(), startTime: '09:00', endTime: '10:00', note: '' }}
        submitLabel="+ เพิ่มเวลา"
        onSubmit={(input) => createTimeEntryAction(documentId, input)}
      />

      <ul className="divide-y divide-slate-100 text-sm">
        {entries.map((entry) => {
          const start = toBangkokParts(new Date(entry.startedAt));
          const end = entry.endedAt ? toBangkokParts(new Date(entry.endedAt)) : null;
          if (editingId === entry.id) {
            return (
              <li key={entry.id} className="py-2">
                <EntryForm
                  initial={toFormValues(entry)}
                  submitLabel="บันทึก"
                  onSubmit={(input) => updateTimeEntryAction(entry.id, input)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            );
          }
          return (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="w-24">{start.date}</span>
              <span className="w-28 tabular-nums">
                {start.time} – {end ? end.time : 'กำลังเดิน'}
              </span>
              <span className="w-14 tabular-nums">
                {entry.endedAt ? formatDuration(entryMinutes(new Date(entry.startedAt), new Date(entry.endedAt))) : ''}
              </span>
              <span className="flex-1 text-slate-600">{entry.note}</span>
              {end && (
                <button type="button" onClick={() => setEditingId(entry.id)} className="text-slate-500 hover:underline">
                  แก้
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => confirm('ลบรายการเวลานี้?') && run(() => deleteTimeEntryAction(entry.id))}
                className="text-red-600 hover:underline"
              >
                ลบ
              </button>
            </li>
          );
        })}
        {entries.length === 0 && <li className="py-2 text-slate-500">ยังไม่มีเวลาที่บันทึก</li>}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
