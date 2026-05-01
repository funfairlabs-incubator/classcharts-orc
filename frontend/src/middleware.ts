import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';

const CORRECT_HOST = 'classcharts.funfairlabs.com';

export default withAuth(
  function middleware(req: NextRequest) {
    const headers = new Headers(req.headers);
    headers.set('x-forwarded-host', CORRECT_HOST);
    headers.set('x-forwarded-proto', 'https');
    return NextResponse.next({ request: { headers } });
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/auth/signin',
      error: '/auth/error',
    },
  }
);

export const config = {
  matcher: [
    // Only protect API routes (except NextAuth's own)
    '/api/((?!auth).*)',
    // Only protect app pages — explicitly exclude auth, static, images, icons
    '/((?!auth|_next|favicon\\.ico|icons|manifest\\.json).*)',
  ],
};
