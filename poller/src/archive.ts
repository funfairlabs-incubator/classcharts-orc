import { Firestore } from '@google-cloud/firestore';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Storage } from '@google-cloud/storage';
import type { CCAnnouncement } from '@classcharts/shared';

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const BUCKET = process.env.GCS_BUCKET!;

// ── Archive announcement to Firestore ─────────────────────────

export async function archiveAnnouncement(
  ann: CCAnnouncement,
  studentId: number,
  studentName: string,
): Promise<void> {
  const docId = `${studentId}_${ann.id}`;
  await db.collection('announcements').doc(docId).set({
    ...ann,
    studentId,
    studentName,
    archivedAt: new Date().toISOString(),
  }, { merge: true });
}

// ── Download & save attachments to GCS ───────────────────────

export interface SavedAttachment {
  filename: string;
  gcsPath: string;
  originalUrl: string;
  contentType: string;
  size: number;
  savedAt: string;
}

export async function downloadAndSaveAttachments(
  ann: CCAnnouncement,
  studentId: number,
  authHeaders: Record<string, string>,
): Promise<SavedAttachment[]> {
  const saved: SavedAttachment[] = [];

  for (const att of ann.attachments) {
    const filename = (att as any).fileName ?? att.filename; // API returns fileName, type says filename
    const gcsPath = `attachments/${studentId}/${ann.id}/${filename}`;
    const file = storage.bucket(BUCKET).file(gcsPath);

    // Skip if already saved
    const [exists] = await file.exists();
    if (exists) {
      console.log(`  Attachment already saved: ${gcsPath}`);
      const [meta] = await file.getMetadata();
      saved.push({
        filename,
        gcsPath,
        originalUrl: att.url,
        contentType: meta.contentType ?? 'application/octet-stream',
        size: Number(meta.size ?? 0),
        savedAt: meta.timeCreated ?? new Date().toISOString(),
      });
      continue;
    }

    try {
      console.log(`  Downloading attachment: ${filename}`);
      const res = await fetch(att.url, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get('content-type') ?? guessContentType(filename);
      // Guard: if we got an HTML response, auth failed — don't save a login page
      if (contentType.includes('text/html')) {
        throw new Error(`Auth redirect received for ${filename} — attachment URL requires valid session`);
      }
      let buffer = Buffer.from(await res.arrayBuffer() as ArrayBuffer);
      let saveFilename = filename;
      let saveContentType = contentType;
      let saveGcsPath = gcsPath;

      // Convert office docs to PDF
      const converted = convertToPdf(buffer, filename);
      if (converted) {
        console.log(`  Converted ${filename} → ${converted.filename}`);
        buffer = converted.buffer;
        saveFilename = converted.filename;
        saveContentType = 'application/pdf';
        saveGcsPath = `attachments/${studentId}/${ann.id}/${saveFilename}`;
      }

      const saveFile = storage.bucket(BUCKET).file(saveGcsPath);
      await saveFile.save(buffer, { contentType: saveContentType, resumable: false });

      const savedAtt: SavedAttachment = {
        filename: saveFilename,
        gcsPath: saveGcsPath,
        originalUrl: att.url,
        contentType: saveContentType,
        size: buffer.length,
        savedAt: new Date().toISOString(),
      };
      saved.push(savedAtt);

      // Record in Firestore for easy listing
      await db.collection('attachments').add({
        ...savedAtt,
        studentId,
        announcementId: ann.id,
        announcementTitle: ann.title,
        schoolName: ann.schoolName,
        teacherName: ann.teacherName,
        announcementDate: ann.timestamp,
      });

      console.log(`  Saved ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
    } catch (err) {
      console.error(`  Failed to save attachment ${filename}:`, err);
    }
  }

  // Write gcsPath map back onto the announcement document so the frontend can serve them
  if (saved.length > 0) {
    const pathMap: Record<string, string> = {};
    for (const s of saved) pathMap[s.filename] = s.gcsPath; // filename here is the converted name
    const docId = `${studentId}_${ann.id}`;
    await db.collection('announcements').doc(docId).update({
      attachmentGcsPaths: pathMap,
    });
    console.log(`  Updated announcement ${ann.id} with ${Object.keys(pathMap).length} GCS path(s)`);
  }

  return saved;
}

// Convert docx/doc/pptx/xlsx to PDF using LibreOffice
function convertToPdf(buffer: Buffer, filename: string): { buffer: Buffer; filename: string } | null {
  const CONVERTIBLE = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (!CONVERTIBLE.includes(ext)) return null;

  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-'));
    const inPath = path.join(tmpDir, filename);
    const pdfFilename = filename.replace(/\.[^.]+$/, '.pdf');
    const outPath = path.join(tmpDir, pdfFilename);

    fs.writeFileSync(inPath, buffer);
    execSync(`libreoffice --headless --convert-to pdf --outdir "${tmpDir}" "${inPath}"`, {
      timeout: 30000,
      stdio: 'pipe',
    });

    if (!fs.existsSync(outPath)) return null;
    const pdfBuffer = fs.readFileSync(outPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return { buffer: pdfBuffer, filename: pdfFilename };
  } catch (err) {
    console.error(`  PDF conversion failed for ${filename}:`, err);
    return null;
  }
}

function guessContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
  };
  return map[ext] ?? 'application/octet-stream';
}
