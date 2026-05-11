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

// ── Heartbeat ─────────────────────────────────────────────────────────────

export interface PollerHeartbeat {
  polledAt: string;
  pupils: string[];
  dependencies: Record<string, 'ok' | 'error'>;
  errors?: string[];
}

export async function writeHeartbeat(beat: PollerHeartbeat): Promise<void> {
  await db.collection('status').doc('poller').set({
    ...beat,
    updatedAt: new Date().toISOString(),
  });
}

export async function readHeartbeat(): Promise<PollerHeartbeat | null> {
  const doc = await db.collection('status').doc('poller').get();
  return doc.exists ? (doc.data() as PollerHeartbeat) : null;
}

// ── Subject map (GCS) ─────────────────────────────────────────

const SUBJECT_MAP_PATH = 'config/subject-map.json';

export async function loadSubjectMap(): Promise<Record<string, string>> {
  try {
    const [data] = await storage.bucket(BUCKET).file(SUBJECT_MAP_PATH).download();
    return JSON.parse(data.toString());
  } catch {
    return {};
  }
}

export async function saveSubjectMap(map: Record<string, string>): Promise<void> {
  await storage.bucket(BUCKET).file(SUBJECT_MAP_PATH).save(
    JSON.stringify(map, null, 2),
    { contentType: 'application/json' },
  );
}
