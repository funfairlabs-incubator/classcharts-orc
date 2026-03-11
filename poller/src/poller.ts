import { loginAllParents, todayStr, daysAgoStr } from '@classcharts/shared';
import type { CCStudent } from '@classcharts/shared';
import { getState, saveState } from './state.js';
import { sendPushoverToKeys } from './pushover.js';
import { formatHomework, formatHomeworkOverdue, formatHomeworkStatusChange, formatActivity, formatAnnouncement, formatAttendance, formatDetention } from './formatter.js';
import { analyseAnnouncement, summariseHomework, summariseActivity } from './claude.js';
import { ensureCalendarsExist, createCalendarEvents } from './calendar.js';
import { getEnabledKeys } from './prefs.js';
import { archiveAnnouncement } from './archive.js';

export async function pollClassCharts(): Promise<void> {
  const from = daysAgoStr(30);
  const today = todayStr();
  const aheadTo = daysAgoStr(-30);

  const parents = await loginAllParents();
  console.log(`Logged in ${parents.length} parent(s), found ${parents.reduce((n, p) => n + p.pupils.length, 0)} unique pupil(s)`);

  const allStudents: CCStudent[] = parents.flatMap(p => p.pupils);
  let calendarConfig;
  try {
    calendarConfig = await ensureCalendarsExist(allStudents.map(s => ({ id: s.id, name: s.name })));
  } catch (err) {
    console.warn('Calendar setup failed (non-fatal):', err);
  }

  for (const { client, pupils } of parents) {
    for (const pupil of pupils) {
      client.selectPupil(pupil.id);
      const state = await getState(pupil.id);
      let changed = false;
      console.log(`Polling ${pupil.name} (${pupil.id})...`);

      // ── Activity (behaviour) ─────────────────────────────────
      if (pupil.displayBehaviour) {
        try {
          const activity = await client.getActivity(from, today);
          const newPoints = activity.filter(a => a.id > state.lastActivityId);
          if (newPoints.length > 0) {
            const keys = await getEnabledKeys('behaviour');
            for (const point of newPoints) {
              const summary = await summariseActivity(point, pupil.name);
              await sendPushoverToKeys(keys, formatActivity(point, pupil.name, summary));
            }
            state.lastActivityId = Math.max(...newPoints.map(a => a.id));
            changed = true;
          }
        } catch (err) { console.error(`  Activity poll failed for ${pupil.name}:`, err); }
      }

      // ── Homework ─────────────────────────────────────────────
      if (pupil.displayHomework) {
        try {
          const homeworks = await client.getHomeworks(from, aheadTo);

          // New homework
          const newHomeworks = homeworks.filter(h => h.id > state.lastHomeworkId);
          if (newHomeworks.length > 0) {
            const keys = await getEnabledKeys('homeworkNew');
            for (const hw of newHomeworks) {
              const summary = await summariseHomework(hw);
              await sendPushoverToKeys(keys, formatHomework(hw, pupil.name, summary));
            }
            state.lastHomeworkId = Math.max(...newHomeworks.map(h => h.id));
            changed = true;
          }

          // Overdue
          const knownOverdueIds: number[] = (state as any).knownOverdueIds ?? [];
          const overdueItems = homeworks.filter(h =>
            new Date(h.dueDate) < new Date() &&
            h.status !== 'completed' && !h.ticked &&
            !knownOverdueIds.includes(h.id)
          );
          if (overdueItems.length > 0) {
            const keys = await getEnabledKeys('homeworkNew'); // overdue uses same toggle
            for (const hw of overdueItems) {
              await sendPushoverToKeys(keys, formatHomeworkOverdue(hw, pupil.name));
            }
            (state as any).knownOverdueIds = [...knownOverdueIds, ...overdueItems.map(h => h.id)].slice(-100);
            changed = true;
          }

          // Status changes (submitted / completed)
          const knownStatuses: Record<number, string> = (state as any).homeworkStatuses ?? {};
          const statusChanges = homeworks.filter(h => {
            const prev = knownStatuses[h.id];
            const curr = h.status ?? (h.ticked ? 'ticked' : 'pending');
            return prev !== undefined && prev !== curr;
          });
          if (statusChanges.length > 0) {
            const keys = await getEnabledKeys('homeworkStatusChange');
            for (const hw of statusChanges) {
              const prev = knownStatuses[hw.id];
              const curr = hw.status ?? (hw.ticked ? 'ticked' : 'pending');
              await sendPushoverToKeys(keys, formatHomeworkStatusChange(hw, pupil.name, prev, curr));
            }
            changed = true;
          }
          // Record current statuses for all homework
          for (const hw of homeworks) {
            knownStatuses[hw.id] = hw.status ?? (hw.ticked ? 'ticked' : 'pending');
          }
          // Prune old entries (keep last 200)
          const sortedKeys = Object.keys(knownStatuses).map(Number).sort((a, b) => b - a).slice(0, 200);
          const pruned: Record<number, string> = {};
          for (const k of sortedKeys) pruned[k] = knownStatuses[k];
          (state as any).homeworkStatuses = pruned;
          changed = true;

        } catch (err) { console.error(`  Homework poll failed for ${pupil.name}:`, err); }
      }

      // ── Announcements ────────────────────────────────────────
      if (pupil.displayAnnouncements) {
        try {
          const announcements = await client.getAnnouncements();
          const newAnnouncements = announcements.filter(a => a.id > state.lastAnnouncementId);
          if (newAnnouncements.length > 0) {
            const keys = await getEnabledKeys('announcements');
            for (const ann of newAnnouncements) {
              const analysis = await analyseAnnouncement(ann, pupil.id, pupil.name);
              await archiveAnnouncement(ann, pupil.id, analysis);
              let calendarAdded = false;
              if (analysis.calendarEvents.length > 0 && calendarConfig) {
                try { await createCalendarEvents(analysis.calendarEvents, calendarConfig); calendarAdded = true; }
                catch (err) { console.error('  Calendar event creation failed:', err); }
              }
              await sendPushoverToKeys(keys, formatAnnouncement(ann, pupil.name, analysis.summary, analysis.requiresAction, analysis.actionDescription, calendarAdded));
            }
            state.lastAnnouncementId = Math.max(...newAnnouncements.map(a => a.id));
            changed = true;
          }
        } catch (err) { console.error(`  Announcements poll failed for ${pupil.name}:`, err); }
      }

      // ── Attendance ───────────────────────────────────────────
      if (pupil.displayAttendance) {
        try {
          const attendance = await client.getAttendance(today, today);
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
            const keys = await getEnabledKeys('attendance');
            const newDays = attendance.days.filter(d =>
              Object.entries(d.sessions).some(([sess, info]) => newAlerts.includes(`${d.date}:${sess}:${info.status}`))
            );
            for (const day of newDays) {
              const msg = formatAttendance(day, pupil.name);
              if (msg) await sendPushoverToKeys(keys, msg);
            }
            (state as any).knownAttendanceKeys = [...knownAttendanceKeys, ...newAlerts].slice(-200);
            changed = true;
          }
        } catch (err) { console.error(`  Attendance poll failed for ${pupil.name}:`, err); }
      }

      // ── Detentions ───────────────────────────────────────────
      if (pupil.displayDetentions) {
        try {
          const detentions = await client.getDetentions();
          const knownIds: number[] = (state as any).knownDetentionIds ?? [];
          const newDetentions = detentions.filter(d => !knownIds.includes(d.id));
          if (newDetentions.length > 0) {
            const keys = await getEnabledKeys('detentions');
            for (const det of newDetentions) await sendPushoverToKeys(keys, formatDetention(det, pupil.name));
            (state as any).knownDetentionIds = [...knownIds, ...newDetentions.map(d => d.id)].slice(-50);
            changed = true;
          }
        } catch (err) { console.error(`  Detentions poll failed for ${pupil.name}:`, err); }
      }

      if (changed) { state.updatedAt = new Date().toISOString(); await saveState(state); }
    }
  }
}
