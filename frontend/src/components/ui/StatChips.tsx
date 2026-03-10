// Server component — will fetch real data once API client is wired
export async function StatChips() {
  // TODO: replace with real ClassCharts data
  const stats = [
    { label: 'Attendance', value: '96.4%', type: 'positive' },
    { label: 'Awards this term', value: '12', type: 'positive' },
    { label: 'Behaviour points', value: '-2', type: 'negative' },
    { label: 'Homework overdue', value: '1', type: 'warning' },
  ];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {stats.map(s => (
        <div key={s.label} style={styles.chip} className={`chip chip--${s.type}`}>
          <span style={styles.chipLabel}>{s.label}</span>
          <span style={styles.chipValue}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 100,
    fontSize: 12,
  },
  chipLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 400,
    opacity: 0.75,
  },
  chipValue: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
  },
};
