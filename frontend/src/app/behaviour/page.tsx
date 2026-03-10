export default function BehaviourPage() {
  const points = [
    { id: 1, score: 2,  reason: 'Excellent homework submission',   lesson: 'Mathematics', teacher: 'Mr. Patel',    date: '10 Mar 2026', type: 'academic' },
    { id: 2, score: 1,  reason: 'Good participation in class',     lesson: 'English',     teacher: 'Ms. Harrison', date: '9 Mar 2026',  type: 'participation' },
    { id: 3, score: -1, reason: 'Talking during lesson',           lesson: 'Science',     teacher: 'Dr. Chen',     date: '8 Mar 2026',  type: 'behaviour' },
    { id: 4, score: 3,  reason: 'Outstanding project work',        lesson: 'Geography',   teacher: 'Mr. Thomson',  date: '7 Mar 2026',  type: 'academic' },
    { id: 5, score: 1,  reason: 'Helpful to classmates',           lesson: 'French',      teacher: 'Mme. Dubois',  date: '6 Mar 2026',  type: 'participation' },
    { id: 6, score: -2, reason: 'Incomplete classwork',            lesson: 'Mathematics', teacher: 'Mr. Patel',    date: '5 Mar 2026',  type: 'academic' },
  ];

  const total = points.reduce((s, p) => s + p.score, 0);
  const positive = points.filter(p => p.score > 0).reduce((s, p) => s + p.score, 0);
  const negative = points.filter(p => p.score < 0).reduce((s, p) => s + p.score, 0);

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Behaviour</h1>
      </div>
      <hr style={styles.rule} />

      {/* Summary row */}
      <div style={styles.summaryRow}>
        {[
          { label: 'Net total', value: total > 0 ? `+${total}` : String(total), color: total >= 0 ? 'var(--positive)' : 'var(--negative)' },
          { label: 'Positive', value: `+${positive}`, color: 'var(--positive)' },
          { label: 'Negative', value: String(negative), color: 'var(--negative)' },
        ].map(s => (
          <div key={s.label} className="card" style={styles.summaryCard}>
            <p style={styles.summaryLabel}>{s.label}</p>
            <p style={{ ...styles.summaryValue, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Points list */}
      <div className="card" style={{ overflow: 'hidden', marginTop: 32 }}>
        {points.map((p, i) => (
          <div key={p.id} style={{
            ...styles.row,
            borderBottom: i < points.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={styles.scoreCol}>
              <span style={{
                ...styles.score,
                color: p.score > 0 ? 'var(--positive)' : 'var(--negative)',
                background: p.score > 0 ? 'var(--positive-bg)' : 'var(--negative-bg)',
              }}>
                {p.score > 0 ? '+' : ''}{p.score}
              </span>
            </div>
            <div style={styles.detail}>
              <p style={styles.reason}>{p.reason}</p>
              <p style={styles.meta}>{p.lesson} · {p.teacher}</p>
            </div>
            <span style={styles.date}>{p.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { marginBottom: 24 },
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500 },
  rule: { border: 'none', borderTop: '1px solid var(--border)', marginBottom: 40 },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  summaryCard: { padding: '20px 24px' },
  summaryLabel: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  summaryValue: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500, lineHeight: 1 },
  row: { display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px' },
  scoreCol: { flexShrink: 0 },
  score: { fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, padding: '3px 8px', borderRadius: 4, display: 'inline-block' },
  detail: { flex: 1 },
  reason: { fontSize: 14, fontWeight: 500, marginBottom: 2 },
  meta: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  date: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', flexShrink: 0 },
};
