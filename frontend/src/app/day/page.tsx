'use client';
import { useState } from 'react';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCLesson, CCAttendanceSummary } from '@classcharts/shared';

// ── Attendance mark → lesson slot mapping ─────────────────────────────────
// ClassCharts returns sessions keyed as: AM, PM, 1, 2, 3... or Reg
// We map these onto the timetable by time + period number
function mapAttendanceToLessons(
  lessons: CCLesson[],
  sessions: Record<string, { status: string; lateMinutes: number }>,
  date: string,
): Map<number, { status: string; lateMinutes: number; key: string }> {
  const result = new Map<number, { status: string; lateMinutes: number; key: string }>();
  if (!sessions) return result;

  const lunchCutoff = 12 * 60; // 12:00

  lessons.forEach((lesson, i) => {
    const startMins = timeMins(lesson.startTime);
    const isAM = startMins < lunchCutoff;

    // Try period number match first (most accurate)
    const periodNum = lesson.periodName?.replace(/\D/g, '');
    if (periodNum && sessions[periodNum]) {
      result.set(i, { ...sessions[periodNum], key: periodNum });
      return;
    }

    // Try AM/PM session match
    const sessionKey = isAM ? 'AM' : 'PM';
    if (sessions[sessionKey] && !result.has(i)) {
      // Only apply AM/PM to the first non-break lesson in each half
      const halfLessons = lessons.filter((l, idx) => {
        const sm = timeMins(l.startTime);
        return !l.isBreak && (isAM ? sm < lunchCutoff : sm >= lunchCutoff);
      });
      if (halfLessons[0] === lesson) {
        result.set(i, { ...sessions[sessionKey], key: sessionKey });
      }
    }

    // Reg → first lesson of day
    if (sessions['Reg'] && i === 0) {
      result.set(i, { ...sessions['Reg'], key: 'Reg' });
    }
  });

  return result;
}

