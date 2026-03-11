'use client';
import { useState } from 'react';

type NodeId =
  | 'classcharts' | 'scheduler' | 'pubsub' | 'poller' | 'firestore'
  | 'gcs' | 'secretmanager' | 'frontend' | 'browser' | 'pushover'
  | 'gcal' | 'claude';

interface FlowStep {
  from: NodeId;
  to: NodeId;
  label: string;
  detail: string;
}

interface ArchNode {
  id: NodeId;
  label: string;
  sublabel: string;
  icon: string;
  color: string;
  bg: string;
  x: number; // % position
  y: number;
  description: string;
}

const NODES: ArchNode[] = [
  { id: 'classcharts',   label: 'ClassCharts',     sublabel: 'External API',        icon: '🏫', color: '#16a34a', bg: '#dcfce7', x: 50,  y: 4,  description: 'The official ClassCharts parent API. Provides pupils, timetable, homework, behaviour, attendance, announcements and detentions. Polled every 5 minutes.' },
  { id: 'scheduler',     label: 'Cloud Scheduler', sublabel: 'GCP',                  icon: '⏰', color: '#7c3aed', bg: '#ede9fe', x: 10,  y: 22, description: 'Two jobs: every 5 minutes triggers a standard poll, and at 3pm weekdays triggers the homework digest. Both publish to the Pub/Sub topic.' },
  { id: 'pubsub',        label: 'Pub/Sub',          sublabel: 'GCP Message Bus',      icon: '📨', color: '#0369a1', bg: '#e0f2fe', x: 35,  y: 22, description: 'Google Cloud Pub/Sub decouples the scheduler from the poller. Messages carry a trigger type: "scheduled" for normal polls, "digest" for the 3pm homework summary.' },
  { id: 'secretmanager', label: 'Secret Manager',   sublabel: 'GCP',                  icon: '🔐', color: '#b45309', bg: '#fef3c7', x: 80,  y: 22, description: 'Stores all credentials: ClassCharts passwords, Google OAuth keys, NextAuth secret, Pushover keys, Anthropic API key. Both the poller and frontend pull secrets at startup.' },
  { id: 'poller',        label: 'Poller',            sublabel: 'Cloud Run',            icon: '🔄', color: '#1d4ed8', bg: '#dbeafe', x: 35,  y: 44, description: 'Node.js service running on Cloud Run. Receives Pub/Sub messages, logs into ClassCharts, diffs state against Firestore, sends targeted Pushover notifications, archives announcements, downloads attachments to GCS, and creates Google Calendar events via Claude analysis.' },
  { id: 'claude',        label: 'Claude API',        sublabel: 'Anthropic',            icon: '🤖', color: '#7c3aed', bg: '#ede9fe', x: 10,  y: 62, description: 'Claude (claude-sonnet-4) analyses new announcements: extracting calendar events, summarising content, identifying required actions and consent items. Also summarises homework and behaviour points for notifications.' },
  { id: 'firestore',     label: 'Firestore',         sublabel: 'GCP NoSQL',            icon: '🗄️', color: '#0f766e', bg: '#ccfbf1', x: 60,  y: 44, description: 'Stores poll state per pupil (last seen IDs for activities, homework, announcements, known detention/overdue IDs), archived announcements, and attachment metadata. Prevents duplicate notifications across polls.' },
  { id: 'gcs',           label: 'Cloud Storage',     sublabel: 'GCP',                  icon: '📦', color: '#b45309', bg: '#fef3c7', x: 85,  y: 44, description: 'Stores downloaded attachment files (PDFs, Word docs, etc) at attachments/{studentId}/{announcementId}/{filename}. Also stores config: allowed-users.json and user-prefs.json. Signed URLs serve files to the frontend.' },
  { id: 'pushover',      label: 'Pushover',           sublabel: 'Notifications',        icon: '📱', color: '#dc2626', bg: '#fee2e2', x: 10,  y: 82, description: 'Delivers specific, actionable push notifications to both parents\' phones. Each notification names the child and describes exactly what happened. Per-parent toggles control which events trigger notifications.' },
  { id: 'gcal',          label: 'Google Calendar',   sublabel: 'Events',               icon: '📅', color: '#0369a1', bg: '#e0f2fe', x: 35,  y: 82, description: 'Claude extracts dates and events from school announcements and creates Google Calendar entries automatically. One calendar per pupil. Covers trips, parents evenings, deadlines and term dates.' },
  { id: 'frontend',      label: 'Frontend',           sublabel: 'App Engine / Next.js', icon: '⚡', color: '#1d4ed8', bg: '#dbeafe', x: 65,  y: 70, description: 'Next.js app deployed on Google App Engine. Server-side API routes proxy ClassCharts calls with caching. Reads archived announcements and attachment metadata from Firestore. Serves signed GCS URLs for documents. Protected by Google OAuth via NextAuth.' },
  { id: 'browser',       label: 'You',                sublabel: 'Mobile / Desktop',     icon: '👁️', color: '#111111', bg: '#f4f4f4', x: 65,  y: 92, description: 'The dashboard you\'re looking at. Mobile-first, per-student cards with live timetable, behaviour, homework and attendance. Bottom nav, Settings page for notification preferences, Documents page for saved attachments.' },
];

