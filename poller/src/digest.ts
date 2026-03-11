import { loginAllParents, todayStr, daysAgoStr } from '@classcharts/shared';
import type { CCHomework } from '@classcharts/shared';
import { getEnabledKeys } from './prefs.js';
import { sendPushoverToKeys } from './pushover.js';

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return dateStr; }
}

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

export async function sendHomeworkDigest(): Promise<void> {
  const today = todayStr();
  const weekAhead = daysAgoStr(-7);

  const parents = await loginAllParents();
  const keys = await getEnabledKeys('homeworkDigest');

  if (keys.length === 0) {
    console.log('Digest: no users have homeworkDigest enabled, skipping.');
    return;
  }

  // Collect homework due in next 7 days across all pupils
  const byPupil: Array<{ name: string; items: CCHomework[] }> = [];

  for (const { client, pupils } of parents) {
    for (const pupil of pupils) {
      client.selectPupil(pupil.id);
      try {
        const homeworks = await client.getHomeworks(today, weekAhead);
        const pending = homeworks.filter(h => {
          const due = new Date(h.dueDate);
          const days = daysUntil(h.dueDate);
          return days >= 0 && days <= 7 && h.status !== 'completed' && !h.ticked;
        });
        if (pending.length > 0) {
          byPupil.push({ name: pupil.firstName ?? pupil.name, items: pending });
        }
      } catch (err) {
        console.error(`Digest: homework fetch failed for ${pupil.name}:`, err);
      }
    }
  }

  if (byPupil.length === 0) {
    await sendPushoverToKeys(keys, {
      title: '📚 Homework this week',
      message: 'Nothing due in the next 7 days. 🎉',
      priority: -1,
    });
    return;
  }

  // Build message — grouped by pupil
  const lines: string[] = [];
  for (const { name, items } of byPupil) {
    lines.push(`── ${name} ──`);
    // Sort by due date
    items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    for (const hw of items) {
      const days = daysUntil(hw.dueDate);
      const urgency = days === 0 ? ' ⚠ TODAY' : days === 1 ? ' tomorrow' : ` ${formatDate(hw.dueDate)}`;
      const late = hw.status === 'late' ? ' [OVERDUE]' : '';
      lines.push(`• ${hw.subject}: ${hw.title}${urgency}${late}`);
    }
  }

  await sendPushoverToKeys(keys, {
    title: '📚 Homework due this week',
    message: lines.join('\n'),
    priority: 0,
  });

  console.log(`Digest sent to ${keys.length} user(s), ${byPupil.reduce((n, p) => n + p.items.length, 0)} items across ${byPupil.length} pupil(s)`);
}
