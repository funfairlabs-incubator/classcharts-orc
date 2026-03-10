import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getClientFor, todayStr, daysAgoStr, daysAheadStr } from '@/lib/classcharts';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const pupilId = parseInt(searchParams.get('pupilId') ?? '0');
  const from = searchParams.get('from') ?? daysAgoStr(30);
  const to = searchParams.get('to') ?? daysAheadStr(30);

  if (!pupilId) return NextResponse.json({ error: 'pupilId required' }, { status: 400 });

  try {
    const client = await getClientFor(pupilId);
    const homework = await client.getHomeworks(from, to);
    return NextResponse.json(homework);
  } catch (err) {
    console.error('GET /api/homework failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
