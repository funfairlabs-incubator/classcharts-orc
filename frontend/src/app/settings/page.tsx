'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { usePupil } from '@/lib/usePupil';
import { getFirebaseMessaging } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';

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

/** Derive a full palette from any hex colour for card bg/border tints. */
function paletteFromHex(hex: string): { color: string; bg: string; border: string; label: string } {
  // Parse to r,g,b
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // bg: mix 8% colour into white; border: mix 25% colour into white
  const mix = (c: number, pct: number) => Math.round(255 * (1 - pct) + c * pct);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const bg = `#${toHex(mix(r, 0.08))}${toHex(mix(g, 0.08))}${toHex(mix(b, 0.08))}`;
  const border = `#${toHex(mix(r, 0.25))}${toHex(mix(g, 0.25))}${toHex(mix(b, 0.25))}`;
  return { color: hex, bg, border, label: hex };
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [pushoverKey, setPushoverKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<'idle'|'sending'|'ok'|'error'>('idle');
  const [notifStatus, setNotifStatus] = useState<'unknown'|'granted'|'denied'|'registering'|'registered'|'error'>('unknown');
  const { pupils } = usePupil();
  const [palettes, setPalettes] = useState<Record<number, ReturnType<typeof paletteFromHex>>>({});
  const [themeColour, setThemeColour] = useState('#f97316');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoColour, setDemoColourState] = useState('#15803d');

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true);
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setInstallPrompt(null);
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pupilPalettes');
      if (saved) {
        // Migrate old preset objects (have .label like 'Blue') to paletteFromHex shape
        const parsed = JSON.parse(saved) as Record<number, { color: string }>;
        const migrated: Record<number, ReturnType<typeof paletteFromHex>> = {};
        for (const [id, p] of Object.entries(parsed)) {
          migrated[Number(id)] = paletteFromHex(p.color);
        }
        setPalettes(migrated);
      }
    } catch { /* ignore */ }
    try {
      const tc = localStorage.getItem('themeColour');
      if (tc) { setThemeColour(tc); applyThemeColour(tc); }
    } catch { /* ignore */ }
    try {
      const dm = localStorage.getItem('demoMode');
      if (dm === 'true') setDemoMode(true);
    } catch { /* ignore */ }
    try {
      const dp = localStorage.getItem('demoPalette');
      if (dp) {
        const parsed = JSON.parse(dp) as { color: string };
        setDemoColourState(parsed.color);
      }
    } catch { /* ignore */ }
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

  async function registerFcmToken() {
    setNotifStatus('registering');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setNotifStatus('denied'); return; }
      const messaging = getFirebaseMessaging();
      if (!messaging) { console.error('FCM: getFirebaseMessaging() returned null'); setNotifStatus('error'); return; }

      // Explicitly register the service worker — don't assume it's already registered
      let swReg: ServiceWorkerRegistration | undefined;
      try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        await swReg.update();
        console.log('FCM: service worker registered', swReg.scope);
      } catch (swErr) {
        console.error('FCM: service worker registration failed', swErr);
        setNotifStatus('error');
        return;
      }

      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });
      console.log('FCM: token obtained', token ? token.slice(0, 20) + '…' : 'null');
      if (!token) { setNotifStatus('error'); return; }
      const res = await fetch('/api/fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      console.log('FCM: token saved', res.status);
      setNotifStatus(res.ok ? 'registered' : 'error');
    } catch (err) {
      console.error('FCM registration failed:', err);
      setNotifStatus('error');
    }
  }

  function applyThemeColour(colour: string) {
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = colour;
    document.documentElement.style.setProperty('--theme-colour', colour);
  }

  function toggleDemoMode() {
    const next = !demoMode;
    setDemoMode(next);
    try { localStorage.setItem('demoMode', String(next)); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('demoModeChange', { detail: next }));
  }

  function handleDemoColour(hex: string) {
    setDemoColourState(hex);
    const palette = paletteFromHex(hex);
    try { localStorage.setItem('demoPalette', JSON.stringify(palette)); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('demoPaletteChange', { detail: palette }));
  }

  function handleTheme(hex: string) {
    setThemeColour(hex);
    applyThemeColour(hex);
    try { localStorage.setItem('themeColour', hex); } catch { /* ignore */ }
  }

  function handlePupilColour(pupilId: number, hex: string) {
    const palette = paletteFromHex(hex);
    const updated = { ...palettes, [pupilId]: palette };
    setPalettes(updated);
    try { localStorage.setItem('pupilPalettes', JSON.stringify(updated)); } catch { /* ignore */ }
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
        <h2 style={styles.sectionTitle}>Push Notifications</h2>
        <p style={styles.sectionDesc}>
          Enable push notifications for this device. You&apos;ll be prompted to allow notifications — tap Allow when asked.
          {notifStatus === 'denied' && <span style={{ color: 'var(--negative)', display: 'block', marginTop: 6 }}>
            Notifications are blocked in your browser settings. Enable them for this site then try again.
          </span>}
        </p>
        <button
          style={{
            padding: '10px 18px', borderRadius: 6, border: '1px solid var(--border)',
            fontSize: 13, fontWeight: 600, cursor: notifStatus === 'registering' ? 'default' : 'pointer',
            background: notifStatus === 'registered' || notifStatus === 'granted' ? 'var(--positive-bg)' : notifStatus === 'error' || notifStatus === 'denied' ? 'var(--negative-bg)' : 'var(--surface-2)',
            color: notifStatus === 'registered' || notifStatus === 'granted' ? 'var(--positive)' : notifStatus === 'error' || notifStatus === 'denied' ? 'var(--negative)' : 'var(--text)',
          }}
          onClick={registerFcmToken}
          disabled={notifStatus === 'registering' || notifStatus === 'registered'}
        >
          {notifStatus === 'registering' ? 'Registering…' : notifStatus === 'registered' ? '✓ Notifications enabled' : notifStatus === 'granted' ? '✓ Already enabled — re-register' : notifStatus === 'denied' ? '✕ Blocked — check browser settings' : notifStatus === 'error' ? '✕ Failed — try again' : '🔔 Enable notifications on this device'}
        </button>
      </div>

      <div className="card" style={styles.section}>
        <h2 style={styles.sectionTitle}>Notifications</h2>
        <p style={styles.sectionDesc}>Choose which events send a push notification to you.</p>
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
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Send a test notification to confirm everything is working</p>
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
          {testing === 'idle' ? '🔔 Send test' : testing === 'sending' ? 'Sending…' : testing === 'ok' ? '✓ Delivered' : '✕ Failed'}
        </button>
      </div>

      {pupils.length > 0 && (
        <div className="card" style={styles.section}>
          <h2 style={styles.sectionTitle}>Colours</h2>
          <p style={styles.sectionDesc}>Customise the accent colours for the app and each student's card.</p>

          {/* Install app */}
          <div style={styles.subSection}>
            <p style={styles.subLabel}>Install app</p>
            {isInstalled ? (
              <p style={{ fontSize: 12, color: 'var(--positive)' }}>✓ App is installed</p>
            ) : installPrompt ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>Add ClassCharts to your home screen for the best experience.</p>
                <button onClick={installApp} style={{
                  padding: '8px 16px', background: 'var(--accent, #6366f1)', color: '#fff',
                  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  Add to Home Screen
                </button>
              </>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                To install: tap the share icon in your browser and choose <strong>Add to Home Screen</strong>.
              </p>
            )}
          </div>

          {/* PWA theme colour */}
          <div style={styles.subSection}>
            <p style={styles.subLabel}>PWA theme colour</p>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>Sets the status bar and header accent colour.</p>
            <ColourPickerRow
              colour={themeColour}
              onChange={handleTheme}
            />
          </div>

          {/* Per-pupil card colours */}
          {pupils.map(pupil => {
            const currentColour = palettes[pupil.id]?.color ?? '#1d4ed8';
            return (
              <div key={pupil.id} style={styles.subSection}>
                <p style={styles.subLabel}>{pupil.firstName}</p>
                <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>Accent colour for {pupil.firstName}'s dashboard card.</p>
                <ColourPickerRow
                  colour={currentColour}
                  onChange={hex => handlePupilColour(pupil.id, hex)}
                />
              </div>
            );
          })}

          {/* Demo mode */}
          <div style={{ ...styles.subSection, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <p style={styles.subLabel}>Demo student</p>
              <button onClick={toggleDemoMode} style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: demoMode ? 'var(--accent, #6366f1)' : 'var(--border)',
                position: 'relative', flexShrink: 0, transition: 'background 0.2s',
              }}>
                <span style={{
                  position: 'absolute', top: 3, left: demoMode ? 22 : 2,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: demoMode ? 12 : 0, lineHeight: 1.5 }}>
              Shows a preview card with example data — useful for testing layouts before a new child joins.
            </p>
            {demoMode && (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>Accent colour for the demo card.</p>
                <ColourPickerRow
                  colour={demoColour}
                  onChange={handleDemoColour}
                />
              </>
            )}
          </div>
        </div>
      )}

      <div style={styles.saveRow}>
        <button style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span style={styles.savedMsg}>✓ Saved</span>}
      </div>
    </div>
  );
}

