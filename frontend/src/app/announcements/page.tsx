'use client';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { ArchivedAnnouncement, CCAnnouncement } from '@classcharts/shared';

type AnnItem = ArchivedAnnouncement | CCAnnouncement;
const isArchived = (a: AnnItem): a is ArchivedAnnouncement => 'archivedAt' in a;

export default function AnnouncementsPage() {
  const { activePupil } = usePupil();
  const { data: announcements, loading, error } = useClassChartsData<AnnItem[]>(
    'announcements',
    { pupilId: String(activePupil?.id ?? '') },
    [activePupil?.id],
  );

  const consentPending = (announcements ?? []).filter(a => a.requiresConsent && a.consentGiven === null);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <p style={styles.eyebrow}>School</p>
        <h1 style={styles.pageTitle}>Announcements</h1>
      </div>

      {/* Consent action banner */}
      {consentPending.length > 0 && (
        <a href="https://app.classcharts.com" target="_blank" rel="noreferrer" style={styles.consentBanner}>
          <div>
            <span style={styles.consentTitle}>⚠ {consentPending.length} item{consentPending.length > 1 ? 's' : ''} need your consent</span>
            <div style={styles.consentList}>
              {consentPending.map(a => <span key={a.id} style={styles.consentItem}>· {a.title}</span>)}
            </div>
          </div>
          <span style={styles.consentCta}>Open ClassCharts →</span>
        </a>
      )}

      <hr style={styles.rule} />

      {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => <div key={i} className="card" style={{ height: 140, background: 'var(--surface-2)' }} />)}
      </div>}
      {error && <p style={{ color: 'var(--negative)', fontSize: 14 }}>{error}</p>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!announcements?.length && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No announcements</p>}
          {(announcements ?? []).map((a, i) => (
            <AnnouncementCard key={a.id} ann={a} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({ ann, index }: { ann: AnnItem; index: number }) {
  const archived = isArchived(ann);
  const consentPending = ann.requiresConsent && ann.consentGiven === null;
  const consentGiven = ann.requiresConsent && ann.consentGiven === true;

  return (
    <div className={`card fade-up fade-up-${Math.min(index + 1, 5)}`} style={{
      padding: 24,
      borderLeft: consentPending ? '4px solid #f59e0b' : '4px solid transparent',
    }}>
      {/* Header row */}
      <div style={styles.cardHeader}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {ann.isPinned && <span className="chip chip--warning">📌 Pinned</span>}
          {consentPending && <span className="chip chip--warning">⚠ Consent needed</span>}
          {consentGiven && <span className="chip chip--positive">✓ Consent given</span>}
          {!ann.isPinned && !ann.requiresConsent && <span className="chip chip--neutral">Info</span>}
          {archived && ann.requiresAction && !ann.requiresConsent && (
            <span className="chip chip--warning">Action required</span>
          )}
        </div>
        <span style={styles.date}>{formatDate(ann.timestamp)}</span>
      </div>

      <h2 style={styles.cardTitle}>{ann.title}</h2>
      <p style={styles.teacher}>{ann.teacherName} · {ann.schoolName}</p>

      {/* AI summary if archived */}
      {archived && ann.aiSummary && (
        <div style={styles.aiSummary}>
          <span style={styles.aiLabel}>Summary</span>
          <p style={styles.aiText}>{ann.aiSummary}</p>
          {ann.actionDescription && (
            <p style={styles.actionText}>⚠ {ann.actionDescription}</p>
          )}
        </div>
      )}

      {ann.descriptionText && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />
          <p style={styles.description}>{ann.descriptionText}</p>
        </>
      )}

      {/* Attachments — proxied through our API if archived */}
      {ann.attachments.length > 0 && (
        <div style={styles.attachments}>
          <span style={styles.attachLabel}>Attachments</span>
          {ann.attachments.map((att, ai) => {
            const gcsPaths = archived ? ann.attachmentGcsPaths : {};
            const gcsPath = gcsPaths[att.filename];
            const href = gcsPath
              ? `/api/attachments/${gcsPath}`
              : att.url;
            return (
              <a key={ai} href={href} target="_blank" rel="noreferrer" style={styles.attachment}>
                {fileIcon(att.filename)} {att.filename}
                {gcsPath && <span style={styles.archivedBadge}>archived</span>}
              </a>
            );
          })}
        </div>
      )}

      {/* Consent action */}
      {consentPending && (
        <a href="https://app.classcharts.com" target="_blank" rel="noreferrer" style={styles.consentBtn}>
          Open ClassCharts to respond →
        </a>
      )}
    </div>
  );
}

function fileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['ppt', 'pptx'].includes(ext)) return '📊';
  if (['xls', 'xlsx'].includes(ext)) return '📈';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return '🖼';
  return '📎';
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles: Record<string, React.CSSProperties> = {
  eyebrow: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 },
  pageTitle: { fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500 },
  rule: { border: 'none', borderTop: '1px solid var(--border)', marginBottom: 24 },
  consentBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '16px 20px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, marginBottom: 20, textDecoration: 'none', color: 'inherit' },
  consentTitle: { fontSize: 14, fontWeight: 600, color: '#92400e', display: 'block', marginBottom: 4 },
  consentList: { display: 'flex', flexDirection: 'column', gap: 2 },
  consentItem: { fontSize: 12, color: '#92400e', fontFamily: 'var(--font-mono)' },
  consentCta: { fontSize: 12, fontWeight: 600, color: '#92400e', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 8 },
  date: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', flexShrink: 0 },
  cardTitle: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, lineHeight: 1.3, marginBottom: 4 },
  teacher: { fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
  aiSummary: { marginTop: 14, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 4, border: '1px solid var(--border)' },
  aiLabel: { fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 },
  aiText: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 },
  actionText: { fontSize: 12, color: '#92400e', marginTop: 6, fontWeight: 500 },
  description: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' },
  attachments: { marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 },
  attachLabel: { fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 },
  attachment: { fontSize: 12, color: 'var(--info)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' },
  archivedBadge: { fontSize: 9, padding: '1px 5px', background: 'var(--positive-bg)', color: 'var(--positive)', borderRadius: 3, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  consentBtn: { display: 'inline-flex', alignItems: 'center', marginTop: 16, padding: '8px 16px', background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', textDecoration: 'none' },
};
