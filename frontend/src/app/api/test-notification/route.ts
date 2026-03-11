import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = process.env.PUSHOVER_API_TOKEN;
  const key = process.env.PUSHOVER_USER_KEY;

  if (!token || !key) return NextResponse.json({ error: 'Pushover not configured' }, { status: 500 });

  const res = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    body: new URLSearchParams({
      token,
      user: key,
      title: '🧪 Test — FunFairLabs + Claude',
      message: `Notifications working ✓\nSent from ClassCharts dashboard\n${new Date().toLocaleTimeString('en-GB')}`,
      priority: '0',
    }),
  });

  const data = await res.json();
  if (data.status === 1) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: data.errors?.join(', ') ?? 'Pushover error' }, { status: 500 });
}
