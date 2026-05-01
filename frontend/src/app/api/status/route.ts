import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Firestore } from '@google-cloud/firestore';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const doc = await db.collection('status').doc('poller').get();
    const heartbeat = doc.exists ? doc.data() : null;
    return NextResponse.json({ heartbeat, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
