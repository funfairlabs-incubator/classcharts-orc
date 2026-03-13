import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getClientFor } from '@/lib/classcharts';
import { Firestore } from '@google-cloud/firestore';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const pupilId = parseInt(searchParams.get('pupilId') ?? '0');
  if (!pupilId) return NextResponse.json({ error: 'pupilId required' }, { status: 400 });

  try {
    // Try archive first (richer data, permanent)
    const snapshot = await db.collection('announcements')
      .where('studentId', '==', pupilId)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    if (!snapshot.empty) {
      // Normalise archived docs — early-archived ones may be missing fields added later
      const docs = snapshot.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          attachments: data.attachments ?? [],
          attachmentGcsPaths: data.attachmentGcsPaths ?? {},
          calendarEvents: data.calendarEvents ?? [],
          aiSummary: data.aiSummary ?? null,
          requiresAction: data.requiresAction ?? false,
          actionDescription: data.actionDescription ?? null,
        };
      });
      return NextResponse.json(docs);
    }

    // Fall back to live ClassCharts if archive not populated yet
    const client = await getClientFor(pupilId);
    const announcements = await client.getAnnouncements();
    return NextResponse.json(announcements);
  } catch (err) {
    console.error('GET /api/announcements failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
