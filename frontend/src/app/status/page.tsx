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
}

const DEPENDENCY_LABELS: Record<string, string> = {
  classcharts: 'ClassCharts API',
  firestore: 'Firestore',
  anthropic: 'Anthropic (AI summaries)',
  pushover: 'Pushover (notifications)',
  pubsub: 'Pub/Sub',
};

const DEPENDENCY_DOCS: Record<string, string> = {
  classcharts: 'TES SSO login + ClassCharts API. Breaks when TES changes auth flow.',
  firestore: 'State + announcement archive storage. Required for all data persistence.',
  anthropic: 'Announcement and homework summarisation. Degrades gracefully if unavailable.',
  pushover: 'Push notifications to parents. Degrades gracefully if unavailable.',
  pubsub: 'Cloud Scheduler → Pub/Sub → Cloud Run trigger chain. If poller goes stale, check subscription push endpoint and IAM binding. Both are re-verified on every poller deploy.',
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
  const displayDeps = hb ? {
    ...hb.dependencies,
    pubsub: staleMins > 15 ? 'error' : (hb.dependencies.pubsub ?? 'ok'),
  } : {};
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
            {Object.entries(displayDeps).map(([key, val], i, arr) => (
              <div key={key} style={{
                padding: '12px 16px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'center', gap: 10,
                borderLeft: `3px solid ${val === 'ok' ? 'var(--positive)' : 'var(--negative)'}`,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{val === 'ok' ? '✓' : '✗'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{DEPENDENCY_LABELS[key] ?? key}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{DEPENDENCY_DOCS[key] ?? ''}</p>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: val === 'ok' ? 'var(--positive)' : 'var(--negative)',
                  padding: '2px 8px', borderRadius: 4,
                  background: val === 'ok' ? 'var(--positive-bg)' : 'var(--negative-bg)',
                }}>
                  {val.toUpperCase()}
                </span>
              </div>
            ))}
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
