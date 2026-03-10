'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { CCAnnouncement } from '@classcharts/shared';

export default function AnnouncementsPage() {
  const { activePupil } = usePupil();
  const { data: announcements, loading, error } = useClassChartsData<CCAnnouncement[]>(
    'announcements',
    { pupilId: String(activePupil?.id ?? '') },
    [activePupil?.id],
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={styles.pageTitle}>Announcements</h1>
      </div>
      <hr style={styles.rule} />

      {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => <div key={i} className="card" style={{ height: 120, background: 'var(--surface-2)' }} />)}
      </div>}
      {error && <p style={{ color: 'var(--negative)', fontSize: 14 }}>{error}</p>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!announcements?.length && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No announcements</p>}
          {(announcements ?? []).map((a, i) => (
            <div key={a.id} className={`card fade-up fade-up-${Math.min(i + 1, 5)}`} style={{ padding: 24 }}>
              <div style={styles.cardHeader}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {a.isPinned && <span className="chip chip--warning">Pinned</span>}
                  {a.requiresConsent && a.consentGiven === null && <span className="chip chip--warning">Consent required</span>}
                  {a.requiresConsent && a.consentGiven === true && <span className="chip chip--positive">Consent given</span>}
                  {!a.isPinned && !a.requiresConsent && <span className="chip chip--neutral">Info</span>}
                </div>
                <span style={styles.date}>{formatDate(a.timestamp)}</span>
              </div>

              <h2 style={styles.cardTitle}>{a.title}</h2>
              <p style={styles.teacher}>{a.teacherName} · {a.schoolName}</p>

              {a.descriptionText && (
                <>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />
                  <p style={styles.description}>{a.descriptionText}</p>
                </>
              )}

              {a.attachments.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {a.attachments.map((att, ai) => (
                    <a key={ai} href={att.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--info)', fontFamily: 'var(--font-mono)' }}>
                      📎 {att.filename}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles: Record<string, React.CSSProperties> = {
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500 },
  rule: { border: 'none', borderTop: '1px solid var(--border)', marginBottom: 40 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  date: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
  cardTitle: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, lineHeight: 1.3, marginBottom: 4 },
  teacher: { fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
  description: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' },
};
