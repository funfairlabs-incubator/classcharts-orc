import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const gcsPath = params.path.join('/');
  try {
    const [url] = await storage.bucket(process.env.GCS_BUCKET!).file(gcsPath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }
}
