'use client';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

export default function SignInPage() {
  const params = useSearchParams();
  const error = params.get('error');

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>School Dashboard</h1>
        <p style={styles.sub}>Sign in to view your child's school information.</p>

        {error === 'AccessDenied' && (
          <div style={styles.errorBox}>
            <strong>Access denied.</strong> Your Google account isn't on the approved list. Contact the admin to be added.
          </div>
        )}

        <button style={styles.btn} onClick={() => signIn('google', { callbackUrl: 'https://classcharts.funfairlabs.com/' })}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '52px 60px', textAlign: 'center', maxWidth: 420, width: '100%', boxShadow: 'var(--shadow-md)' },
  title: { fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 500, marginBottom: 10 },
  sub: { fontSize: 14, color: 'var(--text-2)', marginBottom: 32 },
  errorBox: { background: 'var(--negative-bg)', color: 'var(--negative)', fontSize: 13, padding: '12px 16px', borderRadius: 4, marginBottom: 24, lineHeight: 1.5 },
  btn: { display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 24px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer', boxShadow: 'var(--shadow)' },
};
