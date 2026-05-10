import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const BUCKET = process.env.GCS_BUCKET!;

async function signUrl(gcsPath: string): Promise<string | null> {
  try {
    const [url] = await storage.bucket(BUCKET).file(gcsPath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    });
    return url;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pupilId = req.nextUrl.searchParams.get('pupilId');
  const parsedPupilId = pupilId ? parseInt(pupilId) : null;

  try {
    // ── Announcement attachments ───────────────────────────────
    let annQuery = db.collection('attachments')
      .orderBy('announcementDate', 'desc')
      .limit(200) as FirebaseFirestore.Query;
    if (parsedPupilId) annQuery = annQuery.where('studentId', '==', parsedPupilId);

    // ── Homework attachments ───────────────────────────────────
    let hwQuery = db.collection('homeworkAttachments')
      .orderBy('homeworkDueDate', 'desc')
      .limit(200) as FirebaseFirestore.Query;
    if (parsedPupilId) hwQuery = hwQuery.where('studentId', '==', parsedPupilId);

    const [annSnap, hwSnap] = await Promise.all([annQuery.get(), hwQuery.get()]);

    const annDocs = annSnap.docs.map(d => ({ ...d.data(), type: 'announcement' as const }));
    const hwDocs  = hwSnap.docs.map(d => ({ ...d.data(), type: 'homework' as const }));

    const allDocs = [...annDocs, ...hwDocs];

    // Generate signed URLs in parallel
    const withUrls = await Promise.all(allDocs.map(async doc => ({
      ...doc,
      signedUrl: await signUrl((doc as any).gcsPath),
    })));

    // Sort by date descending (mix of announcementDate and homeworkDueDate)
    withUrls.sort((a, b) => {
      const aDate = (a as any).announcementDate ?? (a as any).homeworkDueDate ?? '';
      const bDate = (b as any).announcementDate ?? (b as any).homeworkDueDate ?? '';
      return bDate.localeCompare(aDate);
    });

    return NextResponse.json(withUrls);
  } catch (err) {
    console.error('GET /api/documents failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
