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

// GET /api/onesignal-id — returns { registered: boolean }
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = session.user.email.toLowerCase();
  const config = await loadPrefs();
  const prefs = config.prefs.find(p => p.email.toLowerCase() === email);
  const registered = (prefs?.oneSignalIds?.length ?? 0) > 0;
  return NextResponse.json({ registered });
}

// POST /api/onesignal-id  { id: string }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id?: string };
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'id required' }, { status: 400 });

  const email = session.user.email.toLowerCase();
  const config = await loadPrefs();
  const idx = config.prefs.findIndex(p => p.email.toLowerCase() === email);

  if (idx >= 0) {
    const existing = config.prefs[idx].oneSignalIds ?? [];
    if (!existing.includes(id)) {
      config.prefs[idx].oneSignalIds = [...existing, id].slice(-10);
    }
  } else {
    config.prefs.push({
      email,
      oneSignalIds: [id],
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

// DELETE /api/onesignal-id  { id: string }
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const email = session.user.email.toLowerCase();
  const config = await loadPrefs();
  const idx = config.prefs.findIndex(p => p.email.toLowerCase() === email);
  if (idx >= 0) {
    config.prefs[idx].oneSignalIds = (config.prefs[idx].oneSignalIds ?? []).filter(i => i !== id);
    await savePrefs(config);
  }

  return NextResponse.json({ ok: true });
}
