import { NextRequest, NextResponse } from 'next/server';

// App Engine routes custom domains internally via appspot.com.
// NextAuth reads x-forwarded-host to build redirect URLs, so we correct it here.
export function middleware(req: NextRequest) {
  const correctHost = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).host
    : null;

  if (correctHost) {
    const res = NextResponse.next();
    const headers = new Headers(req.headers);
    headers.set('x-forwarded-host', correctHost);
    return NextResponse.next({
      request: { headers },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/auth/:path*',
};
