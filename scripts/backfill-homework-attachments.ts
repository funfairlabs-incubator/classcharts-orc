#!/usr/bin/env npx ts-node
/**
 * backfill-homework-attachments.ts
 *
 * Fetches all current homework for each pupil and downloads any
 * attachments that haven't yet been saved to GCS.
 *
 * Usage (from scripts/):
 *   npm run backfill-homework-attachments           # dry run
 *   npm run backfill-homework-attachments -- --go   # apply
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';

const DRY_RUN = !process.argv.includes('--go');
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });
const BUCKET = process.env.GCS_BUCKET!;

// ── Config loaders ────────────────────────────────────────────

async function getAllowedUsers() {
  const [c] = await storage.bucket(BUCKET).file('config/allowed-users.json').download();
  return JSON.parse(c.toString()).users as Array<{ email: string; password: string; name: string }>;
}

// ── ClassCharts client (inline to avoid circular deps) ────────

async function loginAndGetHomeworks(email: string, password: string): Promise<{
  pupils: Array<{ id: number; name: string }>;
  homeworks: Array<{ pupilId: number; pupilName: string; hw: any }>;
  authHeaders: Record<string, string>;
}> {
  const { ClassChartsParentClient } = await import('../shared/src/classcharts.js' as any);
  const client = new ClassChartsParentClient(email, password);
  const pupils = await client.login();
  const authHeaders = client.getAuthHeaders();

  const from = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
  const to   = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const homeworks: Array<{ pupilId: number; pupilName: string; hw: any }> = [];
  for (const pupil of pupils) {
    client.selectPupil(pupil.id);
    const hws = await client.getHomeworks(from, to);
    for (const hw of hws) {
      if (hw.attachments?.length > 0) {
        homeworks.push({ pupilId: pupil.id, pupilName: pupil.name, hw });
      }
    }
  }

  return { pupils, homeworks, authHeaders };
}

async function fileExists(gcsPath: string): Promise<boolean> {
  const [exists] = await storage.bucket(BUCKET).file(gcsPath).exists();
  return exists;
}

async function downloadAndSave(
  att: { fileName: string; url: string },
  hw: any,
  studentId: number,
  authHeaders: Record<string, string>,
): Promise<void> {
  const filename = att.fileName;
  const gcsPath = `homework/${studentId}/${hw.id}/${filename}`;

  if (await fileExists(gcsPath)) {
    console.log(`  ✓ already exists: ${gcsPath}`);
    return;
  }

  if (DRY_RUN) {
    console.log(`  [DRY RUN] would download: ${gcsPath}`);
    return;
  }

  const res = await fetch(att.url, { headers: authHeaders });
  if (!res.ok) { console.warn(`  ✗ fetch failed ${res.status}: ${att.url}`); return; }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const savedAt = new Date().toISOString();

  await storage.bucket(BUCKET).file(gcsPath).save(buffer, {
    metadata: { contentType, metadata: { savedAt, homeworkId: String(hw.id), studentId: String(studentId) } },
  });

  // Record to Firestore
  const docId = `${studentId}_${hw.id}_${filename}`;
  await db.collection('homeworkAttachments').doc(docId).set({
    filename,
    gcsPath,
    originalUrl: att.url,
    contentType,
    size: buffer.length,
    savedAt,
    studentId,
    homeworkId: hw.id,
    homeworkTitle: hw.title,
    homeworkSubject: hw.subject ?? '',
    homeworkDueDate: hw.dueDate ?? '',
    type: 'homework',
  }, { merge: true });

  console.log(`  ✓ saved: ${gcsPath} (${buffer.length} bytes)`);
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 Backfill homework attachments${DRY_RUN ? ' [DRY RUN — pass --go to apply]' : ''}\n`);

  const users = await getAllowedUsers();
  console.log(`Found ${users.length} user(s)\n`);

  let totalHw = 0;
  let totalAtt = 0;

  for (const user of users) {
    console.log(`\n── ${user.name} (${user.email}) ──`);
    try {
      const { homeworks, authHeaders } = await loginAndGetHomeworks(user.email, user.password);
      console.log(`  ${homeworks.length} homework item(s) with attachments`);

      for (const { pupilId, pupilName, hw } of homeworks) {
        console.log(`\n  📚 [${pupilName}] "${hw.title}" (id: ${hw.id}, due: ${hw.dueDate?.split('T')[0] ?? '?'})`);
        totalHw++;
        for (const att of hw.attachments) {
          console.log(`    📎 ${att.fileName}`);
          await downloadAndSave(att, hw, pupilId, authHeaders);
          totalAtt++;
        }
      }
    } catch (err) {
      console.error(`  ✗ Error for ${user.email}:`, err);
    }
  }

  console.log(`\n✅ Done — ${totalHw} homework items, ${totalAtt} attachment(s) processed${DRY_RUN ? ' [DRY RUN]' : ''}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
