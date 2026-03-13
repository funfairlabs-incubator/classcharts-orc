#!/usr/bin/env npx ts-node
/**
 * backfill-homework-tasks.ts
 *
 * Creates Google Tasks for all current homework, and calendar events on
 * issue date (replacing any previously created due-date events).
 *
 * Usage (from scripts/):
 *   npm run backfill-homework-tasks           # dry run
 *   npm run backfill-homework-tasks -- --go   # apply
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Storage } from '@google-cloud/storage';
import { google } from 'googleapis';

const DRY_RUN = !process.argv.includes('--go');
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });

// ── Config loaders ────────────────────────────────────────────

async function getCalendarConfig() {
  try {
    const [c] = await storage.bucket(process.env.GCS_BUCKET!).file('config/calendar-ids.json').download();
    return JSON.parse(c.toString());
  } catch { return null; }
}

async function getTasksConfig() {
  try {
    const [c] = await storage.bucket(process.env.GCS_BUCKET!).file('config/tasks-ids.json').download();
    return JSON.parse(c.toString());
  } catch { return { taskLists: {} }; }
}

async function saveTasksConfig(config: any) {
  await storage.bucket(process.env.GCS_BUCKET!).file('config/tasks-ids.json')
    .save(JSON.stringify(config, null, 2), { contentType: 'application/json' });
}

// ── Google clients ────────────────────────────────────────────

function getAuth() {
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GCAL_REFRESH_TOKEN });
  return auth;
}

// ── ClassCharts client (inline, no shared dep path issues) ────

async function getHomework(from: string, to: string) {
  const { ParentClient } = await import('classcharts-api');
  const result: Array<{ pupil: any; homeworks: any[] }> = [];
  const seenIds = new Set<number>();

  for (let i = 1; i <= 5; i++) {
    const email = process.env[`CLASSCHARTS_PARENT${i}_EMAIL`];
    const password = process.env[`CLASSCHARTS_PARENT${i}_PASSWORD`];
    if (!email || !password) continue;

    const client = new ParentClient(email, password);
    await client.login();
    const pupils = await client.getPupils();

    for (const pupil of pupils) {
      if (seenIds.has(pupil.id)) continue;
      seenIds.add(pupil.id);
      client.selectPupil(pupil.id);
      const homeworkRes = await client.getHomeworks({ from, to, displayDate: 'due_date' });
      const homeworks = homeworkRes.data ?? homeworkRes;
      result.push({ pupil, homeworks });
    }
  }

  if (result.length === 0) throw new Error('No parent credentials found in environment');
  return result;
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('DRY RUN — pass --go to apply\n');

  const calConfig = await getCalendarConfig();
  if (!calConfig) {
    console.warn('⚠ No calendar config in GCS — calendar events will be skipped.');
    console.warn('  Check poller logs, or run: gcloud storage ls gs://classcharts-attachments/config/\n');
  } else {
    console.log(`Family calendar: ${calConfig.familyCalendarId}`);
  }

  const tasksConfig = await getTasksConfig();
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  const tasks = google.tasks({ version: 'v1', auth });

  const from = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
  const to   = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
  const data = await getHomework(from, to);

  for (const { pupil, homeworks } of data) {
    console.log(`\n── ${pupil.name} (id: ${pupil.id})`);
    console.log(`   ${homeworks.length} homework item(s) in window\n`);

    // Ensure task list exists
    if (!tasksConfig.taskLists[pupil.id]) {
      if (!DRY_RUN) {
        const list = await tasks.tasklists.insert({ requestBody: { title: `${pupil.name} — Homework` } });
        tasksConfig.taskLists[pupil.id] = list.data.id;
        console.log(`   Created task list: ${pupil.name} — Homework`);
      } else {
        console.log(`   WOULD create task list: ${pupil.name} — Homework`);
      }
    }

    const taskListId = tasksConfig.taskLists[pupil.id];
    const calIds: string[] = calConfig ? [calConfig.familyCalendarId] : [];
    if (calConfig?.studentCalendars?.[pupil.id] && calConfig.studentCalendars[pupil.id] !== calConfig.familyCalendarId) {
      calIds.push(calConfig.studentCalendars[pupil.id]);
    }

    // Fetch existing tasks to avoid dupes
    let existingTaskTitles = new Set<string>();
    if (taskListId) {
      try {
        const res = await tasks.tasks.list({ tasklist: taskListId, maxResults: 500 });
        for (const t of res.data.items ?? []) if (t.title) existingTaskTitles.add(t.title);
      } catch { /* ignore */ }
    }

    for (const hw of homeworks) {
      const issueDate = (hw.issueDate ?? hw.issue_date)?.split('T')[0];
      const dueDate   = (hw.dueDate   ?? hw.due_date)?.split('T')[0];
      if (!issueDate || !dueDate) { console.log(`   SKIP  "${hw.title}" — no dates`); continue; }

      const subject = hw.subject ?? hw.subject_name ?? '';
      const taskTitle = `${pupil.name}: ${subject ? `[${subject}] ` : ''}${hw.title}`;
      const calTitle  = `📚 ${hw.title}`;

      // ── Calendar event on issue date ──
      if (calIds.length > 0) console.log(`   CAL   "${calTitle}" on ${issueDate} (due ${dueDate})`);
      else console.log(`   SKIP  CAL "${calTitle}" — no calendar config`);
      if (!DRY_RUN && calIds.length > 0) {
        for (const calId of calIds) {
          try {
            await calendar.events.insert({
              calendarId: calId,
              requestBody: {
                summary: calTitle,
                description: [
                  subject ? `Subject: ${subject}` : '',
                  `Due: ${dueDate}`,
                  hw.description ?? hw.description ?? '',
                ].filter(Boolean).join('\n'),
                start: { date: issueDate },
                end: { date: issueDate },
                reminders: { useDefault: false, overrides: [] },
              },
            });
          } catch (err: any) { console.error(`     CAL error: ${err.message}`); }
        }
      }

      // ── Google Task ──
      if (existingTaskTitles.has(taskTitle)) {
        console.log(`   SKIP  task "${taskTitle}" already exists`);
        continue;
      }
      const isComplete = hw.status === 'completed' || hw.ticked === true || hw.ticked === 1;
      const isLate     = hw.status === 'late';
      console.log(`   TASK  "${taskTitle}" due ${dueDate} [${hw.status ?? 'pending'}]`);

      if (!DRY_RUN && taskListId) {
        try {
          await tasks.tasks.insert({
            tasklist: taskListId,
            requestBody: {
              title: taskTitle,
              notes: [
                subject ? `Subject: ${subject}` : '',
                `Set: ${new Date(issueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
                hw.description ?? '',
              ].filter(Boolean).join('\n'),
              due: `${dueDate}T00:00:00.000Z`,
              status: isComplete ? 'completed' : 'needsAction',
            },
          });
        } catch (err: any) { console.error(`     TASK error: ${err.message}`); }
      }
    }
  }

  if (!DRY_RUN) await saveTasksConfig(tasksConfig);
  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
