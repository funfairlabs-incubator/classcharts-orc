#!/usr/bin/env npx ts-node
/**
 * backfill-gcs-paths.ts
 *
 * For each archived announcement in Firestore that has attachments but no
 * attachmentGcsPaths map, look up the GCS paths from the attachments collection
 * and write them back onto the announcement document.
 *
 * Run after backfill-attachments to make existing docs linkable in the frontend.
 *
 * Usage:
 *   npm run backfill-gcs-paths           # dry run
 *   npm run backfill-gcs-paths -- --go   # apply updates
 */

import { Firestore } from '@google-cloud/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? 'classcharts';
const db = new Firestore({ projectId: PROJECT_ID });
const DRY_RUN = !process.argv.includes('--go');

async function main() {
  if (DRY_RUN) console.log('DRY RUN — pass --go to apply\n');

  // Load all saved attachments indexed by announcementId
  const attSnapshot = await db.collection('attachments').get();
  const byAnnId: Record<string, Record<string, string>> = {};
  for (const doc of attSnapshot.docs) {
    const d = doc.data();
    if (!d.announcementId || !d.filename || !d.gcsPath) continue;
    if (!byAnnId[d.announcementId]) byAnnId[d.announcementId] = {};
    byAnnId[d.announcementId][d.filename] = d.gcsPath;
  }
  console.log(`Loaded GCS paths for ${Object.keys(byAnnId).length} announcement(s).\n`);

  // Find announcement docs missing attachmentGcsPaths
  const annSnapshot = await db.collection('announcements').get();
  let updated = 0, skipped = 0, noAttachments = 0;

  for (const doc of annSnapshot.docs) {
    const data = doc.data();
    const annId = data.id;

    if (!data.attachments || data.attachments.length === 0) {
      noAttachments++;
      continue;
    }

    const existing = data.attachmentGcsPaths ?? {};
    const available = byAnnId[annId] ?? {};

    // Check if all attachments already have paths
    const missing = data.attachments.filter((a: any) => {
      const filename = a.filename ?? a.fileName;
      return filename && !existing[filename] && available[filename];
    });

    if (missing.length === 0) {
      skipped++;
      continue;
    }

    // Merge existing + newly found paths
    const merged: Record<string, string> = { ...existing };
    for (const att of missing) {
      const filename = att.filename ?? att.fileName;
      merged[filename] = available[filename];
    }

    console.log(`  ${data.title?.slice(0, 50)} — adding ${missing.length} path(s)`);
    for (const att of missing) {
      const filename = att.filename ?? att.fileName;
      console.log(`    ${filename} → ${merged[filename]}`);
    }

    if (!DRY_RUN) {
      await db.collection('announcements').doc(doc.id).update({
        attachmentGcsPaths: merged,
      });
    }
    updated++;
  }

  console.log(`\n─────────────────────────────`);
  console.log(`${DRY_RUN ? 'Would update' : 'Updated'}: ${updated}`);
  console.log(`Already complete: ${skipped}`);
  console.log(`No attachments: ${noAttachments}`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
