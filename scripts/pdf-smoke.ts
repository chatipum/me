import { mkdirSync, writeFileSync } from 'node:fs';
import { createPrintToken } from '@/lib/auth';
import { requireEnv } from '@/lib/env';
import { renderPdf } from '@/pdf/render';

const id = Number(process.argv[2]);
if (!Number.isInteger(id)) {
  console.error('usage: bun run pdf:smoke <documentId>');
  process.exit(1);
}
const origin = process.env.APP_URL || 'http://localhost:3000';
const token = await createPrintToken(requireEnv('SESSION_SECRET'), id);
const bytes = await renderPdf(`${origin}/print/${id}?token=${encodeURIComponent(token)}`);
mkdirSync('tmp', { recursive: true });
writeFileSync(`tmp/document-${id}.pdf`, bytes);
console.log(`wrote tmp/document-${id}.pdf (${bytes.length} bytes)`);
