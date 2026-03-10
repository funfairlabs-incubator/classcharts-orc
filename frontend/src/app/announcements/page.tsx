export default function AnnouncementsPage() {
  const announcements = [
    {
      id: 1, title: 'Year 9 Geography Field Trip — Jurassic Coast', teacher: 'Mr. Thomson',
      date: '10 Mar 2026', priority: 'high',
      summary: 'A day trip to the Jurassic Coast on 14 May. Cost is £45, consent form and payment due by 28 March.',
      deadline: '28 Mar 2026', calendarAdded: true,
    },
    {
      id: 2, title: 'Non-Uniform Day — Friday 14 March', teacher: 'Admin Office',
      date: '9 Mar 2026', priority: 'normal',
      summary: 'Non-uniform day this Friday in aid of Comic Relief. Suggested donation of £1.',
      deadline: null, calendarAdded: true,
    },
    {
      id: 3, title: 'Parents Evening — Year 9', teacher: 'Admin Office',
      date: '5 Mar 2026', priority: 'high',
      summary: 'Year 9 parents evening on Thursday 27 March. Booking opens Monday 17 March via SchoolCloud.',
      deadline: '17 Mar 2026', calendarAdded: true,
    },
    {
      id: 4, title: 'Spring Term Exam Timetable', teacher: 'Ms. Williams',
      date: '3 Mar 2026', priority: 'normal',
      summary: 'Internal exams run 23–27 March. Timetable attached. Revision materials available on Google Classroom.',
      deadline: null, calendarAdded: true,
    },
  ];

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Announcements</h1>
      </div>
      <hr style={styles.rule} />

      <div style={styles.list}>
        {announcements.map((a, i) => (
          <div key={a.id} className={`card fade-up fade-up-${Math.min(i + 1, 5)}`} style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderLeft}>
                <span className={`chip chip--${a.priority === 'high' ? 'warning' : 'neutral'}`}>
                  {a.priority === 'high' ? 'Action required' : 'Information'}
                </span>
                {a.calendarAdded && (
                  <span className="chip chip--info" style={{ fontSize: 10 }}>📅 In calendar</span>
                )}
              </div>
              <span style={styles.date}>{a.date}</span>
            </div>

            <h2 style={styles.cardTitle}>{a.title}</h2>
            <p style={styles.teacher}>{a.teacher}</p>

            <hr style={styles.divider} />

            <div style={styles.summaryBlock}>
              <span style={styles.summaryLabel}>Summary</span>
              <p style={styles.summaryText}>{a.summary}</p>
            </div>

            {a.deadline && (
              <div style={styles.deadlineRow}>
                <span style={{ color: 'var(--warning)', fontSize: 13 }}>⚠</span>
                <span style={styles.deadlineText}>Reply / action by {a.deadline}</span>
              </div>
            )}
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
  list: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: { padding: '24px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 },
  cardHeaderLeft: { display: 'flex', gap: 8, alignItems: 'center' },
  date: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', flexShrink: 0 },
  cardTitle: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, lineHeight: 1.3, marginBottom: 4 },
  teacher: { fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 0 },
  divider: { border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' },
  summaryBlock: { display: 'flex', flexDirection: 'column', gap: 6 },
  summaryLabel: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  summaryText: { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 },
  deadlineRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, padding: '10px 14px', background: 'var(--warning-bg)', borderRadius: 4 },
  deadlineText: { fontSize: 13, fontWeight: 500, color: 'var(--warning)' },
};
