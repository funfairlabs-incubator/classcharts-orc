'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCActivityPoint, CCBehaviourSummary, CCStudent } from '@classcharts/shared';
import { useState, useEffect } from 'react';

interface BehaviourData { activity: CCActivityPoint[]; summary: CCBehaviourSummary; }

const DEMO_ACTIVITY: CCActivityPoint[] = [
  { id: -1, score: 2,  reason: 'Excellent class contribution', lessonName: 'English',  teacherName: 'Mr J Thompson', timestamp: new Date(Date.now() - 1  * 86400000).toISOString(), polarity: 'positive' },
  { id: -2, score: 1,  reason: 'Good homework submission',     lessonName: 'Maths',    teacherName: 'Mrs A Patel',   timestamp: new Date(Date.now() - 3  * 86400000).toISOString(), polarity: 'positive' },
  { id: -3, score: 1,  reason: 'Helping a classmate',         lessonName: 'Science',  teacherName: 'Dr R Evans',    timestamp: new Date(Date.now() - 5  * 86400000).toISOString(), polarity: 'positive' },
  { id: -4, score: -1, reason: 'Late to lesson',              lessonName: 'History',  teacherName: 'Miss L Davies', timestamp: new Date(Date.now() - 8  * 86400000).toISOString(), polarity: 'negative' },
  { id: -5, score: 2,  reason: 'Outstanding project work',    lessonName: 'Art',      teacherName: 'Mrs K Wilson',  timestamp: new Date(Date.now() - 12 * 86400000).toISOString(), polarity: 'positive' },
];

function useBehaviourData(pupilId: number | undefined) {
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to   = new Date().toISOString().split('T')[0];
  return useClassChartsData<BehaviourData>(
    'behaviour',
    { pupilId: String(pupilId ?? ''), from, to },
    [pupilId],
  );
}

function SummaryCards({ points, accent }: { points: CCActivityPoint[]; accent: { color: string; bg: string } }) {
  const total    = points.reduce((s, p) => s + p.score, 0);
  const positive = points.filter(p => p.score > 0).reduce((s, p) => s + p.score, 0);
  const negative = points.filter(p => p.score < 0).reduce((s, p) => s + p.score, 0);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {[
        { label: 'Net', value: total > 0 ? `+${total}` : String(total), color: total > 0 ? 'var(--positive)' : total < 0 ? 'var(--negative)' : accent.color },
        { label: 'Positive', value: `+${positive}`, color: 'var(--positive)' },
        { label: 'Negative', value: negative < 0 ? String(negative) : '0', color: negative < 0 ? 'var(--negative)' : 'var(--text-3)' },
      ].map(s => (
        <div key={s.label} style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: s.color, lineHeight: 1 }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function BehaviourPage() {
  const { pupils } = usePupil();
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

  const [savedPalettes, setSavedPalettes] = useState<Record<number, { color: string; bg: string; border: string }>>({});
  useEffect(() => {
    try {
      const p = localStorage.getItem('pupilPalettes');
      if (p) setSavedPalettes(JSON.parse(p));
    } catch { /* ignore */ }
  }, []);

  const DEFAULT_ACCENTS = [
    { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  ];

  const accentA = savedPalettes[pupilA?.id ?? 0] ?? DEFAULT_ACCENTS[0];

  const accentB = savedPalettes[pupilB?.id ?? 0] ?? DEFAULT_ACCENTS[1];

  const { data: dataA } = useBehaviourData(pupilA?.id);
  const { data: dataB } = useBehaviourData(pupilB?.id);

  const pointsA = dataA?.activity ?? [];
  const pointsB = dataB?.activity ?? [];
  const demoPoints = demoMode && !pupilB ? DEMO_ACTIVITY : [];
  const demoStudent = { firstName: 'Demo', id: -1 };

  const allActivity = [
    ...pointsA.map(p => ({ point: p, pupil: pupilA!, accent: accentA, isDemo: false })),
    ...pointsB.map(p => ({ point: p, pupil: pupilB!, accent: accentB, isDemo: false })),
    ...demoPoints.map(p => ({ point: p, pupil: demoStudent as any, accent: demoPalette, isDemo: true })),
  ].sort((a, b) => new Date(b.point.timestamp).getTime() - new Date(a.point.timestamp).getTime());

  const hasMultiple = !!pupilB || demoMode;

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <p style={styles.eyebrow}>{hasMultiple ? 'All Students' : (pupilA?.firstName ?? 'Student')}</p>
        <h1 style={styles.pageTitle}>Behaviour</h1>
        <p style={styles.dateRange}>Last 30 days</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {pupilA && (
          <div>
            {hasMultiple && <p style={styles.studentLabel}>{pupilA.firstName}</p>}
            <SummaryCards points={pointsA} accent={accentA} />
          </div>
        )}
        {(pupilB || demoMode) && (
          <div>
            <p style={{ ...styles.studentLabel, color: demoPalette.color }}>
              {pupilB?.firstName ?? 'Demo Student'}{!pupilB && <span style={{ fontSize: 9, marginLeft: 6, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>DEMO</span>}
            </p>
            <SummaryCards points={pupilB ? pointsB : demoPoints} accent={pupilB ? accentB : demoPalette} />
          </div>
        )}
      </div>

      {allActivity.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No activity in the last 30 days</p>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {hasMultiple && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activity</span>
            </div>
          )}
          {allActivity.map(({ point, pupil, accent, isDemo }, i) => (
            <div key={`${point.id}-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: i < allActivity.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {hasMultiple && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: accent.bg, color: accent.color, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                  {pupil.firstName}{isDemo ? ' ·demo' : ''}
                </span>
              )}
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                color: point.score > 0 ? 'var(--positive)' : point.score < 0 ? 'var(--negative)' : 'var(--info)',
                background: point.score > 0 ? 'var(--positive-bg)' : point.score < 0 ? 'var(--negative-bg)' : 'var(--info-bg)',
              }}>
                {point.score > 0 ? '+' : ''}{point.score}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{point.reason}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  {point.lessonName ?? ''}{point.teacherName ? ` · ${point.teacherName}` : ''}
                </p>
              </div>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', flexShrink: 0 }}>
                {new Date(point.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 640, margin: '0 auto', padding: '12px 12px 56px' },
  pageHeader: { marginBottom: 20 },
  eyebrow: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 },
  pageTitle: { fontSize: 22, fontWeight: 700 },
  dateRange: { fontSize: 12, color: 'var(--text-3)', marginTop: 2 },
  studentLabel: { fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' },
};
