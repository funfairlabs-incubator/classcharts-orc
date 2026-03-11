'use client';
import Link from 'next/link';

interface Lesson {
  subjectName: string;
  teacherName: string;
  roomName: string;
  periodName: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  isAlternative: boolean;
  pupilNote: string;
}

interface Props {
  lessons: Lesson[];
  href: string;
  accent: { color: string; bg: string; border: string };
}

function extractTime(t: string): string {
  // Handles "09:00", "2026-03-11T09:00:00", "2026-03-11 09:00:00"
  if (!t) return '00:00';
  const match = t.match(/(\d{2}:\d{2})/);
  return match ? match[1] : '00:00';
}

function timeMins(t: string) {
  const [h, m] = extractTime(t).split(':').map(Number);
  return h * 60 + m;
}

function fmtTime(t: string) {
  return extractTime(t);
}

function guessBreakLabel(periodName: string, startTime: string): string {
  const name = (periodName || '').toLowerCase();
  if (name.includes('lunch')) return 'Lunch';
  if (name.includes('break') || name.includes('reg')) return 'Break';
  // Fall back to time heuristic
  const m = timeMins(startTime);
  if (m >= 720 && m <= 810) return 'Lunch'; // 12:00–13:30
  if (m >= 580 && m <= 640) return 'Break'; // 9:40–10:40
  return 'Break';
}

