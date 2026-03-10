import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getClientFor, todayStr } from '@/lib/classcharts';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const pupilId = parseInt(searchParams.get('pupilId') ?? '0');
  const date = searchParams.get('date') ?? todayStr();

  if (!pupilId) return NextResponse.json({ error: 'pupilId required' }, { status: 400 });

  try {
    const client = await getClientFor(pupilId);
    const lessons = await client.getLessons(date);
    return NextResponse.json(lessons);
  } catch (err) {
    console.error('GET /api/timetable failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
