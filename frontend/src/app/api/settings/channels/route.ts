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

// GET /api/settings/channels — returns { pushoverEnabled, fcmEnabled }
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const config = await readPrefs();
  return NextResponse.json({
    pushoverEnabled: config.pushoverEnabled ?? true,
    fcmEnabled: config.fcmEnabled ?? false,
  });
}

// POST /api/settings/channels — { pushoverEnabled?, fcmEnabled? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { pushoverEnabled?: boolean; fcmEnabled?: boolean };

  const config = await readPrefs();
  if (typeof body.pushoverEnabled === 'boolean') config.pushoverEnabled = body.pushoverEnabled;
  if (typeof body.fcmEnabled === 'boolean') config.fcmEnabled = body.fcmEnabled;
  await writePrefs(config);

  return NextResponse.json({
    ok: true,
    pushoverEnabled: config.pushoverEnabled ?? true,
    fcmEnabled: config.fcmEnabled ?? false,
  });
}
