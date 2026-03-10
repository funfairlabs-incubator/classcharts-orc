'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCAnnouncement } from '@classcharts/shared';

export function LatestAnnouncement() {
  const { activePupil } = usePupil();

  const { data: announcements, loading, error } = useClassChartsData<CCAnnouncement[]>(
    'announcements',
    { pupilId: String(activePupil?.id ?? '') },
    [activePupil?.id],
  );

  if (loading) return <Skeleton />;
  if (error) return <div className="card" style={{ padding: 20, fontSize: 13, color: 'var(--negative)' }}>{error}</div>;

  const latest = announcements?.[0];
  if (!latest) return <div className="card" style={{ padding: 20, fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>No announcements</div>;

  const isPinned = latest.isPinned;
  const requiresConsent = latest.requiresConsent;
  const consentPending = requiresConsent && latest.consentGiven === null;

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={styles.header}>
        <div style={{ display: 'flex', gap: 6 }}>
          {isPinned && <span className="chip chip--warning">Pinned</span>}
          {consentPending && <span className="chip chip--warning">Consent required</span>}
          {!isPinned && !consentPending && <span className="chip chip--neutral">Announcement</span>}
        </div>
        <span style={styles.date}>{formatDate(latest.timestamp)}</span>
      </div>

      <h3 style={styles.title}>{latest.title}</h3>
      <p style={styles.teacher}>{latest.teacherName} · {latest.schoolName}</p>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

      {latest.descriptionText && (
        <p style={styles.description}>
          {latest.descriptionText.slice(0, 280)}
          {latest.descriptionText.length > 280 ? '…' : ''}
        </p>
      )}

      {latest.attachments.length > 0 && (
        <div style={styles.attachments}>
          {latest.attachments.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" style={styles.attachmentLink}>
              📎 {a.filename}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return <div className="card" style={{ padding: 20, height: 160, background: 'var(--surface-2)' }} />;
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  date: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
  title: { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, lineHeight: 1.3, marginBottom: 4 },
  teacher: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  description: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 },
  attachments: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 },
  attachmentLink: { fontSize: 12, color: 'var(--info)', fontFamily: 'var(--font-mono)' },
};