/** A swatch button that opens a native HTML colour picker + displays the hex value. */
function ColourPickerRow({
  colour,
  onChange,
}: {
  colour: string;
  inputRef?: (el: HTMLInputElement | null) => void; // kept for API compat, unused
  onChange: (hex: string) => void;
}) {
  const localRef = useRef<HTMLInputElement | null>(null);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* Hidden native colour input */}
      <input
        ref={localRef}
        type="color"
        value={colour}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
        tabIndex={-1}
      />
      {/* Visible swatch that triggers the picker */}
      <button
        onClick={() => localRef.current?.click()}
        style={{
          width: 40, height: 40, borderRadius: 8, border: '2px solid var(--border)',
          background: colour, cursor: 'pointer', flexShrink: 0,
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          transition: 'transform 0.15s',
        }}
        title="Pick a colour"
        aria-label="Pick a colour"
      />
      {/* Hex label */}
      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>
        {colour.toUpperCase()}
      </span>
      {/* Mini colour preview strip */}
      <div style={{
        flex: 1, height: 8, borderRadius: 4,
        background: `linear-gradient(to right, ${colour}22, ${colour})`,
        minWidth: 0,
      }} />
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
  sectionDesc: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 20 },
  subSection: { marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' },
  subLabel: { fontSize: 13, fontWeight: 600, marginBottom: 4 },
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
