'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCLesson } from '@classcharts/shared';

export function TodayTimetable() {
  const { activePupil } = usePupil();
  const today = new Date().toISOString().split('T')[0];

  const { data: lessons, loading, error } = useClassChartsData<CCLesson[]>(
    'timetable',
    { pupilId: String(activePupil?.id ?? ''), date: today },
    [activePupil?.id],
  );

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} />;
  if (!lessons?.length) return <Empty message="No lessons today" />;

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  function timeMins(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {lessons.map((lesson, i) => {
        const start = timeMins(lesson.startTime);
        const end = timeMins(lesson.endTime);
        const isCurrent = currentMins >= start && currentMins < end;
        const isPast = currentMins >= end;

        return (
          <div key={`${lesson.periodNumber}-${i}`} style={{
            ...styles.row,
            background: isCurrent ? 'var(--info-bg)' : lesson.isBreak ? 'var(--surface-2)' : 'transparent',
            opacity: isPast && !isCurrent ? 0.5 : 1,
            borderBottom: i < lessons.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={styles.time}>{lesson.startTime.slice(0, 5)}</span>
            <div style={styles.lessonInfo}>
              <span style={{ ...styles.subject, color: lesson.isBreak ? 'var(--text-3)' : 'var(--text)' }}>
                {lesson.isBreak ? lesson.lessonName : lesson.subjectName}
              </span>
              {!lesson.isBreak && (
                <span style={styles.meta}>
                  {lesson.teacherName}{lesson.roomName ? ` · ${lesson.roomName}` : ''}
                </span>
              )}
            </div>
            {isCurrent && <span className="chip chip--info" style={{ fontSize: 10 }}>Now</span>}
          </div>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[80, 65, 75, 60, 70, 65].map((w, i) => (
        <div key={i} style={{ height: 14, background: 'var(--surface-2)', borderRadius: 4, width: `${w}%` }} />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return <div className="card" style={{ padding: 20, fontSize: 13, color: 'var(--negative)' }}>{message}</div>;
}

function Empty({ message }: { message: string }) {
  return <div className="card" style={{ padding: 20, fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>{message}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', transition: 'background 0.15s' },
  time: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)', width: 40, flexShrink: 0 },
  lessonInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  subject: { fontSize: 14, fontWeight: 500 },
  meta: { fontSize: 12, color: 'var(--text-3)' },
};