const FLOWS: FlowStep[] = [
  { from: 'scheduler',    to: 'pubsub',       label: '*/5 + 3pm',     detail: 'Publishes {"trigger":"scheduled"} every 5 mins and {"trigger":"digest"} at 3pm weekdays' },
  { from: 'pubsub',       to: 'poller',       label: 'HTTP push',     detail: 'Pub/Sub pushes message to Cloud Run via HTTP POST /' },
  { from: 'poller',       to: 'classcharts',  label: 'REST API',      detail: 'Logs in as parent, fetches activity, homework, announcements, attendance, detentions per pupil' },
  { from: 'poller',       to: 'secretmanager',label: 'Read secrets',  detail: 'Reads ClassCharts credentials, Pushover keys, Google tokens, Anthropic key at startup' },
  { from: 'frontend',     to: 'secretmanager',label: 'Read secrets',  detail: 'Reads Google OAuth, NextAuth secret, ClassCharts credentials at deploy time via app.yaml' },
  { from: 'poller',       to: 'claude',       label: 'Analyse',       detail: 'Sends announcement text to Claude for summary, calendar event extraction, action detection' },
  { from: 'poller',       to: 'firestore',    label: 'State + archive', detail: 'Reads last-seen IDs to detect new items. Writes updated state. Archives full announcement JSON.' },
  { from: 'poller',       to: 'gcs',          label: 'Save files',    detail: 'Downloads attachment files from ClassCharts URLs and saves permanently to GCS bucket' },
  { from: 'poller',       to: 'pushover',     label: 'Notify',        detail: 'Sends specific named notifications per event type, filtered by per-parent preference toggles' },
  { from: 'poller',       to: 'gcal',         label: 'Create events', detail: 'Creates calendar entries from Claude-extracted dates in announcements' },
  { from: 'browser',      to: 'frontend',     label: 'HTTPS',         detail: 'Authenticated via Google OAuth. All API routes are server-side, credentials never reach the browser.' },
  { from: 'frontend',     to: 'classcharts',  label: 'Live data',     detail: 'Frontend proxies live timetable, homework etc via server-side API routes with 10-minute cache' },
  { from: 'frontend',     to: 'firestore',    label: 'Archive',       detail: 'Reads archived announcements and attachment metadata for Documents page' },
  { from: 'frontend',     to: 'gcs',          label: 'Signed URLs',   detail: 'Generates 1-hour signed URLs for attachment downloads, never exposes raw GCS paths' },
];

const LAYERS = [
  { label: 'External',   y: 0,   h: 15,  color: '#f0fdf4' },
  { label: 'Triggers',   y: 15,  h: 17,  color: '#faf5ff' },
  { label: 'Processing', y: 32,  h: 22,  color: '#eff6ff' },
  { label: 'Storage',    y: 54,  h: 22,  color: '#fff7ed' },
  { label: 'Outputs',    y: 76,  h: 24,  color: '#fef2f2' },
];

