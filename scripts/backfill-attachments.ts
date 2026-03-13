#!/usr/bin/env npx ts-node
/**
 * backfill-attachments.ts
 *
 * Re-downloads attachments for announcements already archived in Firestore
 * but whose attachments weren't saved to GCS (e.g. due to missing auth headers).
 *
 * Usage:
 *   npm run backfill-attachments           # dry run — shows what would be downloaded
 *   npm run backfill-attachments -- --go   # actually download and save to GCS
 *
 * Run from /scripts:
 *   cd scripts && npm run backfill-attachments -- --go
 */

import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { ClassChartsClient } from '@classcharts/shared';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? 'classcharts';
const BUCKET = process.env.GCS_BUCKET!;
const db = new Firestore({ projectId: PROJECT_ID });
const storage = new Storage({ projectId: PROJECT_ID });

const DRY_RUN = !process.argv.includes('--go');

async function main() {
  if (DRY_RUN) console.log('DRY RUN — pass --go to actually download\n');

  // Login to get authenticated client
  console.log('Logging in to ClassCharts...');
  const client = new ClassChartsClient(
    process.env.CLASSCHARTS_PARENT1_EMAIL!,
    process.env.CLASSCHARTS_PARENT1_PASSWORD!,
  );
  await client.login();
  const authHeaders = client.getAuthHeaders();
  console.log('Logged in.\n');

  // Fetch all archived announcements with attachments
  const snapshot = await db.collection('announcements').get();
  const withAttachments = snapshot.docs.filter(d => {
    const data = d.data();
    return data.attachments && data.attachments.length > 0;
  });

  console.log(`Found ${withAttachments.length} archived announcements with attachments.\n`);

  let saved = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of withAttachments) {
    const ann = doc.data();
    const studentId = ann.studentId;

    for (const att of ann.attachments) {
      const filename = att.filename ?? att.fileName;
      if (!filename || !att.url) {
        console.log(`  ⚠ Skipping attachment with missing filename/url in ann ${ann.id}`);
        continue;
      }

      const gcsPath = `attachments/${studentId}/${ann.id}/${filename}`;
      const file = storage.bucket(BUCKET).file(gcsPath);

      // Check if already saved
      const [exists] = await file.exists();
      if (exists) {
        console.log(`  ✓ Already saved: ${gcsPath}`);
        skipped++;
        continue;
      }

      console.log(`  → ${ann.title} / ${filename}`);
      console.log(`    URL: ${att.url}`);

      if (DRY_RUN) {
        console.log(`    [dry run — would download and save to ${gcsPath}]`);
        saved++;
        continue;
      }

      try {
        const res = await fetch(att.url, { headers: authHeaders });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

        const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
        if (contentType.includes('text/html')) {
          throw new Error(`Got HTML response — auth may have expired`);
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        await file.save(buffer, { contentType, resumable: false });

        // Record in Firestore attachments collection
        await db.collection('attachments').add({
          filename,
          gcsPath,
          originalUrl: att.url,
          contentType,
          size: buffer.length,
          savedAt: new Date().toISOString(),
          studentId,
          announcementId: ann.id,
          announcementTitle: ann.title,
          schoolName: ann.schoolName,
          teacherName: ann.teacherName,
          announcementDate: ann.timestamp,
          backfilled: true,
        });

        console.log(`    ✓ Saved (${(buffer.length / 1024).toFixed(0)}KB)`);
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

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
