'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCStudent, CCLesson, CCActivityPoint, CCHomework, CCAttendanceSummary, CCAnnouncement } from '@classcharts/shared';
import Link from 'next/link';
import { TimetableTimeline } from '@/components/TimetableTimeline';

// One accent colour per student slot — warm, distinct, accessible
const STUDENT_ACCENTS = [
  { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', label: 'blue' },
  { color: '#b45309', bg: '#fffbeb', border: '#fde68a', label: 'amber' },
  { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'green' },
  { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', label: 'violet' },
];

export default function OverviewPage() {
  const { pupils, loading } = usePupil();

  if (loading) return <LoadingState />;
  if (!pupils.length) return (
    <div style={styles.page}>
      <PageHeader />
      <p style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>No pupils found.</p>
    </div>
  );

  return (
    <div style={styles.page}>
      <PageHeader />
      <div style={styles.grid}>
        {pupils.map((pupil, i) => (
          <StudentCard key={pupil.id} pupil={pupil} accent={STUDENT_ACCENTS[i % STUDENT_ACCENTS.length]} />
        ))}
      </div>
    </div>
  );
}

function PageHeader() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <header style={styles.pageHeader}>
      <p style={styles.dateStr}>{dateStr}</p>
      <h1 style={styles.pageTitle}>Dashboard</h1>
    </header>
  );
}

function StudentCard({ pupil, accent }: { pupil: CCStudent; accent: typeof STUDENT_ACCENTS[0] }) {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const monthAhead = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const { data: lessons } = useClassChartsData<CCLesson[]>('timetable', { pupilId: String(pupil.id), date: today }, [pupil.id]);
  const { data: behaviour } = useClassChartsData<{ activity: CCActivityPoint[] }>('behaviour', { pupilId: String(pupil.id), from: weekAgo, to: today }, [pupil.id]);
  const { data: homeworkData } = useClassChartsData<CCHomework[]>('homework', { pupilId: String(pupil.id), from: today, to: monthAhead }, [pupil.id]);
  const { data: attendance } = useClassChartsData<CCAttendanceSummary>('attendance', { pupilId: String(pupil.id), from: monthAgo, to: today }, [pupil.id]);
  const { data: announcements } = useClassChartsData<CCAnnouncement[]>('announcements', { pupilId: String(pupil.id) }, [pupil.id]);

  // Derived stats
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const behavScore = (behaviour?.activity ?? []).reduce((s, p) => s + p.score, 0);
  const overdueHw = (homeworkData ?? []).filter(h => new Date(h.dueDate) < now && h.status !== 'completed' && !h.ticked);
  const todoHw = (homeworkData ?? []).filter(h => h.status !== 'completed' && !h.ticked && new Date(h.dueDate) >= now);
  const attendPct = attendance ? parseFloat(attendance.overallPercentage) : null;
  const latestAnn = (announcements ?? [])[0] ?? null;

  const attendColor = attendPct === null ? '#9ca3af'
    : attendPct >= 95 ? '#16a34a'
    : attendPct >= 90 ? '#d97706'
    : '#dc2626';

  // Urgent flags
  const flags = [
    overdueHw.length > 0 && { text: `${overdueHw.length} overdue`, href: `/homework?pupil=${pupil.id}`, urgent: true },
    pupil.detentionPendingCount > 0 && { text: `${pupil.detentionPendingCount} detention${pupil.detentionPendingCount > 1 ? 's' : ''}`, href: `/detentions?pupil=${pupil.id}`, urgent: true },
    pupil.announcementsCount > 0 && { text: `${pupil.announcementsCount} unread`, href: `/announcements?pupil=${pupil.id}`, urgent: false },
  ].filter(Boolean) as { text: string; href: string; urgent: boolean }[];

  return (
    <div className="card" style={{ ...styles.card, '--accent': accent.color, '--accent-bg': accent.bg, '--accent-border': accent.border } as any}>

      {/* Accent top stripe */}
      <div style={{ ...styles.stripe, background: accent.color }} />

      {/* Header */}
      <div style={styles.cardHead}>
        <div style={{ ...styles.avatar, background: accent.color }}>
          {pupil.firstName[0]}{pupil.lastName[0]}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={styles.studentName}>{pupil.firstName} {pupil.lastName}</h2>
          <p style={styles.schoolName}>{pupil.schoolName}</p>
        </div>
        {/* Traffic light */}
        {attendPct !== null && (
          <Link href={`/attendance?pupil=${pupil.id}`} style={styles.trafficWrap}>
            <div style={{ ...styles.trafficDot, background: attendColor }} />
            <span style={{ ...styles.trafficPct, color: attendColor }}>{attendPct.toFixed(0)}%</span>
            <span style={styles.trafficLabel}>attend.</span>
          </Link>
        )}
      </div>

      {/* Alert flags */}
      {flags.length > 0 && (
        <div style={styles.flagRow}>
          {flags.map((f, i) => (
            <Link key={i} href={f.href} style={{
              ...styles.flag,
              background: f.urgent ? '#fef2f2' : accent.bg,
              color: f.urgent ? '#b91c1c' : accent.color,
              borderColor: f.urgent ? '#fecaca' : accent.border,
            }}>
              {f.urgent ? '⚠ ' : '● '}{f.text}
            </Link>
          ))}
        </div>
      )}

      <hr style={styles.rule} />

      {/* ① Timetable */}
      <div style={styles.section}>
        <div style={styles.sectionHead}>
          <span style={{ ...styles.sectionTitle, color: accent.color }}>Today's Timetable</span>
        </div>
        <TimetableTimeline
          lessons={lessons ?? []}
          href={`/timetable?pupil=${pupil.id}`}
          accent={accent}
        />
      </div>

      <hr style={styles.rule} />

      {/* ② ③ ④ ⑤ Stats row */}
      <div style={styles.statsRow}>
        <StatCell
          label="Behaviour"
          href={`/behaviour?pupil=${pupil.id}`}
          accent={accent}
        >
          <span style={{ color: behavScore >= 0 ? '#16a34a' : '#dc2626', fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 500 }}>
            {behavScore > 0 ? `+${behavScore}` : behavScore}
          </span>
          <span style={styles.statSub}>this week</span>
        </StatCell>

        <StatCell label="Homework" href={`/homework?pupil=${pupil.id}`} accent={accent}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <span style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 500, color: overdueHw.length > 0 ? '#dc2626' : todoHw.length > 0 ? '#d97706' : '#16a34a' }}>
              {overdueHw.length > 0 ? overdueHw.length : todoHw.length}
            </span>
          </div>
          <span style={styles.statSub}>{overdueHw.length > 0 ? 'overdue' : 'to do'}</span>
        </StatCell>

        <StatCell label="Attendance" href={`/attendance?pupil=${pupil.id}`} accent={accent}>
          <span style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 500, color: attendColor }}>
            {attendPct !== null ? `${attendPct.toFixed(0)}%` : '—'}
          </span>
          <span style={styles.statSub}>30 days</span>
        </StatCell>

        {latestAnn && (
          <StatCell label="Latest News" href={`/announcements?pupil=${pupil.id}`} accent={accent}>
            <p style={styles.annPreview}>{latestAnn.title}</p>
            <span style={styles.statSub}>{latestAnn.teacherName}</span>
          </StatCell>
        )}
      </div>
    </div>
  );
}

