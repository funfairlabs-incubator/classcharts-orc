'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCHomework } from '@classcharts/shared';
import { useState, useEffect, useMemo } from 'react';

function useHomeworkData(pupilId: number | undefined) {
  const from = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
  const to   = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  return useClassChartsData<CCHomework[]>(
    'homework',
    { pupilId: String(pupilId ?? ''), from, to },
    [pupilId],
  );
}

function hwStatus(hw: CCHomework): 'late' | 'todo' | 'completed' {
  if (hw.status === 'late') return 'late';
  if (hw.status === 'completed' || hw.ticked) return 'completed';
  return 'todo';
}

function urgencyColor(hw: CCHomework): string {
  const status = hwStatus(hw);
  if (status === 'completed') return '#16a34a';
  if (status === 'late') return '#dc2626';
  const daysLeft = Math.ceil((new Date(hw.dueDate).getTime() - Date.now()) / 86400000);
  if (daysLeft <= 1) return '#ea580c';
  if (daysLeft <= 3) return '#d97706';
  return 'var(--border)';
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type StatusKey = 'late' | 'todo' | 'completed';

const STATUS_LABELS: Record<StatusKey, string> = { late: 'Overdue', todo: 'To do', completed: 'Done' };
const STATUS_COLORS: Record<StatusKey, { color: string; bg: string }> = {
  late:      { color: '#dc2626', bg: '#fef2f2' },
  todo:      { color: '#d97706', bg: '#fffbeb' },
  completed: { color: '#16a34a', bg: '#f0fdf4' },
};

export default function HomeworkPage() {
  const { pupils } = usePupil();

  const [savedPalettes, setSavedPalettes] = useState<Record<number, { color: string; bg: string; border: string }>>({});
  useEffect(() => {
    try { const p = localStorage.getItem('pupilPalettes'); if (p) setSavedPalettes(JSON.parse(p)); } catch { /* ignore */ }
  }, []);

  const DEFAULT_ACCENTS = [
    { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  ];
  const accentFor = (id: number, idx: number) => savedPalettes[id] ?? DEFAULT_ACCENTS[idx % 2];

  const pupilA = pupils[0];
  const pupilB = pupils[1];
  const hasMultiple = !!pupilB;

  const { data: hwA } = useHomeworkData(pupilA?.id);
  const { data: hwB } = useHomeworkData(pupilB?.id);

  // Combine with pupil tag
  type TaggedHW = CCHomework & { pupilId: number; pupilName: string; pupilIdx: number };
  const all: TaggedHW[] = useMemo(() => [
    ...(hwA ?? []).map(h => ({ ...h, pupilId: pupilA?.id ?? 0, pupilName: pupilA?.firstName ?? '', pupilIdx: 0 })),
    ...(hwB ?? []).map(h => ({ ...h, pupilId: pupilB?.id ?? 0, pupilName: pupilB?.firstName ?? '', pupilIdx: 1 })),
  ], [hwA, hwB, pupilA, pupilB]);

  // Filter state
  const [filterStudent, setFilterStudent] = useState<number | 'all'>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<StatusKey | 'all'>('all');

  const subjects = useMemo(() => {
    const s = new Set(all.map(h => h.subject).filter(Boolean));
    return [...s].sort();
  }, [all]);

  const filtered = useMemo(() => {
    return all
      .filter(h => filterStudent === 'all' || h.pupilId === filterStudent)
      .filter(h => filterSubject === 'all' || h.subject === filterSubject)
      .filter(h => filterStatus === 'all' || hwStatus(h) === filterStatus)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [all, filterStudent, filterSubject, filterStatus]);

  // Summary table data
  const summary = useMemo(() => {
    const rows = pupils.map((pupil, idx) => {
      const hw = idx === 0 ? (hwA ?? []) : (hwB ?? []);
      return {
        pupil, idx,
        late:      hw.filter(h => hwStatus(h) === 'late').length,
        todo:      hw.filter(h => hwStatus(h) === 'todo').length,
        completed: hw.filter(h => hwStatus(h) === 'completed').length,
      };
    });
    return rows;
  }, [pupils, hwA, hwB]);

  const isNew = (h: CCHomework) => new Date(h.issueDate).getTime() > Date.now() - 2 * 86400000;

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <p style={styles.eyebrow}>{hasMultiple ? 'All Students' : (pupilA?.firstName ?? 'Student')}</p>
        <h1 style={styles.pageTitle}>Homework</h1>
      </div>

      {/* Summary table */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: `1fr repeat(3, 60px)`, padding: '8px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <span style={styles.thCell}>Student</span>
          {(['late','todo','completed'] as StatusKey[]).map(s => (
            <span key={s} style={{ ...styles.thCell, color: STATUS_COLORS[s].color, textAlign: 'center' }}>{STATUS_LABELS[s]}</span>
          ))}
        </div>
        {summary.map(({ pupil, idx, late, todo, completed }) => {
          const acc = accentFor(pupil.id, idx);
          return (
            <div key={pupil.id} style={{ display: 'grid', gridTemplateColumns: `1fr repeat(3, 60px)`, padding: '10px 12px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: acc.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{pupil.firstName}</span>
              </div>
              {[
                { val: late,      s: 'late' as StatusKey },
                { val: todo,      s: 'todo' as StatusKey },
                { val: completed, s: 'completed' as StatusKey },
              ].map(({ val, s }) => (
                <button key={s} onClick={() => { setFilterStudent(pupil.id); setFilterStatus(s); }} style={{
                  textAlign: 'center', fontSize: 16, fontWeight: 700, cursor: val > 0 ? 'pointer' : 'default',
                  color: val > 0 ? STATUS_COLORS[s].color : 'var(--text-3)',
                  background: 'none', border: 'none', padding: 0,
                }}>
                  {val}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        {/* Student filter */}
        {hasMultiple && (
          <div style={styles.filterGroup}>
            <button onClick={() => setFilterStudent('all')} style={{ ...styles.filterBtn, ...(filterStudent === 'all' ? styles.filterBtnActive : {}) }}>All</button>
            {pupils.map((p, idx) => {
              const acc = accentFor(p.id, idx);
              return (
                <button key={p.id} onClick={() => setFilterStudent(filterStudent === p.id ? 'all' : p.id)} style={{
                  ...styles.filterBtn,
                  ...(filterStudent === p.id ? { background: acc.bg, color: acc.color, borderColor: acc.color } : {}),
                }}>
                  {p.firstName}
                </button>
              );
            })}
          </div>
        )}

        {/* Status filter */}
        <div style={styles.filterGroup}>
          <button onClick={() => setFilterStatus('all')} style={{ ...styles.filterBtn, ...(filterStatus === 'all' ? styles.filterBtnActive : {}) }}>All status</button>
          {(['late','todo','completed'] as StatusKey[]).map(s => (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)} style={{
              ...styles.filterBtn,
              ...(filterStatus === s ? { background: STATUS_COLORS[s].bg, color: STATUS_COLORS[s].color, borderColor: STATUS_COLORS[s].color } : {}),
            }}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Subject filter */}
        {subjects.length > 1 && (
          <div style={{ ...styles.filterGroup, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterSubject('all')} style={{ ...styles.filterBtn, ...(filterSubject === 'all' ? styles.filterBtnActive : {}) }}>All subjects</button>
            {subjects.map(s => (
              <button key={s} onClick={() => setFilterSubject(filterSubject === s ? 'all' : s)} style={{
                ...styles.filterBtn,
                ...(filterSubject === s ? styles.filterBtnActive : {}),
              }}>{s}</button>
            ))}
          </div>
        )}
      </div>

      {/* Active filter summary + clear */}
      {(filterStudent !== 'all' || filterSubject !== 'all' || filterStatus !== 'all') && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={() => { setFilterStudent('all'); setFilterSubject('all'); setFilterStatus('all'); }} style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Clear filters
          </button>
        </div>
      )}

      {/* Homework list */}
      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginTop: 32 }}>No homework matching filters 🎉</p>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {filtered.map((hw, i) => {
            const status = hwStatus(hw);
            const daysLeft = Math.ceil((new Date(hw.dueDate).getTime() - Date.now()) / 86400000);
            const urgency = urgencyColor(hw);
            const acc = accentFor(hw.pupilId, hw.pupilIdx);

            return (
              <div key={`${hw.id}-${hw.pupilId}`} style={{
                display: 'flex', alignItems: 'stretch',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: status === 'completed' ? 0.6 : 1,
              }}>
                {/* Urgency stripe */}
                <div style={{ width: 3, flexShrink: 0, background: urgency }} />

                <div style={{ flex: 1, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    {/* Student pill */}
                    {hasMultiple && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: acc.bg, color: acc.color, border: `1px solid ${acc.border}`, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                        {hw.pupilName}
                      </span>
                    )}
                    {/* Subject */}
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{hw.subject}</span>
                    {isNew(hw) && <span style={styles.newBadge}>NEW</span>}
                    {/* Due date right */}
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: urgency === 'var(--border)' ? 'var(--text-3)' : urgency, fontWeight: status !== 'completed' && daysLeft <= 3 ? 600 : 400, flexShrink: 0 }}>
                      {status === 'completed' ? '✓ Done' : status === 'late' ? '⚠ Overdue' : `Due ${formatDate(hw.dueDate)}`}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{hw.title}</p>
                  {hw.description && <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4 }}>{hw.description}</p>}
                  {hw.completionTime && <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>⏱ {hw.completionTime}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 640, margin: '0 auto', padding: '12px 12px 56px' },
  pageHeader: { marginBottom: 14 },
  eyebrow: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 },
  pageTitle: { fontSize: 22, fontWeight: 700 },
  thCell: { fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', fontWeight: 600 },
  filters: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 },
  filterGroup: { display: 'flex', gap: 4, flexWrap: 'wrap' as const },
  filterBtn: { fontSize: 11, padding: '4px 10px', borderRadius: 100, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-2)', fontFamily: 'var(--font-body)' },
  filterBtnActive: { background: 'var(--surface-2)', color: 'var(--text)', borderColor: 'var(--text-2)', fontWeight: 600 },
  newBadge: { fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: 100, fontFamily: 'var(--font-mono)' },
};
