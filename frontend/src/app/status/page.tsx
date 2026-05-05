'use client';
import { useEffect, useState } from 'react';

interface Heartbeat {
  polledAt: string;
  pupils: string[];
  dependencies: Record<string, 'ok' | 'error'>;
  errors?: string[];
  updatedAt: string;
}

interface StatusResponse {
  heartbeat: Heartbeat | null;
  fetchedAt: string;
  error?: string;
  pollerHealth?: { ok: boolean; latencyMs?: number };
  expectedPushEndpoint?: string;
}

interface DependencyInfo {
  label: string;
  what: string;
  why: string;
  when: string;
  with: string;
  degradesGracefully?: boolean;
}

const DEPENDENCIES: Record<string, DependencyInfo> = {
  classcharts: {
    label: 'ClassCharts API',
    what: 'School data — timetable, homework, behaviour, attendance, announcements, detentions',
    why: 'Core data source. Without it the poller cannot fetch any pupil data.',
    when: 'Every 5 minutes via the poller. Frontend proxies live data on demand.',
    with: 'TES SSO handshake (session.tes.com) then ClassCharts REST API (classcharts.com/apiv2parent). Uses classcharts-api library with custom TES login. Breaks when TES changes auth flow.',
  },
  firestore: {
    label: 'Firestore',
    what: 'Poll state, announcement archive, attachment metadata, poller heartbeat',
    why: 'Required for all persistence. Without it the poller re-sends every notification on every poll and the frontend cannot show archived announcements or documents.',
    when: 'Read at poll start (state), written after every change. Frontend reads on every page load.',
    with: 'Google Cloud Firestore via @google-cloud/firestore. Project: classcharts. Collections: poll_state, announcements, attachments, status.',
  },
  gcs: {
    label: 'Cloud Storage (GCS)',
    what: 'Attachment files (PDFs, converted docs), allowed-users.json, user-prefs.json',
    why: 'Permanent storage for school documents. Without it attachments cannot be saved or served. Auth config cannot be read.',
    when: 'Written when new attachments are downloaded. Read by frontend on Documents page and at auth time.',
    with: 'Google Cloud Storage via @google-cloud/storage. Bucket: classcharts-attachments. LibreOffice used for docx/pptx/xlsx → PDF conversion before upload.',
  },
  pubsub: {
    label: 'Pub/Sub + Cloud Scheduler',
    what: 'Trigger chain: Cloud Scheduler → Pub/Sub topic → push subscription → Cloud Run',
    why: 'Without it the poller never fires and all data goes stale. IAM binding and subscription push endpoint must be correct.',
    when: 'Every 5 minutes (scheduled poll) and 3pm weekdays (homework digest).',
    with: 'Cloud Scheduler → classcharts-poll topic → classcharts-poller-sub subscription → Cloud Run HTTPS POST. IAM binding (roles/run.invoker) and push endpoint both re-verified on every deploy.',
  },
  cloudrun: {
    label: 'Cloud Run (Poller)',
    what: 'The poller container — receives Pub/Sub messages and executes polls',
    why: 'Without a healthy container, no polls run regardless of Pub/Sub delivering correctly.',
    when: 'Checked on status page load via /health endpoint.',
    with: 'classcharts-poller Cloud Run service, europe-west2. Revision checked via authenticated /health GET.',
  },
  anthropic: {
    label: 'Anthropic API (Claude)',
    what: 'Announcement summarisation, calendar event extraction, action detection, homework digest',
    why: 'Enriches notifications — summaries, calendar events, required action flags. Degrades gracefully.',
    when: 'Called for each new announcement and at 3pm for the homework digest.',
    with: 'claude-sonnet-4-6 via https://api.anthropic.com/v1/messages. API key from Secret Manager. Rate limit: ~65s inter-topic delay for bulk operations.',
    degradesGracefully: true,
  },
  fcm: {
    label: 'Firebase Messaging',
    what: 'Push notifications to parents for new homework, behaviour, announcements, attendance alerts',
    why: 'Push notifications to parents via Firebase Cloud Messaging. Degrades gracefully — data is still archived to Firestore if FCM fails. During parallel-run week Pushover also fires; set PUSHOVER_ENABLED=false in Secret Manager to cut over to FCM-only.',
    when: 'Called for each new event detected by the poller.',
    with: 'Firebase Admin SDK messaging.send(). FCM tokens registered per-device: browser registers firebase-messaging-sw.js, calls getToken() with VAPID key, token stored in GCS user-prefs.json. If red: check VAPID key in Secret Manager, check Firebase Console → Cloud Messaging, verify users have visited /settings and enabled notifications.',
    degradesGracefully: true,
  },
  gcal: {
    label: 'Google Calendar',
    what: 'Calendar events extracted from announcements by Claude, homework due dates',
    why: 'Adds school events to family calendar automatically. Degrades gracefully.',
    when: 'Called when Claude identifies calendar events in new announcements.',
    with: 'Google Calendar API via googleapis. One calendar per pupil. Refresh token from Secret Manager. Event titles updated when homework status changes.',
    degradesGracefully: true,
  },
  gtasks: {
    label: 'Google Tasks',
    what: 'Homework items as tasks with due dates, status synced back from ClassCharts',
    why: 'Makes homework actionable in Google Calendar/Tasks apps. Degrades gracefully.',
    when: 'Called for each new homework item. Status updated when ClassCharts reports completion.',
    with: 'Google Tasks API via googleapis. One task list per pupil. Refresh token from Secret Manager.',
    degradesGracefully: true,
  },
  secretmanager: {
    label: 'Secret Manager',
    what: 'All credentials — ClassCharts passwords, Google OAuth keys, Anthropic API key',
    why: 'Required at startup. Without it the poller cannot log in to anything.',
    when: 'Read once at poller startup and at frontend deploy time (written to app.yaml env vars).',
    with: 'Google Cloud Secret Manager. Project: classcharts. Accessed via gcloud CLI in deploy scripts and via @google-cloud/secret-manager in the poller.',
  },
};

