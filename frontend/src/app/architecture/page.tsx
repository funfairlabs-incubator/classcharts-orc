'use client';
import { useState, useEffect } from 'react';

type NodeId =
  | 'classcharts' | 'scheduler' | 'pubsub' | 'poller' | 'firestore'
  | 'gcs' | 'secretmanager' | 'frontend' | 'browser' | 'fcm'
  | 'gcal' | 'gtasks' | 'claude' | 'status';

// Map architecture node IDs to status dependency keys
const NODE_TO_DEP: Partial<Record<NodeId, string>> = {
  classcharts:   'classcharts',
  firestore:     'firestore',
  gcs:           'gcs',
  pubsub:        'pubsub',
  scheduler:     'pubsub',  // scheduler is part of pubsub chain
  claude:        'anthropic',
  fcm:           'fcm',
  gcal:          'gcal',
  gtasks:        'gtasks',
  secretmanager: 'secretmanager',
  poller: 'cloudrun',
};

const STATUS_COLOR: Record<string, string> = {
  ok:      '#22c55e',
  error:   '#ef4444',
  unknown: '#94a3b8',
};

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
  x: number;
  y: number;
  description: string;
}

const NODES: ArchNode[] = [
  { id: 'classcharts',   label: 'ClassCharts',     sublabel: 'TES SSO + API',        icon: '🏫', color: '#16a34a', bg: '#dcfce7', x: 50,  y: 4,  description: 'The official ClassCharts parent API, now using TES SSO authentication. Login performs a manual TES handshake before accessing ClassCharts. Provides pupils, timetable, homework, behaviour, attendance, announcements and detentions. Polled every 5 minutes.' },
  { id: 'scheduler',     label: 'Cloud Scheduler', sublabel: 'GCP',                  icon: '⏰', color: '#7c3aed', bg: '#ede9fe', x: 10,  y: 22, description: 'Two jobs: every 5 minutes triggers a standard poll, and at 3pm weekdays triggers the homework digest. Both publish to the Pub/Sub topic.' },
  { id: 'pubsub',        label: 'Pub/Sub',          sublabel: 'GCP Message Bus',      icon: '📨', color: '#0369a1', bg: '#e0f2fe', x: 35,  y: 22, description: 'Google Cloud Pub/Sub decouples the scheduler from the poller. Push subscription with OIDC token auth. Messages carry a trigger type: "scheduled" for normal polls, "digest" for the 3pm homework summary.' },
  { id: 'secretmanager', label: 'Secret Manager',   sublabel: 'GCP',                  icon: '🔐', color: '#b45309', bg: '#fef3c7', x: 80,  y: 22, description: 'Stores all credentials: ClassCharts passwords, Google OAuth keys, NextAuth secret, Anthropic API key. Both the poller and frontend pull secrets at startup. FCM tokens are stored per-user in GCS user-prefs.json instead.' },
  { id: 'poller',        label: 'Poller',            sublabel: 'Cloud Run',            icon: '🔄', color: '#1d4ed8', bg: '#dbeafe', x: 35,  y: 44, description: 'Node.js service on Cloud Run. Logs into ClassCharts via TES SSO, diffs state against Firestore, sends push notifications via OneSignal (and optionally Pushover), archives announcements, downloads announcement and homework attachments to GCS, creates Google Calendar events and Google Tasks via Claude analysis. Writes a heartbeat to Firestore after every poll for the status page.' },
  { id: 'claude',        label: 'Claude API',        sublabel: 'Anthropic',            icon: '🤖', color: '#7c3aed', bg: '#ede9fe', x: 10,  y: 62, description: 'Claude (claude-sonnet-4-6) analyses new announcements: extracting calendar events, summarising content, identifying required actions and consent items. Also summarises homework and behaviour points for notifications.' },
  { id: 'firestore',     label: 'Firestore',         sublabel: 'GCP NoSQL',            icon: '🗄️', color: '#0f766e', bg: '#ccfbf1', x: 60,  y: 44, description: 'Stores poll state per pupil (last seen IDs for activities, homework, announcements — retains 200 IDs to prevent re-notification after deploy gaps), archived announcements with AI summaries, announcement attachment metadata (attachments collection), homework attachment metadata (homeworkAttachments collection), and poller heartbeat for the status page.' },
  { id: 'gcs',           label: 'Cloud Storage',     sublabel: 'GCP',                  icon: '📦', color: '#b45309', bg: '#fef3c7', x: 85,  y: 44, description: 'Stores downloaded attachment files at attachments/{studentId}/{announcementId}/{filename} (announcements) and homework/{studentId}/{homeworkId}/{filename} (homework). PDFs, Word docs and other formats served via the /api/attachments proxy. Also stores config: allowed-users.json and user-prefs.json.' },
  { id: 'fcm',           label: 'OneSignal',           sublabel: 'Push Notifications',   icon: '🔔', color: '#f59e0b', bg: '#fffbeb', x: 10,  y: 82, description: 'OneSignal delivers rich push notifications to installed PWAs. Subscription IDs registered per-device from Settings and stored in GCS user-prefs.json. Notifications include AI-generated summaries and deep-link URLs. Toggled independently from Pushover via Settings → Notification Channels.' },
  { id: 'gcal',          label: 'Google Calendar',   sublabel: 'Events',               icon: '📅', color: '#0369a1', bg: '#e0f2fe', x: 35,  y: 82, description: 'Claude extracts dates and events from school announcements and creates Google Calendar entries automatically. One calendar per pupil. Covers trips, parents evenings, deadlines and term dates. Event titles updated when homework status changes (📚 → ✅).' },
  { id: 'gtasks',        label: 'Google Tasks',       sublabel: 'Homework',             icon: '✅', color: '#16a34a', bg: '#dcfce7', x: 55,  y: 82, description: 'Each new homework item creates a Google Task with the due date. Task status updates automatically when ClassCharts reports completion or late submission. One task list per pupil, synced to Google Calendar.' },
  { id: 'status',        label: 'Status',             sublabel: 'Health checks',        icon: '⚡', color: '#f59e0b', bg: '#fef3c7', x: 80,  y: 82, description: 'The /status page reads the poller heartbeat from Firestore. Shows last poll time, staleness (green <7m, amber <15m, red >15m), per-dependency health (ClassCharts, Firestore, Anthropic, FCM), and recent error log. Rule: when a dependency causes an incident, a health check must be added here in the same PR.' },
  { id: 'frontend',      label: 'Frontend',           sublabel: 'App Engine / Next.js', icon: '⚡', color: '#1d4ed8', bg: '#dbeafe', x: 65,  y: 70, description: 'Next.js app on Google App Engine at classcharts.funfairlabs.com. Per-student cards with live timetable + attendance (Day View), behaviour, homework, announcements and documents. Documents page shows both announcement and homework attachments with student and type filter pills. Multi-student support with demo mode for previewing second-student layouts. Pull-to-refresh, PWA installable, dark mode.' },
  { id: 'browser',       label: 'You',                sublabel: 'Mobile PWA',           icon: '👁️', color: '#111111', bg: '#f4f4f4', x: 65,  y: 92, description: 'The dashboard you\'re looking at. Installable as a PWA from Settings. Per-student colour palettes, student switcher in hamburger menu, demo mode for second-student preview. Traffic light in footer shows poller health at a glance. Visit Settings → Enable notifications to register this device for FCM push notifications.' },
];

