import { notFound } from 'next/navigation';
import { DocumentTemplate } from '@/components/document-template';
import { getDb } from '@/db/client';
import { verifyPrintToken } from '@/lib/auth';
import { requireEnv } from '@/lib/env';
import { getDocument } from '@/server/documents';
import { getSettings } from '@/server/settings';

export const dynamic = 'force-dynamic';

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const id = Number((await params).id);
  const { token } = await searchParams;
  if (!Number.isInteger(id) || !token || !(await verifyPrintToken(requireEnv('SESSION_SECRET'), id, token))) {
    notFound();
  }
  const db = getDb();
  const [doc, settings] = await Promise.all([getDocument(db, id), getSettings(db)]);
  if (!doc) notFound();
  return <DocumentTemplate doc={doc} settings={settings} />;
}
