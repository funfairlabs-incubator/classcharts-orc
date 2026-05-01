import { BUILD_INFO } from '@/lib/buildInfo';

export function Footer() {
  const commitSha  = BUILD_INFO.commitSha;
  const deployedAt = BUILD_INFO.deployedAt;

  return (
    <footer style={styles.footer}>
      <span style={styles.brand}>
        <span style={{ color: '#f97316', fontWeight: 700 }}>FunFairLabs</span>
        <span style={{ color: '#6366f1', fontWeight: 700 }}> + Claude</span>
        <span style={{ color: 'var(--border-strong)' }}> | </span>
        <span style={{ color: 'var(--text-3)' }}>ClassCharts</span>
      </span>
      <span style={styles.meta}>
        <code style={styles.code}>{commitSha}</code>
        {' · '}
        <code style={styles.code}>{deployedAt}</code>
      </span>
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    borderTop: '1px solid var(--border)',
    padding: '8px 16px',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 11,
    zIndex: 10,
  },
  brand: { color: 'var(--text-3)' },
  meta: { color: 'var(--text-3)', opacity: 0.6 },
  code: { fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--surface-2)', padding: '1px 4px', borderRadius: 3 },
};