const FLOWS: FlowStep[] = [
  { from: 'scheduler',    to: 'pubsub',        label: '*/5 + 3pm',      detail: 'Publishes {"trigger":"scheduled"} every 5 mins and {"trigger":"digest"} at 3pm weekdays' },
  { from: 'pubsub',       to: 'poller',        label: 'HTTP push+OIDC', detail: 'Pub/Sub pushes to Cloud Run via HTTP POST with OIDC token. IAM binding re-granted after every deploy to prevent drop.' },
  { from: 'poller',       to: 'classcharts',   label: 'TES SSO + REST', detail: 'Manual TES handshake then ClassCharts API calls per pupil — activity, homework, announcements, attendance, detentions' },
  { from: 'poller',       to: 'secretmanager', label: 'Read secrets',   detail: 'Reads ClassCharts credentials, Google tokens, Anthropic key at startup' },
  { from: 'frontend',     to: 'secretmanager', label: 'Read secrets',   detail: 'Reads Google OAuth, NextAuth secret, ClassCharts credentials at deploy time via app.yaml' },
  { from: 'poller',       to: 'claude',        label: 'Analyse',        detail: 'Sends announcement text to Claude for summary, calendar event extraction, action detection, and homework/behaviour digest' },
  { from: 'poller',       to: 'firestore',     label: 'State + archive',detail: 'Reads last-seen IDs. Writes state (200-ID ring buffer for announcements). Archives full announcement JSON with AI summary.' },
  { from: 'poller',       to: 'firestore',     label: 'Heartbeat',      detail: 'After every poll writes {polledAt, pupils, dependencies, errors} to status/poller for the health dashboard' },
  { from: 'poller',       to: 'gcs',           label: 'Save files',     detail: 'Downloads announcement and homework attachments from ClassCharts, saves to GCS under attachments/ and homework/ prefixes respectively' },
  { from: 'poller',       to: 'fcm',           label: 'Notify',         detail: 'Named push notifications per event type, filtered by per-parent toggles. FCM tokens fetched from user-prefs.json in GCS.' },
  { from: 'poller',       to: 'gcal',          label: 'Create events',  detail: 'Creates calendar entries from Claude-extracted dates. Updates event title emoji when homework status changes.' },
  { from: 'poller',       to: 'gtasks',        label: 'Homework tasks', detail: 'Creates a Google Task per homework item with due date. Updates task completion status when ClassCharts reports it.' },
  { from: 'browser',      to: 'frontend',      label: 'HTTPS / PWA',   detail: 'Google OAuth via NextAuth. All API routes server-side. PWA installable from Settings page.' },
  { from: 'browser',      to: 'fcm',           label: 'Register',       detail: 'On first visit to /settings, OneSignal SDK requests notification permission, creates a subscription, and POSTs the subscription ID to /api/onesignal-id which stores it in GCS user-prefs.json.' },
  { from: 'fcm',          to: 'browser',       label: 'Push notify',    detail: 'OneSignal delivers rich web push to the installed PWA. Notifications include AI-generated summary as body text and a deep-link URL that opens the correct page in the app. Appears as a native app notification when PWA is installed to home screen.' },
  { from: 'frontend',     to: 'classcharts',   label: 'Live data',      detail: 'Server-side API routes proxy timetable, homework, behaviour etc with 10-minute cache' },
  { from: 'frontend',     to: 'firestore',     label: 'Archive + status', detail: 'Reads archived announcements, announcement and homework attachment metadata (attachments + homeworkAttachments collections), and poller heartbeat for status page' },
  { from: 'frontend',     to: 'gcs',           label: 'Documents',      detail: 'Streams attachment files directly from GCS — no signed URLs (not available on App Engine SA)' },
  { from: 'frontend',     to: 'status',        label: 'Health',         detail: 'Traffic light in footer reads /api/status every page load. Green <7m, amber <15m, red >15m or errors.' },
];

