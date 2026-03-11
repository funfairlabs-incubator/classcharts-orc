import type { CCHomework, CCActivityPoint, CCAnnouncement, CCAttendanceDay, CCDetention } from '@classcharts/shared';
import type { PushoverMessage } from './pushover.js';

// ── Homework ──────────────────────────────────────────────────

export function formatHomework(
  hw: CCHomework,
  studentName: string,
  summary: string,
): PushoverMessage {
  const due = formatDate(hw.dueDate);
  const completionTime = hw.completionTime ? ` (${hw.completionTime})` : '';

  return {
    title: `📚 Homework — ${studentName}`,
    message: `${hw.subject}: ${hw.title}\n${summary}${completionTime}\nDue: ${due}`,
    priority: 0,
  };
}

// ── Activity (behaviour) ──────────────────────────────────────

export function formatActivity(
  point: CCActivityPoint,
  studentName: string,
  summary: string,
): PushoverMessage {
  const isPositive = point.polarity === 'positive';
  const scoreStr = point.score > 0 ? `+${point.score}` : String(point.score);
  const lesson = point.lessonName ? ` · ${point.lessonName}` : '';
  const teacher = point.teacherName ? ` · ${point.teacherName}` : '';

  return {
    title: isPositive
      ? `⭐ Award (${scoreStr}) — ${studentName}`
      : `⚠️ Behaviour (${scoreStr}) — ${studentName}`,
    message: `${summary}${lesson}${teacher}`,
    priority: isPositive ? -1 : point.score <= -3 ? 1 : 0,
  };
}

// ── Announcement ──────────────────────────────────────────────

export function formatAnnouncement(
  ann: CCAnnouncement,
  studentName: string,
  summary: string,
  requiresAction: boolean,
  actionDescription: string | null,
  calendarAdded: boolean,
): PushoverMessage {
  const actionLine = requiresAction && actionDescription
    ? `\n⚠️ Action: ${actionDescription}`
    : '';
  const calendarLine = calendarAdded ? '\n📅 Added to calendar' : '';

  return {
    title: `📢 ${ann.title}`,
    message: `${studentName} · ${ann.teacherName}\n\n${summary}${actionLine}${calendarLine}`,
    priority: requiresAction ? 1 : 0,
  };
}

// ── Attendance ────────────────────────────────────────────────

export function formatAttendance(
  day: CCAttendanceDay,
  studentName: string,
): PushoverMessage | null {
  const sessions = Object.entries(day.sessions);
  const absences = sessions.filter(([, s]) => s.status === 'absent');
  const lates = sessions.filter(([, s]) => s.status === 'late');

  if (absences.length === 0 && lates.length === 0) return null;

  const parts: string[] = [];
  if (absences.length > 0) {
    parts.push(`Absent: ${absences.map(([k]) => k).join(', ')}`);
  }
  if (lates.length > 0) {
    const lateDetails = lates.map(([k, s]) =>
      s.lateMinutes > 0 ? `${k} (${s.lateMinutes}m late)` : k
    );
    parts.push(`Late: ${lateDetails.join(', ')}`);
  }

  return {
    title: `📋 Attendance Alert — ${studentName}`,
    message: `${formatDate(day.date)}\n${parts.join('\n')}`,
    priority: absences.length > 0 ? 1 : 0,
  };
}

// ── Detention ─────────────────────────────────────────────────

export function formatDetention(
  detention: CCDetention,
  studentName: string,
): PushoverMessage {
  const date = detention.date ? formatDate(detention.date) : 'TBC';
  const time = detention.time ?? '';
  const location = detention.location ? ` · ${detention.location}` : '';
  const length = detention.length ? ` · ${detention.length} mins` : '';
  const type = detention.detentionType ? ` (${detention.detentionType})` : '';

  return {
    title: `🚨 Detention${type} — ${studentName}`,
    message: `${detention.reason}\n${date}${time ? ` at ${time}` : ''}${location}${length}`,
    priority: 1,
  };
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  } catch {
    return dateStr;
  }
}

// ── Homework Overdue ──────────────────────────────────────────

export function formatHomeworkOverdue(
  hw: CCHomework,
  studentName: string,
): PushoverMessage {
  const due = formatDate(hw.dueDate);
  return {
    title: `⏰ Overdue — ${studentName}`,
    message: `${hw.subject}: ${hw.title}\nWas due ${due}`,
    priority: 1,
  };
}
