import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getClientFor } from '@/lib/classcharts';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const pupilId = parseInt(searchParams.get('pupilId') ?? '0');

  if (!pupilId) return NextResponse.json({ error: 'pupilId required' }, { status: 400 });

  try {
    const client = await getClientFor(pupilId);
    const announcements = await client.getAnnouncements();
    return NextResponse.json(announcements);
  } catch (err) {
    console.error('GET /api/announcements failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
