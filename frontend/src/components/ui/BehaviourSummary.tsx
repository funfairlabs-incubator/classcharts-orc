'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCActivityPoint, CCBehaviourSummary } from '@classcharts/shared';

interface BehaviourData {
  activity: CCActivityPoint[];
  summary: CCBehaviourSummary;
}

export function BehaviourSummary() {
  const { activePupil } = usePupil();
  const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];

  const { data, loading, error } = useClassChartsData<BehaviourData>(
    'behaviour',
    { pupilId: String(activePupil?.id ?? ''), from, to },
    [activePupil?.id],
  );

  if (loading) return <Skeleton />;
  if (error) return <div className="card" style={{ padding: 20, fontSize: 13, color: 'var(--negative)' }}>{error}</div>;

  const points = data?.activity ?? [];
  const total = points.reduce((s, p) => s + p.score, 0);

  if (points.length === 0) {
    return <div className="card" style={{ padding: 20, fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>No activity this week</div>;
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={styles.scoreHeader}>
        <div>
          <p style={styles.scoreLabel}>Week total</p>
          <p style={{ ...styles.scoreValue, color: total >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
            {total > 0 ? '+' : ''}{total}
          </p>
        </div>
        <div style={styles.scoreBars}>
          {points.slice(0, 8).map((p, i) => (
            <div key={i} style={{
              ...styles.bar,
              background: p.polarity === 'positive' ? 'var(--positive)' : 'var(--negative)',
              height: Math.min(Math.abs(p.score) * 10 + 8, 40),
            }} />
          ))}
        </div>
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
      {points.slice(0, 5).map((p, i) => (
        <div key={p.id} style={{ ...styles.row, borderBottom: i < Math.min(points.length, 5) - 1 ? '1px solid var(--border)' : 'none' }}>
          <span style={{ ...styles.score, color: p.polarity === 'positive' ? 'var(--positive)' : 'var(--negative)', background: p.polarity === 'positive' ? 'var(--positive-bg)' : 'var(--negative-bg)' }}>
            {p.score > 0 ? '+' : ''}{p.score}
          </span>
          <div style={styles.detail}>
            <span style={styles.reason}>{p.reason}</span>
            <span style={styles.meta}>
              {p.lessonName ?? ''}{p.teacherName ? ` · ${p.teacherName}` : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return <div className="card" style={{ padding: 20, height: 180, background: 'var(--surface-2)' }} />;
}

const styles: Record<string, React.CSSProperties> = {
  scoreHeader: { padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  scoreLabel: { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 },
  scoreValue: { fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, lineHeight: 1 },
  scoreBars: { display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 },
  bar: { width: 8, borderRadius: 3 },
  row: { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 20px' },
  score: { fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, padding: '3px 8px', borderRadius: 4, display: 'inline-block', flexShrink: 0 },
  detail: { flex: 1 },
  reason: { fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 2 },
  meta: { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
};
