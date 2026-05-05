import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Storage } from '@google-cloud/storage';
import type { UserPrefsConfig } from '@classcharts/shared';

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });

async function getFcmTokensForEmail(email: string): Promise<string[]> {
  try {
    const [content] = await storage
      .bucket(process.env.GCS_BUCKET!)
      .file('config/user-prefs.json')
      .download();
    const config: UserPrefsConfig = JSON.parse(content.toString());
    const prefs = config.prefs.find(p => p.email.toLowerCase() === email.toLowerCase());
    return prefs?.fcmTokens ?? [];
  } catch {
    return [];
  }
}

// Get an access token from the GCP metadata server (works on App Engine + Cloud Run)
async function getAccessToken(): Promise<string> {
  const res = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } }
  );
  if (!res.ok) throw new Error(`Metadata server ${res.status}: ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

async function sendFcmViaRest(token: string, title: string, body: string, projectId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          webpush: {
            notification: { icon: '/icons/icon-192x192.png', badge: '/icons/icon-96x96.png' },
            fcm_options: { link: '/settings' },
          },
        },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FCM REST ${res.status}: ${err}`);
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = session.user.email;
  const time = new Date().toLocaleTimeString('en-GB');
  const results: Record<string, string> = {};

  // ── Pushover ──────────────────────────────────────────────
  const pushoverToken = process.env.PUSHOVER_API_TOKEN;
  const pushoverKey = process.env.PUSHOVER_USER_KEY;
  let pushoverEnabled = process.env.PUSHOVER_ENABLED !== 'false';
  try {
    const [prefsContent] = await storage.bucket(process.env.GCS_BUCKET!).file('config/user-prefs.json').download();
    const prefsConfig = JSON.parse(prefsContent.toString());
    if (typeof prefsConfig.pushoverEnabled === 'boolean') pushoverEnabled = prefsConfig.pushoverEnabled;
  } catch { /* use env var fallback */ }

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

  // ── FCM via REST API (no firebase-admin SDK needed) ───────
  const fcmTokens = await getFcmTokensForEmail(email);
  // FCM REST API requires the Firebase project ID, not the GCP project ID
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.GCP_PROJECT_ID!;

  if (fcmTokens.length > 0) {
    const sends = await Promise.allSettled(
      fcmTokens.map(token =>
        sendFcmViaRest(token, '🧪 Test — ClassCharts (FCM)', `FCM channel working ✓\n${time}`, projectId)
      )
    );
    const failed = sends.filter(r => r.status === 'rejected');
    if (failed.length === 0) {
      results.fcm = `ok (${fcmTokens.length} token${fcmTokens.length > 1 ? 's' : ''})`;
    } else {
      results.fcm = `${failed.length}/${fcmTokens.length} failed: ${(failed[0] as PromiseRejectedResult).reason}`;
    }
  } else {
    results.fcm = 'no tokens registered — visit /settings and enable notifications first';
  }

  const anyOk = Object.values(results).some(v => v === 'ok' || v.startsWith('ok'));
  return NextResponse.json({ ok: anyOk, results }, { status: anyOk ? 200 : 500 });
}
