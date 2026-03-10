import type { Metadata } from 'next';
import './globals.css';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/route';
import { SessionProvider } from '@/components/layout/SessionProvider';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'School Dashboard',
  description: 'ClassCharts parent dashboard',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body>
        <SessionProvider session={session}>
          <AppShell session={session}>
            {children}
          </AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
