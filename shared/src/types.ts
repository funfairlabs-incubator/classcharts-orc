// ── Our normalised domain types ───────────────────────────────

export interface CCStudent {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  schoolName: string;
  displayBehaviour: boolean;
  displayHomework: boolean;
  displayAttendance: boolean;
  displayTimetable: boolean;
  displayAnnouncements: boolean;
  displayDetentions: boolean;
  homeworkTodoCount: number;
  homeworkLateCount: number;
  announcementsCount: number;
  detentionPendingCount: number;
}

export interface CCActivityPoint {
  id: number;
  type: 'behaviour' | 'detention' | 'attendance_event' | 'notice' | 'event' | 'other';
  polarity: 'positive' | 'negative' | 'neutral';
  reason: string;
  score: number;
  timestamp: string;
  lessonName: string | null;
  teacherName: string | null;
  roomName: string | null;
  note: string | null;
}

export interface CCBehaviourSummary {
  timeline: Array<{
    positive: number;
    negative: number;
    label: string;
    start: string;
    end: string;
  }>;
  positiveReasons: Record<string, number>;
  negativeReasons: Record<string, number>;
  startDate: string;
  endDate: string;
}

export interface CCHomework {
  id: number;
  title: string;
  description: string;
  subject: string;
  lesson: string;
  teacher: string;
  issueDate: string;
  dueDate: string;
  status: 'completed' | 'late' | 'not_completed' | null;
  ticked: boolean;
  hasAttachments: boolean;
  attachments: Array<{ fileName: string; url: string }>;
  links: Array<{ link: string }>;
  completionTime: string;
}

export interface CCLesson {
  teacherName: string;
  lessonName: string;
  subjectName: string;
  periodName: string;
  periodNumber: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  isAlternative: boolean;
  pupilNote: string;
}

export interface CCAttendanceSession {
  code: string;
  status: 'present' | 'absent' | 'late' | 'excused' | 'ignore' | 'unknown';
  lateMinutes: number;
  lessonName?: string;
}

export interface CCAttendanceDay {
  date: string;
  sessions: Record<string, CCAttendanceSession>;
}

export interface CCAttendanceSummary {
  days: CCAttendanceDay[];
  overallPercentage: string;
  startDate: string;
  endDate: string;
}

export interface CCAnnouncement {
  id: number;
  title: string;
  descriptionHtml: string | null;
  descriptionText: string | null;
  schoolName: string;
  teacherName: string;
  timestamp: string;
  isPinned: boolean;
  requiresConsent: boolean;
  consentGiven: boolean | null;
  attachments: Array<{ filename: string; url: string }>;
}

export interface CCDetention {
  id: number;
  attended: 'yes' | 'no' | 'upscaled' | 'pending';
  date: string | null;
  time: string | null;
  length: number | null;
  location: string | null;
  reason: string;
  lessonName: string | null;
  teacherName: string | null;
  detentionType: string | null;
}

export interface CCBadge {
  id: number;
  name: string;
  iconUrl: string;
  colour: string;
  createdDate: string;
}

// ── Poll state (Firestore) ────────────────────────────────────

export interface PollState {
  studentId: number;
  lastActivityId: number;
  lastHomeworkId: number;
  lastAnnouncementId: number;
  lastAttendanceDate: string;
  lastEmailId: string;
  updatedAt: string;
}

// ── Calendar event ────────────────────────────────────────────

export interface CalendarEvent {
  title: string;
  date: string;
  endDate?: string;
  allDay: boolean;
  description: string;
  deadlineDate?: string;
  eventType: 'homework' | 'trip' | 'parents_evening' | 'options_day' | 'term_date' | 'announcement' | 'deadline' | 'other';
  sourceAnnouncementId?: number;
  studentId: number;
  calendarId?: string;
}

// ── Notification events ───────────────────────────────────────

export type NotificationEvent =
  | { type: 'activity';     data: CCActivityPoint;   studentName: string }
  | { type: 'homework';     data: CCHomework;         studentName: string }
  | { type: 'announcement'; data: CCAnnouncement;    studentName: string }
  | { type: 'attendance';   data: CCAttendanceDay;   studentName: string }
  | { type: 'detention';    data: CCDetention;       studentName: string };

// ── Auth ──────────────────────────────────────────────────────

export interface AllowedUser {
  email: string;
  name?: string;
  addedBy: string;
  addedAt: string;
}

export interface AllowedUsersConfig {
  users: AllowedUser[];
}

// ── User notification preferences (GCS) ──────────────────────

export interface UserNotificationPrefs {
  email: string;
  pushoverKey?: string;           // their personal Pushover user key
  notifications: {
    homeworkDigest: boolean;      // 3pm daily digest of upcoming homework
    homeworkStatusChange: boolean;// when homework marked submitted
    homeworkNew: boolean;         // when new homework is set
    behaviour: boolean;           // behaviour points (+ and -)
    detentions: boolean;          // new detentions
    attendance: boolean;          // absences / lates
    announcements: boolean;       // school announcements
  };
}

export interface UserPrefsConfig {
  prefs: UserNotificationPrefs[];
}
