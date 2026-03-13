import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { Storage } from '@google-cloud/storage';
import type { AllowedUsersConfig } from '@classcharts/shared';

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });

async function getAllowedEmails(): Promise<string[]> {
  try {
    const bucket = storage.bucket(process.env.GCS_BUCKET!);
    const file = bucket.file(process.env.GCS_ALLOWED_USERS_PATH!);
    const [content] = await file.download();
    const config: AllowedUsersConfig = JSON.parse(content.toString());
    return config.users.map(u => u.email.toLowerCase());
  } catch {
    return [];
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          redirect_uri: 'https://classcharts.funfairlabs.com/api/auth/callback/google',
        },
      },
    }),
  ],
  cookies: {
    pkceCodeVerifier: {
      name: '__Host-next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    state: {
      name: '__Host-next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    callbackUrl: {
      name: '__Secure-next-auth.callback-url',
      options: {
        httpOnly: false,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase() ?? '';
      const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase() ?? '';
      if (email === adminEmail) return true;
      const allowed = await getAllowedEmails();
      return allowed.includes(email);
    },
    async session({ session }) {
      if (session.user?.email) {
        const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase() ?? '';
        (session.user as any).isAdmin =
          session.user.email.toLowerCase() === adminEmail;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      const correctBase = process.env.NEXTAUTH_URL ?? baseUrl;
      // Rewrite any appspot.com URLs to the correct domain
      const corrected = url.replace(/https:\/\/[^/]*\.appspot\.com/, correctBase);
      if (corrected.startsWith(correctBase)) return corrected;
      if (corrected.startsWith('/')) return `${correctBase}${corrected}`;
      return correctBase;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};
