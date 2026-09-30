import { divRoundHalfUp } from './money';

export function entryMinutes(startedAt: Date, endedAt: Date | null, now: Date = new Date()): number {
  const end = endedAt ?? now;
  return Math.max(0, Math.floor((end.getTime() - startedAt.getTime()) / 60_000));
}

export function estimatedMinutes(items: { hoursHundredths: number; quantityHundredths: number }[]): number {
  // (hours/100) × (quantity/100) × 60 minutes
  return items.reduce(
    (sum, item) => sum + divRoundHalfUp(item.hoursHundredths * item.quantityHundredths * 60, 10_000),
    0,
  );
}

export function variancePercent(actualMinutes: number, estimated: number): number | null {
  if (estimated === 0) return null;
  return Math.round(((actualMinutes - estimated) / estimated) * 100);
}

export function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export function bangkokDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+07:00`);
}

const bangkokFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function toBangkokParts(value: Date): { date: string; time: string } {
  const parts = Object.fromEntries(bangkokFormatter.formatToParts(value).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
