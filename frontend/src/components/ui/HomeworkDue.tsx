'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCHomework } from '@classcharts/shared';

export function HomeworkDue() {
  const { activePupil } = usePupil();
  const today = new Date().toISOString().split('T')[0];
  const ahead = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const { data: homework, loading, error } = useClassChartsData<CCHomework[]>(
    'homework',
    { pupilId: String(activePupil?.id ?? ''), from: today, to: ahead },
    [activePupil?.id],
  );

  if (loading) return <Skeleton />;
  if (error) return <div className="card" style={{ padding: 20, fontSize: 13, color: 'var(--negative)' }}>{error}</div>;

  const pending = (homework ?? [])
    .filter(h => h.status !== 'completed' && !h.ticked)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  if (pending.length === 0) {
    return <div className="card" style={{ padding: 20, fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>No homework due soon 🎉</div>;
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {pending.map((hw, i) => {
        const daysLeft = Math.ceil((new Date(hw.dueDate).getTime() - Date.now()) / 86400000);
        const urgency = daysLeft <= 1 ? 'var(--negative)' : daysLeft <= 3 ? 'var(--warning)' : 'var(--border)';
        const dueLabel = daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : formatDate(hw.dueDate);

        return (
          <div key={hw.id} style={{ ...styles.row, borderBottom: i < pending.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ ...styles.stripe, background: urgency }} />
            <div style={styles.content}>
              <div style={styles.top}>
                <span style={styles.subject}>{hw.subject}</span>
                <span style={{ ...styles.due, color: daysLeft <= 3 ? urgency : 'var(--text-3)', fontWeight: daysLeft <= 3 ? 500 : 400 }}>
                  {dueLabel}
                </span>
              </div>
              <p style={styles.title}>{hw.title}</p>
              {hw.completionTime && <p style={styles.meta}>{hw.completionTime}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return <div className="card" style={{ padding: 20, height: 140, background: 'var(--surface-2)' }} />;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

const styles: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'stretch' },
  stripe: { width: 3, flexShrink: 0 },
  content: { flex: 1, padding: '14px 16px' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  subject: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  due: { fontSize: 11, fontFamily: 'var(--font-mono)' },
  title: { fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4 },
  meta: { fontSize: 11, color: 'var(--text-3)', marginTop: 2 },
};