export default function ArchitecturePage() {
  const [activeNode, setActiveNode] = useState<NodeId | null>(null);
  const [activeFlow, setActiveFlow] = useState<number | null>(null);

  const selectedNode = NODES.find(n => n.id === activeNode);
  const selectedFlow = activeFlow !== null ? FLOWS[activeFlow] : null;

  const highlightedNodes = new Set<NodeId>();
  if (activeNode) highlightedNodes.add(activeNode);
  if (activeFlow !== null) {
    highlightedNodes.add(FLOWS[activeFlow].from);
    highlightedNodes.add(FLOWS[activeFlow].to);
  }
  const dimmed = highlightedNodes.size > 0;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>FunFairLabs + Claude</p>
        <h1 style={styles.title}>System Architecture</h1>
        <p style={styles.subtitle}>How the ClassCharts dashboard works — tap any component or flow to learn more</p>
      </header>

      {/* Main diagram */}
      <div style={styles.diagramWrap}>
        <div style={styles.diagram}>

          {/* Layer backgrounds */}
          {LAYERS.map(l => (
            <div key={l.label} style={{
              position: 'absolute', left: 0, right: 0,
              top: `${l.y}%`, height: `${l.h}%`,
              background: l.color, borderBottom: '1px solid #e5e7eb',
            }}>
              <span style={styles.layerLabel}>{l.label}</span>
            </div>
          ))}

          {/* Flow lines — rendered behind nodes */}
          <svg style={styles.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
            {FLOWS.map((flow, i) => {
              const from = NODES.find(n => n.id === flow.from)!;
              const to = NODES.find(n => n.id === flow.to)!;
              const isActive = activeFlow === i;
              const isDimmed = dimmed && !isActive && activeFlow !== null;
              const fromNode = NODES.find(n => n.id === activeNode);
              const nodeRelated = activeNode && (flow.from === activeNode || flow.to === activeNode);
              const opacity = dimmed && !nodeRelated && activeFlow === null ? 0.15
                : isDimmed ? 0.1
                : isActive ? 1 : 0.35;

              return (
                <line
                  key={i}
                  x1={from.x} y1={from.y + 3.5}
                  x2={to.x}   y2={to.y + 3.5}
                  stroke={isActive ? from.color : '#94a3b8'}
                  strokeWidth={isActive ? 0.5 : 0.25}
                  strokeDasharray={isActive ? 'none' : '1 1'}
                  opacity={opacity}
                  style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                  onClick={() => setActiveFlow(activeFlow === i ? null : i)}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {NODES.map(node => {
            const isActive = activeNode === node.id;
            const isRelated = activeFlow !== null && (FLOWS[activeFlow].from === node.id || FLOWS[activeFlow].to === node.id);
            const isDimmed = dimmed && !isActive && !isRelated;
            return (
              <button
                key={node.id}
                onClick={() => {
                  setActiveNode(activeNode === node.id ? null : node.id);
                  setActiveFlow(null);
                }}
                style={{
                  position: 'absolute',
                  left: `${node.x}%`, top: `${node.y}%`,
                  transform: 'translate(-50%, -50%)',
                  background: isActive ? node.color : node.bg,
                  color: isActive ? '#fff' : node.color,
                  border: `2px solid ${isActive ? node.color : 'transparent'}`,
                  borderRadius: 10,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  minWidth: 80,
                  maxWidth: 110,
                  opacity: isDimmed ? 0.3 : 1,
                  transition: 'all 0.15s',
                  boxShadow: isActive ? `0 4px 12px ${node.color}44` : '0 1px 3px rgba(0,0,0,0.1)',
                  zIndex: isActive ? 20 : 10,
                }}
              >
                <div style={{ fontSize: 20, lineHeight: 1, marginBottom: 3 }}>{node.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}>{node.label}</div>
                <div style={{ fontSize: 9, opacity: 0.8, marginTop: 2, fontWeight: 500 }}>{node.sublabel}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {(selectedNode || selectedFlow) && (
        <div className="card" style={styles.detail}>
          {selectedNode && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 28 }}>{selectedNode.icon}</div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selectedNode.label}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{selectedNode.sublabel}</p>
                </div>
              </div>
              <p style={styles.detailText}>{selectedNode.description}</p>
              <div style={{ marginTop: 12 }}>
                <p style={styles.relatedLabel}>Connected flows:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {FLOWS.filter(f => f.from === selectedNode.id || f.to === selectedNode.id).map((f, i) => (
                    <button key={i} onClick={() => { setActiveFlow(FLOWS.indexOf(f)); setActiveNode(null); }}
                      style={{ ...styles.flowChip, background: selectedNode.bg, color: selectedNode.color, borderColor: selectedNode.color + '44' }}>
                      {f.from === selectedNode.id ? '→' : '←'} {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {selectedFlow && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{NODES.find(n => n.id === selectedFlow.from)?.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{NODES.find(n => n.id === selectedFlow.from)?.label}</span>
                <span style={{ fontSize: 16, color: 'var(--text-3)' }}>→</span>
                <span style={{ fontSize: 18 }}>{NODES.find(n => n.id === selectedFlow.to)?.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{NODES.find(n => n.id === selectedFlow.to)?.label}</span>
                <span className="chip chip--neutral" style={{ marginLeft: 'auto', fontSize: 10 }}>{selectedFlow.label}</span>
              </div>
              <p style={styles.detailText}>{selectedFlow.detail}</p>
            </>
          )}
          <button onClick={() => { setActiveNode(null); setActiveFlow(null); }} style={styles.closeBtn}>✕ Close</button>
        </div>
      )}

      {/* Flow list */}
      <div style={{ marginTop: 24 }}>
        <h2 style={styles.sectionTitle}>All Data Flows</h2>
        <div style={styles.flowList}>
          {FLOWS.map((flow, i) => {
            const fromNode = NODES.find(n => n.id === flow.from)!;
            const toNode = NODES.find(n => n.id === flow.to)!;
            return (
              <button key={i} onClick={() => { setActiveFlow(activeFlow === i ? null : i); setActiveNode(null); }}
                style={{ ...styles.flowRow, background: activeFlow === i ? fromNode.bg : 'var(--surface)', borderColor: activeFlow === i ? fromNode.color : 'var(--border)' }}>
                <span style={{ fontSize: 16 }}>{fromNode.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: fromNode.color }}>{fromNode.label}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 12 }}>→</span>
                <span style={{ fontSize: 16 }}>{toNode.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: toNode.color }}>{toNode.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{flow.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tech stack */}
      <div style={{ marginTop: 28 }}>
        <h2 style={styles.sectionTitle}>Tech Stack</h2>
        <div style={styles.stackGrid}>
          {[
            { cat: 'Frontend',     items: ['Next.js 14', 'React', 'TypeScript', 'App Engine'] },
            { cat: 'Backend',      items: ['Node.js', 'Express', 'Cloud Run', 'Pub/Sub'] },
            { cat: 'Storage',      items: ['Firestore', 'Cloud Storage', 'Secret Manager'] },
            { cat: 'Intelligence', items: ['Claude claude-sonnet-4', 'Announcement analysis', 'Calendar extraction', 'Digest summarisation'] },
            { cat: 'Integrations', items: ['ClassCharts API', 'Google Calendar', 'Google OAuth', 'Pushover'] },
          ].map(({ cat, items }) => (
            <div key={cat} className="card" style={styles.stackCard}>
              <p style={styles.stackCat}>{cat}</p>
              {items.map(item => <p key={item} style={styles.stackItem}>· {item}</p>)}
            </div>
          ))}
        </div>
      </div>

      <p style={{ marginTop: 32, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
        Built by FunFairLabs · Powered by Claude · Data from ClassCharts
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 800, margin: '0 auto', padding: '24px 16px 48px' },
  header: { marginBottom: 24, textAlign: 'center' },
  eyebrow: { fontSize: 11, color: '#f97316', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 },
  diagramWrap: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16, boxShadow: 'var(--shadow-md)' },
  diagram: { position: 'relative', width: '100%', paddingBottom: '110%' },
  svg: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'all' },
  layerLabel: { position: 'absolute', right: 8, top: 4, fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' },
  detail: { padding: 20, marginBottom: 8, borderLeft: '4px solid var(--border-strong)' },
  detailText: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 },
  relatedLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  flowChip: { fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, border: '1px solid', cursor: 'pointer' },
  closeBtn: { marginTop: 14, fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 },
  sectionTitle: { fontSize: 14, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)' },
  flowList: { display: 'flex', flexDirection: 'column', gap: 6 },
  flowRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' },
  stackGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 },
  stackCard: { padding: 14 },
  stackCat: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 8 },
  stackItem: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8, fontWeight: 500 },
};
