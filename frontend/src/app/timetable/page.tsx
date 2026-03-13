'use client';
import { useState } from 'react';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCLesson } from '@classcharts/shared';

export default function TimetablePage() {
  const { activePupil } = usePupil();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: lessons, loading, error } = useClassChartsData<CCLesson[]>(
    'timetable',
    { pupilId: String(activePupil?.id ?? ''), date: selectedDate },
    [activePupil?.id, selectedDate],
  );

  const weekDays = getWeekDays(selectedDate);

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Timetable</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={styles.weekNav}>
          <button style={styles.navBtn} onClick={() => setSelectedDate(shiftDate(selectedDate, -7))}>← Prev week</button>
          <span style={styles.weekLabel}>{formatWeek(selectedDate)}</span>
          <button style={styles.navBtn} onClick={() => setSelectedDate(shiftDate(selectedDate, 7))}>Next week →</button>
        </div>
      </div>
      <hr style={styles.rule} />

      <div style={styles.dayTabs}>
        {weekDays.map(({ date, label, isToday }) => (
          <button
            key={date}
            onClick={() => setSelectedDate(date)}
            style={{
              ...styles.dayTab,
              ...(date === selectedDate ? styles.dayTabActive : {}),
              ...(isToday ? styles.dayTabToday : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div style={{ height: 300, background: 'var(--surface-2)', borderRadius: 4, marginTop: 24 }} />}
      {error && <p style={{ color: 'var(--negative)', fontSize: 14, marginTop: 24 }}>{error}</p>}

      {!loading && !error && (
        <div className="card" style={{ overflow: 'hidden', marginTop: 24 }}>
          {!lessons?.length ? (
            <p style={{ padding: 20, fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>No lessons on this day</p>
          ) : (
            lessons.map((lesson, i) => {
              const now = new Date();
              const currentMins = now.getHours() * 60 + now.getMinutes();
              const startMins = timeMins(lesson.startTime);
              const endMins = timeMins(lesson.endTime);
              const isCurrent = selectedDate === now.toISOString().split('T')[0] && currentMins >= startMins && currentMins < endMins;

              return (
                <div key={i} style={{
                  ...styles.lessonRow,
                  background: isCurrent ? 'var(--info-bg)' : lesson.isBreak ? 'var(--surface-2)' : 'transparent',
                  borderBottom: i < lessons.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={styles.timeBlock}>
                    <span style={styles.startTime}>{extractHHMM(lesson.startTime)}</span>
                    <span style={styles.endTime}>{extractHHMM(lesson.endTime)}</span>
                  </div>
                  <div style={styles.lessonDetail}>
                    <p style={{ ...styles.subject, color: lesson.isBreak ? 'var(--text-3)' : 'var(--text)' }}>
                      {lesson.isBreak ? lesson.lessonName : lesson.subjectName}
                    </p>
                    {!lesson.isBreak && (
                      <p style={styles.meta}>
                        {lesson.teacherName}{lesson.roomName ? ` · ${lesson.roomName}` : ''}
                        {lesson.periodName ? ` · Period ${lesson.periodName}` : ''}
                      </p>
                    )}
                    {lesson.pupilNote && <p style={styles.note}>📝 {lesson.pupilNote}</p>}
                  </div>
                  {isCurrent && <span className="chip chip--info" style={{ fontSize: 10 }}>Now</span>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function extractHHMM(t: string): string {
  if (!t) return '00:00';
  const match = t.match(/(\d{2}:\d{2})/);
  return match ? match[1] : '00:00';
}

function timeMins(t: string) {
  const [h, m] = extractHHMM(t).split(':').map(Number);
  return h * 60 + m;
}

function getWeekDays(dateStr: string) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  const today = new Date().toISOString().split('T')[0];

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    return {
      date: ds,
      label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
      isToday: ds === today,
    };
  });
}

function shiftDate(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatWeek(dateStr: string) {
  const days = getWeekDays(dateStr);
  const first = new Date(days[0].date);
  const last = new Date(days[4].date);
  const sameMonth = first.getMonth() === last.getMonth();
  const firstStr = first.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const lastStr = last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const year = last.getFullYear();
  return `${firstStr} – ${lastStr} ${year}`;
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  pageTitle: { fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' },
  rule: { border: 'none', borderTop: '1px solid var(--border)', marginBottom: 24 },
  weekNav: { display: 'flex', alignItems: 'center', gap: 16 },
  navBtn: { fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' },
  weekLabel: { fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', minWidth: 180, textAlign: 'center' },
  dayTabs: { display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 4, borderRadius: 6, width: 'fit-content' },
  dayTab: { padding: '8px 16px', borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-2)', fontWeight: 500 },
  dayTabActive: { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow)' },
  dayTabToday: { fontWeight: 700 },
  lessonRow: { display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px' },
  timeBlock: { display: 'flex', flexDirection: 'column', gap: 2, width: 48, flexShrink: 0 },
  startTime: { fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  endTime: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' },
  lessonDetail: { flex: 1 },
  subject: { fontSize: 15, fontWeight: 500, marginBottom: 2 },
  meta: { fontSize: 12, color: 'var(--text-3)' },
  note: { fontSize: 12, color: 'var(--text-2)', marginTop: 4 },
};
