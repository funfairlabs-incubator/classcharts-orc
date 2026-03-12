export function Footer() {
  const buildId    = process.env.NEXT_PUBLIC_BUILD_ID    ?? 'dev';
  const commitSha  = process.env.NEXT_PUBLIC_COMMIT_SHA  ?? 'local';
  const deployedAt = process.env.NEXT_PUBLIC_DEPLOYED_AT ?? 'local build';

  return (
    <footer style={styles.footer}>
      <p style={styles.line}>
        © {new Date().getFullYear()}{' '}
        <a href="https://leaguepredictions.co.uk" target="_blank" rel="noreferrer" style={styles.link}>
          leaguepredictions.co.uk
        </a>
        {' '}· part of{' '}
        <span style={{ color: '#f97316', fontWeight: 700 }}>FunFairLabs</span>
        <span style={{ color: '#6366f1', fontWeight: 700 }}> + Claude</span>
      </p>
      <p style={styles.meta}>
        Build: <code style={styles.code}>{buildId}</code>
        {' · '}
        Commit: <code style={styles.code}>{commitSha}</code>
        {' · '}
        Deployed: <code style={styles.code}>{deployedAt}</code>
      </p>
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    borderTop: '1px solid var(--border)',
    padding: '16px 20px',
    marginTop: 32,
    textAlign: 'center',
  },
  line: { fontSize: 12, color: 'var(--text-3)', marginBottom: 4 },
  meta: { fontSize: 11, color: 'var(--text-3)', opacity: 0.7 },
  link: { color: 'var(--text-3)', textDecoration: 'underline' },
  code: { fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3 },
};
