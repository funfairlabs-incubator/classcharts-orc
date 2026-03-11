const PUSHOVER_API = 'https://api.pushover.net/1/messages.json';

export type PushoverPriority = -1 | 0 | 1 | 2;

export interface PushoverMessage {
  title: string;
  message: string;
  priority?: PushoverPriority;
  url?: string;
  urlTitle?: string;
}

async function sendToKey(userKey: string, msg: PushoverMessage): Promise<void> {
  const body = new URLSearchParams({
    token: process.env.PUSHOVER_API_TOKEN!,
    user: userKey,
    title: msg.title,
    message: msg.message,
    priority: String(msg.priority ?? 0),
    ...(msg.url ? { url: msg.url } : {}),
    ...(msg.urlTitle ? { url_title: msg.urlTitle } : {}),
    ...(msg.priority === 2 ? { retry: '60', expire: '3600' } : {}),
  });

  const res = await fetch(PUSHOVER_API, { method: 'POST', body });
  if (!res.ok) {
    console.error(`Pushover failed for key ${userKey.slice(0, 6)}...: ${res.status}`);
  }
}

// Send to all configured keys (default behaviour — respects prefs via poller)
export async function sendPushover(msg: PushoverMessage): Promise<void> {
  const keys = [
    process.env.PUSHOVER_USER_KEY,
    process.env.PUSHOVER_USER_KEY_2,
  ].filter(Boolean) as string[];
  for (const key of keys) await sendToKey(key, msg);
}

// Send to a specific list of keys (used by prefs-aware callers)
export async function sendPushoverToKeys(keys: string[], msg: PushoverMessage): Promise<void> {
  for (const key of keys) await sendToKey(key, msg);
}
