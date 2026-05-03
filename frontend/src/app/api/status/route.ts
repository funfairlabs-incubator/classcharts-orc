import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Firestore } from '@google-cloud/firestore';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });

const EXPECTED_PUSH_ENDPOINT = 'https://classcharts-poller-306745837103.europe-west2.run.app/';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Firestore heartbeat
    const doc = await db.collection('status').doc('poller').get();
    const heartbeat = doc.exists ? doc.data() : null;

    // Infer Cloud Run health from heartbeat recency — active health check
    // requires OIDC token which isn't reliably available from App Engine
    const heartbeatMins = heartbeat
      ? Math.floor((Date.now() - new Date(heartbeat.polledAt).getTime()) / 60000)
      : null;
    const pollerHealth = heartbeatMins !== null
      ? { ok: heartbeatMins <= 15, latencyMs: null, inferredFromHeartbeat: true }
      : null;

    return NextResponse.json({
      heartbeat,
      pollerHealth,
      expectedPushEndpoint: EXPECTED_PUSH_ENDPOINT,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
