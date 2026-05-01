import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Firestore } from '@google-cloud/firestore';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });

const POLLER_URL = 'https://classcharts-poller-306745837103.europe-west2.run.app';
const EXPECTED_PUSH_ENDPOINT = `${POLLER_URL}/`;

async function getIdentityToken(audience: string): Promise<string | null> {
  try {
    const res = await fetch(
      `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`,
      { headers: { 'Metadata-Flavor': 'Google' } }
    );
    return res.ok ? res.text() : null;
  } catch { return null; }
}

async function checkPollerHealth(): Promise<{ ok: boolean; latencyMs?: number }> {
  try {
    const token = await getIdentityToken(POLLER_URL);
    const start = Date.now();
    const res = await fetch(`${POLLER_URL}/health`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch { return { ok: false }; }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Firestore heartbeat
    const doc = await db.collection('status').doc('poller').get();
    const heartbeat = doc.exists ? doc.data() : null;

    // Cloud Run health check
    const pollerHealth = await checkPollerHealth();

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
