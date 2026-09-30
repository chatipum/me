import Link from 'next/link';
import { connection } from 'next/server';
import { logoutAction } from '@/app/login/actions';
import { RunningTimer } from '@/components/running-timer';
import { getDb } from '@/db/client';
import { getRunningTimer } from '@/server/time';

const NAV = [
  { href: '/', label: 'เอกสาร' },
  { href: '/customers', label: 'ลูกค้า' },
  { href: '/time', label: 'เวลา' },
  { href: '/settings', label: 'ตั้งค่า' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const timer = await getRunningTimer(getDb());
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-6 px-4 py-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-bold hover:underline">
              {item.label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-4">
            {timer && (
              <RunningTimer jobId={timer.jobId} jobNumber={timer.jobNumber} startedAt={timer.startedAt.toISOString()} />
            )}
            <form action={logoutAction}>
              <button type="submit" className="text-sm text-slate-500 hover:underline">
                ออกจากระบบ
              </button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
