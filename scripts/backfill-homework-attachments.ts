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
import { ParentClient } from 'classcharts-api';

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

function stripHtml(html: string): string {
  return (html ?? '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

async function loginAndGetHomeworks(email: string, password: string): Promise<{
  homeworks: Array<{ pupilId: number; pupilName: string; hw: any }>;
  authHeaders: Record<string, string>;
}> {
  // Use the same TES SSO flow as the poller
  const formData = new URLSearchParams({
    _method: 'POST', email, logintype: 'existing', password,
    'recaptcha-token': 'no-token-available',
  });
  const loginRes = await fetch('https://www.classcharts.com/parent/login', {
    method: 'POST', body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
  });
  if (loginRes.status !== 302) throw new Error(`ClassCharts login failed: ${loginRes.status}`);
  const setCookie = loginRes.headers.get('set-cookie') ?? '';
  const ccSession = setCookie.match(/cc-session=([^;]+)/)?.[1];
  const credMatch = setCookie.match(/parent_session_credentials=([^;\s]+)/)?.[1];
  if (!ccSession || !credMatch) throw new Error('ClassCharts login: missing session cookies');
  const sessionId = JSON.parse(decodeURIComponent(credMatch)).session_id as string;
  const cookieHeader = \`cc-session=\${ccSession}; parent_session_credentials=\${credMatch}\`;

  // TES verify
  const tesRes = await fetch(
    'https://session.tes.com/v1/verify?returnUrl=https%3A%2F%2Fwww.classcharts.com%2Fapiv2parent%2Fpupils',
    { headers: { Cookie: cookieHeader }, redirect: 'manual' }
  );
  const tesLocation = tesRes.headers.get('location');
  if (tesLocation) await fetch(tesLocation, { headers: { Cookie: cookieHeader }, redirect: 'manual' });

  const authHeaders = { Cookie: cookieHeader, Authorization: \`Basic \${sessionId}\` };

  // Get pupils
  const pupilsRes = await fetch('https://www.classcharts.com/apiv2parent/pupils', {
    headers: { ...authHeaders, 'User-Agent': 'classcharts-api' }, redirect: 'manual',
  });
  if (pupilsRes.status !== 200) throw new Error(\`getPupils failed: \${pupilsRes.status}\`);
  const { data: rawPupils } = await pupilsRes.json() as { data: any[] };

  const from = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
  const to   = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const client = new ParentClient(email, password);
  const c = client as any;
  c.sessionId = sessionId;
  c.authCookies = cookieHeader.split('; ');
  c.lastPing = Date.now();
  c.pupils = rawPupils;
  c.studentId = rawPupils[0]?.id ?? 0;

  const homeworks: Array<{ pupilId: number; pupilName: string; hw: any }> = [];

  for (const rawPupil of rawPupils) {
    client.selectPupil(rawPupil.id);
    const res = await client.getHomeworks({ from, to, displayDate: 'due_date' });
    for (const h of res.data) {
      const attachments = (h.validated_attachments ?? []).map((a: any) => ({
        fileName: a.file_name,
        url: a.validated_file,
      }));
      if (attachments.length > 0) {
        homeworks.push({
          pupilId: rawPupil.id,
          pupilName: rawPupil.name,
          hw: { id: h.id, title: h.title, subject: h.subject, dueDate: h.due_date, attachments },
        });
      }
    }
  }

  return { homeworks, authHeaders };
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
