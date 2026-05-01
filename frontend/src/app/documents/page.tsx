'use client';
import { usePupil } from '@/lib/usePupil';
import { useEffect, useState } from 'react';

interface Document {
  filename: string;
  gcsPath: string;
  signedUrl: string | null;
  contentType: string;
  size: number;
  savedAt: string;
  studentId: number;
  studentName: string;
  announcementId: number;
  announcementTitle: string;
  announcementDate: string;
  teacherName: string;
  schoolName: string;
}

function fileIcon(contentType: string): string {
  if (contentType.includes('pdf')) return '📄';
  if (contentType.includes('word') || contentType.includes('document')) return '📝';
  if (contentType.includes('sheet') || contentType.includes('excel')) return '📊';
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return '📊';
  if (contentType.includes('image')) return '🖼';
  return '📎';
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByAnnouncement(docs: Document[]): Map<string, Document[]> {
  const map = new Map<string, Document[]>();
  for (const doc of docs) {
    const key = `${doc.studentId}_${doc.announcementId}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(doc);
  }
  return map;
}

export default function DocumentsPage() {
  const { pupils } = usePupil();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<number | null>(null);

  const [savedPalettes, setSavedPalettes] = useState<Record<number, { color: string; bg: string; border: string }>>({});
  useEffect(() => {
    try { const p = localStorage.getItem('pupilPalettes'); if (p) setSavedPalettes(JSON.parse(p)); } catch { /* ignore */ }
  }, []);

  const DEFAULT_ACCENTS = [
    { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  ];
  const accentFor = (studentId: number) => {
    if (savedPalettes[studentId]) return savedPalettes[studentId];
    const idx = pupils.findIndex(p => p.id === studentId);
    return DEFAULT_ACCENTS[idx >= 0 ? idx % 2 : 0];
  };

  useEffect(() => {
    setLoading(true);
    const params = filter ? `?pupilId=${filter}` : '';
    fetch(`/api/documents${params}`)
      .then(r => r.json())
      .then(d => { setDocs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  const grouped = groupByAnnouncement(docs);

  return (
    <div style={styles.page}>
      <div style={{ marginBottom: 16 }}>
        <p style={styles.eyebrow}>School</p>
        <h1 style={styles.pageTitle}>Documents</h1>
      </div>

      {/* Student filter pills */}
      {pupils.length > 1 && (
        <div style={styles.filterRow}>
          <button onClick={() => setFilter(null)} style={{ ...styles.filterBtn, ...(filter === null ? styles.filterBtnActive : {}) }}>All</button>
          {pupils.map((p, idx) => {
            const acc = accentFor(p.id);
            return (
              <button key={p.id} onClick={() => setFilter(filter === p.id ? null : p.id)} style={{
                ...styles.filterBtn,
                ...(filter === p.id ? { background: acc.bg, color: acc.color, borderColor: acc.color } : {}),
              }}>{p.firstName}</button>
            );
          })}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="card" style={{ height: 100, background: 'var(--surface-2)' }} />)}
        </div>
      )}

      {!loading && docs.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No documents yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>Attachments from school announcements will appear here once archived.</p>
        </div>
      )}

      {!loading && docs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from(grouped.entries()).map(([groupKey, groupDocs]) => {
            const first = groupDocs[0];
            const acc = accentFor(first.studentId);
            const pupilName = pupils.find(p => p.id === first.studentId)?.firstName ?? first.studentName;

            return (
              <div key={groupKey} className="card" style={{ overflow: 'hidden' }}>
                {/* Accent stripe */}
                <div style={{ height: 3, background: acc.color }} />

                <div style={{ padding: '12px 16px 0' }}>
                  {/* Student pill + date */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                      background: acc.bg, color: acc.color, border: `1px solid ${acc.border}`,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {pupilName}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                      {formatDate(first.announcementDate)}
                    </span>
                  </div>

                  {/* Announcement title + teacher */}
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{first.announcementTitle}</p>
                  <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 10 }}>
                    {first.teacherName} · {first.schoolName}
                  </p>
                </div>

                {/* Files */}
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {groupDocs.map((doc, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 16px',
                      borderBottom: i < groupDocs.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{fileIcon(doc.contentType)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</p>
                        <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{fileSize(doc.size)}</p>
                      </div>
                      {doc.gcsPath ? (
                        <a href={`/api/attachments/${doc.gcsPath}`} target="_blank" rel="noreferrer" style={{
                          fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                          color: acc.color, padding: '5px 10px',
                          border: `1px solid ${acc.border}`, borderRadius: 4,
                          background: acc.bg, textDecoration: 'none', flexShrink: 0,
                        }}>
                          Open
                        </a>
                      ) : (
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', opacity: 0.5 }}>Pending</span>
                      )}
                    </div>
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

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 640, margin: '0 auto', padding: '12px 12px 56px' },
  eyebrow: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 },
  pageTitle: { fontSize: 22, fontWeight: 700 },
  filterRow: { display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' as const },
  filterBtn: { fontSize: 11, padding: '4px 12px', border: '1px solid var(--border)', borderRadius: 100, background: 'transparent', cursor: 'pointer', color: 'var(--text-2)', fontFamily: 'var(--font-body)' },
  filterBtnActive: { background: 'var(--surface-2)', color: 'var(--text)', borderColor: 'var(--text-2)', fontWeight: 600 },
};
