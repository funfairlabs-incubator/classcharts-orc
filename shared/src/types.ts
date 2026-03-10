// ── ClassCharts data types ────────────────────────────────────

export interface CCStudent {
  id: number;
  name: string;
  school: string;
  avatarUrl?: string;
}

export interface CCBehaviourPoint {
  id: number;
  studentId: number;
  timestamp: string;
  score: number; // positive or negative
  reason: string;
  lessonName?: string;
  teacherName?: string;
}

export interface CCHomework {
  id: number;
  studentId: number;
  title: string;
  description: string;
  subject: string;
  setDate: string;
  dueDate: string;
  status: 'todo' | 'completed' | 'late';
  attachmentUrl?: string;
}

export interface CCAttendance {
  studentId: number;
  date: string;
  amStatus: string;
  pmStatus: string;
  lessons: CCLessonAttendance[];
}

export interface CCLessonAttendance {
  period: string;
  subject: string;
  status: string;
}

export interface CCTimetableLesson {
  studentId: number;
  date: string;
  period: string;
  subject: string;
  teacher: string;
  room: string;
}

export interface CCAnnouncement {
  id: number;
  title: string;
  description: string;
  teacherName: string;
  timestamp: string;
  priority: 'normal' | 'high';
}

// ── Poll state (stored in Firestore) ─────────────────────────

export interface PollState {
  studentId: number;
  lastHomeworkId: number;
  lastBehaviourId: number;
  lastAnnouncementId: number;
  lastAttendanceDate: string;
  lastEmailId: string;
  updatedAt: string;
}

// ── Notification events ───────────────────────────────────────

export type NotificationEvent =
  | { type: 'homework'; data: CCHomework }
  | { type: 'behaviour'; data: CCBehaviourPoint }
  | { type: 'attendance'; data: CCAttendance }
  | { type: 'announcement'; data: CCAnnouncement };

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
