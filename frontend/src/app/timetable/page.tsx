export default function TimetablePage() {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = ['1', '2', '3', 'L', '4', '5'];

  const timetable: Record<string, Record<string, { subject: string; teacher: string; room: string } | null>> = {
    '1': {
      Monday: { subject: 'English Literature', teacher: 'Ms. Harrison', room: 'E12' },
      Tuesday: { subject: 'Mathematics',        teacher: 'Mr. Patel',    room: 'M4'  },
      Wednesday: { subject: 'Science — Physics', teacher: 'Mr. Wright',  room: 'S3'  },
      Thursday: { subject: 'French',             teacher: 'Mme. Dubois', room: 'L3'  },
      Friday: { subject: 'Geography',            teacher: 'Mr. Thomson', room: 'G2'  },
    },
    '2': {
      Monday: { subject: 'Mathematics',          teacher: 'Mr. Patel',    room: 'M4'  },
      Tuesday: { subject: 'English Literature',  teacher: 'Ms. Harrison', room: 'E12' },
      Wednesday: { subject: 'History',           teacher: 'Mrs. Simmons', room: 'H6'  },
      Thursday: { subject: 'Mathematics',        teacher: 'Mr. Patel',    room: 'M4'  },
      Friday: { subject: 'Science — Biology',    teacher: 'Dr. Chen',     room: 'S7'  },
    },
    '3': {
      Monday: { subject: 'Geography',            teacher: 'Mr. Thomson',  room: 'G2'  },
      Tuesday: { subject: 'Science — Chemistry', teacher: 'Ms. Webb',     room: 'S1'  },
      Wednesday: { subject: 'PE',                teacher: 'Mr. Davies',   room: 'Gym' },
      Thursday: { subject: 'Art',                teacher: 'Ms. Park',     room: 'A2'  },
      Friday: { subject: 'English Literature',   teacher: 'Ms. Harrison', room: 'E12' },
    },
    'L': { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null },
    '4': {
      Monday: { subject: 'Science — Biology',   teacher: 'Dr. Chen',     room: 'S7'  },
      Tuesday: { subject: 'Geography',          teacher: 'Mr. Thomson',  room: 'G2'  },
      Wednesday: { subject: 'Mathematics',      teacher: 'Mr. Patel',    room: 'M4'  },
      Thursday: { subject: 'English Language',  teacher: 'Ms. Harrison', room: 'E12' },
      Friday: { subject: 'History',             teacher: 'Mrs. Simmons', room: 'H6'  },
    },
    '5': {
      Monday: { subject: 'French',              teacher: 'Mme. Dubois',  room: 'L3'  },
      Tuesday: { subject: 'History',            teacher: 'Mrs. Simmons', room: 'H6'  },
      Wednesday: { subject: 'French',           teacher: 'Mme. Dubois',  room: 'L3'  },
      Thursday: { subject: 'Science — Physics', teacher: 'Mr. Wright',   room: 'S3'  },
      Friday: { subject: 'PE',                  teacher: 'Mr. Davies',   room: 'Gym' },
    },
  };

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
  const times: Record<string, string> = { '1': '08:50', '2': '09:50', '3': '10:50', 'L': '12:00', '4': '13:00', '5': '14:00' };

  const subjectColours: Record<string, string> = {
    'Mathematics': '#dbeafe', 'English Literature': '#fce7f3', 'English Language': '#fce7f3',
    'Science — Biology': '#dcfce7', 'Science — Chemistry': '#dcfce7', 'Science — Physics': '#dcfce7',
    'Geography': '#fef9c3', 'History': '#ffedd5', 'French': '#f3e8ff',
    'Art': '#fdf4ff', 'PE': '#ecfdf5',
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Timetable</h1>
      </div>
      <hr style={styles.rule} />

      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Header row */}
        <div style={styles.headerRow}>
          <div style={styles.timeCol} />
          {days.map(d => (
            <div key={d} style={{ ...styles.dayHeader, fontWeight: d === today ? 700 : 500, borderBottom: d === today ? '2px solid var(--text)' : '2px solid transparent' }}>
              {d}
            </div>
          ))}
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border-strong)' }} />

        {/* Period rows */}
        {periods.map((period, pi) => {
          const isLunch = period === 'L';
          return (
            <div key={period} style={{ ...styles.periodRow, background: isLunch ? 'var(--surface-2)' : 'transparent', borderBottom: pi < periods.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={styles.timeCol}>
                <span style={styles.periodNum}>{isLunch ? 'L' : period}</span>
                <span style={styles.periodTime}>{times[period]}</span>
              </div>
              {days.map(day => {
                const lesson = timetable[period][day];
                if (isLunch) return (
                  <div key={day} style={styles.lunchCell}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Lunch</span>
                  </div>
                );
                if (!lesson) return <div key={day} style={styles.cell} />;
                const isToday = day === today;
                return (
                  <div key={day} style={{
                    ...styles.cell,
                    background: isToday ? subjectColours[lesson.subject] ?? 'var(--info-bg)' : 'transparent',
                    borderLeft: isToday ? '3px solid rgba(0,0,0,0.15)' : '3px solid transparent',
                  }}>
                    <span style={styles.cellSubject}>{lesson.subject}</span>
                    <span style={styles.cellMeta}>{lesson.room}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { marginBottom: 24 },
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500 },
  rule: { border: 'none', borderTop: '1px solid var(--border)', marginBottom: 40 },
  headerRow: { display: 'grid', gridTemplateColumns: '60px repeat(5, 1fr)', },
  dayHeader: { padding: '12px 16px', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text)', textAlign: 'center' as const },
  periodRow: { display: 'grid', gridTemplateColumns: '60px repeat(5, 1fr)', minHeight: 72 },
  timeCol: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 2, padding: '8px 4px', borderRight: '1px solid var(--border)' },
  periodNum: { fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--text-2)' },
  periodTime: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' },
  cell: { padding: '10px 14px', borderLeft: '3px solid transparent', display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', gap: 2 },
  lunchCell: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cellSubject: { fontSize: 12, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 },
  cellMeta: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
};
