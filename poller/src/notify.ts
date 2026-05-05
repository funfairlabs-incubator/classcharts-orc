/**
 * notify.ts — unified notification dispatch
 *
 * During the parallel-run week this sends to BOTH Pushover and FCM.
 * Once Pushover is retired, delete the Pushover import + sendPushoverToKeys calls.
 * Toggle: set PUSHOVER_ENABLED=false in Secret Manager to disable Pushover.
 */

import { getMessaging } from 'firebase-admin/messaging';
import { sendPushoverToKeys } from './pushover.js';
import type { PushoverMessage } from './pushover.js';
import { getAllPrefs } from './prefs.js';

export interface NotifyMessage {
  title: string;
  body: string;
  /** Deep-link URL opened when the notification is tapped */
  url?: string;
}

/**
 * Send a notification to a set of Pushover keys AND/OR FCM tokens.
 * Callers pass both arrays; this module decides which channels are live.
 */
export async function sendNotification(
  pushoverKeys: string[],
  fcmTokens: string[],
  msg: NotifyMessage,
): Promise<void> {
  // GCS config takes precedence over env var — allows toggling from the Settings UI
  const config = await getAllPrefs();
  const pushoverEnabled = config.pushoverEnabled !== undefined
    ? config.pushoverEnabled
    : process.env.PUSHOVER_ENABLED !== 'false';

  const tasks: Promise<void>[] = [];

  // ── Pushover (parallel-run only) ──────────────────────────────
  if (pushoverEnabled && pushoverKeys.length > 0) {
    const pm: PushoverMessage = { title: msg.title, message: msg.body };
    if (msg.url) { pm.url = msg.url; pm.urlTitle = 'Open'; }
    tasks.push(sendPushoverToKeys(pushoverKeys, pm));
  }

  // ── FCM ───────────────────────────────────────────────────────
  if (fcmTokens.length > 0) {
    tasks.push(sendFcm(fcmTokens, msg));
  }

  await Promise.allSettled(tasks);
}

async function sendFcm(tokens: string[], msg: NotifyMessage): Promise<void> {
  const messaging = getMessaging();

  // Send to each token individually so we can handle per-token failures
  const results = await Promise.allSettled(
    tokens.map(token =>
      messaging.send({
        token,
        notification: {
          title: msg.title,
          body: msg.body,
        },
        webpush: {
          notification: {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-96x96.png',
            ...(msg.url ? { data: { url: msg.url } } : {}),
          },
          fcmOptions: msg.url ? { link: msg.url } : undefined,
        },
      }),
    ),
  );

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { code?: string };
      if (
        err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token'
      ) {
        // Token is stale — log so it can be cleaned up; non-fatal
        console.warn(`  FCM: stale token [${tokens[i].slice(0, 12)}...], should be pruned`);
      } else {
        console.error(`  FCM send failed for token [${tokens[i].slice(0, 12)}...]:`, err);
      }
    }
  });
}