const LAYERS = [
  { label: 'External',   y: 0,   h: 15,  color: '#f0fdf4' },
  { label: 'Triggers',   y: 15,  h: 17,  color: '#faf5ff' },
  { label: 'Processing', y: 32,  h: 22,  color: '#eff6ff' },
  { label: 'Storage',    y: 54,  h: 20,  color: '#fff7ed' },
  { label: 'Outputs',    y: 74,  h: 26,  color: '#fef2f2' },
];

export default function ArchitecturePage() {
  const [activeNode, setActiveNode] = useState<NodeId | null>(null);
  const [activeFlow, setActiveFlow] = useState<number | null>(null);
  const [depStatus, setDepStatus] = useState<Record<string, string>>({});
  const [lastPoll, setLastPoll] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => {
        const hb = d?.heartbeat;
        if (!hb) return;
        setLastPoll(hb.polledAt);
        const mins = Math.floor((Date.now() - new Date(hb.polledAt).getTime()) / 60000);
        setDepStatus({
          ...hb.dependencies,
          pubsub: mins > 15 ? 'error' : (hb.dependencies.pubsub ?? 'ok'),
        });
      })
      .catch(() => {});
  }, []);

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
        <h1 style={styles.title}>How it works</h1>
        <p style={styles.subtitle}>Tap any component or flow to learn more</p>
      </header>

      <div style={styles.diagramWrap}>
        <div style={styles.diagram}>
          {LAYERS.map(l => (
            <div key={l.label} style={{
              position: 'absolute', left: 0, right: 0,
              top: `${l.y}%`, height: `${l.h}%`,
              background: l.color, borderBottom: '1px solid #e5e7eb',
            }}>
              <span style={styles.layerLabel}>{l.label}</span>
            </div>
          ))}

          <svg style={styles.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
            {FLOWS.map((flow, i) => {
              const from = NODES.find(n => n.id === flow.from)!;
              const to = NODES.find(n => n.id === flow.to)!;
              const isActive = activeFlow === i;
              const nodeRelated = activeNode && (flow.from === activeNode || flow.to === activeNode);
              const opacity = dimmed && !nodeRelated && activeFlow === null ? 0.15
                : dimmed && !isActive && activeFlow !== null ? 0.1
                : isActive ? 1 : 0.35;
              return (
                <line key={i}
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

          {NODES.map(node => {
            const isActive = activeNode === node.id;
            const isRelated = activeFlow !== null && (FLOWS[activeFlow].from === node.id || FLOWS[activeFlow].to === node.id);
            const isDimmed = dimmed && !isActive && !isRelated;
            return (
              <button key={node.id}
                onClick={() => { setActiveNode(activeNode === node.id ? null : node.id); setActiveFlow(null); }}
                style={{
                  position: 'absolute',
                  left: `${node.x}%`, top: `${node.y}%`,
                  transform: 'translate(-50%, -50%)',
                  background: isActive ? node.color : node.bg,
                  color: isActive ? '#fff' : node.color,
                  border: `2px solid ${isActive ? node.color : 'transparent'}`,
                  borderRadius: 10, padding: '6px 10px', cursor: 'pointer',
                  textAlign: 'center', minWidth: 80, maxWidth: 110,
                  opacity: isDimmed ? 0.3 : 1,
                  transition: 'all 0.15s',
                  boxShadow: isActive ? `0 4px 12px ${node.color}44` : '0 1px 3px rgba(0,0,0,0.1)',
                  zIndex: isActive ? 20 : 10,
                }}
              >
                {/* Status dot */}
                {NODE_TO_DEP[node.id] && (() => {
                  const depKey = NODE_TO_DEP[node.id]!;
                  const st = depStatus[depKey] ?? 'unknown';
                  return (
                    <div style={{
                      position: 'absolute', top: -4, right: -4,
                      width: 10, height: 10, borderRadius: '50%',
                      background: STATUS_COLOR[st] ?? STATUS_COLOR.unknown,
                      border: '2px solid var(--bg)',
                      boxShadow: st === 'ok' ? `0 0 4px ${STATUS_COLOR.ok}` : st === 'error' ? `0 0 4px ${STATUS_COLOR.error}` : 'none',
                      zIndex: 30,
                    }} />
                  );
                })()}
                <div style={{ fontSize: 20, lineHeight: 1, marginBottom: 3 }}>{node.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}>{node.label}</div>
                <div style={{ fontSize: 9, opacity: 0.8, marginTop: 2, fontWeight: 500 }}>{node.sublabel}</div>
              </button>
            );
          })}
        </div>
      {/* Status legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {[['#22c55e','OK'], ['#ef4444','Error'], ['#94a3b8','Unknown']].map(([col, label]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: col as string, display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
        <span>{lastPoll ? `Last poll ${new Date(lastPoll).toLocaleTimeString('en-GB')}` : 'No poll data'}</span>
      </div>
      </div>

      {(selectedNode || selectedFlow) && (
        <div className="card" style={styles.detail}>
          {selectedNode && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 28 }}>{selectedNode.icon}</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selectedNode.label}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{selectedNode.sublabel}</p>
                </div>
                {NODE_TO_DEP[selectedNode.id] && (() => {
                  const st = depStatus[NODE_TO_DEP[selectedNode.id]!] ?? 'unknown';
                  return (
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: STATUS_COLOR[st], margin: '0 auto 3px', boxShadow: st !== 'unknown' ? `0 0 5px ${STATUS_COLOR[st]}` : 'none' }} />
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: STATUS_COLOR[st], fontWeight: 700, textTransform: 'uppercase' }}>{st}</span>
                    </div>
                  );
                })()}
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
                <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{selectedFlow.label}</span>
              </div>
              <p style={styles.detailText}>{selectedFlow.detail}</p>
            </>
          )}
          <button onClick={() => { setActiveNode(null); setActiveFlow(null); }} style={styles.closeBtn}>✕ Close</button>
        </div>
      )}

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

      <div style={{ marginTop: 28 }}>
        <h2 style={styles.sectionTitle}>Tech Stack</h2>
        <div style={styles.stackGrid}>
          {[
            { cat: 'Frontend',     items: ['Next.js 14', 'React', 'TypeScript', 'App Engine', 'PWA / installable'] },
            { cat: 'Backend',      items: ['Node.js', 'Express', 'Cloud Run', 'Pub/Sub + OIDC'] },
            { cat: 'Storage',      items: ['Firestore', 'Cloud Storage', 'Secret Manager'] },
            { cat: 'Intelligence', items: ['Claude claude-sonnet-4-6', 'Announcement analysis', 'Calendar extraction', 'Digest summarisation'] },
            { cat: 'Integrations', items: ['ClassCharts + TES SSO', 'Google Calendar', 'Google Tasks', 'Google OAuth', 'Firebase Cloud Messaging'] },
            { cat: 'Observability',items: ['Poller heartbeat', 'Dependency health', 'Traffic light footer', 'Error log'] },
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
  page: { maxWidth: 800, margin: '0 auto', padding: '24px 16px 56px' },
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
