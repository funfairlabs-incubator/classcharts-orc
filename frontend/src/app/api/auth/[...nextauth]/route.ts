import { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

// App Engine sets x-forwarded-host to appspot.com internally even on custom domains.
// We rewrite the host header to force NextAuth to use the correct base URL.
function fixHost(req: NextRequest): NextRequest {
  const url = new URL(req.url);
  const correctHost = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).host
    : null;
  if (correctHost && url.host !== correctHost) {
    url.host = correctHost;
    url.protocol = 'https:';
    const headers = new Headers(req.headers);
    headers.set('host', correctHost);
    headers.set('x-forwarded-host', correctHost);
    return new NextRequest(url.toString(), { method: req.method, headers, body: req.body });
  }
  return req;
}

export async function GET(req: NextRequest, ctx: any) {
  return handler(fixHost(req), ctx);
}
export async function POST(req: NextRequest, ctx: any) {
  return handler(fixHost(req), ctx);
}
