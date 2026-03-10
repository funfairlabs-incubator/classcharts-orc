import { ClassChartsClient } from '@classcharts/shared';
import type { PollState, NotificationEvent } from '@classcharts/shared';
import { Firestore } from '@google-cloud/firestore';
import { sendPushover } from './pushover';
import { formatNotification } from './formatter';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });

interface ParentConfig {
  email: string;
  code: string;
}

function getParentConfigs(): ParentConfig[] {
  const configs: ParentConfig[] = [];
  if (process.env.CLASSCHARTS_PARENT1_EMAIL && process.env.CLASSCHARTS_PARENT1_CODE) {
    configs.push({
      email: process.env.CLASSCHARTS_PARENT1_EMAIL,
      code: process.env.CLASSCHARTS_PARENT1_CODE,
    });
  }
  if (process.env.CLASSCHARTS_PARENT2_EMAIL && process.env.CLASSCHARTS_PARENT2_CODE) {
    configs.push({
      email: process.env.CLASSCHARTS_PARENT2_EMAIL,
      code: process.env.CLASSCHARTS_PARENT2_CODE,
    });
  }
  return configs;
}

async function getState(studentId: number): Promise<PollState | null> {
  const doc = await db.collection('poll_state').doc(String(studentId)).get();
  return doc.exists ? (doc.data() as PollState) : null;
}

async function saveState(state: PollState): Promise<void> {
  await db.collection('poll_state').doc(String(state.studentId)).set(state);
}

export async function pollClassCharts(): Promise<void> {
  const parents = getParentConfigs();
  const today = new Date().toISOString().split('T')[0];
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

  for (const parent of parents) {
    const client = new ClassChartsClient(parent.email, parent.code);
    const students = await client.login();

    for (const student of students) {
      const state = await getState(student.id) ?? {
        studentId: student.id,
        lastHomeworkId: 0,
        lastBehaviourId: 0,
        lastAnnouncementId: 0,
        lastAttendanceDate: '',
        lastEmailId: '',
        updatedAt: new Date().toISOString(),
      };

      const events: NotificationEvent[] = [];

      // ── Homework ────────────────────────────────────────────
      const homeworks = await client.getHomework(student.id, twoWeeksAgo, today);
      const newHomeworks = homeworks.filter(h => h.id > state.lastHomeworkId);
      for (const hw of newHomeworks) {
        events.push({ type: 'homework', data: hw });
      }
      if (newHomeworks.length > 0) {
        state.lastHomeworkId = Math.max(...newHomeworks.map(h => h.id));
      }

      // ── Behaviour ───────────────────────────────────────────
      const behaviours = await client.getBehaviour(student.id, twoWeeksAgo, today);
      const newBehaviours = behaviours.filter(b => b.id > state.lastBehaviourId);
      for (const beh of newBehaviours) {
        events.push({ type: 'behaviour', data: beh });
      }
      if (newBehaviours.length > 0) {
        state.lastBehaviourId = Math.max(...newBehaviours.map(b => b.id));
      }

      // ── Announcements ────────────────────────────────────────
      const announcements = await client.getAnnouncements(student.id);
      const newAnnouncements = announcements.filter(a => a.id > state.lastAnnouncementId);
      for (const ann of newAnnouncements) {
        events.push({ type: 'announcement', data: ann });
      }
      if (newAnnouncements.length > 0) {
        state.lastAnnouncementId = Math.max(...newAnnouncements.map(a => a.id));
      }

      // ── Attendance ───────────────────────────────────────────
      const attendances = await client.getAttendance(student.id, today, today);
      for (const att of attendances) {
        if (att.date > state.lastAttendanceDate) {
          events.push({ type: 'attendance', data: att });
          state.lastAttendanceDate = att.date;
        }
      }

      // ── Send notifications ───────────────────────────────────
      for (const event of events) {
        const { title, message, priority } = formatNotification(student.name, event);
        await sendPushover(title, message, priority);
      }

      state.updatedAt = new Date().toISOString();
      await saveState(state);

      console.log(`Polled ${student.name}: ${events.length} new events`);
    }
  }
}
