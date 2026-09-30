import { getDb } from '@/db/client';
import { createPrintToken } from '@/lib/auth';
import { requireEnv } from '@/lib/env';
import { renderPdf } from '@/pdf/render';
import { pdfPathname, readPdf, uploadPdf } from '@/pdf/storage';
import { getDocument, markPdfGenerated } from '@/server/documents';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

async function loadDocument(context: Context) {
  const id = Number((await context.params).id);
  return Number.isInteger(id) ? getDocument(getDb(), id) : null;
}

export async function POST(request: Request, context: Context) {
  const doc = await loadDocument(context);
  if (!doc) return Response.json({ error: 'ไม่พบเอกสาร' }, { status: 404 });
  try {
    const token = await createPrintToken(requireEnv('SESSION_SECRET'), doc.id);
    const origin = process.env.APP_URL || new URL(request.url).origin;
    const bytes = await renderPdf(`${origin}/print/${doc.id}?token=${encodeURIComponent(token)}`);
    const pathname = pdfPathname(doc);
    await uploadPdf(pathname, bytes);
    await markPdfGenerated(getDb(), doc.id, pathname);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('PDF generation failed', error);
    return Response.json({ error: 'สร้าง PDF ไม่สำเร็จ ลองใหม่อีกครั้ง' }, { status: 500 });
  }
}

export async function GET(_request: Request, context: Context) {
  const doc = await loadDocument(context);
  if (!doc?.pdfPathname) return Response.json({ error: 'ยังไม่มี PDF' }, { status: 404 });
  const stream = await readPdf(doc.pdfPathname);
  if (!stream) return Response.json({ error: 'ไม่พบไฟล์ PDF' }, { status: 404 });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${doc.number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
