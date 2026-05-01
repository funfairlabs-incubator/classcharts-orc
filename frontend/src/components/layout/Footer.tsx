export function Footer() {
  const commitSha  = process.env.NEXT_PUBLIC_COMMIT_SHA  ?? 'local';
  const deployedAt = process.env.NEXT_PUBLIC_DEPLOYED_AT ?? 'local build';

  return (
    <footer style={styles.footer}>
      <p style={styles.line}>
        <span style={{ color: '#f97316', fontWeight: 700 }}>FunFairLabs</span>
        <span style={{ color: '#6366f1', fontWeight: 700 }}> + Claude</span>
        <span style={{ color: 'var(--border-strong)' }}> | </span>
        <span style={{ color: 'var(--text-3)' }}>ClassCharts</span>
        <span style={{ color: 'var(--text-3)' }}> © {new Date().getFullYear()}</span>
      </p>
      <p style={styles.meta}>
        Commit: <code style={styles.code}>{commitSha}</code>
        {' · '}
        Deployed: <code style={styles.code}>{deployedAt}</code>
      </p>
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: { borderTop: '1px solid var(--border)', padding: '16px 20px', marginTop: 32, textAlign: 'center' },
  line: { fontSize: 12, marginBottom: 4 },
  meta: { fontSize: 11, color: 'var(--text-3)', opacity: 0.7 },
  code: { fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3 },
};
