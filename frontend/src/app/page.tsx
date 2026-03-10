import { TodayTimetable } from '@/components/ui/TodayTimetable';
import { BehaviourSummary } from '@/components/ui/BehaviourSummary';
import { HomeworkDue } from '@/components/ui/HomeworkDue';
import { LatestAnnouncement } from '@/components/ui/LatestAnnouncement';
import { StatChips } from '@/components/ui/StatChips';

export default function OverviewPage() {
  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <p style={styles.dateLabel}>
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </p>
          <h1 style={styles.pageTitle}>Overview</h1>
        </div>
        <StatChips />
      </div>

      <hr style={styles.rule} />

      <div style={styles.grid}>
        <div style={styles.colLeft}>
          <section>
            <SectionHeading title="Today's Timetable" href="/timetable" />
            <TodayTimetable />
          </section>
          <section style={{ marginTop: 40 }}>
            <SectionHeading title="Homework Due Soon" href="/homework" />
            <HomeworkDue />
          </section>
        </div>
        <div style={styles.colRight}>
          <section>
            <SectionHeading title="Behaviour This Week" href="/behaviour" />
            <BehaviourSummary />
          </section>
          <section style={{ marginTop: 40 }}>
            <SectionHeading title="Latest Announcement" href="/announcements" />
            <LatestAnnouncement />
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

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 24 },
  dateLabel: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 },
  pageTitle: { fontSize: 36, fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--text)' },
  rule: { border: 'none', borderTop: '1px solid var(--border)', marginBottom: 40 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 48, alignItems: 'start' },
  colLeft: {},
  colRight: {},
  sectionHeading: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 500 },
  sectionLink: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
};
