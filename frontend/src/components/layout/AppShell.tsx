'use client';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PupilProvider } from '@/lib/usePupil';

export function AppShell({ children, session }: { children: React.ReactNode; session: any }) {
  const { data: clientSession } = useSession();
  const sess = session ?? clientSession;

  if (!sess) {
    return (
      <div style={styles.authWrap}>
        <div style={styles.authCard}>
          <h1 style={styles.authTitle}>School Dashboard</h1>
          <p style={styles.authSub}>Sign in with your Google account to continue.</p>
          <button style={styles.signInBtn} onClick={() => signIn('google')}>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <PupilProvider>
      <AppShellInner session={sess}>{children}</AppShellInner>
    </PupilProvider>
  );
}

const NAV = [
  { href: '/',              label: 'Home',       icon: '⌂' },
  { href: '/timetable',     label: 'Timetable',  icon: '◷' },
  { href: '/homework',      label: 'Homework',   icon: '✎' },
  { href: '/behaviour',     label: 'Behaviour',  icon: '★' },
  { href: '/attendance',    label: 'Attendance', icon: '✓' },
  { href: '/announcements', label: 'News',       icon: '◉' },
];

function AppShellInner({ children, session }: { children: React.ReactNode; session: any }) {
  const pathname = usePathname();

  return (
    <div style={styles.root}>
      {/* Top bar — minimal */}
      <header style={styles.topBar}>
        <span style={styles.wordmark}>ClassCharts</span>
        <div style={styles.topRight}>
          {(session.user as any)?.isAdmin && (
            <Link href="/admin" style={styles.adminLink}>Admin</Link>
          )}
          <span style={styles.userDot} title={session.user?.email ?? ''}>
            {session.user?.email?.[0]?.toUpperCase()}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main style={styles.main}>{children}</main>

      {/* Bottom nav */}
      <nav style={styles.bottomNav}>
        {NAV.map(({ href, label, icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} style={{ ...styles.navItem, color: active ? 'var(--text)' : 'var(--text-3)' }}>
              <span style={{ ...styles.navIcon, background: active ? 'var(--surface-2)' : 'transparent' }}>{icon}</span>
              <span style={{ ...styles.navLabel, fontWeight: active ? 600 : 400 }}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: 72 },
  topBar: { position: 'sticky', top: 0, zIndex: 100, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, letterSpacing: '-0.01em' },
  topRight: { display: 'flex', alignItems: 'center', gap: 12 },
  adminLink: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 4 },
  userDot: { width: 28, height: 28, borderRadius: '50%', background: 'var(--text)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', cursor: 'default' },
  main: { flex: 1 },
  bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)' },
  navItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px 6px', gap: 2, transition: 'color 0.15s' },
  navIcon: { fontSize: 18, lineHeight: 1, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, transition: 'background 0.15s' },
  navLabel: { fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  authWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 },
  authCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '48px 40px', textAlign: 'center', maxWidth: 360, width: '100%', boxShadow: 'var(--shadow-md)' },
  authTitle: { fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 10 },
  authSub: { fontSize: 14, color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.5 },
  signInBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer', width: '100%', justifyContent: 'center' },
};
