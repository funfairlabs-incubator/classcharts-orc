import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Storage } from '@google-cloud/storage';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { UserPrefsConfig } from '@classcharts/shared';

// ── Firebase Admin init ───────────────────────────────────────
if (!getApps().length) initializeApp();

// ── GCS prefs ─────────────────────────────────────────────────
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

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = session.user.email;
  const time = new Date().toLocaleTimeString('en-GB');
  const results: Record<string, string> = {};

  // ── Pushover ──────────────────────────────────────────────
  const pushoverToken = process.env.PUSHOVER_API_TOKEN;
  const pushoverKey = process.env.PUSHOVER_USER_KEY;
  const pushoverEnabled = process.env.PUSHOVER_ENABLED !== 'false';

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

  // ── FCM ───────────────────────────────────────────────────
  const fcmTokens = await getFcmTokensForEmail(email);

  if (fcmTokens.length > 0) {
    try {
      const messaging = getMessaging();
      const sends = await Promise.allSettled(
        fcmTokens.map(token =>
          messaging.send({
            token,
            notification: { title: '🧪 Test — ClassCharts (FCM)', body: `FCM channel working ✓\n${time}` },
            webpush: {
              notification: { icon: '/icons/icon-192x192.png', badge: '/icons/icon-96x96.png' },
              fcmOptions: { link: '/settings' },
            },
          })
        )
      );
      const failed = sends.filter(r => r.status === 'rejected').length;
      results.fcm = failed === 0 ? `ok (${fcmTokens.length} token${fcmTokens.length > 1 ? 's' : ''})` : `${failed}/${fcmTokens.length} failed`;
    } catch (err) {
      results.fcm = `error: ${String(err)}`;
    }
  } else {
    results.fcm = 'no tokens registered — visit /settings and enable notifications first';
  }

  const anyOk = Object.values(results).some(v => v === 'ok' || v.startsWith('ok'));
  return NextResponse.json({ ok: anyOk, results }, { status: anyOk ? 200 : 500 });
}