function timeMins(t: string): number {
  if (!t) return 0;
  const match = t.match(/(\d{2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function extractHHMM(t: string): string {
  if (!t) return '00:00';
  const match = t.match(/(\d{2}:\d{2})/);
  return match ? match[1] : '00:00';
}

function statusIcon(status: string): { icon: string; color: string; bg: string } {
  switch (status) {
    case 'present':  return { icon: '✓', color: 'var(--positive)',  bg: 'var(--positive-bg)' };
    case 'absent':   return { icon: '✗', color: 'var(--negative)',  bg: 'var(--negative-bg)' };
    case 'late':     return { icon: 'L', color: 'var(--warning)',   bg: 'var(--warning-bg)'  };
    case 'excused':  return { icon: 'E', color: 'var(--text-2)',    bg: 'var(--surface-2)'   };
    default:         return { icon: '·', color: 'var(--text-3)',    bg: 'transparent'         };
  }
}

// ── Date helpers ──────────────────────────────────────────────
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
    return { date: ds, label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }), isToday: ds === today };
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
  const firstStr = first.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const lastStr = last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${firstStr} – ${lastStr}`;
}

// ── Component ─────────────────────────────────────────────────
export default function DayPage() {
  const { activePupil } = usePupil();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  const { data: lessons, loading: lessonsLoading } = useClassChartsData<CCLesson[]>(
    'timetable',
    { pupilId: String(activePupil?.id ?? ''), date: selectedDate },
    [activePupil?.id, selectedDate],
  );

  // Get attendance for a 60-day window
  const from = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
  const { data: attendance } = useClassChartsData<CCAttendanceSummary>(
    'attendance',
    { pupilId: String(activePupil?.id ?? ''), from, to: today },
    [activePupil?.id],
  );

  // Find attendance for selected date
  const dayAttendance = attendance?.days.find(d => d.date === selectedDate);
  const sessions = dayAttendance?.sessions ?? {};

  // Map attendance to lessons
  const attendanceMap = lessons ? mapAttendanceToLessons(lessons, sessions, selectedDate) : new Map();

  const weekDays = getWeekDays(selectedDate);
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

  // Overall attendance % for display
  const overallPct = attendance ? parseFloat(attendance.overallPercentage) : null;
  const pctColor = overallPct == null ? 'var(--text-3)' : overallPct >= 95 ? 'var(--positive)' : overallPct >= 90 ? 'var(--warning)' : 'var(--negative)';

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <p style={styles.eyebrow}>{activePupil?.firstName ?? 'Student'}</p>
          <h1 style={styles.pageTitle}>Day View</h1>
        </div>
        {overallPct != null && (
          <div style={styles.pctBadge}>
            <span style={{ ...styles.pctValue, color: pctColor }}>{overallPct.toFixed(1)}%</span>
            <span style={styles.pctLabel}>Attendance</span>
          </div>
        )}
      </div>

      {/* Week navigation */}
      <div style={styles.weekNav}>
        <button style={styles.navBtn} onClick={() => setSelectedDate(shiftDate(selectedDate, -7))}>←</button>
        <span style={styles.weekLabel}>{formatWeek(selectedDate)}</span>
        <button style={styles.navBtn} onClick={() => setSelectedDate(shiftDate(selectedDate, 7))}>→</button>
      </div>

      {/* Day tabs */}
      <div style={styles.dayTabs}>
        {weekDays.map(({ date, label, isToday: isTodayTab }) => (
          <button key={date} onClick={() => setSelectedDate(date)} style={{
            ...styles.dayTab,
            ...(date === selectedDate ? styles.dayTabActive : {}),
            fontWeight: isTodayTab ? 700 : 400,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {[
          { label: 'Present', status: 'present' },
          { label: 'Late', status: 'late' },
          { label: 'Absent', status: 'absent' },
          { label: 'Excused', status: 'excused' },
        ].map(({ label, status }) => {
          const s = statusIcon(status);
          return (
            <span key={status} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-2)' }}>
              <span style={{ ...styles.attBadge, color: s.color, background: s.bg }}>{s.icon}</span>
              {label}
            </span>
          );
        })}
      </div>

      {/* Lesson list */}
      {lessonsLoading && <div style={{ height: 300, background: 'var(--surface-2)', borderRadius: 8, marginTop: 16 }} />}

      {!lessonsLoading && (
        <div className="card" style={{ overflow: 'hidden', marginTop: 12 }}>
          {!lessons?.length ? (
            <p style={{ padding: '24px 20px', fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>
              No lessons on this day
            </p>
          ) : (
            lessons.map((lesson, i) => {
              const startMins = timeMins(lesson.startTime);
              const endMins = timeMins(lesson.endTime);
              const isCurrent = isToday && nowMins >= startMins && nowMins < endMins;
              const isPast = isToday && nowMins >= endMins;
              const att = attendanceMap.get(i);
              const attStyle = att ? statusIcon(att.status) : null;

              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: isCurrent ? 'var(--info-bg, #eff6ff)' : lesson.isBreak ? 'var(--surface-2)' : 'transparent',
                  borderBottom: i < lessons.length - 1 ? '1px solid var(--border)' : 'none',
                  opacity: isPast && !lesson.isBreak ? 0.55 : 1,
                  borderLeft: isCurrent ? '3px solid #3b82f6' : '3px solid transparent',
                }}>
                  {/* Time */}
                  <div style={{ width: 44, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                      {extractHHMM(lesson.startTime)}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                      {extractHHMM(lesson.endTime)}
                    </span>
                  </div>

                  {/* Subject + detail */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {lesson.isBreak ? (
                      <span style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
                        {lesson.lessonName || lesson.periodName || 'Break'}
                      </span>
                    ) : (
                      <>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                          {lesson.subjectName || 'Lesson'}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          {lesson.teacherName}
                          {lesson.roomName ? ` · ${lesson.roomName}` : ''}
                          {lesson.periodName ? ` · P${lesson.periodName}` : ''}
                        </p>
                        {lesson.pupilNote && (
                          <p style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>📝 {lesson.pupilNote}</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Attendance badge */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: 36, flexShrink: 0 }}>
                    {attStyle && att && (
                      <>
                        <span style={{ ...styles.attBadge, color: attStyle.color, background: attStyle.bg, fontSize: 12, fontWeight: 700 }}>
                          {attStyle.icon}
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                          {att.key}
                        </span>
                        {att.lateMinutes > 0 && (
                          <span style={{ fontSize: 9, color: 'var(--warning)' }}>{att.lateMinutes}m</span>
                        )}
                      </>
                    )}
                    {isCurrent && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Now</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 640, margin: '0 auto', padding: '12px 12px 56px' },
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 },
  pageTitle: { fontSize: 22, fontWeight: 700 },
  pctBadge: { textAlign: 'right' },
  pctValue: { fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', display: 'block', lineHeight: 1 },
  pctLabel: { fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  weekNav: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
  navBtn: { fontSize: 14, background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-2)' },
  weekLabel: { flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textAlign: 'center' },
  dayTabs: { display: 'flex', gap: 3, background: 'var(--surface-2)', padding: 3, borderRadius: 6, marginBottom: 10 },
  dayTab: { flex: 1, padding: '6px 4px', borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--text-2)', textAlign: 'center' },
  dayTabActive: { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow)' },
  legend: { display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' },
  attBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' },
};
