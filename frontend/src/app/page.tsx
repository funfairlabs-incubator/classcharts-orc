import { Suspense } from 'react';
import { TodayTimetable } from '@/components/ui/TodayTimetable';
import { BehaviourSummary } from '@/components/ui/BehaviourSummary';
import { HomeworkDue } from '@/components/ui/HomeworkDue';
import { LatestAnnouncement } from '@/components/ui/LatestAnnouncement';
import { StatChips } from '@/components/ui/StatChips';

export default function OverviewPage() {
  return (
    <div>
      {/* Page header */}
      <div style={styles.pageHeader}>
        <div>
          <p style={styles.dateLabel}>
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </p>
          <h1 style={styles.pageTitle}>Overview</h1>
        </div>
        <Suspense fallback={<div style={styles.chipsPlaceholder} />}>
          <StatChips />
        </Suspense>
      </div>

      <hr style={styles.rule} />

      {/* Main grid */}
      <div style={styles.grid}>
        {/* Left column — timetable + homework */}
        <div style={styles.colLeft}>
          <section className="fade-up fade-up-1">
            <SectionHeading title="Today's Timetable" href="/timetable" />
            <Suspense fallback={<CardSkeleton rows={6} />}>
              <TodayTimetable />
            </Suspense>
          </section>

          <section className="fade-up fade-up-3" style={{ marginTop: 40 }}>
            <SectionHeading title="Homework Due Soon" href="/homework" />
            <Suspense fallback={<CardSkeleton rows={3} />}>
              <HomeworkDue />
            </Suspense>
          </section>
        </div>

        {/* Right column — behaviour + announcement */}
        <div style={styles.colRight}>
          <section className="fade-up fade-up-2">
            <SectionHeading title="Behaviour This Week" href="/behaviour" />
            <Suspense fallback={<CardSkeleton rows={4} />}>
              <BehaviourSummary />
            </Suspense>
          </section>

          <section className="fade-up fade-up-4" style={{ marginTop: 40 }}>
            <SectionHeading title="Latest Announcement" href="/announcements" />
            <Suspense fallback={<CardSkeleton rows={3} />}>
              <LatestAnnouncement />
            </Suspense>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ title, href }: { title: string; href: string }) {
  return (
    <div style={styles.sectionHeading}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <a href={href} style={styles.sectionLink}>View all →</a>
    </div>
  );
}

function CardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: 16, background: 'var(--surface-2)', borderRadius: 4, width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 24,
  },
  dateLabel: {
    fontSize: 12,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6,
  },
  pageTitle: {
    fontSize: 36,
    fontFamily: 'var(--font-display)',
    fontWeight: 500,
    color: 'var(--text)',
  },
  chipsPlaceholder: {
    height: 32,
    width: 300,
  },
  rule: {
    border: 'none',
    borderTop: '1px solid var(--border)',
    marginBottom: 40,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: 48,
    alignItems: 'start',
  },
  colLeft: {},
  colRight: {},
  sectionHeading: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'var(--font-display)',
    fontWeight: 500,
  },
  sectionLink: {
    fontSize: 12,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
  },
};
