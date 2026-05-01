'use client';
import { useState } from 'react';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCLesson, CCAttendanceSummary } from '@classcharts/shared';

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

function getSessionGroups(
  lessons: CCLesson[],
  sessions: Record<string, { status: string; lateMinutes: number; lessonName?: string }>,
) {
  const amSession = sessions['AM'] ?? null;
  const pmSession = sessions['PM'] ?? null;
  const periodMap = new Map<number, { status: string; lateMinutes: number; key: string }>();

  // Session keys are "Period 1", "Period 2", "Period REG" etc
  // Match to lessons by period number or lesson name
  lessons.forEach((lesson, i) => {
    if (lesson.isBreak) return;

    // Try "Period REG" for registration
    if (sessions['Period REG'] && (lesson.periodName?.toLowerCase().includes('reg') || lesson.lessonName?.toLowerCase().includes('tu'))) {
      const s = sessions['Period REG'];
      if (s.status !== 'ignore') periodMap.set(i, { ...s, key: 'REG' });
      return;
    }

    // Try "Period N" where N matches lesson periodNumber or periodName
    const periodNum = lesson.periodNumber || lesson.periodName?.replace(/\D/g, '');
    if (periodNum) {
      const key = `Period ${periodNum}`;
      if (sessions[key] && sessions[key].status !== 'ignore') {
        periodMap.set(i, { ...sessions[key], key: `P${periodNum}` });
        return;
      }
    }

    // Fallback: match by lesson name in session lessonName field
    const lessonCode = lesson.lessonName || lesson.subjectName;
    if (lessonCode) {
      const match = Object.entries(sessions).find(([k, s]) =>
        k.startsWith('Period') && s.lessonName && s.lessonName === lessonCode && s.status !== 'ignore'
      );
      if (match) {
        const num = match[0].replace('Period ', '');
        periodMap.set(i, { ...match[1], key: `P${num}` });
      }
    }
  });

  return { amSession, pmSession, periodMap };
}

// Merge two lesson arrays into time-aligned rows
function mergeByTime(a: CCLesson[], b: CCLesson[]): Array<{
  startTime: string; endTime: string;
  a: CCLesson | null; aIdx: number;
  b: CCLesson | null; bIdx: number;
  isSharedBreak: boolean;
}> {
  const rows: ReturnType<typeof mergeByTime> = [];
  let ai = 0; let bi = 0;
  while (ai < a.length || bi < b.length) {
    const la = a[ai]; const lb = b[bi];
    if (!la && !lb) break;
    const startA = la ? timeMins(la.startTime) : Infinity;
    const startB = lb ? timeMins(lb.startTime) : Infinity;
    const start = Math.min(startA, startB);

    // Both lessons start at same time
    if (startA === startB) {
      const isSharedBreak = la.isBreak && lb.isBreak;
      rows.push({ startTime: la.startTime, endTime: la.endTime, a: la, aIdx: ai, b: lb, bIdx: bi, isSharedBreak });
      ai++; bi++;
    } else if (startA < startB) {
      rows.push({ startTime: la.startTime, endTime: la.endTime, a: la, aIdx: ai, b: null, bIdx: -1, isSharedBreak: false });
      ai++;
    } else {
      rows.push({ startTime: lb.startTime, endTime: lb.endTime, a: null, aIdx: -1, b: lb, bIdx: bi, isSharedBreak: false });
      bi++;
    }
  }
  return rows;
}

