'use client';
import { usePupil } from '@/lib/usePupil';

export function StatChips() {
  const { activePupil } = usePupil();

  if (!activePupil) return null;

  const stats = [
    ...(activePupil.homeworkLateCount > 0
      ? [{ label: 'Overdue', value: String(activePupil.homeworkLateCount), type: 'negative' }]
      : []),
    { label: 'Homework to do', value: String(activePupil.homeworkTodoCount), type: 'neutral' },
    ...(activePupil.announcementsCount > 0
      ? [{ label: 'Announcements', value: String(activePupil.announcementsCount), type: 'info' }]
      : []),
    ...(activePupil.detentionPendingCount > 0
      ? [{ label: 'Detentions pending', value: String(activePupil.detentionPendingCount), type: 'negative' }]
      : []),
  ];

  if (stats.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {stats.map(s => (
        <div key={s.label} className={`chip chip--${s.type}`} style={{ padding: '6px 12px' }}>
          <span style={{ opacity: 0.75 }}>{s.label}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, marginLeft: 6 }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}