export function TimetableTimeline({ lessons, href, accent }: Props) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  // School day bounds
  const allLessons = lessons ?? [];
  const firstStart = allLessons.length ? timeMins(allLessons[0].startTime) : 480;
  const lastEnd = allLessons.length ? timeMins(allLessons[allLessons.length - 1].endTime) : 1020;
  const daySpan = lastEnd - firstStart || 1;

  // What's happening now
  const currentSlot = allLessons.find(l =>
    nowMins >= timeMins(l.startTime) && nowMins < timeMins(l.endTime)
  );

  const beforeSchool = nowMins < firstStart;
  const afterSchool = nowMins >= lastEnd;

  // Determine the "now" status label
  let nowStatus: { label: string; sub: string; urgent?: boolean } | null = null;
  if (!beforeSchool && !afterSchool) {
    if (currentSlot) {
      if (currentSlot.isBreak) {
        nowStatus = { label: guessBreakLabel(currentSlot.periodName, currentSlot.startTime), sub: `until ${fmtTime(currentSlot.endTime)}` };
      } else if (currentSlot.isAlternative) {
        nowStatus = { label: currentSlot.subjectName || 'Alternative lesson', sub: currentSlot.pupilNote || 'Timetable may have changed', urgent: true };
      } else {
        nowStatus = { label: currentSlot.subjectName, sub: `${currentSlot.teacherName}${currentSlot.roomName ? ` · ${currentSlot.roomName}` : ''}` };
      }
    } else {
      // Gap between lessons — shouldn't normally happen, but handle gracefully
      const next = allLessons.find(l => timeMins(l.startTime) > nowMins);
      if (next) {
        nowStatus = { label: 'Between lessons', sub: `Next: ${next.isBreak ? guessBreakLabel(next.periodName, next.startTime) : next.subjectName} at ${fmtTime(next.startTime)}`, urgent: true };
      }
    }
  }

  // Arrow position as % of day
  const arrowPct = beforeSchool ? 0 : afterSchool ? 100
    : Math.min(100, Math.max(0, ((nowMins - firstStart) / daySpan) * 100));

  const showArrow = !beforeSchool && !afterSchool;

  return (
    <div>
      {/* "Now" status banner */}
      {nowStatus && (
        <div style={{
          ...styles.nowBanner,
          background: nowStatus.urgent ? '#fef2f2' : accent.bg,
          borderColor: nowStatus.urgent ? '#fecaca' : accent.border,
        }}>
          <div style={{ ...styles.nowDot, background: nowStatus.urgent ? '#dc2626' : accent.color }} />
          <div>
            <span style={{ ...styles.nowLabel, color: nowStatus.urgent ? '#b91c1c' : accent.color }}>
              {nowStatus.label}
            </span>
            {nowStatus.sub && (
              <span style={styles.nowSub}> · {nowStatus.sub}</span>
            )}
          </div>
        </div>
      )}
      {beforeSchool && (
        <div style={{ ...styles.nowBanner, background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <span style={styles.nowSub}>School starts at {allLessons[0] ? fmtTime(allLessons[0].startTime) : '—'}</span>
        </div>
      )}
      {afterSchool && (
        <div style={{ ...styles.nowBanner, background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <span style={styles.nowSub}>School day finished</span>
        </div>
      )}

      {/* Timeline bar */}
      {allLessons.length > 0 && (
        <div style={styles.timelineWrap}>
          <div style={styles.timelineTrack}>
            {allLessons.map((l, i) => {
              const startPct = ((timeMins(l.startTime) - firstStart) / daySpan) * 100;
              const widthPct = ((timeMins(l.endTime) - timeMins(l.startTime)) / daySpan) * 100;
              const isCurrent = currentSlot === l;
              const isPast = nowMins >= timeMins(l.endTime);
              const bg = l.isBreak ? 'var(--surface-2)'
                : l.isAlternative ? '#fef3c7'
                : isCurrent ? accent.color
                : isPast ? '#d1d5db'
                : accent.bg;
              const border = l.isBreak ? 'var(--border)'
                : l.isAlternative ? '#fbbf24'
                : isCurrent ? accent.color
                : accent.border;
              return (
                <div key={i} title={l.isBreak ? guessBreakLabel(l.periodName, l.startTime) : `${l.subjectName} — ${fmtTime(l.startTime)}`} style={{
                  position: 'absolute',
                  left: `${startPct}%`,
                  width: `calc(${widthPct}% - 2px)`,
                  top: 0, bottom: 0,
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: 3,
                  transition: 'background 0.3s',
                }} />
              );
            })}
            {/* Now arrow */}
            {showArrow && (
              <div style={{ ...styles.nowArrow, left: `${arrowPct}%` }}>
                <div style={{ ...styles.arrowHead, borderBottomColor: accent.color }} />
                <div style={{ ...styles.arrowLine, background: accent.color }} />
              </div>
            )}
          </div>
          {/* Time labels */}
          <div style={styles.timeLabels}>
            <span style={styles.timeLabel}>{allLessons[0] ? fmtTime(allLessons[0].startTime) : ''}</span>
            <span style={styles.timeLabel}>{allLessons[allLessons.length - 1] ? fmtTime(allLessons[allLessons.length - 1].endTime) : ''}</span>
          </div>
        </div>
      )}

      {/* Lesson list */}
      <div style={styles.lessonList}>
        {allLessons.map((l, i) => {
          if (l.isBreak) {
            return (
              <div key={i} style={styles.breakRow}>
                <span style={styles.breakLabel}>{guessBreakLabel(l.periodName, l.startTime)}</span>
                <span style={styles.breakTime}>{fmtTime(l.startTime)}–{fmtTime(l.endTime)}</span>
              </div>
            );
          }
          const isCurrent = currentSlot === l;
          const isPast = nowMins >= timeMins(l.endTime);
          return (
            <div key={i} style={{
              ...styles.lessonRow,
              opacity: isPast ? 0.4 : 1,
              background: isCurrent ? accent.bg : 'transparent',
              borderLeft: isCurrent ? `3px solid ${accent.color}` : '3px solid transparent',
              borderRadius: 4,
            }}>
              {isCurrent && <span style={{ ...styles.nowPill, background: accent.color }}>▶ Now</span>}
              <span style={styles.lessonTime}>{fmtTime(l.startTime)}</span>
              <div style={styles.lessonMeta}>
                <span style={{ ...styles.lessonSubject, color: l.isAlternative ? '#b45309' : 'var(--text)' }}>
                  {l.isAlternative ? '⚠ ' : ''}{l.subjectName || 'Lesson'}
                </span>
                <span style={styles.lessonDetail}>
                  {l.isAlternative
                    ? (l.pupilNote || 'Timetable may have changed — check with school')
                    : `${l.teacherName}${l.roomName ? ` · ${l.roomName}` : ''}`
                  }
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '0 0 4px', textAlign: 'right' }}>
        <Link href={href} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>Full timetable →</Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nowBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px', borderRadius: 6, border: '1px solid',
    marginBottom: 12,
  },
  nowDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  nowLabel: { fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  nowSub: { fontSize: 13, color: 'var(--text-2)', fontWeight: 500 },

  timelineWrap: { marginBottom: 14 },
  timelineTrack: { position: 'relative', height: 22, marginBottom: 6 },
  timeLabels: { display: 'flex', justifyContent: 'space-between' },
  timeLabel: { fontSize: 11, fontWeight: 500, color: 'var(--text-2)' },

  nowArrow: {
    position: 'absolute', top: -7, transform: 'translateX(-50%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    pointerEvents: 'none', zIndex: 10,
  },
  arrowHead: {
    width: 0, height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderBottom: '8px solid',
  },
  arrowLine: { width: 2, height: 28, marginTop: -1 },

  lessonList: { display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 10 },
  lessonRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '8px 8px', transition: 'opacity 0.2s', position: 'relative',
  },
  nowPill: {
    position: 'absolute', right: 8, top: 8,
    color: '#fff', fontSize: 10,
    fontWeight: 700, padding: '2px 8px', borderRadius: 100,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  lessonTime: { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', width: 40, flexShrink: 0, paddingTop: 1 },
  lessonMeta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  lessonSubject: { fontSize: 14, fontWeight: 500, color: 'var(--text)' },
  lessonDetail: { fontSize: 12, color: 'var(--text-2)', fontWeight: 400 },
  breakRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 8px 5px 11px',
  },
  breakLabel: { fontSize: 12, color: 'var(--text-2)', fontWeight: 500, fontStyle: 'italic' },
  breakTime: { fontSize: 11, color: 'var(--text-2)', fontWeight: 400 },
};