// Date helpers
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
  return `${first.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

// Single pupil data hook
function usePupilDay(pupilId: number | undefined, date: string, today: string) {
  const { data: lessons } = useClassChartsData<CCLesson[]>(
    'timetable',
    { pupilId: String(pupilId ?? ''), date },
    [pupilId, date],
  );
  const from = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
  const { data: attendance } = useClassChartsData<CCAttendanceSummary>(
    'attendance',
    { pupilId: String(pupilId ?? ''), from, to: today },
    [pupilId],
  );
  const dayAtt = attendance?.days.find(d => d.date === date);
  const sessions = dayAtt?.sessions ?? {};
  const { amSession, pmSession, periodMap } = lessons
    ? getSessionGroups(lessons, sessions)
    : { amSession: null, pmSession: null, periodMap: new Map() };
  return { lessons: lessons ?? [], amSession, pmSession, periodMap, overallPct: attendance ? parseFloat(attendance.overallPercentage) : null };
}

// Session band component
function SessionBand({ label, session }: { label: string; session: { status: string; lateMinutes: number } | null }) {
  if (!session) return <div style={{ flex: 1, padding: '6px 8px', borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)' }}>{label}</div>
    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>No mark</div>
  </div>;
  const s = statusIcon(session.status);
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, background: s.bg, border: `1px solid ${s.color}33` }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.icon}</span>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{label}</div>
        <div style={{ fontSize: 9, color: 'var(--text-3)' }}>
          {session.status}{session.lateMinutes > 0 ? ` · ${session.lateMinutes}m` : ''}
        </div>
      </div>
    </div>
  );
}

// Lesson cell
function LessonCell({ lesson, att, isCurrent, isPast, accent }: {
  lesson: CCLesson | null;
  att: { status: string; lateMinutes: number; key: string } | undefined;
  isCurrent: boolean;
  isPast: boolean;
  accent?: string;
}) {
  if (!lesson) return <div style={{ flex: 1, minWidth: 0, padding: '8px 6px', opacity: 0.3, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>—</div>;
  if (lesson.isBreak) return null; // breaks handled as shared row
  const attStyle = att ? statusIcon(att.status) : null;
  return (
    <div style={{
      flex: 1, minWidth: 0, padding: '8px 6px',
      opacity: isPast ? 0.5 : 1,
      background: isCurrent ? (accent ? `${accent}15` : 'var(--info-bg)') : 'transparent',
      borderLeft: isCurrent ? `2px solid ${accent ?? '#3b82f6'}` : '2px solid transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lesson.subjectName || 'Lesson'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lesson.teacherName}{lesson.roomName ? ` · ${lesson.roomName}` : ''}
          </div>
        </div>
        {attStyle && <span style={{ fontSize: 11, fontWeight: 700, color: attStyle.color, flexShrink: 0 }}>{attStyle.icon}</span>}
      </div>
    </div>
  );
}

export default function DayPage() {
  const { pupils } = usePupil();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const weekDays = getWeekDays(selectedDate);

  const [demoMode, setDemoMode] = useState(false);
  const [demoPalette, setDemoPalette] = useState({ color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' });
  useEffect(() => {
    try {
      if (localStorage.getItem('demoMode') === 'true') setDemoMode(true);
      const dp = localStorage.getItem('demoPalette');
      if (dp) setDemoPalette(JSON.parse(dp));
    } catch { /* ignore */ }
    const h1 = (e: Event) => setDemoMode((e as CustomEvent).detail);
    const h2 = (e: Event) => setDemoPalette((e as CustomEvent).detail);
    window.addEventListener('demoModeChange', h1);
    window.addEventListener('demoPaletteChange', h2);
    return () => { window.removeEventListener('demoModeChange', h1); window.removeEventListener('demoPaletteChange', h2); };
  }, []);

  const pupilA = pupils[0];
  const pupilB = pupils[1];
  const hasDemo = demoMode && !pupilB;

  const dataA = usePupilDay(pupilA?.id, selectedDate, today);
  const dataB = usePupilDay(pupilB?.id, selectedDate, today);

  // Use pupil A's timetable as the time spine (same bell times for same school)
  // If only one pupil, just show single column
  const singlePupil = !pupilB && !hasDemo;
  const demoLessons = hasDemo ? [
    { subjectName: 'English',  teacherName: 'Mr J Thompson', roomName: 'B12',        periodName: '1', periodNumber: '1', startTime: '08:50', endTime: '09:50', isBreak: false, isAlternative: false, pupilNote: '', lessonName: null },
    { subjectName: '',         teacherName: '',               roomName: '',           periodName: 'Break', periodNumber: '', startTime: '09:50', endTime: '10:10', isBreak: true,  isAlternative: false, pupilNote: '', lessonName: 'Break' },
    { subjectName: 'Maths',    teacherName: 'Mrs A Patel',   roomName: 'C04',        periodName: '2', periodNumber: '2', startTime: '10:10', endTime: '11:10', isBreak: false, isAlternative: false, pupilNote: '', lessonName: null },
    { subjectName: 'Science',  teacherName: 'Dr R Evans',    roomName: 'Lab 2',      periodName: '3', periodNumber: '3', startTime: '11:10', endTime: '12:10', isBreak: false, isAlternative: false, pupilNote: '', lessonName: null },
    { subjectName: '',         teacherName: '',               roomName: '',           periodName: 'Lunch', periodNumber: '', startTime: '12:10', endTime: '13:00', isBreak: true,  isAlternative: false, pupilNote: '', lessonName: 'Lunch' },
    { subjectName: 'History',  teacherName: 'Miss L Davies', roomName: 'A07',        periodName: '4', periodNumber: '4', startTime: '13:00', endTime: '14:00', isBreak: false, isAlternative: false, pupilNote: '', lessonName: null },
    { subjectName: 'PE',       teacherName: 'Mr S Wilson',   roomName: 'Sports Hall', periodName: '5', periodNumber: '5', startTime: '14:00', endTime: '15:00', isBreak: false, isAlternative: false, pupilNote: '', lessonName: null },
  ] : [];
  const bLessons = pupilB ? dataB.lessons : (hasDemo ? demoLessons : []);
  const rows = singlePupil ? [] : mergeByTime(dataA.lessons, bLessons);

  // Accent colours
  const accentA = 'var(--accent, #6366f1)';

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <p style={styles.eyebrow}>Timetable & Attendance</p>
          <h1 style={styles.pageTitle}>
            {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </h1>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          {[
            { p: pupilA, d: dataA },
            ...(pupilB ? [{ p: pupilB, d: dataB }] : []),
            ...(hasDemo ? [{ p: { id: -1, firstName: 'Demo' }, d: { overallPct: 98 } }] : []),
          ].filter(x => x.p).map(({ p, d }) => (
            <div key={(p as any).id} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: (d as any).overallPct == null ? 'var(--text-3)' : (d as any).overallPct >= 95 ? 'var(--positive)' : (d as any).overallPct >= 90 ? 'var(--warning)' : 'var(--negative)' }}>
                {(d as any).overallPct?.toFixed(0) ?? '—'}%
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{(p as any).firstName}</div>
              <div style={{ fontSize: 8, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>this year</div>
            </div>
          ))}
        </div>
      </div>

      {/* Week nav */}
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
          }}>{label}</button>
        ))}
      </div>

      {/* AM/PM session bands */}
      {pupils.length > 1 ? (
        <>
          {/* Two-column AM/PM */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 44, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{pupilA?.firstName}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <SessionBand label="AM" session={dataA.amSession} />
                <SessionBand label="PM" session={dataA.pmSession} />
              </div>
            </div>
            {(pupilB || hasDemo) && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {pupilB?.firstName ?? 'Demo'}{hasDemo && <span style={{ fontSize: 8, marginLeft: 4, opacity: 0.6 }}>DEMO</span>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <SessionBand label="AM" session={hasDemo ? { status: 'present', lateMinutes: 0 } : dataB.amSession} />
                <SessionBand label="PM" session={hasDemo ? { status: 'present', lateMinutes: 0 } : dataB.pmSession} />
              </div>
            </div>}
          </div>

          {/* Side-by-side lesson rows */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {rows.map((row, i) => {
              const isCurrent = isToday && nowMins >= timeMins(row.startTime) && nowMins < timeMins(row.endTime);
              const isPast = isToday && nowMins >= timeMins(row.endTime);

              if (row.isSharedBreak) {
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ width: 44, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{extractHHMM(row.startTime)}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', flex: 1 }}>
                      {row.a?.lessonName || row.a?.periodName || 'Break'}
                    </span>
                  </div>
                );
              }

              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'stretch', gap: 0,
                  borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                  background: isCurrent ? 'var(--info-bg, #eff6ff)' : 'transparent',
                }}>
                  {/* Time */}
                  <div style={{ width: 44, flexShrink: 0, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text)', opacity: isPast ? 0.5 : 1 }}>{extractHHMM(row.startTime)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>{extractHHMM(row.endTime)}</span>
                  </div>
                  {/* Divider */}
                  <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />
                  {/* Pupil A */}
                  <LessonCell
                    lesson={row.a}
                    att={row.aIdx >= 0 ? dataA.periodMap.get(row.aIdx) : undefined}
                    isCurrent={isCurrent}
                    isPast={isPast}
                  />
                  {/* Divider */}
                  <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />
                  {/* Pupil B */}
                  <LessonCell
                    lesson={row.b}
                    att={row.bIdx >= 0 && !hasDemo ? dataB.periodMap.get(row.bIdx) : undefined}
                    isCurrent={isCurrent}
                    isPast={isPast}
                  />
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Single pupil AM/PM */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <SessionBand label="AM" session={dataA.amSession} />
            <SessionBand label="PM" session={dataA.pmSession} />
          </div>

          {/* Single column lessons */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {!dataA.lessons.length ? (
              <p style={{ padding: '24px 20px', fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>No lessons on this day</p>
            ) : (
              dataA.lessons.map((lesson, i) => {
                const isCurrent = isToday && nowMins >= timeMins(lesson.startTime) && nowMins < timeMins(lesson.endTime);
                const isPast = isToday && nowMins >= timeMins(lesson.endTime);
                const att = dataA.periodMap.get(i);
                const attStyle = att ? statusIcon(att.status) : null;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                    background: isCurrent ? 'var(--info-bg)' : lesson.isBreak ? 'var(--surface-2)' : 'transparent',
                    borderBottom: i < dataA.lessons.length - 1 ? '1px solid var(--border)' : 'none',
                    opacity: isPast && !lesson.isBreak ? 0.55 : 1,
                    borderLeft: isCurrent ? '3px solid #3b82f6' : '3px solid transparent',
                  }}>
                    <div style={{ width: 44, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{extractHHMM(lesson.startTime)}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{extractHHMM(lesson.endTime)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {lesson.isBreak ? (
                        <span style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>{lesson.lessonName || lesson.periodName || 'Break'}</span>
                      ) : (
                        <>
                          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{lesson.subjectName || 'Lesson'}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {lesson.teacherName}{lesson.roomName ? ` · ${lesson.roomName}` : ''}{lesson.periodName ? ` · P${lesson.periodName}` : ''}
                          </p>
                          {lesson.pupilNote && <p style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>📝 {lesson.pupilNote}</p>}
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: 36, flexShrink: 0 }}>
                      {attStyle && att && (
                        <>
                          <span style={{ fontSize: 12, fontWeight: 700, color: attStyle.color }}>{attStyle.icon}</span>
                          <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{att.key}</span>
                          {att.lateMinutes > 0 && <span style={{ fontSize: 9, color: 'var(--warning)' }}>{att.lateMinutes}m</span>}
                        </>
                      )}
                      {isCurrent && <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Now</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 700, margin: '0 auto', padding: '12px 12px 56px' },
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 },
  eyebrow: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 },
  pageTitle: { fontSize: 20, fontWeight: 700 },
  weekNav: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  navBtn: { fontSize: 14, background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-2)' },
  weekLabel: { flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textAlign: 'center' },
  dayTabs: { display: 'flex', gap: 3, background: 'var(--surface-2)', padding: 3, borderRadius: 6, marginBottom: 10 },
  dayTab: { flex: 1, padding: '6px 2px', borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--text-2)', textAlign: 'center' },
  dayTabActive: { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow)' },
};
