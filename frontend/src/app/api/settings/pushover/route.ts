import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Storage } from '@google-cloud/storage';
import type { UserPrefsConfig } from '@classcharts/shared';

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const BUCKET = process.env.GCS_BUCKET!;
const PREFS_PATH = 'config/user-prefs.json';

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

function isAdmin(email: string): boolean {
  return email.toLowerCase() === (process.env.ADMIN_EMAIL ?? '').toLowerCase();
}

// GET /api/settings/pushover — returns { pushoverEnabled: boolean }
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const config = await readPrefs();
  // Default true if not set — safe during parallel run
  return NextResponse.json({ pushoverEnabled: config.pushoverEnabled ?? true });
}

// POST /api/settings/pushover — { pushoverEnabled: boolean }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { pushoverEnabled } = await req.json() as { pushoverEnabled: boolean };
  if (typeof pushoverEnabled !== 'boolean') {
    return NextResponse.json({ error: 'pushoverEnabled must be boolean' }, { status: 400 });
  }

  const config = await readPrefs();
  config.pushoverEnabled = pushoverEnabled;
  await writePrefs(config);
  return NextResponse.json({ ok: true, pushoverEnabled });
}
