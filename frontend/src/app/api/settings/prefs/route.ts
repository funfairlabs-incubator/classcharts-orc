import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Storage } from '@google-cloud/storage';
import type { UserPrefsConfig, UserNotificationPrefs } from '@classcharts/shared';

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const BUCKET = process.env.GCS_BUCKET!;
const PREFS_PATH = 'config/user-prefs.json';

const DEFAULT_NOTIFS: UserNotificationPrefs['notifications'] = {
  homeworkDigest: true, homeworkStatusChange: true, homeworkNew: true,
  behaviour: true, detentions: true, attendance: true, announcements: true,
};

async function readPrefs(): Promise<UserPrefsConfig> {
  try {
    const [content] = await storage.bucket(BUCKET).file(PREFS_PATH).download();
    return JSON.parse(content.toString());
  } catch { return { prefs: [] }; }
}

async function writePrefs(config: UserPrefsConfig): Promise<void> {
  await storage.bucket(BUCKET).file(PREFS_PATH).save(
    JSON.stringify(config, null, 2), { contentType: 'application/json' }
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const config = await readPrefs();
  const prefs = config.prefs.find(p => p.email.toLowerCase() === session.user!.email!.toLowerCase());
  return NextResponse.json({
    notifications: prefs?.notifications ?? DEFAULT_NOTIFS,
    pushoverKey: prefs?.pushoverKey ?? '',
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const config = await readPrefs();
  const email = session.user.email.toLowerCase();
  const idx = config.prefs.findIndex(p => p.email.toLowerCase() === email);
  const updated: UserNotificationPrefs = {
    email,
    pushoverKey: body.pushoverKey || undefined,
    notifications: { ...DEFAULT_NOTIFS, ...body.notifications },
  };
  if (idx >= 0) config.prefs[idx] = updated;
  else config.prefs.push(updated);
  await writePrefs(config);
  return NextResponse.json({ ok: true });
}
