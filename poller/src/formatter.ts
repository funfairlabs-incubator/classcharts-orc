import type { NotificationEvent } from '@classcharts/shared';

interface FormattedNotification {
  title: string;
  message: string;
  priority: -1 | 0 | 1 | 2;
}

export function formatNotification(
  studentName: string,
  event: NotificationEvent
): FormattedNotification {
  switch (event.type) {
    case 'homework':
      return {
        title: `📚 Homework – ${studentName}`,
        message: `${event.data.subject}: "${event.data.title}" due ${event.data.dueDate}`,
        priority: 0,
      };

    case 'behaviour':
      const isPositive = event.data.score > 0;
      return {
        title: isPositive
          ? `⭐ Award – ${studentName}`
          : `⚠️ Behaviour – ${studentName}`,
        message: `${event.data.reason}${event.data.lessonName ? ` (${event.data.lessonName})` : ''}`,
        priority: isPositive ? -1 : 1,
      };

    case 'attendance':
      return {
        title: `📋 Attendance – ${studentName}`,
        message: `AM: ${event.data.amStatus} / PM: ${event.data.pmStatus} on ${event.data.date}`,
        priority: 1,
      };

    case 'announcement':
      return {
        title: `📢 Announcement – ${studentName}`,
        message: `${event.data.title} (from ${event.data.teacherName})`,
        priority: event.data.priority === 'high' ? 1 : 0,
      };
  }
}
