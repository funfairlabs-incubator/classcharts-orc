'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCStudent, CCLesson, CCActivityPoint, CCHomework, CCAttendanceSummary } from '@classcharts/shared';
import Link from 'next/link';

export default function OverviewPage() {
  const { pupils, loading } = usePupil();

  if (loading) return <LoadingState />;

  return (
    <div style={styles.page}>
      <header style={styles.pageHeader}>
        <p style={styles.dateStr}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 style={styles.pageTitle}>Dashboard</h1>
      </header>

      <div style={styles.cards}>
        {pupils.map((pupil, i) => (
          <StudentCard key={pupil.id} pupil={pupil} index={i} />
        ))}
      </div>
    </div>
  );
}

function StudentCard({ pupil, index }: { pupil: CCStudent; index: number }) {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const monthAhead = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const { data: lessons } = useClassChartsData<CCLesson[]>('timetable', { pupilId: String(pupil.id), date: today }, [pupil.id]);
  const { data: behaviour } = useClassChartsData<{ activity: CCActivityPoint[] }>('behaviour', { pupilId: String(pupil.id), from: weekAgo, to: today }, [pupil.id]);
  const { data: homework } = useClassChartsData<CCHomework[]>('homework', { pupilId: String(pupil.id), from: today, to: monthAhead }, [pupil.id]);
  const { data: attendance } = useClassChartsData<CCAttendanceSummary>('attendance', { pupilId: String(pupil.id), from: monthAgo, to: today }, [pupil.id]);

  const behavScore = (behaviour?.activity ?? []).reduce((s, p) => s + p.score, 0);
  const overdueHw = (homework ?? []).filter(h => h.status === 'late').length;
  const todoHw = (homework ?? []).filter(h => h.status !== 'completed' && !h.ticked && h.status !== 'late').length;
  const attendPct = attendance ? parseFloat(attendance.overallPercentage) : null;

  // Traffic light for attendance
  const attendColor = attendPct === null ? '#d1d5db'
    : attendPct >= 95 ? '#22c55e'
    : attendPct >= 90 ? '#f59e0b'
    : '#ef4444';

  // Today's lessons — mark current
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const todayLessons = (lessons ?? []).filter(l => !l.isBreak);

  const notifications = [
    pupil.announcementsCount > 0 && { label: `${pupil.announcementsCount} announcements`, href: `/announcements?pupil=${pupil.id}`, urgent: false },
    overdueHw > 0 && { label: `${overdueHw} overdue`, href: `/homework?pupil=${pupil.id}`, urgent: true },
    pupil.detentionPendingCount > 0 && { label: `${pupil.detentionPendingCount} detention`, href: `/homework?pupil=${pupil.id}`, urgent: true },
  ].filter(Boolean) as { label: string; href: string; urgent: boolean }[];

  return (
    <div className="card fade-up" style={{ ...styles.card, animationDelay: `${index * 0.08}s` }}>

      {/* Card header */}
      <div style={styles.cardHeader}>
        <div style={styles.avatar}>{pupil.firstName[0]}{pupil.lastName[0]}</div>
        <div style={styles.studentInfo}>
          <h2 style={styles.studentName}>{pupil.firstName} {pupil.lastName}</h2>
          <p style={styles.schoolName}>{pupil.schoolName}</p>
        </div>
        {/* Attendance traffic light */}
        {attendPct !== null && (
          <div style={styles.attendBadge}>
            <div style={{ ...styles.trafficLight, background: attendColor }} />
            <span style={{ ...styles.attendPct, color: attendColor }}>{attendPct.toFixed(0)}%</span>
            <span style={styles.attendLabel}>attendance</span>
          </div>
        )}
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div style={styles.notifications}>
          {notifications.map((n, i) => (
            <Link key={i} href={n.href} style={{ ...styles.notifChip, background: n.urgent ? '#fdf2f4' : '#fffbeb', color: n.urgent ? '#9b2335' : '#92400e', borderColor: n.urgent ? '#f5c6cb' : '#fde68a' }}>
              <span style={styles.notifDot} />
              {n.label}
            </Link>
          ))}
        </div>
      )}

      {/* Today's timetable */}
      {pupil.displayTimetable && (
        <div style={styles.section}>
          <SectionHeader title="Today" href={`/timetable?pupil=${pupil.id}`} />
          {todayLessons.length === 0 ? (
            <p style={styles.emptyText}>No lessons today</p>
          ) : (
            <div style={styles.lessonList}>
              {todayLessons.map((l, i) => {
                const startMins = timeMins(l.startTime);
                const endMins = timeMins(l.endTime);
                const isCurrent = nowMins >= startMins && nowMins < endMins;
                const isPast = nowMins >= endMins;
                return (
                  <div key={i} style={{ ...styles.lesson, opacity: isPast ? 0.45 : 1, background: isCurrent ? '#eff6ff' : 'transparent' }}>
                    {isCurrent && <div style={styles.currentBar} />}
                    <span style={styles.lessonTime}>{l.startTime.slice(0, 5)}</span>
                    <span style={styles.lessonSubject}>{l.subjectName}</span>
                    {l.roomName && <span style={styles.lessonRoom}>{l.roomName}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={styles.divider} />

      {/* Stats row */}
      <div style={styles.statsRow}>
        {pupil.displayBehaviour && (
          <StatLink href={`/behaviour?pupil=${pupil.id}`} label="Behaviour" value={behavScore > 0 ? `+${behavScore}` : String(behavScore)} valueColor={behavScore >= 0 ? '#2d6a4f' : '#9b2335'} />
        )}
        {pupil.displayHomework && (
          <StatLink href={`/homework?pupil=${pupil.id}`} label="To do" value={String(todoHw)} valueColor={todoHw > 0 ? '#92400e' : '#2d6a4f'} />
        )}
        {pupil.displayAttendance && attendPct !== null && (
          <StatLink href={`/attendance?pupil=${pupil.id}`} label="Attend." value={`${attendPct.toFixed(0)}%`} valueColor={attendColor} />
        )}
        {pupil.displayAnnouncements && (
          <StatLink href={`/announcements?pupil=${pupil.id}`} label="News" value={String(pupil.announcementsCount)} valueColor={pupil.announcementsCount > 0 ? '#1e3a5f' : '#9c9a94'} />
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div style={styles.sectionHeader}>
      <span style={styles.sectionTitle}>{title}</span>
      <Link href={href} style={styles.sectionLink}>View all →</Link>
    </div>
  );
}

function StatLink({ href, label, value, valueColor }: { href: string; label: string; value: string; valueColor: string }) {
  return (
    <Link href={href} style={styles.statLink}>
      <span style={{ ...styles.statValue, color: valueColor }}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </Link>
  );
}

function LoadingState() {
  return (
    <div style={styles.page}>
      <header style={styles.pageHeader}>
        <div style={{ height: 14, width: 160, background: '#e8e6df', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 36, width: 120, background: '#e8e6df', borderRadius: 4 }} />
      </header>
      {[1, 2].map(i => (
        <div key={i} className="card" style={{ ...styles.card, height: 320, background: '#f5f4f0' }} />
      ))}
    </div>
  );
}

function timeMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 640, margin: '0 auto', padding: '24px 16px 40px' },
  pageHeader: { marginBottom: 24 },
  dateStr: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 },
  pageTitle: { fontSize: 32, fontFamily: 'var(--font-display)', fontWeight: 500 },
  cards: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: { padding: 0, overflow: 'hidden', animation: 'fadeUp 0.35s ease forwards', opacity: 0 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 14, padding: '20px 20px 16px' },
  avatar: { width: 44, height: 44, borderRadius: '50%', background: 'var(--text)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)', flexShrink: 0 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 500, lineHeight: 1.2, marginBottom: 2 },
  schoolName: { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  attendBadge: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  trafficLight: { width: 14, height: 14, borderRadius: '50%', flexShrink: 0 },
  attendPct: { fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-mono)', lineHeight: 1 },
  attendLabel: { fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  notifications: { display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 20px 14px' },
  notifChip: { fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, padding: '4px 10px', borderRadius: 100, border: '1px solid', display: 'flex', alignItems: 'center', gap: 5 },
  notifDot: { width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' },
  section: { padding: '0 20px 16px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' },
  sectionLink: { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  lessonList: { display: 'flex', flexDirection: 'column', gap: 1 },
  lesson: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 4, position: 'relative', transition: 'opacity 0.2s' },
  currentBar: { position: 'absolute', left: 0, top: 4, bottom: 4, width: 2, background: '#3b82f6', borderRadius: 2 },
  lessonTime: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', width: 38, flexShrink: 0 },
  lessonSubject: { fontSize: 13, fontWeight: 500, flex: 1 },
  lessonRoom: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
  divider: { height: 1, background: 'var(--border)', margin: '0 20px' },
  statsRow: { display: 'flex', padding: '4px 8px' },
  statLink: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', gap: 3, borderRadius: 4 },
  statValue: { fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 500, lineHeight: 1 },
  statLabel: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  emptyText: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
};
