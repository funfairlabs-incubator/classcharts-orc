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
    }),
  ],
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
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};
