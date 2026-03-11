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

// Group documents by announcement
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
  const { pupils, activePupil } = usePupil();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<number | null>(null); // null = all pupils

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
      <header style={styles.header}>
        <p style={styles.eyebrow}>School</p>
        <h1 style={styles.title}>Documents</h1>
      </header>

      {/* Pupil filter */}
      {pupils.length > 1 && (
        <div style={styles.filterRow}>
          <button
            style={{ ...styles.filterBtn, background: filter === null ? 'var(--text)' : 'var(--surface)', color: filter === null ? '#fff' : 'var(--text)' }}
            onClick={() => setFilter(null)}
          >All</button>
          {pupils.map(p => (
            <button
              key={p.id}
              style={{ ...styles.filterBtn, background: filter === p.id ? 'var(--text)' : 'var(--surface)', color: filter === p.id ? '#fff' : 'var(--text)' }}
              onClick={() => setFilter(p.id)}
            >{p.firstName}</button>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="card" style={{ height: 100, background: 'var(--surface-2)' }} />)}
        </div>
      )}

      {!loading && docs.length === 0 && (
        <div className="card" style={styles.empty}>
          <p style={styles.emptyTitle}>No documents yet</p>
          <p style={styles.emptyDesc}>Attachments from school announcements will appear here once the poller has run.</p>
        </div>
      )}

      {!loading && docs.length > 0 && (
        <div style={styles.list}>
          {Array.from(grouped.entries()).map(([groupKey, groupDocs]) => {
            const first = groupDocs[0];
            return (
              <div key={groupKey} className="card" style={styles.group}>
                {/* Announcement header */}
                <div style={styles.groupHeader}>
                  <div style={styles.groupMeta}>
                    <span style={styles.groupStudent}>{first.studentName}</span>
                    <span style={styles.groupDot}>·</span>
                    <span style={styles.groupDate}>{formatDate(first.announcementDate)}</span>
                  </div>
                  <h3 style={styles.groupTitle}>{first.announcementTitle}</h3>
                  <p style={styles.groupTeacher}>{first.teacherName} · {first.schoolName}</p>
                </div>

                {/* Files */}
                <div style={styles.fileList}>
                  {groupDocs.map((doc, i) => (
                    <div key={i} style={styles.fileRow}>
                      <span style={styles.fileIcon}>{fileIcon(doc.contentType)}</span>
                      <div style={styles.fileMeta}>
                        <span style={styles.fileName}>{doc.filename}</span>
                        <span style={styles.fileSize}>{fileSize(doc.size)}</span>
                      </div>
                      {doc.signedUrl ? (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.downloadBtn}
                        >
                          Download
                        </a>
                      ) : (
                        <span style={styles.unavailable}>Unavailable</span>
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
  page: { maxWidth: 640, margin: '0 auto', padding: '24px 16px 48px' },
  header: { marginBottom: 24 },
  eyebrow: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 },
  title: { fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 500 },
  filterRow: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  filterBtn: { padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 100, fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', fontWeight: 500 },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  group: { overflow: 'hidden', padding: 0 },
  groupHeader: { padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' },
  groupMeta: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 },
  groupStudent: { fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-2)' },
  groupDot: { fontSize: 11, color: 'var(--text-3)' },
  groupDate: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
  groupTitle: { fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginBottom: 2 },
  groupTeacher: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
  fileList: { display: 'flex', flexDirection: 'column' },
  fileRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' },
  fileIcon: { fontSize: 20, flexShrink: 0 },
  fileMeta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  fileName: { fontSize: 13, fontWeight: 500 },
  fileSize: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
  downloadBtn: { fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--info)', padding: '6px 12px', border: '1px solid var(--info-bg)', borderRadius: 4, background: 'var(--info-bg)', textDecoration: 'none', flexShrink: 0 },
  unavailable: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
  empty: { padding: 32, textAlign: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: 600, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 },
};
