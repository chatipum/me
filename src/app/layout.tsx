import type { Metadata } from 'next';
import { sarabun } from './fonts';
import './globals.css';

export const metadata: Metadata = { title: 'ใบเสนอราคา' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={sarabun.variable}>
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
