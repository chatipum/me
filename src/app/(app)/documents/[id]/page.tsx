import { notFound } from 'next/navigation';
import { DocumentTemplate } from '@/components/document-template';
import { getDb } from '@/db/client';
import { getDocument } from '@/server/documents';
import { getSettings } from '@/server/settings';
import { getJobTimeSummary, getRunningTimer, listTimeEntries } from '@/server/time';
import { DocumentActions } from '../document-actions';
import { TimeSection } from './time-section';

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const db = getDb();
  const doc = Number.isInteger(id) ? await getDocument(db, id) : null;
  if (!doc) notFound();
  const [settings, summary, timer] = await Promise.all([
    getSettings(db),
    getJobTimeSummary(db, doc.id),
    getRunningTimer(db),
  ]);
  const entries = await listTimeEntries(db, summary.jobId);
  const pdfStale = doc.pdfGeneratedAt !== null && doc.updatedAt > doc.pdfGeneratedAt;

  return (
    <div className="space-y-4">
      <DocumentActions
        id={doc.id}
        type={doc.type}
        status={doc.status}
        hasChild={doc.childId !== null}
        hasPdf={doc.pdfPathname !== null}
        pdfStale={pdfStale}
      />
      <TimeSection
        documentId={doc.id}
        summary={summary}
        runningHere={timer?.jobId === summary.jobId}
        entries={entries.map((e) => ({
          id: e.id,
          startedAt: e.startedAt.toISOString(),
          endedAt: e.endedAt?.toISOString() ?? null,
          note: e.note,
        }))}
      />
      <div className="overflow-x-auto rounded-lg bg-white p-[15mm] shadow">
        <DocumentTemplate doc={doc} settings={settings} />
      </div>
    </div>
  );
}
