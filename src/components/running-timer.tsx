'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { stopTimerAction } from '@/app/(app)/time/actions';
import { formatElapsed } from '@/lib/time';

export function RunningTimer({ jobId, jobNumber, startedAt }: { jobId: number; jobNumber: string; startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm">
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
      <Link href={`/documents/${jobId}`} className="font-bold hover:underline">
        {jobNumber}
      </Link>
      <span className="tabular-nums" suppressHydrationWarning>
        {formatElapsed(now - new Date(startedAt).getTime())}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await stopTimerAction();
            if (!result.ok) setError(result.error);
          })
        }
        className="rounded bg-red-600 px-2 text-white disabled:opacity-50"
      >
        หยุด
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
