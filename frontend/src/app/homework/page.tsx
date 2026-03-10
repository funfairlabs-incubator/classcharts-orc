export default function HomeworkPage() {
  const homework = [
    { id: 1, subject: 'Mathematics',  title: 'Quadratic equations worksheet',  description: 'Complete exercises 3.4–3.7 from the textbook. Show all working.', setDate: '10 Mar', dueDate: '11 Mar', status: 'todo',      daysLeft: 1 },
    { id: 2, subject: 'English',      title: 'Essay — Of Mice and Men',        description: 'Write a 600-word analytical essay on the theme of loneliness.',   setDate: '9 Mar',  dueDate: '13 Mar', status: 'todo',      daysLeft: 3 },
    { id: 3, subject: 'Science',      title: 'Lab report — photosynthesis',    description: 'Write up the experiment from Tuesday\'s lesson.',                 setDate: '8 Mar',  dueDate: '14 Mar', status: 'completed', daysLeft: 4 },
    { id: 4, subject: 'French',       title: 'Vocabulary list — Chapter 6',    description: 'Learn 30 new vocabulary items. Quiz on Friday.',                  setDate: '7 Mar',  dueDate: '14 Mar', status: 'todo',      daysLeft: 4 },
    { id: 5, subject: 'Geography',    title: 'Map skills worksheet',           description: 'Grid references and contour lines exercises.',                    setDate: '5 Mar',  dueDate: '7 Mar',  status: 'late',      daysLeft: -3 },
  ];

  const grouped = {
    overdue:   homework.filter(h => h.status === 'late'),
    todo:      homework.filter(h => h.status === 'todo'),
    completed: homework.filter(h => h.status === 'completed'),
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Homework</h1>
        <div style={styles.legend}>
          <span style={{ ...styles.dot, background: 'var(--negative)' }} /> Overdue
          <span style={{ ...styles.dot, background: 'var(--warning)', marginLeft: 12 }} /> Due soon
          <span style={{ ...styles.dot, background: 'var(--border)', marginLeft: 12 }} /> Upcoming
        </div>
      </div>
      <hr style={styles.rule} />

      {grouped.overdue.length > 0 && (
        <Group title="Overdue" items={grouped.overdue} />
      )}
      <Group title="To do" items={grouped.todo} />
      <Group title="Completed" items={grouped.completed} muted />
    </div>
  );
}

function Group({ title, items, muted }: { title: string; items: any[]; muted?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section style={{ marginBottom: 40, opacity: muted ? 0.6 : 1 }}>
      <h2 style={styles.groupTitle}>{title} <span style={styles.groupCount}>{items.length}</span></h2>
      <div className="card" style={{ overflow: 'hidden' }}>
        {items.map((hw, i) => (
          <div key={hw.id} style={{
            ...styles.row,
            borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{
              ...styles.stripe,
              background: hw.status === 'late'      ? 'var(--negative)' :
                          hw.daysLeft <= 1           ? 'var(--negative)' :
                          hw.daysLeft <= 3           ? 'var(--warning)'  : 'var(--border)',
            }} />
            <div style={styles.rowContent}>
              <div style={styles.rowTop}>
                <div>
                  <span style={styles.subject}>{hw.subject}</span>
                  <p style={styles.title}>{hw.title}</p>
                  <p style={styles.description}>{hw.description}</p>
                </div>
                <div style={styles.dates}>
                  <span style={styles.dateItem}>Set {hw.setDate}</span>
                  <span style={{
                    ...styles.dateItem,
                    color: hw.status === 'late' ? 'var(--negative)' :
                           hw.daysLeft <= 1      ? 'var(--negative)' :
                           hw.daysLeft <= 3      ? 'var(--warning)'  : 'var(--text-3)',
                    fontWeight: hw.daysLeft <= 3 ? 500 : 400,
                  }}>
                    Due {hw.dueDate}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 },
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500 },
  rule: { border: 'none', borderTop: '1px solid var(--border)', marginBottom: 40 },
  legend: { display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 6 },
  groupTitle: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 },
  groupCount: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)', fontWeight: 400 },
  row: { display: 'flex', alignItems: 'stretch' },
  stripe: { width: 3, flexShrink: 0 },
  rowContent: { flex: 1, padding: '16px 20px' },
  rowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  subject: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 },
  title: { fontSize: 15, fontWeight: 500, marginBottom: 4 },
  description: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 },
  dates: { display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'right', flexShrink: 0 },
  dateItem: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
};