function Section({ title, href, accent, children }: { title: string; href: string; accent: typeof STUDENT_ACCENTS[0]; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHead}>
        <span style={{ ...styles.sectionTitle, color: accent.color }}>{title}</span>
        <Link href={href} style={{ ...styles.sectionLink, color: accent.color }}>All →</Link>
      </div>
      {children}
    </div>
  );
}

function StatCell({ label, href, accent, children }: { label: string; href: string; accent: typeof STUDENT_ACCENTS[0]; children: React.ReactNode }) {
  return (
    <Link href={href} style={styles.statCell}>
      <span style={{ ...styles.statLabel, color: 'var(--text-3)' }}>{label}</span>
      {children}
    </Link>
  );
}

function LoadingState() {
  return (
    <div style={styles.page}>
      <header style={styles.pageHeader}>
        <div style={{ height: 13, width: 180, background: '#e8e6df', borderRadius: 4, marginBottom: 10 }} />
        <div style={{ height: 36, width: 130, background: '#e8e6df', borderRadius: 4 }} />
      </header>
      <div style={styles.grid}>
        {[1, 2].map(i => (
          <div key={i} className="card" style={{ height: 420, background: '#f5f4f0' }} />
        ))}
      </div>
    </div>
  );
}

function timeMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '24px 16px 48px' },
  pageHeader: { marginBottom: 28 },
  dateStr: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 },
  pageTitle: { fontSize: 32, fontFamily: 'var(--font-display)', fontWeight: 500 },

  // Grid: stacked on mobile, side by side on tablet+
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 20,
    alignItems: 'start',
  },

  card: { overflow: 'hidden', padding: 0 },
  stripe: { height: 4 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px 14px' },
  avatar: { width: 40, height: 40, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' },
  studentName: { fontSize: 17, fontFamily: 'var(--font-display)', fontWeight: 500, lineHeight: 1.2, marginBottom: 2 },
  schoolName: { fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' },

  trafficWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none' },
  trafficDot: { width: 12, height: 12, borderRadius: '50%' },
  trafficPct: { fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1 },
  trafficLabel: { fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' },

  flagRow: { display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 20px 14px' },
  flag: { fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '4px 10px', borderRadius: 100, border: '1px solid', textDecoration: 'none' },

  rule: { border: 'none', borderTop: '1px solid var(--border)', margin: '0 20px' },

  section: { padding: '14px 20px' },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 },
  sectionLink: { fontSize: 11, fontFamily: 'var(--font-mono)', textDecoration: 'none' },

  lessonGrid: { display: 'flex', flexDirection: 'column', gap: 2 },
  lesson: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 4, transition: 'opacity 0.2s' },
  lessonTime: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', width: 36, flexShrink: 0 },
  lessonMeta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 1 },
  lessonSubject: { fontSize: 13, fontWeight: 500 },
  lessonTeacher: { fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  nowBadge: { color: '#fff', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 6px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', borderTop: '1px solid var(--border)' },
  statCell: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 8px 16px', gap: 2, textDecoration: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer' },
  statLabel: { fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 },
  statSub: { fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  annPreview: { fontSize: 12, fontWeight: 500, textAlign: 'center', lineHeight: 1.3, maxWidth: 120, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  empty: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
};
