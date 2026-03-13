import { NextRequest, NextResponse } from 'next/server';

const CORRECT_HOST = 'classcharts.funfairlabs.com';

// App Engine internally routes all requests via appspot.com even on custom domains.
// This causes Next.js and NextAuth to generate URLs with the wrong host.
// We rewrite x-forwarded-host on every request so the correct domain is used everywhere.
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set('x-forwarded-host', CORRECT_HOST);
  headers.set('x-forwarded-proto', 'https');
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
