import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';

const CORRECT_HOST = 'classcharts.funfairlabs.com';

export default withAuth(
  function middleware(req: NextRequest) {
    // App Engine internally routes all requests via appspot.com even on custom domains.
    // This causes Next.js and NextAuth to generate URLs with the wrong host.
    // We rewrite x-forwarded-host on every request so the correct domain is used everywhere.
    const headers = new Headers(req.headers);
    headers.set('x-forwarded-host', CORRECT_HOST);
    headers.set('x-forwarded-proto', 'https');
    return NextResponse.next({ request: { headers } });
  },
  {
    callbacks: {
      // Only run auth check when token is missing — withAuth handles the redirect
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    // Protect all API routes except NextAuth's own endpoints
    '/api/((?!auth).*)',
    // Protect all pages except auth pages and static assets
    '/((?!auth|_next/static|_next/image|favicon\\.ico).*)',
  ],
};
