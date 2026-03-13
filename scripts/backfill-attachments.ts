#!/usr/bin/env npx ts-node
/**
 * backfill-attachments.ts
 *
 * Re-downloads attachments for announcements already archived in Firestore
 * but whose attachments weren't saved to GCS (missing auth headers bug).
 *
 * Usage:
 *   npm run backfill-attachments           # dry run
 *   npm run backfill-attachments -- --go   # actually download
 */

import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { ParentClient } from 'classcharts-api';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? 'classcharts';
const BUCKET = process.env.GCS_BUCKET!;
const db = new Firestore({ projectId: PROJECT_ID });
const storage = new Storage({ projectId: PROJECT_ID });

const DRY_RUN = !process.argv.includes('--go');

function guessContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  };
  return map[ext] ?? 'application/octet-stream';
}

async function main() {
  if (DRY_RUN) console.log('DRY RUN — pass --go to actually download\n');

  console.log('Logging in to ClassCharts...');
  const rawClient = new ParentClient(
    process.env.CLASSCHARTS_PARENT1_EMAIL!,
    process.env.CLASSCHARTS_PARENT1_PASSWORD!,
  );
  await rawClient.login();

  const c = rawClient as any;
  const authHeaders: Record<string, string> = {
    Cookie: (c.authCookies ?? []).join(';'),
    Authorization: `Basic ${c.sessionId ?? ''}`,
  };
  console.log(`Logged in. sessionId present: ${!!c.sessionId}\n`);

  const snapshot = await db.collection('announcements').get();
  const withAttachments = snapshot.docs.filter(d => {
    const data = d.data();
    return Array.isArray(data.attachments) && data.attachments.length > 0;
  });

  console.log(`Found ${withAttachments.length} archived announcement(s) with attachments.\n`);

  let saved = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of withAttachments) {
    const ann = doc.data();
    const studentId = ann.studentId;

    for (const att of ann.attachments) {
      const filename = att.filename ?? att.fileName;
      if (!filename || !att.url) {
        console.log(`  ⚠ Skipping — missing filename or url in ann ${ann.id}`);
        continue;
      }

      const gcsPath = `attachments/${studentId}/${ann.id}/${filename}`;
      const file = storage.bucket(BUCKET).file(gcsPath);

      const [exists] = await file.exists();
      if (exists) {
        console.log(`  ✓ Already in GCS: ${filename}`);
        skipped++;
        continue;
      }

      console.log(`  ↓ "${ann.title}" / ${filename}`);

      if (DRY_RUN) {
        console.log(`    [dry run — would save to ${gcsPath}]`);
        saved++;
        continue;
      }

      try {
        const res = await fetch(att.url, { headers: authHeaders });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

        const contentType = res.headers.get('content-type') ?? guessContentType(filename);
        if (contentType.includes('text/html')) {
          throw new Error(`Got HTML response — session auth failed or URL expired`);
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        await file.save(buffer, { contentType, resumable: false });

        const existing = await db.collection('attachments')
          .where('gcsPath', '==', gcsPath).limit(1).get();
        if (existing.empty) {
          await db.collection('attachments').add({
            filename, gcsPath, originalUrl: att.url, contentType,
            size: buffer.length, savedAt: new Date().toISOString(),
            studentId, announcementId: ann.id, announcementTitle: ann.title,
            schoolName: ann.schoolName, teacherName: ann.teacherName,
            announcementDate: ann.timestamp, backfilled: true,
          });
        }

        console.log(`    ✓ Saved (${(buffer.length / 1024).toFixed(0)} KB)`);
        saved++;
      } catch (err) {
        console.error(`    ✗ Failed:`, err);
        failed++;
      }
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`${DRY_RUN ? 'Would save' : 'Saved'}:  ${saved}`);
  console.log(`Skipped: ${skipped} (already in GCS)`);
  if (failed > 0) console.log(`Failed:  ${failed}`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
