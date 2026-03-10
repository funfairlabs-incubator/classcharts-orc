import { ParentClient } from 'classcharts-api';
import type {
  Pupil,
  Homework,
  ActivityPoint,
  Lesson,
  Announcement,
  Detention,
  Badge,
  AttendanceData,
  AttendanceMeta,
} from 'classcharts-api/types';
import type {
  CCStudent,
  CCActivityPoint,
  CCBehaviourSummary,
  CCHomework,
  CCLesson,
  CCAttendanceSummary,
  CCAttendanceDay,
  CCAnnouncement,
  CCDetention,
  CCBadge,
} from './types';

// ── HTML stripper ─────────────────────────────────────────────

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Mappers ───────────────────────────────────────────────────

function mapPupil(p: Pupil): CCStudent {
  return {
    id: p.id,
    name: p.name,
    firstName: p.first_name,
    lastName: p.last_name,
    avatarUrl: p.avatar_url,
    schoolName: p.school_name,
    displayBehaviour: p.display_behaviour,
    displayHomework: p.display_homework,
    displayAttendance: p.display_attendance,
    displayTimetable: p.display_timetable,
    displayAnnouncements: p.display_announcements,
    displayDetentions: p.display_detentions,
    homeworkTodoCount: p.homework_todo_count ?? 0,
    homeworkLateCount: p.homework_late_count ?? 0,
    announcementsCount: p.announcements_count ?? 0,
    detentionPendingCount: p.detention_pending_count ?? 0,
  };
}

function mapActivity(a: ActivityPoint): CCActivityPoint {
  const type = (['behaviour', 'detention', 'attendance_event', 'notice', 'event'] as const)
    .includes(a.type as any) ? a.type as CCActivityPoint['type'] : 'other';
  const polarity: CCActivityPoint['polarity'] =
    a.polarity === 'positive' ? 'positive' :
    a.polarity === 'negative' ? 'negative' : 'neutral';
  return {
    id: a.id,
    type,
    polarity,
    reason: a.reason,
    score: a.score,
    timestamp: a.timestamp,
    lessonName: a.lesson_name,
    teacherName: a.teacher_name,
    roomName: a.room_name,
    note: a.note,
  };
}

function mapHomework(h: Homework): CCHomework {
  const completionTime = h.completion_time_value && h.completion_time_unit
    ? `${h.completion_time_value} ${h.completion_time_unit}`
    : '';
  return {
    id: h.id,
    title: h.title,
    description: stripHtml(h.description),
    subject: h.subject,
    lesson: h.lesson,
    teacher: h.teacher,
    issueDate: h.issue_date,
    dueDate: h.due_date,
    status: h.status.state ?? null,
    ticked: h.status.ticked === 'yes',
    hasAttachments: (h.status.attachments?.length ?? 0) > 0 || (h.validated_attachments?.length ?? 0) > 0,
    attachments: (h.validated_attachments ?? []).map(a => ({
      fileName: a.file_name,
      url: a.validated_file,
    })),
    links: (h.validated_links ?? []).map(l => ({ link: l.validated_link })),
    completionTime,
  };
}

function mapLesson(l: Lesson): CCLesson {
  return {
    teacherName: l.teacher_name,
    lessonName: l.lesson_name,
    subjectName: l.subject_name,
    periodName: l.period_name,
    periodNumber: l.period_number,
    roomName: l.room_name,
    date: l.date,
    startTime: l.start_time,
    endTime: l.end_time,
    isBreak: l.is_break ?? false,
    isAlternative: l.is_alternative_lesson,
    pupilNote: l.pupil_note ?? '',
  };
}

function mapAttendance(data: AttendanceData, meta: AttendanceMeta): CCAttendanceSummary {
  const days: CCAttendanceDay[] = Object.entries(data).map(([date, sessions]) => ({
    date,
    sessions: Object.fromEntries(
      Object.entries(sessions).map(([sessionKey, period]) => [
        sessionKey,
        {
          code: period.code,
          status: (['present', 'absent', 'late', 'excused', 'ignore'].includes(period.status)
            ? period.status : 'unknown') as CCAttendanceDay['sessions'][string]['status'],
          lateMinutes: typeof period.late_minutes === 'number' ? period.late_minutes : parseInt(period.late_minutes as string) || 0,
          lessonName: period.lesson_name,
        },
      ])
    ),
  }));

  // Sort days descending
  days.sort((a, b) => b.date.localeCompare(a.date));

  return {
    days,
    overallPercentage: meta.percentage ?? '0',
    startDate: meta.start_date,
    endDate: meta.end_date,
  };
}

