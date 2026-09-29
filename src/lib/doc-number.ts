import type { DocType } from './doc-status';

const PREFIX: Record<DocType, string> = { quotation: 'QT', invoice: 'INV', receipt: 'RC' };

export function formatDocNumber(type: DocType, year: number, seq: number): string {
  return `${PREFIX[type]}-${year}-${String(seq).padStart(4, '0')}`;
}
