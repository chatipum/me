import { get, put } from '@vercel/blob';

export function pdfPathname(doc: { id: number; number: string }): string {
  return `documents/${doc.id}/${doc.number}.pdf`;
}

export async function uploadPdf(pathname: string, bytes: Uint8Array): Promise<void> {
  await put(pathname, Buffer.from(bytes), {
    access: 'private',
    contentType: 'application/pdf',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

export async function readPdf(pathname: string): Promise<ReadableStream<Uint8Array> | null> {
  const result = await get(pathname, { access: 'private', useCache: false });
  return result?.stream ?? null;
}
