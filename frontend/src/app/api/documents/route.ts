import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const BUCKET = process.env.GCS_BUCKET!;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pupilId = req.nextUrl.searchParams.get('pupilId');

  try {
    let query = db.collection('attachments').orderBy('announcementDate', 'desc').limit(200) as FirebaseFirestore.Query;
    if (pupilId) query = query.where('studentId', '==', parseInt(pupilId));

    const snapshot = await query.get();
    const docs = snapshot.docs.map(d => d.data());

    // Generate short-lived signed URLs (1 hour)
    const withUrls = await Promise.all(docs.map(async doc => {
      try {
        const [url] = await storage.bucket(BUCKET).file(doc.gcsPath).getSignedUrl({
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000,
        });
        return { ...doc, signedUrl: url };
      } catch {
        return { ...doc, signedUrl: null };
      }
    }));

    return NextResponse.json(withUrls);
  } catch (err) {
    console.error('GET /api/documents failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
