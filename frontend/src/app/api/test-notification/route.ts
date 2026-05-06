import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Storage } from '@google-cloud/storage';
import type { UserPrefsConfig } from '@classcharts/shared';

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });

async function getOneSignalIdsForEmail(email: string): Promise<string[]> {
  try {
    const [content] = await storage
      .bucket(process.env.GCS_BUCKET!)
      .file('config/user-prefs.json')
      .download();
    const config: UserPrefsConfig = JSON.parse(content.toString());
    const prefs = config.prefs.find(p => p.email.toLowerCase() === email.toLowerCase());
    return prefs?.oneSignalIds ?? [];
  } catch {
    return [];
  }
}

async function sendOneSignalNotification(ids: string[], title: string, body: string): Promise<void> {
  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${process.env.ONESIGNAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      include_subscription_ids: ids,
      headings: { en: title },
      contents: { en: body },
      url: 'https://classcharts.funfairlabs.com/settings',
      chrome_web_icon: '/icons/icon-192x192.png',
    }),
  });
  if (!res.ok) throw new Error(`OneSignal ${res.status}: ${await res.text()}`);
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = session.user.email;
  const time = new Date().toLocaleTimeString('en-GB');
  const results: Record<string, string> = {};

  // ── Read channel config from GCS ──────────────────────────
  let pushoverEnabled = process.env.PUSHOVER_ENABLED !== 'false';
  let fcmEnabled = false;
  try {
    const [prefsContent] = await storage.bucket(process.env.GCS_BUCKET!).file('config/user-prefs.json').download();
    const prefsConfig = JSON.parse(prefsContent.toString());
    if (typeof prefsConfig.pushoverEnabled === 'boolean') pushoverEnabled = prefsConfig.pushoverEnabled;
    if (typeof prefsConfig.fcmEnabled === 'boolean') fcmEnabled = prefsConfig.fcmEnabled;
  } catch { /* use env var fallback */ }

  // ── Pushover ──────────────────────────────────────────────
  const pushoverToken = process.env.PUSHOVER_API_TOKEN;
  const pushoverKey = process.env.PUSHOVER_USER_KEY;

  if (pushoverEnabled && pushoverToken && pushoverKey) {
    try {
      const res = await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        body: new URLSearchParams({
          token: pushoverToken,
          user: pushoverKey,
          title: '🧪 Test — ClassCharts (Pushover)',
          message: `Pushover channel working ✓\n${time}`,
          priority: '0',
        }),
      });
      const data = await res.json();
      results.pushover = data.status === 1 ? 'ok' : `error: ${data.errors?.join(', ')}`;
    } catch (err) {
      results.pushover = `error: ${String(err)}`;
    }
  } else {
    results.pushover = 'disabled';
  }

  // ── OneSignal ─────────────────────────────────────────────
  const oneSignalIds = await getOneSignalIdsForEmail(email);

  if (fcmEnabled && oneSignalIds.length > 0) {
    try {
      await sendOneSignalNotification(
        oneSignalIds,
        '🧪 Test — ClassCharts (OneSignal)',
        `OneSignal working ✓\n${time}`
      );
      results.onesignal = `ok (${oneSignalIds.length} device${oneSignalIds.length > 1 ? 's' : ''})`;
    } catch (err) {
      results.onesignal = `error: ${String(err)}`;
    }
  } else {
    results.onesignal = fcmEnabled
      ? 'no devices registered — visit /settings and enable notifications first'
      : 'disabled';
  }

  const anyOk = Object.values(results).some(v => v === 'ok' || v.startsWith('ok'));
  return NextResponse.json({ ok: anyOk, results }, { status: anyOk ? 200 : 500 });
}
