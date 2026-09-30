import { notFound } from 'next/navigation';
import { DocumentTemplate } from '@/components/document-template';
import { getDb } from '@/db/client';
import { getDocument } from '@/server/documents';
import { getSettings } from '@/server/settings';
import { DocumentActions } from '../document-actions';

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const db = getDb();
  const doc = Number.isInteger(id) ? await getDocument(db, id) : null;
  if (!doc) notFound();
  const settings = await getSettings(db);
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
      <div className="overflow-x-auto rounded-lg bg-white p-[15mm] shadow">
        <DocumentTemplate doc={doc} settings={settings} />
      </div>
    </div>
  );
}
