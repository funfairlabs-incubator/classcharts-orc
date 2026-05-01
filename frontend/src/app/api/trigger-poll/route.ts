import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const POLLER_URL = 'https://classcharts-poller-306745837103.europe-west2.run.app';

async function getIdentityToken(audience: string): Promise<string> {
  // On GCP, fetch an identity token from the metadata server
  const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`;
  const res = await fetch(metadataUrl, {
    headers: { 'Metadata-Flavor': 'Google' },
  });
  if (!res.ok) throw new Error(`Metadata server returned ${res.status}`);
  return res.text();
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const token = await getIdentityToken(POLLER_URL);
    const res = await fetch(`${POLLER_URL}/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ trigger: 'manual' }),
    });
    return NextResponse.json({ triggered: true, status: res.status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
