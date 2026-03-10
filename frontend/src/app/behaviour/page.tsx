'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCActivityPoint, CCBehaviourSummary } from '@classcharts/shared';

interface BehaviourData { activity: CCActivityPoint[]; summary: CCBehaviourSummary; }

export default function BehaviourPage() {
  const { activePupil } = usePupil();
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];

  const { data, loading, error } = useClassChartsData<BehaviourData>(
    'behaviour',
    { pupilId: String(activePupil?.id ?? ''), from, to },
    [activePupil?.id],
  );

  const points = data?.activity ?? [];
  const total = points.reduce((s, p) => s + p.score, 0);
  const positive = points.filter(p => p.score > 0).reduce((s, p) => s + p.score, 0);
  const negative = points.filter(p => p.score < 0).reduce((s, p) => s + p.score, 0);

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Behaviour</h1>
      </div>
      <hr style={styles.rule} />

      {loading && <div style={{ height: 120, background: 'var(--surface-2)', borderRadius: 4 }} />}
      {error && <p style={{ color: 'var(--negative)', fontSize: 14 }}>{error}</p>}

      {!loading && !error && (
        <>
          <div style={styles.summaryRow}>
            {[
              { label: 'Net total', value: total > 0 ? `+${total}` : String(total), color: total >= 0 ? 'var(--positive)' : 'var(--negative)' },
              { label: 'Positive', value: `+${positive}`, color: 'var(--positive)' },
              { label: 'Negative', value: String(negative), color: 'var(--negative)' },
            ].map(s => (
              <div key={s.label} className="card" style={styles.summaryCard}>
                <p style={styles.summaryLabel}>{s.label}</p>
                <p style={{ ...styles.summaryValue, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {points.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 32 }}>No activity in the last 30 days</p>
          ) : (
            <div className="card" style={{ overflow: 'hidden', marginTop: 32 }}>
              {points.map((p, i) => (
                <div key={p.id} style={{ ...styles.row, borderBottom: i < points.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ ...styles.score, color: p.polarity === 'positive' ? 'var(--positive)' : 'var(--negative)', background: p.polarity === 'positive' ? 'var(--positive-bg)' : 'var(--negative-bg)' }}>
                    {p.score > 0 ? '+' : ''}{p.score}
                  </span>
                  <div style={styles.detail}>
                    <p style={styles.reason}>{p.reason}</p>
                    <p style={styles.meta}>{p.lessonName ?? ''}{p.teacherName ? ` · ${p.teacherName}` : ''}</p>
                  </div>
                  <span style={styles.date}>{formatDate(p.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { marginBottom: 24 },
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500 },
  rule: { border: 'none', borderTop: '1px solid var(--border)', marginBottom: 40 },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  summaryCard: { padding: '20px 24px' },
  summaryLabel: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  summaryValue: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500, lineHeight: 1 },
  row: { display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px' },
  score: { fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, padding: '3px 8px', borderRadius: 4, display: 'inline-block', flexShrink: 0 },
  detail: { flex: 1 },
  reason: { fontSize: 14, fontWeight: 500, marginBottom: 2 },
  meta: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  date: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', flexShrink: 0 },
};
