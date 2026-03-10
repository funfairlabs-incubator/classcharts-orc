import type { CCAnnouncement, CCHomework, CCActivityPoint, CalendarEvent } from '@classcharts/shared';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function callClaude(prompt: string, maxTokens = 1000): Promise<string> {
  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }] as ClaudeMessage[],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  return data.content.find(b => b.type === 'text')?.text ?? '';
}

// ── Announcement summary + calendar extraction ────────────────

export interface AnnouncementAnalysis {
  summary: string;          // 2-3 sentence plain-English summary for Pushover
  calendarEvents: CalendarEvent[];
  requiresAction: boolean;
  actionDescription: string | null;
}

export async function analyseAnnouncement(
  announcement: CCAnnouncement,
  studentId: number,
  studentName: string,
): Promise<AnnouncementAnalysis> {
  const text = announcement.descriptionText ?? announcement.title;

  const prompt = `You are a school-parent assistant. Analyse this school announcement and respond ONLY with valid JSON, no preamble or markdown.

Student: ${studentName}
Announcement title: ${announcement.title}
From: ${announcement.teacherName} at ${announcement.schoolName}
Date: ${announcement.timestamp}
Content: ${text}

Respond with this exact JSON structure:
{
  "summary": "2-3 sentence plain English summary suitable for a push notification. Be specific — include dates, costs, deadlines.",
  "requiresAction": true or false,
  "actionDescription": "What the parent needs to do, or null if no action required",
  "calendarEvents": [
    {
      "title": "Event title",
      "date": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD or null",
      "allDay": true,
      "description": "Brief description",
      "deadlineDate": "YYYY-MM-DD or null (for reply-by / consent deadlines)",
      "eventType": "one of: trip | parents_evening | options_day | term_date | announcement | deadline | other"
    }
  ]
}

If there are no calendar-worthy dates, return an empty array for calendarEvents.
For deadlines (reply-by, consent, payment), create a separate event with eventType "deadline".
Today's date is ${new Date().toISOString().split('T')[0]}.`;

  try {
    const raw = await callClaude(prompt, 800);
    const parsed = JSON.parse(raw) as {
      summary: string;
      requiresAction: boolean;
      actionDescription: string | null;
      calendarEvents: Array<{
        title: string;
        date: string;
        endDate: string | null;
        allDay: boolean;
        description: string;
        deadlineDate: string | null;
        eventType: CalendarEvent['eventType'];
      }>;
    };

    return {
      summary: parsed.summary,
      requiresAction: parsed.requiresAction,
      actionDescription: parsed.actionDescription,
      calendarEvents: parsed.calendarEvents.map(e => ({
        title: e.title,
        date: e.date,
        endDate: e.endDate ?? undefined,
        allDay: e.allDay,
        description: e.description,
        deadlineDate: e.deadlineDate ?? undefined,
        eventType: e.eventType,
        sourceAnnouncementId: announcement.id,
        studentId,
      })),
    };
  } catch (err) {
    console.error('Claude announcement analysis failed:', err);
    // Fallback — don't crash the poll
    return {
      summary: announcement.descriptionText?.slice(0, 200) ?? announcement.title,
      requiresAction: announcement.requiresConsent,
      actionDescription: announcement.requiresConsent ? 'Consent required' : null,
      calendarEvents: [],
    };
  }
}

// ── Homework summary ──────────────────────────────────────────

export async function summariseHomework(hw: CCHomework): Promise<string> {
  if (!hw.description || hw.description.length < 50) {
    return hw.description || hw.title;
  }

  const prompt = `Summarise this homework assignment in one concise sentence (max 120 chars) suitable for a push notification. Include the key task and any important details.

Subject: ${hw.subject}
Title: ${hw.title}
Description: ${hw.description}
Due: ${hw.dueDate}

Respond with ONLY the summary sentence, no preamble.`;

  try {
    const summary = await callClaude(prompt, 150);
    return summary.trim().replace(/^["']|["']$/g, '');
  } catch {
    return hw.description.slice(0, 120);
  }
}

// ── Activity (behaviour) summary ──────────────────────────────

export async function summariseActivity(point: CCActivityPoint, studentName: string): Promise<string> {
  // Activity points are usually short — only summarise if there's a long note
  if (!point.note || point.note.length < 80) {
    return point.reason + (point.note ? ` — ${point.note}` : '');
  }

  const prompt = `Summarise this school behaviour note in one sentence (max 120 chars) for a parent push notification.

Reason: ${point.reason}
Note: ${point.note}
Lesson: ${point.lessonName ?? 'unknown'}

Respond with ONLY the summary, no preamble.`;

  try {
    const summary = await callClaude(prompt, 150);
    return summary.trim().replace(/^["']|["']$/g, '');
  } catch {
    return point.reason;
  }
}
