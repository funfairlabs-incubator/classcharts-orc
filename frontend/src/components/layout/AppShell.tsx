'use client';
import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { PupilProvider } from '@/lib/usePupil';

export function AppShell({ children, session }: { children: React.ReactNode; session: any }) {
  const { data: clientSession } = useSession();
  const sess = session ?? clientSession;

  if (!sess) {
    return (
      <div style={styles.authWrap}>
        <div style={styles.authCard}>
          <div style={styles.authLogo}>
            <span style={{ color: '#f97316', fontWeight: 800, fontSize: 20 }}>FunFairLabs</span>
            <span style={{ color: '#6366f1', fontWeight: 800, fontSize: 20 }}> + Claude</span>
          </div>
          <p style={styles.authSub}>Sign in to access the ClassCharts dashboard.</p>
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
  { href: '/',              label: 'Home',         icon: '⌂' },
  { href: '/timetable',     label: 'Timetable',    icon: '◷' },
  { href: '/homework',      label: 'Homework',     icon: '✎' },
  { href: '/behaviour',     label: 'Behaviour',    icon: '★' },
  { href: '/attendance',    label: 'Attendance',   icon: '✓' },
  { href: '/announcements', label: 'Announcements',icon: '◉' },
  { href: '/documents',     label: 'Documents',    icon: '📎' },
  { href: '/architecture',  label: 'How it works', icon: '🔧' },
  { href: '/settings',      label: 'Settings',     icon: '⚙' },
];

function AppShellInner({ children, session }: { children: React.ReactNode; session: any }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Close menu on nav
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const isAdmin = (session.user as any)?.isAdmin;

  return (
    <div style={styles.root}>
      {/* Top bar */}
      <header style={styles.topBar}>
        <Link href="/" style={styles.wordmark}>
          <span style={{ color: '#f97316', fontWeight: 800 }}>FunFairLabs</span>
          <span style={{ color: '#6366f1', fontWeight: 800 }}> + Claude</span>
          <span style={{ color: 'var(--border-strong)', fontWeight: 300, margin: '0 4px' }}>|</span>
          <span style={{ color: 'var(--text-2)', fontWeight: 500, fontSize: 12 }}>ClassCharts</span>
        </Link>

        {/* Hamburger */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{ ...styles.hamburger, background: menuOpen ? 'var(--surface-2)' : 'transparent' }}
            aria-label="Menu"
          >
            <span style={styles.bar} />
            <span style={{ ...styles.bar, width: menuOpen ? 22 : 16 }} />
            <span style={styles.bar} />
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div style={styles.dropdown}>
              <div style={styles.dropdownHeader}>
                <p style={styles.dropdownEmail}>{session.user?.email}</p>
              </div>
              {NAV.map(({ href, label, icon }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                  <Link key={href} href={href} style={{
                    ...styles.dropdownItem,
                    background: active ? 'var(--surface-2)' : 'transparent',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--text)' : 'var(--text-2)',
                  }}>
                    <span style={styles.dropdownIcon}>{icon}</span>
                    {label}
                    {active && <span style={styles.activeBar} />}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link href="/admin" style={styles.dropdownItem}>
                  <span style={styles.dropdownIcon}>🛡</span>
                  Admin
                </Link>
              )}
              <div style={styles.dropdownFooter}>
                <button onClick={() => signOut()} style={styles.signOutBtn}>Sign out</button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },

  topBar: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    padding: '0 16px', height: 52,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },

  wordmark: {
    fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em',
    display: 'flex', alignItems: 'center', textDecoration: 'none',
  },

  hamburger: {
    width: 40, height: 40, borderRadius: 8,
    border: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 5, cursor: 'pointer',
    transition: 'background 0.15s',
  },
  bar: { width: 22, height: 2, background: 'var(--text)', borderRadius: 2, transition: 'width 0.15s' },

  dropdown: {
    position: 'absolute', top: 48, right: 0,
    width: 240,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    zIndex: 200,
  },
  dropdownHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface-2)',
  },
  dropdownEmail: { fontSize: 11, color: 'var(--text-3)', fontWeight: 500 },

  dropdownItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 16px', fontSize: 14,
    textDecoration: 'none', transition: 'background 0.1s',
    position: 'relative', borderBottom: '1px solid var(--border)',
  },
  dropdownIcon: { fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 },
  activeBar: {
    position: 'absolute', left: 0, top: 8, bottom: 8,
    width: 3, background: '#f97316', borderRadius: '0 2px 2px 0',
  },

  dropdownFooter: { padding: '10px 16px' },
  signOutBtn: {
    width: '100%', padding: '8px', background: 'var(--surface-2)',
    border: '1px solid var(--border)', borderRadius: 6,
    fontSize: 13, fontWeight: 500, color: 'var(--text-2)', cursor: 'pointer',
  },

  main: { flex: 1, paddingBottom: 24 },

  authWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 },
  authCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 40px', textAlign: 'center', maxWidth: 360, width: '100%', boxShadow: 'var(--shadow-md)' },
  authLogo: { marginBottom: 12 },
  authSub: { fontSize: 14, color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.5 },
  signInBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' },
};
