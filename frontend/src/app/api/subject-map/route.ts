import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [data] = await storage
      .bucket(process.env.GCS_BUCKET!)
      .file('config/subject-map.json')
      .download();
    return NextResponse.json(JSON.parse(data.toString()));
  } catch {
    // Map not yet built — return empty object, poller will populate on next poll
    return NextResponse.json({});
  }
}
