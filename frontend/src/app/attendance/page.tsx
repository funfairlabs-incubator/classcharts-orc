'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCAttendanceSummary } from '@classcharts/shared';

export default function AttendancePage() {
  const { activePupil } = usePupil();
  const from = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];
  const to = new Date().toISOString().split('T')[0];

  const { data, loading, error } = useClassChartsData<CCAttendanceSummary>(
    'attendance',
    { pupilId: String(activePupil?.id ?? ''), from, to },
    [activePupil?.id],
  );

  function statusColor(status: string) {
    if (status === 'present') return { color: 'var(--positive)', background: 'var(--positive-bg)' };
    if (status === 'absent')  return { color: 'var(--negative)', background: 'var(--negative-bg)' };
    if (status === 'late')    return { color: 'var(--warning)',  background: 'var(--warning-bg)'  };
    return { color: 'var(--text-3)', background: 'var(--surface-2)' };
  }

  function statusLabel(status: string) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Attendance</h1>
        {data && (
          <div style={styles.pctBadge}>
            <span style={{ ...styles.pctValue, color: parseFloat(data.overallPercentage) >= 95 ? 'var(--positive)' : parseFloat(data.overallPercentage) >= 90 ? 'var(--warning)' : 'var(--negative)' }}>
              {parseFloat(data.overallPercentage).toFixed(1)}%
            </span>
            <span style={styles.pctLabel}>Overall</span>
          </div>
        )}
      </div>
      <hr style={styles.rule} />

      {loading && <div style={{ height: 200, background: 'var(--surface-2)', borderRadius: 4 }} />}
      {error && <p style={{ color: 'var(--negative)', fontSize: 14 }}>{error}</p>}

      {!loading && !error && data && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Header */}
          <div style={styles.tableHeader}>
            <span style={styles.colDate}>Date</span>
            <span style={styles.colSessions}>Sessions</span>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

          {data.days.map((day, i) => {
            const sessions = Object.entries(day.sessions);
            const hasAbsence = sessions.some(([, s]) => s.status === 'absent');
            const hasLate = sessions.some(([, s]) => s.status === 'late');

            return (
              <div key={day.date} style={{
                ...styles.tableRow,
                background: hasAbsence ? 'var(--negative-bg)' : hasLate ? 'var(--warning-bg)' : 'transparent',
                borderBottom: i < data.days.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={styles.colDate}>{formatDate(day.date)}</span>
                <div style={{ ...styles.colSessions, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {sessions.map(([key, session]) => (
                    session.status !== 'ignore' && (
                      <span key={key} style={{ ...styles.sessionChip, ...statusColor(session.status) }}>
                        {key}: {statusLabel(session.status)}
                        {session.lateMinutes > 0 ? ` (${session.lateMinutes}m)` : ''}
                      </span>
                    )
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 },
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500 },
  rule: { border: 'none', borderTop: '1px solid var(--border)', marginBottom: 40 },
  pctBadge: { textAlign: 'right' },
  pctValue: { fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 500, display: 'block', lineHeight: 1 },
  pctLabel: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  tableHeader: { display: 'flex', padding: '10px 20px', gap: 24 },
  tableRow: { display: 'flex', padding: '12px 20px', gap: 24, alignItems: 'center' },
  colDate: { fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)', width: 140, flexShrink: 0 },
  colSessions: {},
  sessionChip: { fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, padding: '3px 8px', borderRadius: 100, display: 'inline-block' },
};
