import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { Storage } from '@google-cloud/storage';
import type { AllowedUsersConfig, AllowedUser } from '@classcharts/shared';

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });

function getFile() {
  return storage
    .bucket(process.env.GCS_BUCKET!)
    .file(process.env.GCS_ALLOWED_USERS_PATH!);
}

async function readConfig(): Promise<AllowedUsersConfig> {
  try {
    const [content] = await getFile().download();
    return JSON.parse(content.toString());
  } catch {
    return { users: [] };
  }
}

async function writeConfig(config: AllowedUsersConfig): Promise<void> {
  await getFile().save(JSON.stringify(config, null, 2), {
    contentType: 'application/json',
  });
}

function requireAdmin(session: any) {
  if (!session?.user?.isAdmin) {
    throw new Error('Forbidden');
  }
}

// GET /api/admin/users
export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
    const config = await readConfig();
    return NextResponse.json(config.users);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}

// POST /api/admin/users — add a user
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
    const { email, name } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const config = await readConfig();
    const exists = config.users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return NextResponse.json({ error: 'User already exists' }, { status: 409 });

    const newUser: AllowedUser = {
      email: email.toLowerCase(),
      name,
      addedBy: session!.user!.email!,
      addedAt: new Date().toISOString(),
    };
    config.users.push(newUser);
    await writeConfig(config);

    return NextResponse.json(newUser, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}

// DELETE /api/admin/users — remove a user
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
    const { email } = await req.json();
    const config = await readConfig();
    config.users = config.users.filter(u => u.email.toLowerCase() !== email.toLowerCase());
    await writeConfig(config);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
