export default function AttendancePage() {
  const records = [
    { date: 'Mon 10 Mar', am: 'Present', pm: 'Present', lessons: 5, absences: 0 },
    { date: 'Fri 7 Mar',  am: 'Present', pm: 'Present', lessons: 5, absences: 0 },
    { date: 'Thu 6 Mar',  am: 'Present', pm: 'Late',    lessons: 5, absences: 1 },
    { date: 'Wed 5 Mar',  am: 'Present', pm: 'Present', lessons: 5, absences: 0 },
    { date: 'Tue 4 Mar',  am: 'Absent',  pm: 'Absent',  lessons: 0, absences: 5 },
    { date: 'Mon 3 Mar',  am: 'Present', pm: 'Present', lessons: 5, absences: 0 },
  ];

  const totalDays = records.length;
  const fullPresent = records.filter(r => r.am === 'Present' && r.pm === 'Present').length;
  const pct = ((fullPresent / totalDays) * 100).toFixed(1);

  function statusStyle(status: string): React.CSSProperties {
    if (status === 'Present') return { color: 'var(--positive)', background: 'var(--positive-bg)' };
    if (status === 'Absent')  return { color: 'var(--negative)', background: 'var(--negative-bg)' };
    return { color: 'var(--warning)', background: 'var(--warning-bg)' };
  }

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Attendance</h1>
        <div style={styles.pctBadge}>
          <span style={styles.pctValue}>{pct}%</span>
          <span style={styles.pctLabel}>This term</span>
        </div>
      </div>
      <hr style={styles.rule} />

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={styles.tableHeader}>
          <span style={styles.col1}>Date</span>
          <span style={styles.colCenter}>AM</span>
          <span style={styles.colCenter}>PM</span>
          <span style={styles.colRight}>Lessons attended</span>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
        {records.map((r, i) => (
          <div key={i} style={{
            ...styles.tableRow,
            borderBottom: i < records.length - 1 ? '1px solid var(--border)' : 'none',
            background: r.absences > 0 ? 'var(--negative-bg)' : 'transparent',
          }}>
            <span style={styles.col1}>{r.date}</span>
            <span style={styles.colCenter}>
              <span style={{ ...styles.statusChip, ...statusStyle(r.am) }}>{r.am}</span>
            </span>
            <span style={styles.colCenter}>
              <span style={{ ...styles.statusChip, ...statusStyle(r.pm) }}>{r.pm}</span>
            </span>
            <span style={{ ...styles.colRight, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              {r.lessons} / 5
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 },
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500 },
  rule: { border: 'none', borderTop: '1px solid var(--border)', marginBottom: 40 },
  pctBadge: { textAlign: 'right' },
  pctValue: { fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 500, color: 'var(--positive)', display: 'block', lineHeight: 1 },
  pctLabel: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  tableHeader: { display: 'grid', gridTemplateColumns: '160px 1fr 1fr 140px', padding: '10px 20px', gap: 8 },
  tableRow: { display: 'grid', gridTemplateColumns: '160px 1fr 1fr 140px', padding: '12px 20px', gap: 8, alignItems: 'center' },
  col1: { fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)' },
  colCenter: { textAlign: 'center' as const, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  colRight: { textAlign: 'right' as const, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  statusChip: { fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, padding: '3px 8px', borderRadius: 100, display: 'inline-block' },
};
