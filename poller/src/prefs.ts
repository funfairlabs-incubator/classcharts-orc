import { Storage } from '@google-cloud/storage';
import type { UserNotificationPrefs, UserPrefsConfig } from '@classcharts/shared';

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const BUCKET = process.env.GCS_BUCKET!;
const PREFS_PATH = 'config/user-prefs.json';

const DEFAULT_PREFS: UserNotificationPrefs['notifications'] = {
  homeworkDigest: true,
  homeworkStatusChange: true,
  homeworkNew: true,
  behaviour: true,
  detentions: true,
  attendance: true,
  announcements: true,
};

export async function getAllPrefs(): Promise<UserPrefsConfig> {
  try {
    const [content] = await storage.bucket(BUCKET).file(PREFS_PATH).download();
    return JSON.parse(content.toString());
  } catch {
    return { prefs: [] };
  }
}

export async function saveAllPrefs(config: UserPrefsConfig): Promise<void> {
  await storage.bucket(BUCKET).file(PREFS_PATH).save(
    JSON.stringify(config, null, 2),
    { contentType: 'application/json' }
  );
}

export async function getPrefsForEmail(email: string): Promise<UserNotificationPrefs> {
  const config = await getAllPrefs();
  const existing = config.prefs.find(p => p.email.toLowerCase() === email.toLowerCase());
  return existing ?? { email, notifications: { ...DEFAULT_PREFS } };
}

export async function savePrefsForEmail(prefs: UserNotificationPrefs): Promise<void> {
  const config = await getAllPrefs();
  const idx = config.prefs.findIndex(p => p.email.toLowerCase() === prefs.email.toLowerCase());
  if (idx >= 0) config.prefs[idx] = prefs;
  else config.prefs.push(prefs);
  await saveAllPrefs(config);
}

// Get all Pushover keys that have a given toggle enabled
// Returns array of { userKey, email } for everyone who wants this notification
export async function getEnabledKeys(
  toggle: keyof UserNotificationPrefs['notifications'],
  allowedEmails?: string[],
): Promise<string[]> {
  const config = await getAllPrefs();

  // Collect all env-configured pushover keys with their associated emails
  const envKeys: { key: string; email: string }[] = [];
  const adminEmail = process.env.ADMIN_EMAIL ?? '';
  const adminKey = process.env.PUSHOVER_USER_KEY ?? '';
  const partnerKey = process.env.PUSHOVER_USER_KEY_2 ?? '';

  if (adminKey) envKeys.push({ key: adminKey, email: adminEmail });
  // Partner email comes from prefs config (they set it themselves)

  const keys: string[] = [];

  // Check each configured user key
  for (const { key, email } of envKeys) {
    const prefs = config.prefs.find(p => p.email.toLowerCase() === email.toLowerCase());
    const notifs = prefs?.notifications ?? DEFAULT_PREFS;
    if (notifs[toggle]) keys.push(key);
  }

  // Also check any users who've set their own pushoverKey in prefs
  for (const pref of config.prefs) {
    if (!pref.pushoverKey) continue;
    if (envKeys.some(e => e.email.toLowerCase() === pref.email.toLowerCase())) continue; // already handled
    if (allowedEmails && !allowedEmails.map(e => e.toLowerCase()).includes(pref.email.toLowerCase())) continue;
    if (pref.notifications[toggle]) keys.push(pref.pushoverKey);
  }

  return [...new Set(keys)]; // dedupe
}
