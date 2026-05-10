#!/usr/bin/env npx ts-node
/**
 * backfill-homework-attachments.ts
 * Usage: npx ts-node backfill-homework-attachments.ts [--go]
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

async function getAllowedUsers() {
  const [c] = await storage.bucket(BUCKET).file('config/allowed-users.json').download();
  return JSON.parse(c.toString()).users as Array<{ email: string; password: string; name: string }>;
}

async function tesLogin(email: string, password: string) {
  const formData = new URLSearchParams({
    _method: 'POST', email, logintype: 'existing', password,
    'recaptcha-token': 'no-token-available',
  });
  const loginRes = await fetch('https://www.classcharts.com/parent/login', {
    method: 'POST', body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
  });
  if (loginRes.status !== 302) throw new Error(`Login failed: ${loginRes.status}`);
  const setCookie = loginRes.headers.get('set-cookie') ?? '';
  const ccSession = setCookie.match(/cc-session=([^;]+)/)?.[1];
  const credMatch = setCookie.match(/parent_session_credentials=([^;\s]+)/)?.[1];
  if (!ccSession || !credMatch) throw new Error('Missing session cookies');
  const sessionId = JSON.parse(decodeURIComponent(credMatch)).session_id as string;
  const cookieHeader = `cc-session=${ccSession}; parent_session_credentials=${credMatch}`;
  const authHeaders = { Cookie: cookieHeader, Authorization: `Basic ${sessionId}`, 'User-Agent': 'classcharts-api' };
  const tesRes = await fetch(
    'https://session.tes.com/v1/verify?returnUrl=https%3A%2F%2Fwww.classcharts.com%2Fapiv2parent%2Fpupils',
    { headers: { Cookie: cookieHeader }, redirect: 'manual' }
  );
  const loc = tesRes.headers.get('location');
  if (loc) await fetch(loc, { headers: { Cookie: cookieHeader }, redirect: 'manual' });
  const pupilsRes = await fetch('https://www.classcharts.com/apiv2parent/pupils', { headers: authHeaders, redirect: 'manual' });
  if (pupilsRes.status !== 200) throw new Error(`getPupils failed: ${pupilsRes.status}`);
  const { data: rawPupils } = await pupilsRes.json() as { data: any[] };
  return { authHeaders, sessionId, cookieHeader, rawPupils };
}

async function getHomeworks(pupilId: number, sessionId: string, cookieHeader: string) {
  const from = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
  const to   = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const h = { Cookie: cookieHeader, Authorization: `Basic ${sessionId}`, 'User-Agent': 'classcharts-api' };
  await fetch(`https://www.classcharts.com/apiv2parent/selectstudent/${pupilId}`, { method: 'POST', headers: h });
  const res = await fetch(`https://www.classcharts.com/apiv2parent/homeworks/?display_date=due_date&from=${from}&to=${to}`, { headers: h });
  if (!res.ok) throw new Error(`getHomeworks failed: ${res.status}`);
  return ((await res.json()) as { data: any[] }).data;
}

async function saveAttachment(att: { fileName: string; url: string }, hw: any, studentId: number, authHeaders: Record<string,string>) {
  const gcsPath = `homework/${studentId}/${hw.id}/${att.fileName}`;
  const [exists] = await storage.bucket(BUCKET).file(gcsPath).exists();
  if (exists) { console.log(`    ✓ exists: ${att.fileName}`); return; }
  if (DRY_RUN) { console.log(`    [DRY RUN] ${att.fileName}`); return; }
  const res = await fetch(att.url, { headers: authHeaders });
  if (!res.ok) { console.warn(`    ✗ ${res.status}: ${att.url}`); return; }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const savedAt = new Date().toISOString();
  await storage.bucket(BUCKET).file(gcsPath).save(buffer, { metadata: { contentType, metadata: { savedAt } } });
  await db.collection('homeworkAttachments').doc(`${studentId}_${hw.id}_${att.fileName}`).set({
    filename: att.fileName, gcsPath, originalUrl: att.url, contentType,
    size: buffer.length, savedAt, studentId,
    homeworkId: hw.id, homeworkTitle: hw.title,
    homeworkSubject: hw.subject ?? '', homeworkDueDate: hw.dueDate ?? '',
    type: 'homework',
  }, { merge: true });
  console.log(`    ✓ saved: ${att.fileName} (${buffer.length} bytes)`);
}

async function main() {
  console.log(`\n🔍 Backfill homework attachments${DRY_RUN ? ' [DRY RUN — pass --go to apply]' : ''}\n`);
  const users = await getAllowedUsers();
  console.log(`Found ${users.length} user(s)\n`);
  let totalHw = 0, totalAtt = 0;
  for (const user of users) {
    console.log(`── ${user.name} (${user.email}) ──`);
    try {
      const { authHeaders, sessionId, cookieHeader, rawPupils } = await tesLogin(user.email, user.password);
      console.log(`  Logged in, ${rawPupils.length} pupil(s)`);
      for (const p of rawPupils) {
        console.log(`\n  👤 ${p.name}`);
        const homeworks = await getHomeworks(p.id, sessionId, cookieHeader);
        const withAtt = homeworks.filter((h: any) => (h.validated_attachments ?? []).length > 0);
        console.log(`  ${homeworks.length} items, ${withAtt.length} with attachments`);
        for (const h of withAtt) {
          const hw = { id: h.id, title: h.title, subject: h.subject ?? '', dueDate: h.due_date ?? '' };
          console.log(`\n  📚 "${hw.title}" due ${hw.dueDate.split('T')[0]}`);
          totalHw++;
          for (const a of (h.validated_attachments ?? [])) {
            const att = { fileName: a.file_name, url: a.validated_file };
            console.log(`    📎 ${att.fileName}`);
            await saveAttachment(att, hw, p.id, authHeaders);
            totalAtt++;
          }
        }
      }
    } catch (err) { console.error(`  ✗ Error:`, err); }
  }
  console.log(`\n✅ Done — ${totalHw} hw items, ${totalAtt} attachments${DRY_RUN ? ' [DRY RUN]' : ''}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
