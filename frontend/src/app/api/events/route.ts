import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Firestore } from '@google-cloud/firestore';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const pupilId = parseInt(searchParams.get('pupilId') ?? '0');
  if (!pupilId) return NextResponse.json({ error: 'pupilId required' }, { status: 400 });

  const from = new Date().toISOString().split('T')[0];
  const to = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

  try {
    const snapshot = await db.collection('upcoming_events')
      .where('studentId', '==', pupilId)
      .where('date', '>=', from)
      .where('date', '<=', to)
      .orderBy('date', 'asc')
      .limit(10)
      .get();
    return NextResponse.json(snapshot.docs.map(d => d.data()));
  } catch (err) {
    console.error('GET /api/events failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
