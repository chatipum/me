import Link from 'next/link';
import { logoutAction } from '@/app/login/actions';

const NAV = [
  { href: '/', label: 'เอกสาร' },
  { href: '/customers', label: 'ลูกค้า' },
  { href: '/settings', label: 'ตั้งค่า' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-bold hover:underline">
              {item.label}
            </Link>
          ))}
          <form action={logoutAction} className="ml-auto">
            <button type="submit" className="text-sm text-slate-500 hover:underline">
              ออกจากระบบ
            </button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
