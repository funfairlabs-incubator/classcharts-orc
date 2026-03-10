import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getClientFor, todayStr, daysAgoStr } from '@/lib/classcharts';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const pupilId = parseInt(searchParams.get('pupilId') ?? '0');
  const from = searchParams.get('from') ?? daysAgoStr(60);
  const to = searchParams.get('to') ?? todayStr();

  if (!pupilId) return NextResponse.json({ error: 'pupilId required' }, { status: 400 });

  try {
    const client = await getClientFor(pupilId);
    const attendance = await client.getAttendance(from, to);
    return NextResponse.json(attendance);
  } catch (err) {
    console.error('GET /api/attendance failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
