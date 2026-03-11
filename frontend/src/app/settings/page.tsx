'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface NotificationPrefs {
  homeworkDigest: boolean;
  homeworkStatusChange: boolean;
  homeworkNew: boolean;
  behaviour: boolean;
  detentions: boolean;
  attendance: boolean;
  announcements: boolean;
}

const TOGGLE_META: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  { key: 'homeworkDigest',      label: 'Daily homework digest',    desc: '3pm summary of homework due in the next 7 days' },
  { key: 'homeworkStatusChange',label: 'Homework status changes',  desc: 'When homework is marked submitted, completed, or late' },
  { key: 'homeworkNew',         label: 'New homework set',         desc: 'When a teacher sets new homework' },
  { key: 'behaviour',           label: 'Behaviour points',         desc: 'Awards and negative behaviour points' },
  { key: 'detentions',          label: 'Detentions',               desc: 'When a new detention is added' },
  { key: 'attendance',          label: 'Attendance alerts',        desc: 'When an absence or late mark is recorded' },
];

const DEFAULT_PREFS: NotificationPrefs = {
  homeworkDigest: true, homeworkStatusChange: true, homeworkNew: true,
  behaviour: true, detentions: true, attendance: true, announcements: true,
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [pushoverKey, setPushoverKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<'idle'|'sending'|'ok'|'error'>('idle');

  useEffect(() => {
    fetch('/api/settings/prefs')
      .then(r => r.json())
      .then(d => {
        if (d.notifications) setPrefs(d.notifications);
        if (d.pushoverKey) setPushoverKey(d.pushoverKey);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function testNotification() {
    setTesting('sending');
    try {
      const res = await fetch('/api/test-notification', { method: 'POST' });
      setTesting(res.ok ? 'ok' : 'error');
    } catch { setTesting('error'); }
    setTimeout(() => setTesting('idle'), 4000);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch('/api/settings/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifications: prefs, pushoverKey: pushoverKey || undefined }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function toggle(key: keyof NotificationPrefs) {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  }

  if (loading) return <div style={styles.page}><p style={styles.loading}>Loading…</p></div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Account</p>
        <h1 style={styles.title}>Notification Settings</h1>
        {session?.user?.email && <p style={styles.email}>{session.user.email}</p>}
      </header>

      <div className="card" style={styles.section}>
        <h2 style={styles.sectionTitle}>Pushover Key</h2>
        <p style={styles.sectionDesc}>
          Your personal Pushover user key. Find it at{' '}
          <a href="https://pushover.net" target="_blank" rel="noreferrer" style={styles.link}>pushover.net</a>.
          Leave blank to use the shared account key.
        </p>
        <input
          style={styles.input}
          type="text"
          placeholder="u_xxxxxxxxxxxxxxxxxxxxx (optional)"
          value={pushoverKey}
          onChange={e => { setPushoverKey(e.target.value); setSaved(false); }}
          spellCheck={false}
        />
      </div>

      <div className="card" style={styles.section}>
        <h2 style={styles.sectionTitle}>Notifications</h2>
        <p style={styles.sectionDesc}>Choose which events send a Pushover notification to you.</p>
        <div style={styles.toggleList}>
          {TOGGLE_META.map(({ key, label, desc }) => (
            <div key={key} style={styles.toggleRow} onClick={() => toggle(key)}>
              <div style={styles.toggleText}>
                <span style={styles.toggleLabel}>{label}</span>
                <span style={styles.toggleDesc}>{desc}</span>
              </div>
              <button
                style={{ ...styles.toggle, background: prefs[key] ? 'var(--text)' : '#d1d5db' }}
                aria-pressed={prefs[key]}
                onClick={e => { e.stopPropagation(); toggle(key); }}
              >
                <span style={{ ...styles.toggleThumb, transform: prefs[key] ? 'translateX(20px)' : 'translateX(2px)' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: '20px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Test notification</p>
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Send a test Pushover to confirm everything is working</p>
        </div>
        <button
          style={{
            padding: '10px 18px', borderRadius: 6, border: '1px solid var(--border)',
            fontSize: 13, fontWeight: 600, cursor: testing === 'sending' ? 'default' : 'pointer',
            background: testing === 'ok' ? 'var(--positive-bg)' : testing === 'error' ? 'var(--negative-bg)' : 'var(--surface-2)',
            color: testing === 'ok' ? 'var(--positive)' : testing === 'error' ? 'var(--negative)' : 'var(--text)',
            flexShrink: 0,
          }}
          onClick={testNotification}
          disabled={testing === 'sending'}
        >
          {testing === 'idle' ? '📱 Send test' : testing === 'sending' ? 'Sending…' : testing === 'ok' ? '✓ Delivered' : '✕ Failed'}
        </button>
      </div>

      <div style={styles.saveRow}>
        <button style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span style={styles.savedMsg}>✓ Saved</span>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 560, margin: '0 auto', padding: '24px 16px 48px' },
  header: { marginBottom: 28 },
  eyebrow: { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 },
  title: { fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 500, marginBottom: 4 },
  email: { fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  loading: { color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 },
  section: { padding: '24px', marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
  sectionDesc: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 16 },
  link: { color: 'var(--text)', textDecoration: 'underline' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', color: 'var(--text)', outline: 'none' },
  toggleList: { display: 'flex', flexDirection: 'column' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' },
  toggleText: { display: 'flex', flexDirection: 'column', gap: 2 },
  toggleLabel: { fontSize: 13, fontWeight: 500 },
  toggleDesc: { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  toggle: { width: 44, height: 24, borderRadius: 100, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' },
  toggleThumb: { position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'transform 0.2s' },
  saveRow: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 },
  saveBtn: { padding: '12px 28px', background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-body)', cursor: 'pointer' },
  savedMsg: { fontSize: 13, color: 'var(--positive)', fontFamily: 'var(--font-mono)' },
};
