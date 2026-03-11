import { loginAllParents, todayStr, daysAgoStr } from '@classcharts/shared';
import type { CCStudent, CCHomework } from '@classcharts/shared';
import { getState, saveState } from './state.js';
import { sendPushover } from './pushover.js';
import { formatHomework, formatHomeworkOverdue, formatActivity, formatAnnouncement, formatAttendance, formatDetention } from './formatter.js';
import { analyseAnnouncement, summariseHomework, summariseActivity } from './claude.js';
import { ensureCalendarsExist, createCalendarEvents } from './calendar.js';

export async function pollClassCharts(): Promise<void> {
  const from = daysAgoStr(30);
  const today = todayStr();
  const aheadTo = daysAgoStr(-30);

  const parents = await loginAllParents();
  console.log(`Logged in ${parents.length} parent(s), found ${parents.reduce((n, p) => n + p.pupils.length, 0)} unique pupil(s)`);

  const allStudents: CCStudent[] = parents.flatMap(p => p.pupils);
  let calendarConfig;
  try {
    calendarConfig = await ensureCalendarsExist(
      allStudents.map(s => ({ id: s.id, name: s.name })),
    );
  } catch (err) {
    console.warn('Calendar setup failed (non-fatal):', err);
  }

  for (const { client, pupils } of parents) {
    for (const pupil of pupils) {
      client.selectPupil(pupil.id);
      const state = await getState(pupil.id);
      let changed = false;

      console.log(`Polling ${pupil.name} (${pupil.id})...`);

      // ── Activity (behaviour/notices) ─────────────────────────
      if (pupil.displayBehaviour) {
        try {
          const activity = await client.getActivity(from, today);
          const newPoints = activity.filter(a => a.id > state.lastActivityId);

          for (const point of newPoints) {
            const summary = await summariseActivity(point, pupil.name);
            const msg = formatActivity(point, pupil.name, summary);
            await sendPushover(msg);
          }

          if (newPoints.length > 0) {
            state.lastActivityId = Math.max(...newPoints.map(a => a.id));
            changed = true;
            console.log(`  ${pupil.name}: ${newPoints.length} new activity point(s)`);
          }
        } catch (err) {
          console.error(`  Activity poll failed for ${pupil.name}:`, err);
        }
      }

      // ── Homework ─────────────────────────────────────────────
      if (pupil.displayHomework) {
        try {
          const homeworks = await client.getHomeworks(from, aheadTo);

          // New homework set
          const newHomeworks = homeworks.filter(h => h.id > state.lastHomeworkId);
          for (const hw of newHomeworks) {
            const summary = await summariseHomework(hw);
            const msg = formatHomework(hw, pupil.name, summary);
            await sendPushover(msg);
          }

          if (newHomeworks.length > 0) {
            state.lastHomeworkId = Math.max(...newHomeworks.map(h => h.id));
            changed = true;
            console.log(`  ${pupil.name}: ${newHomeworks.length} new homework(s)`);
          }

          // Overdue homework — alert once per homework ID
          const knownOverdueIds: number[] = (state as any).knownOverdueIds ?? [];
          const overdueItems = homeworks.filter(h => {
            const due = new Date(h.dueDate);
            const isOverdue = due < new Date() && h.status !== 'completed' && !h.ticked;
            return isOverdue && !knownOverdueIds.includes(h.id);
          });

          for (const hw of overdueItems) {
            await sendPushover(formatHomeworkOverdue(hw, pupil.name));
          }

          if (overdueItems.length > 0) {
            (state as any).knownOverdueIds = [
              ...knownOverdueIds,
              ...overdueItems.map(h => h.id),
            ].slice(-100);
            changed = true;
            console.log(`  ${pupil.name}: ${overdueItems.length} newly overdue homework(s)`);
          }
        } catch (err) {
          console.error(`  Homework poll failed for ${pupil.name}:`, err);
        }
      }

      // ── Announcements ────────────────────────────────────────
      if (pupil.displayAnnouncements) {
        try {
          const announcements = await client.getAnnouncements();
          const newAnnouncements = announcements.filter(a => a.id > state.lastAnnouncementId);

          for (const ann of newAnnouncements) {
            const analysis = await analyseAnnouncement(ann, pupil.id, pupil.name);

            let calendarAdded = false;
            if (analysis.calendarEvents.length > 0 && calendarConfig) {
              try {
                await createCalendarEvents(analysis.calendarEvents, calendarConfig);
                calendarAdded = true;
              } catch (err) {
                console.error('  Calendar event creation failed:', err);
              }
            }

            const msg = formatAnnouncement(
              ann, pupil.name, analysis.summary,
              analysis.requiresAction, analysis.actionDescription,
              calendarAdded,
            );
            await sendPushover(msg);
          }

          if (newAnnouncements.length > 0) {
            state.lastAnnouncementId = Math.max(...newAnnouncements.map(a => a.id));
            changed = true;
            console.log(`  ${pupil.name}: ${newAnnouncements.length} new announcement(s)`);
          }
        } catch (err) {
          console.error(`  Announcements poll failed for ${pupil.name}:`, err);
        }
      }

      // ── Attendance ───────────────────────────────────────────
      if (pupil.displayAttendance) {
        try {
          const attendance = await client.getAttendance(today, today);
          // Use composite key: date+session to avoid re-alerting
          const knownAttendanceKeys: string[] = (state as any).knownAttendanceKeys ?? [];
          const newAlerts: string[] = [];

          for (const day of attendance.days) {
            for (const [session, info] of Object.entries(day.sessions)) {
              const key = `${day.date}:${session}:${info.status}`;
              if (!knownAttendanceKeys.includes(key) && (info.status === 'absent' || info.status === 'late')) {
                newAlerts.push(key);
              }
            }
          }

          if (newAlerts.length > 0) {
            const newDays = attendance.days.filter(d =>
              Object.entries(d.sessions).some(([sess, info]) =>
                newAlerts.includes(`${d.date}:${sess}:${info.status}`)
              )
            );
            for (const day of newDays) {
              const msg = formatAttendance(day, pupil.name);
              if (msg) await sendPushover(msg);
            }
            (state as any).knownAttendanceKeys = [...knownAttendanceKeys, ...newAlerts].slice(-200);
            changed = true;
            console.log(`  ${pupil.name}: ${newAlerts.length} new attendance alert(s)`);
          }
        } catch (err) {
          console.error(`  Attendance poll failed for ${pupil.name}:`, err);
        }
      }

      // ── Detentions ───────────────────────────────────────────
      if (pupil.displayDetentions) {
        try {
          const detentions = await client.getDetentions();
          const knownIds: number[] = (state as any).knownDetentionIds ?? [];
          const newDetentions = detentions.filter(d => !knownIds.includes(d.id));

          for (const det of newDetentions) {
            const msg = formatDetention(det, pupil.name);
            await sendPushover(msg);
          }

          if (newDetentions.length > 0) {
            (state as any).knownDetentionIds = [...knownIds, ...newDetentions.map(d => d.id)].slice(-50);
            changed = true;
            console.log(`  ${pupil.name}: ${newDetentions.length} new detention(s)`);
          }
        } catch (err) {
          console.error(`  Detentions poll failed for ${pupil.name}:`, err);
        }
      }

      if (changed) {
        state.updatedAt = new Date().toISOString();
        await saveState(state);
      }
    }
  }
}
