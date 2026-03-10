'use client';
import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV = [
  { href: '/',              label: 'Overview'      },
  { href: '/timetable',     label: 'Timetable'     },
  { href: '/homework',      label: 'Homework'      },
  { href: '/behaviour',     label: 'Behaviour'     },
  { href: '/attendance',    label: 'Attendance'    },
  { href: '/announcements', label: 'Announcements' },
];

// TODO: replace with real children from ClassCharts API
const CHILDREN = [
  { id: 1, name: 'Child 1' },
];

export function AppShell({ children, session }: { children: React.ReactNode; session: any }) {
  const { data: clientSession } = useSession();
  const pathname = usePathname();
  const [activeChild, setActiveChild] = useState(CHILDREN[0].id);

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
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLeft}>
            <span style={styles.wordmark}>School Dashboard</span>
            {/* Child switcher */}
            <div style={styles.childSwitcher}>
              {CHILDREN.map(c => (
                <button
                  key={c.id}
                  style={{
                    ...styles.childBtn,
                    ...(activeChild === c.id ? styles.childBtnActive : {}),
                  }}
                  onClick={() => setActiveChild(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div style={styles.headerRight}>
            <span style={styles.userEmail}>{sess.user?.email}</span>
            {(sess.user as any)?.isAdmin && (
              <Link href="/admin" style={styles.adminLink}>Admin</Link>
            )}
            <button style={styles.signOutBtn} onClick={() => signOut()}>Sign out</button>
          </div>
        </div>
        {/* Nav */}
        <nav style={styles.nav}>
          <div style={styles.navInner}>
            {NAV.map(({ href, label }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{ ...styles.navLink, ...(active ? styles.navLinkActive : {}) }}
                >
                  {label}
                  {active && <span style={styles.navUnderline} />}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: 'var(--bg)',
  },
  header: {
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
  },
  wordmark: {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 500,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
    whiteSpace: 'nowrap',
  },
  childSwitcher: {
    display: 'flex',
    gap: 4,
    background: 'var(--surface-2)',
    padding: 3,
    borderRadius: 6,
  },
  childBtn: {
    padding: '4px 12px',
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'var(--font-body)',
    color: 'var(--text-2)',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  childBtnActive: {
    background: 'var(--surface)',
    color: 'var(--text)',
    boxShadow: 'var(--shadow)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  userEmail: {
    fontSize: 12,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
  },
  adminLink: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-2)',
    padding: '4px 10px',
    border: '1px solid var(--border)',
    borderRadius: 4,
  },
  signOutBtn: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-2)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 0',
  },
  nav: {
    borderTop: '1px solid var(--border)',
  },
  navInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 32px',
    display: 'flex',
    gap: 0,
  },
  navLink: {
    position: 'relative',
    padding: '12px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-2)',
    display: 'block',
    transition: 'color 0.15s',
  },
  navLinkActive: {
    color: 'var(--text)',
  },
  navUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    background: 'var(--text)',
    borderRadius: 2,
    display: 'block',
  },
  main: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '40px 32px',
  },
  // Auth
  authWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
  },
  authCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '48px 56px',
    textAlign: 'center',
    maxWidth: 400,
    boxShadow: 'var(--shadow-md)',
  },
  authTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 28,
    marginBottom: 12,
  },
  authSub: {
    fontSize: 14,
    color: 'var(--text-2)',
    marginBottom: 32,
  },
  signInBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    background: 'var(--text)',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: 'var(--font-body)',
    cursor: 'pointer',
  },
};
