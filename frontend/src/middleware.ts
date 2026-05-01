import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const CORRECT_HOST = 'classcharts.funfairlabs.com';

// Paths that must remain public
const PUBLIC_PREFIXES = [
  '/api/auth',       // NextAuth endpoints (signin, callback, signout, session)
  '/auth',           // signin and error pages
  '/_next',          // Next.js static assets
  '/favicon.ico',
  '/icons',
  '/manifest.json',
];

export async function middleware(req: NextRequest) {
  // Always rewrite host first (required for App Engine custom domain)
  const headers = new Headers(req.headers);
  headers.set('x-forwarded-host', CORRECT_HOST);
  headers.set('x-forwarded-proto', 'https');

  const { pathname } = req.nextUrl;

  // Allow public paths through without auth check
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next({ request: { headers } });
  }

  // Check for valid session token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon\\.ico).*)',
};
