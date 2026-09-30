import { type NextRequest, NextResponse } from 'next/server';
import { isValidSession, SESSION_COOKIE } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // /print verifies its own short-lived token (used by headless Chromium).
  if (pathname === '/login' || pathname.startsWith('/print/')) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSession(process.env.SESSION_SECRET, token)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