function ago(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function pollAge(ts: string): { label: string; color: string } {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins <= 7)  return { label: 'Recent',   color: 'var(--positive)' };
  if (mins <= 15) return { label: 'Delayed',  color: 'var(--warning)'  };
  return              { label: 'Stale',    color: 'var(--negative)' };
}

export default function StatusPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [triggering, setTriggering] = useState(false);
  const [expandedDep, setExpandedDep] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  async function triggerPoll() {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch('/api/trigger-poll', { method: 'POST' });
      const data = await res.json();
      setTriggerResult(JSON.stringify(data));
      setTimeout(load, 15000);
    } catch (err) {
      setTriggerResult(`Error: ${String(err)}`);
    }
    setTimeout(() => setTriggering(false), 15000);
  }

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/status');
      setStatus(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const hb = status?.heartbeat;
  const age = hb ? pollAge(hb.polledAt) : null;
  // If poller is stale (>15m), Pub/Sub trigger chain is implicitly broken
  const staleMins = hb ? Math.floor((Date.now() - new Date(hb.polledAt).getTime()) / 60000) : 0;
  const cloudRunOk = status?.pollerHealth?.ok;
  const displayDeps = hb ? {
    // Start with all known deps as unknown, then overlay reported values
    ...Object.fromEntries(Object.keys(DEPENDENCIES).map(k => [k, 'unknown'])),
    ...hb.dependencies,
    // Override specific deps with computed values — must come last
    pubsub: staleMins > 15 ? 'error' : (hb.dependencies.pubsub ?? 'ok'),
    cloudrun: staleMins <= 15 ? 'ok' : 'error',
  } : Object.fromEntries(Object.keys(DEPENDENCIES).map(k => [k, 'unknown' as const]));
  const allOk = hb ? Object.values(displayDeps).every(v => v === 'ok') && staleMins <= 15 : false;

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <p style={styles.eyebrow}>System</p>
        <h1 style={styles.pageTitle}>Status</h1>
      </div>

      {loading && <div style={{ height: 200, background: 'var(--surface-2)', borderRadius: 8 }} />}

      {!loading && !hb && (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No heartbeat data</p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
            The poller has not written a status record yet.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
            <button onClick={load} style={{ fontSize: 12, padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-2)' }}>
              Refresh
            </button>
            <button onClick={triggerPoll} disabled={triggering} style={{ fontSize: 12, padding: '6px 14px', border: 'none', borderRadius: 6, background: 'var(--accent, #6366f1)', color: '#fff', cursor: triggering ? 'default' : 'pointer', opacity: triggering ? 0.7 : 1 }}>
              {triggering ? 'Polling…' : 'Trigger poll now'}
            </button>
          </div>
          {triggerResult && (
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', wordBreak: 'break-all', marginTop: 8 }}>
              {triggerResult}
            </p>
          )}
        </div>
      )}

      {!loading && hb && (
        <>
          {/* Overall status banner */}
          <div style={{
            padding: '14px 16px',
            borderRadius: 8,
            marginBottom: 16,
            background: allOk ? 'var(--positive-bg)' : 'var(--negative-bg)',
            border: `1px solid ${allOk ? 'var(--positive)' : 'var(--negative)'}33`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{allOk ? '✓' : '✗'}</span>
            <div>
              <p style={{ fontWeight: 700, color: allOk ? 'var(--positive)' : 'var(--negative)', fontSize: 15 }}>
                {allOk ? 'All systems operational' : 'One or more dependencies degraded'}
              </p>
              <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                Last checked {ago(status!.fetchedAt)}
              </p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={load} style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-2)' }}>
                Refresh
              </button>
              <button onClick={triggerPoll} disabled={triggering} style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 4, background: triggering ? 'var(--surface-2)' : 'var(--surface)', cursor: triggering ? 'default' : 'pointer', color: 'var(--text-2)' }}>
                {triggering ? 'Polling…' : 'Trigger poll'}
              </button>
            </div>
          </div>

          {/* Poller heartbeat */}
          <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '10px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <span style={styles.sectionLabel}>Poller</span>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>Last poll</p>
                  <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                    {new Date(hb.polledAt).toLocaleString('en-GB')}
                  </p>
                  {status?.pollerHealth && (
                    <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: status.pollerHealth.ok ? 'var(--positive)' : 'var(--negative)', marginTop: 4 }}>
                      {status.pollerHealth.ok ? '✓ Container healthy' : '✗ Container stale'}
                      {status.pollerHealth.latencyMs ? ` (${status.pollerHealth.latencyMs}ms)` : ' (inferred from heartbeat)'}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: age!.color }}>{ago(hb.polledAt)}</span>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: age!.color }}>{age!.label}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {hb.pupils.map(p => (
                  <span key={p} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: 'var(--surface-2)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Dependencies */}
          <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '10px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <span style={styles.sectionLabel}>Dependencies</span>
            </div>
            {Object.entries(displayDeps).map(([key, val], i, arr) => {
              const dep = DEPENDENCIES[key];
              const isExpanded = expandedDep === key;
              return (
                <div key={key} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <button onClick={() => setExpandedDep(isExpanded ? null : key)} style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                    borderLeft: `3px solid ${val === 'ok' ? 'var(--positive)' : val === 'unknown' ? 'var(--border)' : 'var(--negative)'}`,
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0, color: val === 'ok' ? 'var(--positive)' : val === 'unknown' ? 'var(--text-3)' : 'var(--negative)' }}>{val === 'ok' ? '✓' : val === 'unknown' ? '?' : '✗'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{dep?.label ?? key}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dep?.what ?? ''}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {dep?.degradesGracefully && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', padding: '1px 5px', borderRadius: 3, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>graceful</span>}
                      <span style={{
                        fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        color: val === 'ok' ? 'var(--positive)' : val === 'unknown' ? 'var(--text-3)' : 'var(--negative)',
                        padding: '2px 8px', borderRadius: 4,
                        background: val === 'ok' ? 'var(--positive-bg)' : val === 'unknown' ? 'var(--surface-2)' : 'var(--negative-bg)',
                      }}>{String(val).toUpperCase()}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {isExpanded && dep && (
                    <div style={{ padding: '0 16px 14px 16px', borderLeft: `3px solid ${val === 'ok' ? 'var(--positive)' : val === 'unknown' ? 'var(--border)' : 'var(--negative)'}`, background: 'var(--surface-2)' }}>
                      {[
                        { label: 'What', value: dep.what },
                        { label: 'Why', value: dep.why },
                        { label: 'When', value: dep.when },
                        { label: 'With', value: dep.with },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 8 }}>{label}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recent errors */}
          {hb.errors && hb.errors.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: 'var(--negative-bg)', borderBottom: '1px solid var(--border)' }}>
                <span style={{ ...styles.sectionLabel, color: 'var(--negative)' }}>Recent errors ({hb.errors.length})</span>
              </div>
              {hb.errors.map((err, i) => (
                <div key={i} style={{
                  padding: '10px 16px', fontSize: 12, fontFamily: 'var(--font-mono)',
                  color: 'var(--negative)', lineHeight: 1.5,
                  borderBottom: i < hb.errors!.length - 1 ? '1px solid var(--border)' : 'none',
                  wordBreak: 'break-word' as const,
                }}>
                  {err}
                </div>
              ))}
            </div>
          )}

          {/* Rule reminder */}
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
              📋 Rule: when a dependency causes a production incident, a health check for it must be added to this page in the same PR as the fix.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 640, margin: '0 auto', padding: '12px 12px 56px' },
  pageHeader: { marginBottom: 16 },
  eyebrow: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 },
  pageTitle: { fontSize: 22, fontWeight: 700 },
  sectionLabel: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
};
