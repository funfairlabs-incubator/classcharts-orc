import { Firestore } from '@google-cloud/firestore';
import type { PollState } from '@classcharts/shared';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });

const COLLECTION = 'poll_state';

export async function getState(studentId: number): Promise<PollState> {
  const doc = await db.collection(COLLECTION).doc(String(studentId)).get();
  if (doc.exists) return doc.data() as PollState;
  return {
    studentId,
    lastActivityId: 0,
    lastHomeworkId: 0,
    lastAnnouncementId: 0,
    lastAttendanceDate: '',
    lastEmailId: '',
    updatedAt: new Date().toISOString(),
  };
}

export async function saveState(state: PollState): Promise<void> {
  await db.collection(COLLECTION).doc(String(state.studentId)).set(state);
}

export async function getGmailState(): Promise<{ lastEmailId: string }> {
  const doc = await db.collection(COLLECTION).doc('gmail').get();
  return doc.exists ? (doc.data() as { lastEmailId: string }) : { lastEmailId: '' };
}

export async function saveGmailState(lastEmailId: string): Promise<void> {
  await db.collection(COLLECTION).doc('gmail').set({
    lastEmailId,
    updatedAt: new Date().toISOString(),
  });
}
