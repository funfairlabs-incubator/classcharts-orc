import { loginAllParents, todayStr, daysAgoStr } from '@classcharts/shared';
import type { CCStudent } from '@classcharts/shared';
import { getState, saveState, writeHeartbeat } from './state.js';
import { sendNotification } from './notify.js';
import { formatHomework, formatHomeworkOverdue, formatHomeworkStatusChange, formatActivity, formatAnnouncement, formatAttendance, formatDetention } from './formatter.js';
import { analyseAnnouncement, summariseHomework, summariseActivity } from './claude.js';
import { ensureCalendarsExist, createCalendarEvents, updateCalendarEventTitles } from './calendar.js';
import { ensureTaskListsExist, createHomeworkTask, updateHomeworkTaskStatus, type HomeworkStatus } from './tasks.js';
import { getEnabledKeys, getEnabledFcmTokens, getEnabledOneSignalIds } from './prefs.js';
import { archiveAnnouncement, downloadAndSaveAttachments } from './archive.js';

export async function pollClassCharts(): Promise<void> {
  const from = daysAgoStr(30);
  const today = todayStr();
  const aheadTo = daysAgoStr(-30);

  const pollErrors: string[] = [];

  const parents = await loginAllParents();
  console.log(`Logged in ${parents.length} parent(s), found ${parents.reduce((n, p) => n + p.pupils.length, 0)} unique pupil(s)`);

  const allStudents: CCStudent[] = parents.flatMap(p => p.pupils);
  let calendarConfig;
  let tasksConfig;
  try {
    calendarConfig = await ensureCalendarsExist(allStudents.map(s => ({ id: s.id, name: s.name })));
    tasksConfig = await ensureTaskListsExist(allStudents.map(s => ({ id: s.id, name: s.name })));
  } catch (err) {
    console.error('Calendar/Tasks setup failed:', err);
    // Write diagnostic to GCS so we can inspect without log access
    try {
      const { Storage } = await import('@google-cloud/storage');
      const st = new Storage({ projectId: process.env.GCP_PROJECT_ID });
      await st.bucket(process.env.GCS_BUCKET!).file('config/calendar-init-error.txt').save(
        `${new Date().toISOString()}
${String(err)}
${(err as any)?.stack ?? ''}`,
        { contentType: 'text/plain' }
      );
    } catch { /* ignore diagnostic write failure */ }
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
            const fcmTokens = await getEnabledFcmTokens('behaviour');
            const oneSignalIds = await getEnabledOneSignalIds('behaviour');
            for (const point of newPoints) {
              const summary = await summariseActivity(point, pupil.name);
              await sendNotification(keys, fcmTokens, (m => ({ title: m.title, body: m.message, url: m.url }, oneSignalIds))(formatActivity(point, pupil.name, summary)));
            }
            state.lastActivityId = Math.max(...newPoints.map(a => a.id));
            changed = true;
          }
        } catch (err) { const msg = `Activity poll failed for ${pupil.name}: ${String(err)}`; console.error(' ', msg); pollErrors.push(msg); }
      }

      // ── Homework ─────────────────────────────────────────────
      if (pupil.displayHomework) {
        try {
          const homeworks = await client.getHomeworks(from, aheadTo);

          // New homework
          const newHomeworks = homeworks.filter(h => h.id > state.lastHomeworkId);
          if (newHomeworks.length > 0) {
            const keys = await getEnabledKeys('homeworkNew');
            const fcmTokens = await getEnabledFcmTokens('homeworkNew');
            const oneSignalIds = await getEnabledOneSignalIds('homeworkNew');
            for (const hw of newHomeworks) {
              const summary = await summariseHomework(hw);
              await sendNotification(keys, fcmTokens, (m => ({ title: m.title, body: m.message, url: m.url }, oneSignalIds))(formatHomework(hw, pupil.name, summary)));

              // Calendar event on issue date — "homework was set today"
              if (calendarConfig && hw.issueDate) {
                try {
                  const issueDate = hw.issueDate.split('T')[0];
                  const dueDate = hw.dueDate?.split('T')[0] ?? issueDate;
                  const calEvent = {
                    title: `📚 ${hw.title}`,
                    date: issueDate,
                    allDay: true,
                    description: [
                      hw.subject ? `Subject: ${hw.subject}` : '',
                      `Due: ${dueDate}`,
                      summary ?? '',
                    ].filter(Boolean).join('\n'),
                    eventType: 'homework' as const,
                    studentId: pupil.id,
                  };
                  const createdIds = await createCalendarEvents([calEvent], calendarConfig);
                  if (createdIds.length > 0) {
                    const calMap: Record<number, string[]> = (state as any).homeworkCalendarIds ?? {};
                    calMap[hw.id] = createdIds;
                    (state as any).homeworkCalendarIds = calMap;
                  }
                  console.log(`  Added homework to calendar on issue date ${issueDate}: "${hw.title}"`);
                } catch (calErr) {
                  console.error(`  Calendar write failed for homework ${hw.id}:`, calErr);
                }
              }

              // Google Task with due date — actionable, syncable
              if (tasksConfig && hw.dueDate) {
                try {
                  const taskId = await createHomeworkTask({
                    homeworkId: hw.id,
                    title: hw.title,
                    subject: hw.subject ?? '',
                    dueDate: hw.dueDate.split('T')[0],
                    issueDate: hw.issueDate.split('T')[0],
                    studentId: pupil.id,
                    studentName: pupil.name,
                    description: hw.description,
                  }, tasksConfig);
                  if (taskId) {
                    const taskMap: Record<number, string> = (state as any).homeworkTaskIds ?? {};
                    taskMap[hw.id] = taskId;
                    (state as any).homeworkTaskIds = taskMap;
                  }
                } catch (taskErr) {
                  console.error(`  Task creation failed for homework ${hw.id}:`, taskErr);
                }
              }
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
            const keys = await getEnabledKeys('homeworkNew');
            const fcmTokens = await getEnabledFcmTokens('homeworkNew');
            const oneSignalIds = await getEnabledOneSignalIds('homeworkNew'); // overdue uses same toggle
            for (const hw of overdueItems) {
              await sendNotification(keys, fcmTokens, (m => ({ title: m.title, body: m.message, url: m.url }, oneSignalIds))(formatHomeworkOverdue(hw, pupil.name)));
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
            const fcmTokens = await getEnabledFcmTokens('homeworkStatusChange');
            const oneSignalIds = await getEnabledOneSignalIds('homeworkStatusChange');
            const calMap: Record<number, string[]> = (state as any).homeworkCalendarIds ?? {};
            for (const hw of statusChanges) {
              const prev = knownStatuses[hw.id];
              const curr = hw.status ?? (hw.ticked ? 'ticked' : 'pending');
              await sendNotification(keys, fcmTokens, (m => ({ title: m.title, body: m.message, url: m.url }, oneSignalIds))(formatHomeworkStatusChange(hw, pupil.name, prev, curr)));

              // Update calendar event title
              if (calendarConfig && calMap[hw.id]?.length) {
                try {
                  const isComplete = curr === 'completed' || curr === 'ticked';
                  const isLate = curr === 'late';
                  const prefix = isComplete ? '✅' : isLate ? '⚠️' : '📚';
                  await updateCalendarEventTitles(calMap[hw.id], `${prefix} ${hw.title}`, calendarConfig.familyCalendarId);
                  console.log(`  Updated calendar event for "${hw.title}": ${prev} → ${curr}`);
                } catch (calErr) {
                  console.error(`  Calendar update failed for homework ${hw.id}:`, calErr);
                }
              }

              // Update Google Task status
              const taskMap: Record<number, string> = (state as any).homeworkTaskIds ?? {};
              if (tasksConfig && taskMap[hw.id]) {
                try {
                  await updateHomeworkTaskStatus(taskMap[hw.id], pupil.id, curr as HomeworkStatus, tasksConfig);
                } catch (taskErr) {
                  console.error(`  Task status update failed for homework ${hw.id}:`, taskErr);
                }
              }
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

        } catch (err) { const msg = `Homework poll failed for ${pupil.name}: ${String(err)}`; console.error(' ', msg); pollErrors.push(msg); }
      }

      // ── Announcements ────────────────────────────────────────
      if (pupil.displayAnnouncements) {
        try {
          const announcements = await client.getAnnouncements();
          // Use a set of seen IDs to catch announcements regardless of ordering
          if (!state.seenAnnouncementIds) state.seenAnnouncementIds = [];
          const seenSet = new Set(state.seenAnnouncementIds);
          console.log(`  Announcements: ${announcements.length} total, seen=${seenSet.size}, ids=[${announcements.map(a=>a.id).join(',')}]`);
          const newAnnouncements = announcements.filter(a => !seenSet.has(a.id));
          if (newAnnouncements.length > 0) {
            const keys = await getEnabledKeys('announcements');
            const fcmTokens = await getEnabledFcmTokens('announcements');
            const oneSignalIds = await getEnabledOneSignalIds('announcements');
            console.log(`  New announcements: ${newAnnouncements.length}, pushover keys: ${keys.length}, fcm tokens: ${fcmTokens.length}`);
            const authHeaders = client.getAuthHeaders();
            for (const ann of newAnnouncements) {
              // Archive to Firestore + download attachments to GCS
              await archiveAnnouncement(ann, pupil.id, pupil.name);
              if (ann.attachments.length > 0) {
                await downloadAndSaveAttachments(ann, pupil.id, authHeaders);
              }
              const analysis = await analyseAnnouncement(ann, pupil.id, pupil.name);
              let calendarAdded = false;
              if (analysis.calendarEvents.length > 0 && calendarConfig) {
                try { await createCalendarEvents(analysis.calendarEvents, calendarConfig); calendarAdded = true; }
                catch (err) { console.error('  Calendar event creation failed:', err); }
              }
              await sendNotification(keys, fcmTokens, (m => ({ title: m.title, body: m.message, url: m.url }, oneSignalIds))(formatAnnouncement(ann, pupil.name, analysis.summary, analysis.requiresAction, analysis.actionDescription, calendarAdded)));
              seenSet.add(ann.id);
            }
            // Keep last 50 seen IDs to avoid unbounded growth
            state.seenAnnouncementIds = [...seenSet].slice(-200);
            state.lastAnnouncementId = Math.max(...[...seenSet]);
            changed = true;
          }
        } catch (err) { const msg = `Announcements poll failed for ${pupil.name}: ${String(err)}`; console.error(' ', msg); pollErrors.push(msg); }
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
            const fcmTokens = await getEnabledFcmTokens('attendance');
            const oneSignalIds = await getEnabledOneSignalIds('attendance');
            const newDays = attendance.days.filter(d =>
              Object.entries(d.sessions).some(([sess, info]) => newAlerts.includes(`${d.date}:${sess}:${info.status}`))
            );
            for (const day of newDays) {
              const msg = formatAttendance(day, pupil.name);
              if (msg) await sendNotification(keys, fcmTokens, { title: msg.title, body: msg.message, url: msg.url }, oneSignalIds);
            }
            (state as any).knownAttendanceKeys = [...knownAttendanceKeys, ...newAlerts].slice(-200);
            changed = true;
          }
        } catch (err) { const msg = `Attendance poll failed for ${pupil.name}: ${String(err)}`; console.error(' ', msg); pollErrors.push(msg); }
      }

      // ── Detentions ───────────────────────────────────────────
      if (pupil.displayDetentions) {
        try {
          const detentions = await client.getDetentions();
          const knownIds: number[] = (state as any).knownDetentionIds ?? [];
          const newDetentions = detentions.filter(d => !knownIds.includes(d.id));
          if (newDetentions.length > 0) {
            const keys = await getEnabledKeys('detentions');
            const fcmTokens = await getEnabledFcmTokens('detentions');
            const oneSignalIds = await getEnabledOneSignalIds('detentions');
            for (const det of newDetentions) await sendNotification(keys, fcmTokens, (m => ({ title: m.title, body: m.message, url: m.url }, oneSignalIds))(formatDetention(det, pupil.name)));
            (state as any).knownDetentionIds = [...knownIds, ...newDetentions.map(d => d.id)].slice(-50);
            changed = true;
          }
        } catch (err) { const msg = `Detentions poll failed for ${pupil.name}: ${String(err)}`; console.error(' ', msg); pollErrors.push(msg); }
      }

      if (changed) { state.updatedAt = new Date().toISOString(); await saveState(state); }
    }
  }

  // Write heartbeat to Firestore so status page can show last successful poll
  try {
  await writeHeartbeat({
    polledAt: new Date().toISOString(),
    pupils: allStudents.map(s => s.name),
    dependencies: {
      classcharts:    pollErrors.some(e => e.includes('login') || e.includes('TES') || e.includes('401') || e.includes('403')) ? 'error' : 'ok',
      firestore:      pollErrors.some(e => e.includes('Firestore') || e.includes('firestore')) ? 'error' : 'ok',
      gcs:            pollErrors.some(e => e.includes('Storage') || e.includes('GCS') || e.includes('bucket') || e.includes('attachment')) ? 'error' : 'ok',
      pubsub:         'ok', // If poller ran, Pub/Sub delivered successfully
      anthropic:      pollErrors.some(e => e.includes('Anthropic') || e.includes('claude') || e.includes('summarise')) ? 'error' : 'ok',
      fcm:            pollErrors.some(e => e.includes('FCM') || e.includes('firebase') || e.includes('messaging')) ? 'error' : 'ok',
      pushover:       process.env.PUSHOVER_ENABLED !== 'false' ? (pollErrors.some(e => e.includes('Pushover') || e.includes('pushover')) ? 'error' : 'ok') : 'disabled',
      gcal:           pollErrors.some(e => e.includes('Calendar') || e.includes('calendar') || e.includes('calendarConfig')) ? 'error' : 'ok',
      gtasks:         pollErrors.some(e => e.includes('Task') || e.includes('task') || e.includes('tasksConfig')) ? 'error' : 'ok',
      secretmanager:  'ok', // If poller started, secrets were read successfully
    },
    errors: pollErrors.slice(-10),
  });
  console.log('Heartbeat written to Firestore');
  } catch (err) { console.error('Failed to write heartbeat:', err); }
}
