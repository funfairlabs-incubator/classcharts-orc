#!/usr/bin/env npx ts-node
/**
 * backfill-homework-calendar.ts
 *
 * Fetches all current homework for each pupil via the ClassCharts API and
 * creates due-date events in the student's Google Calendar.
 *
 * Usage (from scripts/):
 *   npm run backfill-homework-calendar           # dry run
 *   npm run backfill-homework-calendar -- --go   # apply
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Storage } from '@google-cloud/storage';
import { google } from 'googleapis';
import { ParentClient } from '../shared/src/classcharts.js';

const DRY_RUN = !process.argv.includes('--go');
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });

interface CalendarConfig {
  familyCalendarId: string;
  studentCalendars: Record<number, string>;
}

async function getCalendarConfig(): Promise<CalendarConfig | null> {
  try {
    const [content] = await storage
      .bucket(process.env.GCS_BUCKET!)
      .file('config/calendar-ids.json')
      .download();
    return JSON.parse(content.toString());
  } catch {
    return null;
  }
}

function getCalendarClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GCAL_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth });
}

async function getExistingHomeworkTitles(calendar: ReturnType<typeof getCalendarClient>, calId: string): Promise<Set<string>> {
  const titles = new Set<string>();
  try {
    const res = await calendar.events.list({
      calendarId: calId,
      q: '📚',
      maxResults: 500,
      singleEvents: true,
    });
    for (const ev of res.data.items ?? []) {
      if (ev.summary) titles.add(ev.summary);
    }
  } catch { /* ignore */ }
  return titles;
}

async function main() {
  if (DRY_RUN) console.log('DRY RUN — pass --go to apply\n');

  const config = await getCalendarConfig();
  if (!config) { console.error('No calendar config found in GCS'); process.exit(1); }
  console.log(`Family calendar: ${config.familyCalendarId}`);
  console.log(`Student calendars:`, config.studentCalendars, '\n');

  const calendar = getCalendarClient();

  // Load parent credentials
  const email = process.env.CLASSCHARTS_PARENT1_EMAIL!;
  const password = process.env.CLASSCHARTS_PARENT1_PASSWORD!;
  const client = new ParentClient(email, password);
  await client.login();

  const pupils = await client.getPupils();
  console.log(`Found ${pupils.length} pupil(s)\n`);

  const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to   = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

  let created = 0, skipped = 0;

  for (const pupil of pupils) {
    console.log(`── ${pupil.name} (${pupil.id})`);
    const homeworks = await client.getHomeworks(from, to, pupil.id);
    console.log(`   ${homeworks.length} homework item(s) in window`);

    const studentCalId = config.studentCalendars[pupil.id];
    const calIds = [config.familyCalendarId];
    if (studentCalId && studentCalId !== config.familyCalendarId) calIds.push(studentCalId);

    // Check what's already there to avoid dupes
    const existing = await getExistingHomeworkTitles(calendar, config.familyCalendarId);

    for (const hw of homeworks) {
      if (!hw.dueDate) { skipped++; continue; }
      const dueDate = hw.dueDate.split('T')[0];
      const title = `📚 ${hw.title}`;

      if (existing.has(title)) {
        console.log(`   SKIP  ${title} (already in calendar)`);
        skipped++;
        continue;
      }

      const description = [
        hw.subject ? `Subject: ${hw.subject}` : '',
        hw.description ?? '',
      ].filter(Boolean).join('\n');

      const eventBody = {
        summary: title,
        description,
        start: { date: dueDate },
        end: { date: dueDate },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup' as const, minutes: 24 * 60 },  // day before
            { method: 'popup' as const, minutes: 8 * 60 },   // morning of
          ],
        },
      };

      console.log(`   ADD   ${title} → ${dueDate}`);
      if (!DRY_RUN) {
        for (const calId of calIds) {
          try {
            await calendar.events.insert({ calendarId: calId, requestBody: eventBody });
          } catch (err) {
            console.error(`   ERROR creating in ${calId}:`, err);
          }
        }
      }
      created++;
    }
    console.log();
  }

  console.log('─────────────────────────');
  console.log(`${DRY_RUN ? 'Would create' : 'Created'}: ${created}`);
  console.log(`Skipped: ${skipped}`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
