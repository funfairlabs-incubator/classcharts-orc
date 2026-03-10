export async function BehaviourSummary() {
  // TODO: replace with real data
  const points = [
    { id: 1, score: 2,  reason: 'Excellent homework submission', lesson: 'Mathematics',    teacher: 'Mr. Patel',    date: 'Mon' },
    { id: 2, score: 1,  reason: 'Good participation in class',   lesson: 'English',        teacher: 'Ms. Harrison', date: 'Tue' },
    { id: 3, score: -1, reason: 'Talking during lesson',         lesson: 'Science',        teacher: 'Dr. Chen',     date: 'Wed' },
    { id: 4, score: 3,  reason: 'Outstanding project work',      lesson: 'Geography',      teacher: 'Mr. Thomson',  date: 'Thu' },
  ];

  const total = points.reduce((sum, p) => sum + p.score, 0);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Score header */}
      <div style={styles.scoreHeader}>
        <div>
          <p style={styles.scoreLabel}>Week total</p>
          <p style={{
            ...styles.scoreValue,
            color: total >= 0 ? 'var(--positive)' : 'var(--negative)',
          }}>
            {total > 0 ? '+' : ''}{total}
          </p>
        </div>
        <div style={styles.scoreBars}>
          {points.map(p => (
            <div
              key={p.id}
              title={`${p.score > 0 ? '+' : ''}${p.score} — ${p.reason}`}
              style={{
                ...styles.bar,
                background: p.score > 0 ? 'var(--positive)' : 'var(--negative)',
                height: Math.abs(p.score) * 10 + 8,
                opacity: 0.7 + Math.abs(p.score) * 0.1,
              }}
            />
          ))}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

      {/* Point list */}
      {points.map((p, i) => (
        <div
          key={p.id}
          style={{
            ...styles.row,
            borderBottom: i < points.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <span style={{
            ...styles.score,
            color: p.score > 0 ? 'var(--positive)' : 'var(--negative)',
          }}>
            {p.score > 0 ? '+' : ''}{p.score}
          </span>
          <div style={styles.detail}>
            <span style={styles.reason}>{p.reason}</span>
            <span style={styles.meta}>{p.lesson} · {p.teacher} · {p.date}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  scoreHeader: {
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreLabel: {
    fontSize: 11,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 4,
  },
  scoreValue: {
    fontFamily: 'var(--font-display)',
    fontSize: 32,
    fontWeight: 500,
    lineHeight: 1,
  },
  scoreBars: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 4,
    height: 40,
  },
  bar: {
    width: 8,
    borderRadius: 3,
    transition: 'height 0.3s ease',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    padding: '12px 20px',
  },
  score: {
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    fontWeight: 500,
    width: 28,
    flexShrink: 0,
    paddingTop: 1,
  },
  detail: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  reason: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text)',
  },
  meta: {
    fontSize: 11,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
  },
};
