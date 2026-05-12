'use client';
import { useState, useEffect } from 'react';
import { usePupil, useClassChartsData } from '@/lib/usePupil';
import type { ArchivedAnnouncement, CCAnnouncement } from '@classcharts/shared';
import Link from 'next/link';

type AnnItem = ArchivedAnnouncement | CCAnnouncement;
const isArchived = (a: AnnItem): a is ArchivedAnnouncement => 'archivedAt' in a;

function fileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['doc','docx'].includes(ext ?? '')) return '📝';
  if (['jpg','jpeg','png','gif'].includes(ext ?? '')) return '🖼';
  return '📎';
}

// Fetch announcements for a single pupil
function usePupilAnnouncements(pupilId: number | undefined) {
  return useClassChartsData<AnnItem[]>(
    'announcements',
    { pupilId: String(pupilId ?? '') },
    [pupilId],
  );
}

// Strip dangerous tags/attrs but keep links, basic formatting and line breaks
function sanitiseHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')   // remove event handlers
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/href="javascript:[^"]*"/gi, 'href="#"')
    .replace(/href='javascript:[^']*'/gi, "href='#'");
}

export default function AnnouncementsPage() {
  const { pupils } = usePupil();
  const [filterStudent, setFilterStudent] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');

  // Load saved palettes to colour student pills
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
    { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
    { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  ];

  function accentFor(pupilId: number, idx: number) {
    return savedPalettes[pupilId] ?? DEFAULT_ACCENTS[idx % DEFAULT_ACCENTS.length];
  }

  const pupilA = pupils[0];
  const pupilB = pupils[1];

  const { data: annA } = usePupilAnnouncements(pupilA?.id);
  const { data: annB } = usePupilAnnouncements(pupilB?.id);

  // Merge and deduplicate by announcement numeric id
  // Same announcement sent to multiple students → one card with multiple pills
  const merged = new Map<number, { ann: AnnItem; pupils: Array<{ pupil: typeof pupilA; idx: number }> }>();

  function addToMerged(ann: AnnItem, pupil: typeof pupilA, idx: number) {
    const key = ann.id;
    if (merged.has(key)) {
      merged.get(key)!.pupils.push({ pupil, idx });
    } else {
      merged.set(key, { ann, pupils: [{ pupil, idx }] });
    }
  }

  (annA ?? []).forEach(a => addToMerged(a, pupilA, 0));
  (annB ?? []).forEach(a => addToMerged(a, pupilB, 1));

  // Sort by timestamp desc
  const sorted = [...merged.values()].sort((a, b) => {
    const ta = isArchived(a.ann) ? a.ann.archivedAt : a.ann.timestamp;
    const tb = isArchived(b.ann) ? b.ann.archivedAt : b.ann.timestamp;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });

  const filtered = sorted.filter(({ ann, pupils: annPupils }) => {
    if (filterStudent !== 'all' && !annPupils.some(({ pupil }) => pupil?.id === filterStudent)) return false;
    if (search) {
      const q = search.toLowerCase();
      return ann.title.toLowerCase().includes(q) ||
        ann.teacherName?.toLowerCase().includes(q) ||
        ann.descriptionText?.toLowerCase().includes(q) ||
        (ann as any).aiSummary?.toLowerCase().includes(q);
    }
    return true;
  });

  const consentPending = sorted.filter(({ ann }) => ann.requiresConsent && ann.consentGiven === null);

  return (
    <div style={styles.page}>
      <div style={{ marginBottom: 16 }}>
        <p style={styles.eyebrow}>School</p>
        <h1 style={styles.pageTitle}>Announcements</h1>
      </div>

      {/* Student filter + search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {pupils.length > 1 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterStudent('all')} style={{ ...styles.filterBtn, ...(filterStudent === 'all' ? styles.filterBtnActive : {}) }}>All</button>
            {pupils.map((p, idx) => {
              const acc = savedPalettes[p.id] ?? DEFAULT_ACCENTS[idx % DEFAULT_ACCENTS.length];
              return (
                <button key={p.id} onClick={() => setFilterStudent(filterStudent === p.id ? 'all' : p.id)} style={{
                  ...styles.filterBtn,
                  ...(filterStudent === p.id ? { background: acc.bg, color: acc.color, borderColor: acc.color } : {}),
                }}>{p.firstName}</button>
              );
            })}
          </div>
        )}
        <input
          type="search"
          placeholder="Search announcements…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.searchBox}
        />
      </div>

      {/* Consent banner */}
      {consentPending.length > 0 && (
        <a href="https://app.classcharts.com" target="_blank" rel="noreferrer" style={styles.consentBanner}>
          <span style={{ fontWeight: 600, color: 'var(--warning)' }}>
            ⚠ {consentPending.length} item{consentPending.length > 1 ? 's' : ''} need your consent
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginTop: 2 }}>
            Open ClassCharts app to respond
          </span>
        </a>
      )}

      {filtered.map(({ ann, pupils: annPupils }) => {
        const archived = isArchived(ann);
        const accent = annPupils.length === 1 ? accentFor(annPupils[0].pupil?.id ?? 0, annPupils[0].idx) : { color: 'var(--text-2)', bg: 'var(--surface-2)', border: 'var(--border)' };

        return (
          <div key={ann.id} className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
            {/* Accent stripe */}
            <div style={{ height: 3, background: accent.color }} />

            <div style={{ padding: '12px 16px' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Student pills */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {annPupils.map(({ pupil, idx }) => {
                      if (!pupil) return null;
                      const a = accentFor(pupil.id, idx);
                      return (
                        <span key={pupil.id} style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                          background: a.bg, color: a.color, border: `1px solid ${a.border}`,
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {pupil.firstName}
                        </span>
                      );
                    })}
                    {ann.isPinned && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: '#fef3c7', color: '#b45309', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        📌 Pinned
                      </span>
                    )}
                  </div>
                  <p style={styles.annTitle}>{ann.title}</p>
                  <p style={styles.annMeta}>{ann.teacherName} · {ann.schoolName}</p>
                </div>
                <span style={styles.annDate}>
                  {new Date(isArchived(ann) ? ann.archivedAt : ann.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              {/* AI summary (archived only) */}
              {archived && ann.aiSummary && (
                <p style={styles.aiSummary}>{ann.aiSummary}</p>
              )}

              {/* Description */}
              {ann.descriptionHtml && (
                <div
                  style={styles.annBody}
                  dangerouslySetInnerHTML={{ __html: sanitiseHtml(ann.descriptionHtml) }}
                />
              )}

              {/* Action required */}
              {archived && ann.requiresAction && ann.actionDescription && (
                <div style={styles.actionBanner}>
                  <span style={{ fontWeight: 600, color: 'var(--warning)' }}>Action required</span>
                  <span style={{ color: 'var(--text-2)', marginLeft: 6 }}>{ann.actionDescription}</span>
                </div>
              )}

              {/* Attachments */}
              {ann.attachments.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p style={styles.attachLabel}>Attachments</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ann.attachments.map((att, ai) => {
                      const gcsPaths = ann.attachmentGcsPaths ?? {};
                      const gcsPath = gcsPaths[att.filename];
                      if (!gcsPath) return (
                        <span key={ai} style={{ ...styles.attachment, opacity: 0.4, cursor: 'not-allowed' }} title="Not yet archived">
                          {fileIcon(att.filename)} {att.filename}
                          <span style={styles.chip}>pending</span>
                        </span>
                      );
                      return (
                        <a key={ai} href={`/api/attachments/${gcsPath}`} target="_blank" rel="noreferrer" style={styles.attachment}>
                          {fileIcon(att.filename)} {att.filename}
                          <span style={styles.chip}>archived</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginTop: 48 }}>No announcements</p>
      )}
    </div>
  );
}

const DEFAULT_ACCENTS = [
  { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
];

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 640, margin: '0 auto', padding: '12px 12px 56px' },
  eyebrow: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 },
  pageTitle: { fontSize: 22, fontWeight: 700 },
  filterBtn: { fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 100, background: 'transparent', cursor: 'pointer', color: 'var(--text-2)', fontFamily: 'var(--font-body)' },
  filterBtnActive: { background: 'var(--surface-2)', color: 'var(--text)', borderColor: 'var(--text-2)', fontWeight: 600 },
  searchBox: { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' as const },
  consentBanner: { display: 'block', padding: '12px 16px', background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 8, marginBottom: 16, textDecoration: 'none' },
  annTitle: { fontSize: 15, fontWeight: 600, marginBottom: 2 },
  annMeta: { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  annDate: { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 },
  aiSummary: { fontSize: 13, color: 'var(--text-2)', fontStyle: 'italic', marginBottom: 6, lineHeight: 1.5 },
  annBody: { fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginTop: 6 },
  actionBanner: { marginTop: 8, padding: '6px 10px', background: 'var(--warning-bg)', borderRadius: 4, fontSize: 12 },
  attachLabel: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 },
  attachment: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text)', textDecoration: 'none', padding: '4px 8px', background: 'var(--surface-2)', borderRadius: 4, border: '1px solid var(--border)' },
  chip: { fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--positive-bg)', color: 'var(--positive)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' },
};
