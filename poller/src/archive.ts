import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';
import type { CCAnnouncement, ArchivedAnnouncement, CalendarEvent, UpcomingEvent } from '@classcharts/shared';
import type { AnnouncementAnalysis } from './claude.js';

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });
const BUCKET = process.env.GCS_BUCKET!;

// ── Download and archive attachment to GCS ────────────────────

async function archiveAttachment(
  url: string,
  filename: string,
  studentId: number,
  announcementId: number,
): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const gcsPath = `attachments/${studentId}/${announcementId}/${safeName}`;
    await storage.bucket(BUCKET).file(gcsPath).save(buffer, {
      metadata: { contentDisposition: `attachment; filename="${filename}"` },
    });
    console.log(`  Archived attachment: ${gcsPath}`);
    return gcsPath;
  } catch (err) {
    console.error(`  Failed to archive attachment ${filename}:`, err);
    return null;
  }
}

// ── Save announcement + attachments to Firestore + GCS ────────

export async function archiveAnnouncement(
  ann: CCAnnouncement,
  studentId: number,
  analysis: AnnouncementAnalysis,
): Promise<void> {
  const docId = `${studentId}_${ann.id}`;

  // Check if already archived
  const existing = await db.collection('announcements').doc(docId).get();
  if (existing.exists) return;

  // Download attachments
  const attachmentGcsPaths: Record<string, string> = {};
  for (const att of ann.attachments) {
    const gcsPath = await archiveAttachment(att.url, att.filename, studentId, ann.id);
    if (gcsPath) attachmentGcsPaths[att.filename] = gcsPath;
  }

  const archived: ArchivedAnnouncement = {
    ...ann,
    studentId,
    archivedAt: new Date().toISOString(),
    attachmentGcsPaths,
    calendarEvents: analysis.calendarEvents,
    aiSummary: analysis.summary,
    requiresAction: analysis.requiresAction,
    actionDescription: analysis.actionDescription,
  };

  await db.collection('announcements').doc(docId).set(archived);
  console.log(`  Archived announcement ${ann.id}: "${ann.title}"`);

  // Also save upcoming events to their own collection for fast querying
  for (let i = 0; i < analysis.calendarEvents.length; i++) {
    const ev = analysis.calendarEvents[i];
    if (!ev.date) continue;
    const eventId = `${studentId}_${ann.id}_${i}`;
    const upcomingEvent: UpcomingEvent = {
      id: eventId,
      studentId,
      title: ev.title,
      date: ev.date,
      endDate: ev.endDate,
      eventType: ev.eventType,
      sourceAnnouncementId: ann.id,
      description: ev.description,
    };
    await db.collection('upcoming_events').doc(eventId).set(upcomingEvent);
    console.log(`  Saved upcoming event: "${ev.title}" on ${ev.date}`);
  }
}

// ── Read archived announcements (for frontend) ────────────────

export async function getArchivedAnnouncements(studentId: number, limit = 100): Promise<ArchivedAnnouncement[]> {
  const snapshot = await db.collection('announcements')
    .where('studentId', '==', studentId)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map(d => d.data() as ArchivedAnnouncement);
}

// ── Read upcoming events for a student ───────────────────────

export async function getUpcomingEvents(studentId: number, daysAhead = 60): Promise<UpcomingEvent[]> {
  const from = new Date().toISOString().split('T')[0];
  const to = new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0];
  const snapshot = await db.collection('upcoming_events')
    .where('studentId', '==', studentId)
    .where('date', '>=', from)
    .where('date', '<=', to)
    .orderBy('date', 'asc')
    .get();
  return snapshot.docs.map(d => d.data() as UpcomingEvent);
}

// ── Serve attachment from GCS (signed URL) ───────────────────

export async function getAttachmentSignedUrl(gcsPath: string): Promise<string> {
  const [url] = await storage.bucket(BUCKET).file(gcsPath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  });
  return url;
}
