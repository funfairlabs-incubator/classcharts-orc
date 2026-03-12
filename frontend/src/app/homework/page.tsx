'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCHomework } from '@classcharts/shared';

export default function HomeworkPage() {
  const { activePupil } = usePupil();
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const { data: homework, loading, error } = useClassChartsData<CCHomework[]>(
    'homework',
    { pupilId: String(activePupil?.id ?? ''), from, to },
    [activePupil?.id],
  );

  const twoDaysAgo = Date.now() - 2 * 86400000;
  const grouped = {
    late:      (homework ?? []).filter(h => h.status === 'late'),
    todo:      (homework ?? []).filter(h => h.status === 'not_completed' && !h.ticked),
    completed: (homework ?? []).filter(h => h.status === 'completed' || h.ticked),
  };
  const isNew = (h: CCHomework) => new Date(h.issueDate).getTime() > twoDaysAgo;

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Homework</h1>
        <div style={styles.legend}>
          <span style={{ ...styles.dot, background: 'var(--negative)' }} /> Overdue
          <span style={{ ...styles.dot, background: 'var(--warning)', marginLeft: 12 }} /> Due soon
        </div>
      </div>
      <hr style={styles.rule} />

      {loading && <LoadingSkeleton />}
      {error && <p style={{ color: 'var(--negative)', fontSize: 14 }}>{error}</p>}

      {!loading && !error && (
        <>
          {grouped.late.length > 0 && <Group title="Overdue" items={grouped.late} />}
          <Group title="To do" items={grouped.todo} emptyMessage="Nothing to do 🎉" />
          <Group title="Completed" items={grouped.completed} muted />
        </>
      )}
    </div>
  );
}

function Group({ title, items, muted, emptyMessage }: {
  title: string; items: CCHomework[]; muted?: boolean; emptyMessage?: string;
}) {
  if (items.length === 0 && !emptyMessage) return null;
  return (
    <section style={{ marginBottom: 40, opacity: muted ? 0.6 : 1 }}>
      <h2 style={styles.groupTitle}>
        {title} <span style={styles.groupCount}>{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{emptyMessage}</p>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {items.map((hw, i) => {
            const daysLeft = Math.ceil((new Date(hw.dueDate).getTime() - Date.now()) / 86400000);
            const urgency = hw.status === 'late' ? 'var(--negative)' :
              daysLeft <= 1 ? 'var(--warning)' : daysLeft <= 3 ? 'var(--info)' : 'var(--border)';

            return (
              <div key={hw.id} style={{ ...styles.row, borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ ...styles.stripe, background: urgency }} />
                <div style={styles.rowContent}>
                  <div style={styles.rowTop}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={styles.subject}>{hw.subject}</span>
                        {isNew(hw) && <span style={styles.newBadge}>NEW</span>}
                      </div>
                      <p style={styles.hwTitle}>{hw.title}</p>
                      {hw.description && <p style={styles.description}>{hw.description}</p>}
                      {hw.completionTime && <p style={styles.completionTime}>⏱ {hw.completionTime}</p>}
                      {hw.links.length > 0 && hw.links.map((l, li) => (
                        <a key={li} href={l.link} target="_blank" rel="noreferrer" style={styles.link}>🔗 Link</a>
                      ))}
                    </div>
                    <div style={styles.dates}>
                      <span style={styles.dateItem}>Set {formatDate(hw.issueDate)}</span>
                      <span style={{
                        ...styles.dateItem,
                        color: hw.status === 'late' ? 'var(--negative)' : urgency !== 'var(--border)' ? urgency : 'var(--text-3)',
                        fontWeight: daysLeft <= 3 ? 600 : 400,
                      }}>
                        {hw.status === 'late' ? '⚠ Overdue' : `Due ${formatDate(hw.dueDate)}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="card" style={{ height: 72, background: 'var(--surface-2)' }} />
      ))}
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 },
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500 },
  rule: { border: 'none', borderTop: '1px solid var(--border)', marginBottom: 40 },
  legend: { display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 6 },
  groupTitle: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 },
  groupCount: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)', fontWeight: 400 },
  row: { display: 'flex', alignItems: 'stretch' },
  stripe: { width: 3, flexShrink: 0 },
  rowContent: { flex: 1, padding: '16px 20px' },
  rowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  subject: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 },
  hwTitle: { fontSize: 15, fontWeight: 500, marginBottom: 4 },
  description: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 4 },
  completionTime: { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  link: { fontSize: 12, color: 'var(--info)', display: 'block', marginTop: 4 },
  dates: { display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'right', flexShrink: 0 },
  dateItem: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
  newBadge: { fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: 100, fontFamily: 'var(--font-mono)' },
};
