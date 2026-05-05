import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Storage } from '@google-cloud/storage';
import type { UserPrefsConfig } from '@classcharts/shared';

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const BUCKET = process.env.GCS_BUCKET!;
const PREFS_PATH = 'config/user-prefs.json';

async function loadPrefs(): Promise<UserPrefsConfig> {
  try {
    const [content] = await storage.bucket(BUCKET).file(PREFS_PATH).download();
    return JSON.parse(content.toString());
  } catch {
    return { prefs: [] };
  }
}

async function savePrefs(config: UserPrefsConfig): Promise<void> {
  await storage.bucket(BUCKET).file(PREFS_PATH).save(
    JSON.stringify(config, null, 2),
    { contentType: 'application/json' },
  );
}

// POST /api/fcm-token  { token: string }
// Registers an FCM token for the signed-in user. Idempotent.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token } = await req.json() as { token?: string };
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  const email = session.user.email.toLowerCase();
  const config = await loadPrefs();

  const idx = config.prefs.findIndex(p => p.email.toLowerCase() === email);
  if (idx >= 0) {
    const existing = config.prefs[idx].fcmTokens ?? [];
    if (!existing.includes(token)) {
      config.prefs[idx].fcmTokens = [...existing, token].slice(-10); // keep max 10 tokens per user
    }
  } else {
    config.prefs.push({
      email,
      fcmTokens: [token],
      notifications: {
        homeworkDigest: true,
        homeworkStatusChange: true,
        homeworkNew: true,
        behaviour: true,
        detentions: true,
        attendance: true,
        announcements: true,
      },
    });
  }

  await savePrefs(config);
  return NextResponse.json({ ok: true });
}

// DELETE /api/fcm-token  { token: string }
// Removes a stale or revoked FCM token.
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token } = await req.json() as { token?: string };
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const email = session.user.email.toLowerCase();
  const config = await loadPrefs();

  const idx = config.prefs.findIndex(p => p.email.toLowerCase() === email);
  if (idx >= 0) {
    config.prefs[idx].fcmTokens = (config.prefs[idx].fcmTokens ?? []).filter(t => t !== token);
    await savePrefs(config);
  }

  return NextResponse.json({ ok: true });
}
