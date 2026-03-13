import { google } from 'googleapis';
import type { CalendarEvent } from '@classcharts/shared';
import { Storage } from '@google-cloud/storage';

// ── Calendar ID store (GCS) ───────────────────────────────────

interface CalendarConfig {
  familyCalendarId: string;
  studentCalendars: Record<number, string>; // studentId -> calendarId
}

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const CALENDAR_CONFIG_PATH = 'config/calendar-ids.json';

async function getCalendarConfig(): Promise<CalendarConfig | null> {
  try {
    const [content] = await storage
      .bucket(process.env.GCS_BUCKET!)
      .file(CALENDAR_CONFIG_PATH)
      .download();
    return JSON.parse(content.toString()) as CalendarConfig;
  } catch {
    return null;
  }
}

async function saveCalendarConfig(config: CalendarConfig): Promise<void> {
  await storage
    .bucket(process.env.GCS_BUCKET!)
    .file(CALENDAR_CONFIG_PATH)
    .save(JSON.stringify(config, null, 2), { contentType: 'application/json' });
}

// ── Google Calendar auth ──────────────────────────────────────

function getCalendarClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GCAL_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth });
}

// ── Ensure student calendars exist ────────────────────────────

export async function ensureCalendarsExist(
  students: Array<{ id: number; name: string }>,
): Promise<CalendarConfig> {
  const calendar = getCalendarClient();
  let config = await getCalendarConfig();

  if (!config) {
    config = { familyCalendarId: '', studentCalendars: {} };
  }

  // Create family calendar if missing
  if (!config.familyCalendarId) {
    const cal = await calendar.calendars.insert({
      requestBody: { summary: 'Family — School', timeZone: 'Europe/London' },
    });
    config.familyCalendarId = cal.data.id!;
    console.log(`Created family calendar: ${config.familyCalendarId}`);
  }

  // Create per-student calendars if missing
  for (const student of students) {
    if (!config.studentCalendars[student.id]) {
      const cal = await calendar.calendars.insert({
        requestBody: {
          summary: `${student.name} — School`,
          timeZone: 'Europe/London',
        },
      });
      config.studentCalendars[student.id] = cal.data.id!;
      console.log(`Created calendar for ${student.name}: ${cal.data.id}`);
    }
  }

  await saveCalendarConfig(config);
  return config;
}

// ── Create calendar event ─────────────────────────────────────

const EVENT_TYPE_EMOJI: Record<CalendarEvent['eventType'], string> = {
  homework:       '📚',
  trip:           '🚌',
  parents_evening:'👨‍👩‍👧',
  options_day:    '📋',
  term_date:      '🏫',
  announcement:   '📢',
  deadline:       '⚠️',
  other:          '📅',
};

export async function createCalendarEvents(
  events: CalendarEvent[],
  config: CalendarConfig,
): Promise<string[]> {
  const calendar = getCalendarClient();
  const createdIds: string[] = [];

  for (const event of events) {
    const emoji = EVENT_TYPE_EMOJI[event.eventType];
    const title = `${emoji} ${event.title}`;

    const studentCalId = config.studentCalendars[event.studentId];
    const calendarIds = studentCalId ? [studentCalId] : [config.familyCalendarId];

    const eventBody = event.allDay
      ? {
          summary: title,
          description: event.description,
          start: { date: event.date },
          end: { date: event.endDate ?? event.date },
          reminders: {
            useDefault: false,
            overrides: event.eventType === 'deadline'
              ? [{ method: 'popup', minutes: 24 * 60 }, { method: 'popup', minutes: 60 }]
              : [{ method: 'popup', minutes: 9 * 60 }],
          },
        }
      : {
          summary: title,
          description: event.description,
          start: { dateTime: `${event.date}T09:00:00`, timeZone: 'Europe/London' },
          end: { dateTime: `${event.date}T10:00:00`, timeZone: 'Europe/London' },
        };

    // Also create a deadline reminder event if there's a deadlineDate
    const eventsToCreate = [{ calendarIds, body: eventBody }];

    if (event.deadlineDate) {
      eventsToCreate.push({
        calendarIds,
        body: {
          summary: `⚠️ Deadline: ${event.title}`,
          description: `Reply/action required for: ${event.title}`,
          start: { date: event.deadlineDate },
          end: { date: event.deadlineDate },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 24 * 60 },
              { method: 'popup', minutes: 60 },
            ],
          },
        },
      });
    }

    for (const { calendarIds: calIds, body } of eventsToCreate) {
      for (const calId of calIds) {
        try {
          const res = await calendar.events.insert({
            calendarId: calId,
            requestBody: body,
          });
          createdIds.push(res.data.id!);
        } catch (err) {
          console.error(`Failed to create calendar event in ${calId}:`, err);
        }
      }
    }
  }

  return createdIds;
}

// ── Update event titles (e.g. when homework status changes) ──

export async function updateCalendarEventTitles(
  eventIds: string[],
  newTitle: string,
  calendarId: string,
): Promise<void> {
  const calendar = getCalendarClient();
  for (const eventId of eventIds) {
    try {
      // Fetch current event to preserve all other fields
      const { data: existing } = await calendar.events.get({ calendarId, eventId });
      await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: { summary: newTitle },
      });
    } catch (err) {
      console.error(`Failed to update calendar event ${eventId}:`, err);
    }
  }
}