function mapAnnouncement(a: Announcement): CCAnnouncement {
  return {
    id: a.id,
    title: a.title,
    descriptionHtml: a.description,
    descriptionText: stripHtml(a.description),
    schoolName: a.school_name,
    teacherName: a.teacher_name,
    timestamp: a.timestamp,
    isPinned: a.priority_pinned === 'yes' || a.sticky === 'yes',
    requiresConsent: a.requires_consent === 'yes',
    consentGiven: a.consent ? a.consent.consent_given === 'yes' : null,
    attachments: (a.attachments ?? []).map(att => ({
      filename: att.filename,
      url: att.url,
    })),
  };
}

function mapDetention(d: Detention): CCDetention {
  return {
    id: d.id,
    attended: d.attended,
    date: d.date,
    time: d.time,
    length: d.length,
    location: d.location,
    reason: d.lesson_pupil_behaviour?.reason ?? '',
    lessonName: d.lesson?.name ?? null,
    teacherName: d.teacher
      ? `${d.teacher.title} ${d.teacher.last_name}`.trim()
      : null,
    detentionType: d.detention_type?.name ?? null,
  };
}

function mapBadge(b: Badge): CCBadge {
  return {
    id: b.id,
    name: b.name,
    iconUrl: b.icon_url,
    colour: b.colour,
    createdDate: b.created_date,
  };
}

// ── Client wrapper ────────────────────────────────────────────

export class ClassChartsParentClient {
  private client: ParentClient;
  private pupils: CCStudent[] = [];

  constructor(email: string, password: string) {
    this.client = new ParentClient(email, password);
  }

  async login(): Promise<CCStudent[]> {
    await this.client.login();
    const raw = await this.client.getPupils();
    this.pupils = raw.map(mapPupil);
    return this.pupils;
  }

  selectPupil(pupilId: number): void {
    this.client.selectPupil(pupilId);
  }

  getPupils(): CCStudent[] {
    return this.pupils;
  }

  // ── Data methods ────────────────────────────────────────────

  async getActivity(from: string, to: string): Promise<CCActivityPoint[]> {
    const raw = await this.client.getFullActivity({ from, to });
    return raw.map(mapActivity);
  }

  async getBehaviourSummary(from: string, to: string): Promise<CCBehaviourSummary> {
    const res = await this.client.getBehaviour({ from, to });
    return {
      timeline: res.data.timeline.map(t => ({
        positive: t.positive,
        negative: t.negative,
        label: t.name,
        start: t.start,
        end: t.end,
      })),
      positiveReasons: res.data.positive_reasons ?? {},
      negativeReasons: res.data.negative_reasons ?? {},
      startDate: res.meta.start_date,
      endDate: res.meta.end_date,
    };
  }

  async getHomeworks(from: string, to: string): Promise<CCHomework[]> {
    const res = await this.client.getHomeworks({
      from,
      to,
      displayDate: 'due_date',
    });
    return res.data.map(mapHomework);
  }

  async getLessons(date: string): Promise<CCLesson[]> {
    const res = await this.client.getLessons({ date });
    return res.data.map(mapLesson);
  }

  async getAttendance(from: string, to: string): Promise<CCAttendanceSummary> {
    const res = await this.client.getAttendance({ from, to });
    return mapAttendance(res.data, res.meta);
  }

  async getAnnouncements(): Promise<CCAnnouncement[]> {
    const res = await this.client.getAnnouncements();
    return res.data.map(mapAnnouncement);
  }

  async getDetentions(): Promise<CCDetention[]> {
    const res = await this.client.getDetentions();
    return res.data.map(mapDetention);
  }

  async getBadges(): Promise<CCBadge[]> {
    const res = await this.client.getBadges();
    return res.data.map(mapBadge);
  }
}

// ── Date helpers ──────────────────────────────────────────────

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function daysAgoStr(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0];
}

export function daysAheadStr(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().split('T')[0];
}
