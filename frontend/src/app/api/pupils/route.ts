import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getPupils } from '@/lib/classcharts';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const pupils = await getPupils();
    return NextResponse.json(pupils);
  } catch (err) {
    console.error('GET /api/pupils failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
