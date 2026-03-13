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
    const file = storage.bucket(process.env.GCS_BUCKET!).file(gcsPath);
    const [exists] = await file.exists();
    if (!exists) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType ?? 'application/octet-stream';
    const filename = gcsPath.split('/').pop() ?? 'attachment';

    const stream = file.createReadStream();
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    return new NextResponse(Buffer.concat(chunks), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Attachment proxy error:', err);
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }
}
