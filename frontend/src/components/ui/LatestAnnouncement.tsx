export async function LatestAnnouncement() {
  // TODO: replace with real data + Claude summary
  const announcement = {
    id: 1,
    title: 'Year 9 Geography Field Trip — Jurassic Coast',
    teacherName: 'Mr. Thomson',
    date: '10 March 2026',
    summary: 'A day trip to the Jurassic Coast on 14 May. Cost is £45, consent form and payment due by 28 March.',
    priority: 'high' as const,
    hasDeadline: true,
    deadline: '28 March 2026',
    calendarAdded: true,
  };

  return (
    <div className="card" style={styles.card}>
      <div style={styles.header}>
        <span className={`chip chip--${announcement.priority === 'high' ? 'warning' : 'neutral'}`}>
          {announcement.priority === 'high' ? 'Action required' : 'Information'}
        </span>
        <span style={styles.date}>{announcement.date}</span>
      </div>

      <h3 style={styles.title}>{announcement.title}</h3>
      <p style={styles.teacher}>{announcement.teacherName}</p>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      {/* Claude summary */}
      <div style={styles.summaryWrap}>
        <span style={styles.summaryLabel}>Summary</span>
        <p style={styles.summary}>{announcement.summary}</p>
      </div>

      {announcement.hasDeadline && (
        <div style={styles.deadlineRow}>
          <span style={styles.deadlineIcon}>⚠</span>
          <span style={styles.deadlineText}>Reply by {announcement.deadline}</span>
          {announcement.calendarAdded && (
            <span className="chip chip--info" style={{ fontSize: 10, marginLeft: 'auto' }}>
              📅 In calendar
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  date: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-3)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 17,
    fontWeight: 500,
    lineHeight: 1.3,
    marginBottom: 4,
  },
  teacher: {
    fontSize: 12,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
  },
  summaryWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  summary: {
    fontSize: 13,
    color: 'var(--text-2)',
    lineHeight: 1.6,
  },
  deadlineRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: '10px 14px',
    background: 'var(--warning-bg)',
    borderRadius: 4,
  },
  deadlineIcon: {
    fontSize: 13,
    color: 'var(--warning)',
  },
  deadlineText: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--warning)',
  },
};
