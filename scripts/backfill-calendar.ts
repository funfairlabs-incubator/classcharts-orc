#!/usr/bin/env npx ts-node
/**
 * One-off backfill: reads all archived announcements from Firestore,
 * runs each through Claude, and creates any missing Google Calendar events.
 *
 * Usage (from repo root):
 *   cd scripts && npx ts-node backfill-calendar.ts
 *   cd scripts && npx ts-node backfill-calendar.ts --dry-run
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { google } from 'googleapis';

const DRY_RUN = process.argv.includes('--dry-run');
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const RATE_LIMIT_MS = 1500;

const db = new Firestore({ projectId: process.env.GCP_PROJECT_ID });
const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });

interface ArchivedAnnouncement {
  id: string;
  studentId: number;
  studentName: string;
  title: string;
  teacherName: string;
  schoolName: string;
  timestamp: string;
  descriptionText?: string;
  requiresConsent?: boolean;
}

interface CalendarConfig {
  familyCalendarId: string;
  studentCalendars: Record<number, string>;
}

function getCalendarClient() {
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GCAL_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth });
}

async function getCalendarConfig(): Promise<CalendarConfig | null> {
  try {
    const [content] = await storage.bucket(process.env.GCS_BUCKET!).file('config/calendar-ids.json').download();
    return JSON.parse(content.toString()) as CalendarConfig;
  } catch { return null; }
}

async function getExistingSourceIds(calendarId: string): Promise<Set<string>> {
  const calendar = getCalendarClient();
  const sources = new Set<string>();
  let pageToken: string | undefined;
  do {
    const res: any = await calendar.events.list({ calendarId, maxResults: 250, pageToken });
    for (const ev of res.data.items ?? []) {
      const match = (ev.description ?? '').match(/src:(\S+)/);
      if (match) sources.add(match[1]);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return sources;
}

async function analyseAnnouncement(ann: ArchivedAnnouncement): Promise<any[]> {
  const text = ann.descriptionText ?? ann.title;
  const prompt = `You are a school-parent assistant. Analyse this announcement and respond ONLY with valid JSON, no preamble.

Student: ${ann.studentName}
Title: ${ann.title}
From: ${ann.teacherName} at ${ann.schoolName}
Date: ${ann.timestamp}
Content: ${text}

Respond with:
{"calendarEvents":[{"title":"...","date":"YYYY-MM-DD","endDate":"YYYY-MM-DD or null","allDay":true,"description":"...","deadlineDate":"YYYY-MM-DD or null","eventType":"trip|parents_evening|options_day|term_date|announcement|deadline|other"}]}

Return empty array if no calendar-worthy dates. Today: ${new Date().toISOString().split('T')[0]}`;

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data: any = await res.json();
  const raw = data.content.find((b: any) => b.type === 'text')?.text ?? '{}';
  const parsed = JSON.parse(raw);
  return (parsed.calendarEvents ?? []).map((e: any) => ({ ...e, description: `${e.description}\nsrc:${ann.id}`, studentId: ann.studentId }));
}

const EMOJI: Record<string, string> = { homework:'📚', trip:'🚌', parents_evening:'👨‍👩‍👧', options_day:'📋', term_date:'🏫', announcement:'📢', deadline:'⚠️', other:'📅' };

async function createEvent(ev: any, config: CalendarConfig) {
  const calendar = getCalendarClient();
  const title = `${EMOJI[ev.eventType] ?? '📅'} ${ev.title}`;
  const calIds = [config.familyCalendarId];
  const studentCal = config.studentCalendars[ev.studentId];
  if (studentCal && studentCal !== config.familyCalendarId) calIds.push(studentCal);
  const body = ev.allDay
    ? { summary: title, description: ev.description, start: { date: ev.date }, end: { date: ev.endDate ?? ev.date } }
    : { summary: title, description: ev.description, start: { dateTime: `${ev.date}T09:00:00`, timeZone: 'Europe/London' }, end: { dateTime: `${ev.date}T10:00:00`, timeZone: 'Europe/London' } };
  for (const calId of calIds) {
    await calendar.events.insert({ calendarId: calId, requestBody: body });
  }
}

async function main() {
  console.log(`\n🔁 Calendar backfill${DRY_RUN ? ' (DRY RUN — nothing will be created)' : ''}\n`);

  const config = await getCalendarConfig();
  if (!config) { console.error('❌ No calendar config in GCS. Run the poller first.'); process.exit(1); }
  console.log(`📅 Family calendar: ${config.familyCalendarId}`);
  console.log(`👩‍🎓 Students: ${JSON.stringify(config.studentCalendars)}\n`);

  const snap = await db.collection('announcements').orderBy('timestamp', 'asc').get();
  const announcements = snap.docs.map(d => ({ id: d.id, ...d.data() } as ArchivedAnnouncement));
  console.log(`📬 ${announcements.length} archived announcements to process\n`);

  const existing = await getExistingSourceIds(config.familyCalendarId);
  console.log(`🔍 ${existing.size} announcements already have calendar entries — skipping those\n`);

  let created = 0, skipped = 0, noEvents = 0, errors = 0;

  for (const ann of announcements) {
    if (existing.has(ann.id)) { skipped++; continue; }

    process.stdout.write(`  "${ann.title.slice(0, 55).padEnd(55)}" ... `);
    try {
      const events = await analyseAnnouncement(ann);
      if (events.length === 0) {
        console.log('— no dates');
        noEvents++;
      } else {
        console.log(`${events.length} event(s)`);
        for (const ev of events) {
          console.log(`      ${ev.eventType.padEnd(16)} "${ev.title}" → ${ev.date}`);
          if (!DRY_RUN) await createEvent(ev, config);
          created++;
        }
      }
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    } catch (err) {
      console.log(`ERROR: ${err}`);
      errors++;
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅  Created:  ${created} calendar events`);
  console.log(`⏭   Skipped:  ${skipped} (already had entries)`);
  console.log(`—   No dates: ${noEvents}`);
  console.log(`❌  Errors:   ${errors}`);
  if (DRY_RUN) console.log(`\n⚠️  Dry run — nothing was actually created. Re-run without --dry-run to apply.`);
  console.log('');
}

main().catch(err => { console.error(err); process.exit(1); });
