export async function HomeworkDue() {
  // TODO: replace with real data
  const homework = [
    { id: 1, subject: 'Mathematics',      title: 'Quadratic equations worksheet', dueDate: 'Tomorrow',    status: 'todo',      daysLeft: 1 },
    { id: 2, subject: 'English',          title: 'Essay — Of Mice and Men',       dueDate: 'Thu 13 Mar',  status: 'todo',      daysLeft: 3 },
    { id: 3, subject: 'Science',          title: 'Lab report — photosynthesis',   dueDate: 'Fri 14 Mar',  status: 'completed', daysLeft: 4 },
  ];

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {homework.map((hw, i) => (
        <div
          key={hw.id}
          style={{
            ...styles.row,
            borderBottom: i < homework.length - 1 ? '1px solid var(--border)' : 'none',
            opacity: hw.status === 'completed' ? 0.5 : 1,
          }}
        >
          {/* Urgency stripe */}
          <div style={{
            ...styles.stripe,
            background: hw.daysLeft <= 1 ? 'var(--negative)' :
                        hw.daysLeft <= 3 ? 'var(--warning)' : 'var(--border)',
          }} />
          <div style={styles.content}>
            <div style={styles.top}>
              <span style={styles.subject}>{hw.subject}</span>
              <span style={{
                ...styles.due,
                color: hw.daysLeft <= 1 ? 'var(--negative)' :
                       hw.daysLeft <= 3 ? 'var(--warning)' : 'var(--text-3)',
              }}>
                {hw.dueDate}
              </span>
            </div>
            <p style={styles.title}>{hw.title}</p>
          </div>
          {hw.status === 'completed' && (
            <span style={styles.tick}>✓</span>
          )}
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 0,
  },
  stripe: {
    width: 3,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subject: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  due: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
  },
  title: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text)',
    lineHeight: 1.4,
  },
  tick: {
    padding: '14px 16px',
    color: 'var(--positive)',
    fontSize: 14,
    fontWeight: 500,
  },
};
