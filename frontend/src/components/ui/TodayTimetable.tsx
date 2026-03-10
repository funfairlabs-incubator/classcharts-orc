// Server component
export async function TodayTimetable() {
  // TODO: replace with real ClassCharts timetable data
  const lessons = [
    { period: '1', time: '08:50', subject: 'English Literature', teacher: 'Ms. Harrison', room: 'E12' },
    { period: '2', time: '09:50', subject: 'Mathematics', teacher: 'Mr. Patel', room: 'M4' },
    { period: '3', time: '10:50', subject: 'Geography', teacher: 'Mr. Thomson', room: 'G2' },
    { period: 'L', time: '12:00', subject: 'Lunch', teacher: '', room: '' },
    { period: '4', time: '13:00', subject: 'Science — Biology', teacher: 'Dr. Chen', room: 'S7' },
    { period: '5', time: '14:00', subject: 'French', teacher: 'Mme. Dubois', room: 'L3' },
  ];

  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentMins = currentHour * 60 + currentMin;

  function lessonMins(time: string) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  function isCurrent(time: string, nextTime?: string) {
    const start = lessonMins(time);
    const end = nextTime ? lessonMins(nextTime) : start + 60;
    return currentMins >= start && currentMins < end;
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {lessons.map((lesson, i) => {
        const current = isCurrent(lesson.time, lessons[i + 1]?.time);
        const isLunch = lesson.period === 'L';
        return (
          <div
            key={i}
            style={{
              ...styles.row,
              ...(current ? styles.rowCurrent : {}),
              ...(isLunch ? styles.rowLunch : {}),
              borderBottom: i < lessons.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={styles.time}>{lesson.time}</span>
            <div style={styles.lessonInfo}>
              <span style={{ ...styles.subject, ...(isLunch ? styles.lunchText : {}) }}>
                {lesson.subject}
              </span>
              {lesson.teacher && (
                <span style={styles.meta}>{lesson.teacher} · {lesson.room}</span>
              )}
            </div>
            {current && <span className="chip chip--info" style={{ fontSize: 10 }}>Now</span>}
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '14px 20px',
    transition: 'background 0.15s',
  },
  rowCurrent: {
    background: 'var(--info-bg)',
  },
  rowLunch: {
    background: 'var(--surface-2)',
  },
  time: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    color: 'var(--text-3)',
    width: 40,
    flexShrink: 0,
  },
  lessonInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  subject: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text)',
  },
  lunchText: {
    color: 'var(--text-3)',
    fontWeight: 400,
  },
  meta: {
    fontSize: 12,
    color: 'var(--text-3)',
  },
};
