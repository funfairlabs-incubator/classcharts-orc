import { google } from 'googleapis';
import { Storage } from '@google-cloud/storage';

// ── Task list ID store (GCS, alongside calendar config) ───────

interface TasksConfig {
  taskLists: Record<number, string>; // studentId -> taskListId
}

const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
const TASKS_CONFIG_PATH = 'config/tasks-ids.json';

async function getTasksConfig(): Promise<TasksConfig> {
  try {
    const [content] = await storage
      .bucket(process.env.GCS_BUCKET!)
      .file(TASKS_CONFIG_PATH)
      .download();
    return JSON.parse(content.toString()) as TasksConfig;
  } catch {
    return { taskLists: {} };
  }
}

async function saveTasksConfig(config: TasksConfig): Promise<void> {
  await storage
    .bucket(process.env.GCS_BUCKET!)
    .file(TASKS_CONFIG_PATH)
    .save(JSON.stringify(config, null, 2), { contentType: 'application/json' });
}

// ── Google Tasks auth ─────────────────────────────────────────

function getTasksClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  // Tasks uses the same refresh token — must have been issued with tasks scope
  auth.setCredentials({ refresh_token: process.env.GCAL_REFRESH_TOKEN });
  return google.tasks({ version: 'v1', auth });
}

// ── Ensure per-student task lists exist ───────────────────────

export async function ensureTaskListsExist(
  students: Array<{ id: number; name: string }>,
): Promise<TasksConfig> {
  const tasks = getTasksClient();
  const config = await getTasksConfig();

  for (const student of students) {
    if (!config.taskLists[student.id]) {
      const list = await tasks.tasklists.insert({
        requestBody: { title: `${student.name} — Homework` },
      });
      config.taskLists[student.id] = list.data.id!;
      console.log(`Created task list for ${student.name}: ${list.data.id}`);
    }
  }

  await saveTasksConfig(config);
  return config;
}

// ── Create a homework task ────────────────────────────────────

export interface HomeworkTask {
  homeworkId: number;
  title: string;
  subject: string;
  dueDate: string;       // YYYY-MM-DD
  issueDate: string;     // YYYY-MM-DD
  studentId: number;
  studentName: string;
  description?: string;
}

export async function createHomeworkTask(
  hw: HomeworkTask,
  config: TasksConfig,
): Promise<string | null> {
  const tasks = getTasksClient();
  const taskListId = config.taskLists[hw.studentId];
  if (!taskListId) {
    console.error(`No task list for student ${hw.studentId}`);
    return null;
  }

  const notes = [
    `Subject: ${hw.subject}`,
    `Set: ${formatDate(hw.issueDate)}`,
    hw.description ? `\n${hw.description.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()}` : '',
  ].filter(Boolean).join('\n');

  // Tasks API due date must be an RFC 3339 timestamp (midnight UTC)
  const due = `${hw.dueDate}T00:00:00.000Z`;

  try {
    const task = await tasks.tasks.insert({
      tasklist: taskListId,
      requestBody: {
        title: `${hw.studentName}: ${hw.subject ? `[${hw.subject}] ` : ''}${hw.title}`,
        notes,
        due,
        status: 'needsAction',
      },
    });
    console.log(`  Created task "${hw.title}" for ${hw.studentName} (due ${hw.dueDate})`);
    return task.data.id ?? null;
  } catch (err) {
    console.error(`  Failed to create task for homework ${hw.homeworkId}:`, err);
    return null;
  }
}

// ── Update task status when homework status changes ───────────

export type HomeworkStatus = 'completed' | 'late' | 'not_completed' | 'ticked' | 'pending';

export async function updateHomeworkTaskStatus(
  taskId: string,
  studentId: number,
  newStatus: HomeworkStatus,
  config: TasksConfig,
): Promise<void> {
  const tasks = getTasksClient();
  const taskListId = config.taskLists[studentId];
  if (!taskListId) return;

  const isComplete = newStatus === 'completed' || newStatus === 'ticked';

  try {
    await tasks.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      requestBody: {
        status: isComplete ? 'completed' : 'needsAction',
        // Clear completion date if reverting (unlikely but safe)
        ...(isComplete ? {} : { completed: null }),
      },
    });
    console.log(`  Updated task ${taskId}: ${newStatus} (complete=${isComplete})`);
  } catch (err) {
    console.error(`  Failed to update task ${taskId}:`, err);
  }
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
