import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from './config.js';

export type TaskPattern = 'once' | 'daily' | 'weekdays' | 'weekend' | 'holiday' | 'vacation';

export interface Task {
  id: number;
  user_id: string;
  title: string;
  details: string | null;
  pattern: TaskPattern;
  scheduled_date: string | null;
  time: string | null;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  timezone: string;
  reminders_enabled: number;
}

export interface Holiday {
  id: number;
  user_id: string;
  date: string;
  name: string;
}

export interface Vacation {
  id: number;
  user_id: string;
  start_date: string;
  end_date: string;
  name: string;
}

const databasePath = resolve(config.databasePath);
mkdirSync(dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    timezone TEXT NOT NULL,
    reminders_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT,
    pattern TEXT NOT NULL CHECK (pattern IN ('once','daily','weekdays','weekend','holiday','vacation')),
    scheduled_date TEXT,
    time TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_time ON tasks(time) WHERE time IS NOT NULL;

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(user_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_holidays_user_date ON holidays(user_id, date);

  CREATE TABLE IF NOT EXISTS vacations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    name TEXT NOT NULL,
    CHECK (start_date <= end_date)
  );
  CREATE INDEX IF NOT EXISTS idx_vacations_user_dates ON vacations(user_id, start_date, end_date);

  CREATE TABLE IF NOT EXISTS task_completions (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    occurrence_date TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(task_id, occurrence_date)
  );

  CREATE TABLE IF NOT EXISTS reminders_sent (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    occurrence_date TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(task_id, occurrence_date)
  );
`);

const insertDefaultSettings = db.prepare(`
  INSERT INTO user_settings (user_id, timezone, reminders_enabled)
  VALUES (?, ?, 1)
  ON CONFLICT(user_id) DO NOTHING
`);

export function ensureUser(userId: string): UserSettings {
  insertDefaultSettings.run(userId, config.defaultTimezone);
  return db.prepare('SELECT user_id, timezone, reminders_enabled FROM user_settings WHERE user_id = ?')
    .get(userId) as UserSettings;
}

export function setUserTimezone(userId: string, timezone: string): void {
  ensureUser(userId);
  db.prepare('UPDATE user_settings SET timezone = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
    .run(timezone, userId);
}

export function setRemindersEnabled(userId: string, enabled: boolean): void {
  ensureUser(userId);
  db.prepare('UPDATE user_settings SET reminders_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
    .run(enabled ? 1 : 0, userId);
}

export function createTask(input: {
  userId: string;
  title: string;
  details?: string | null;
  pattern: TaskPattern;
  scheduledDate?: string | null;
  time?: string | null;
}): Task {
  ensureUser(input.userId);
  const result = db.prepare(`
    INSERT INTO tasks (user_id, title, details, pattern, scheduled_date, time)
    VALUES (@user_id, @title, @details, @pattern, @scheduled_date, @time)
  `).run({
    user_id: input.userId,
    title: input.title,
    details: input.details ?? null,
    pattern: input.pattern,
    scheduled_date: input.scheduledDate ?? null,
    time: input.time ?? null,
  });
  return getTaskForUser(Number(result.lastInsertRowid), input.userId)!;
}

export function getTaskForUser(taskId: number, userId: string): Task | undefined {
  return db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, userId) as Task | undefined;
}

export function listTasks(userId: string): Task[] {
  return db.prepare(`
    SELECT * FROM tasks WHERE user_id = ?
    ORDER BY CASE WHEN pattern = 'once' THEN 0 ELSE 1 END, scheduled_date, time, id
  `).all(userId) as Task[];
}

export function listRemindableTasks(): Task[] {
  return db.prepare('SELECT * FROM tasks WHERE time IS NOT NULL ORDER BY user_id, time, id').all() as Task[];
}

export function deleteTask(taskId: number, userId: string): boolean {
  return db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(taskId, userId).changes > 0;
}

export function isTaskCompleted(taskId: number, date: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM task_completions WHERE task_id = ? AND occurrence_date = ?')
    .get(taskId, date));
}

export function markTaskCompleted(taskId: number, date: string): boolean {
  return db.prepare(`
    INSERT OR IGNORE INTO task_completions (task_id, occurrence_date) VALUES (?, ?)
  `).run(taskId, date).changes > 0;
}

export function wasReminderSent(taskId: number, date: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM reminders_sent WHERE task_id = ? AND occurrence_date = ?')
    .get(taskId, date));
}

export function markReminderSent(taskId: number, date: string): void {
  db.prepare('INSERT OR IGNORE INTO reminders_sent (task_id, occurrence_date) VALUES (?, ?)')
    .run(taskId, date);
}

export function listHolidays(userId: string): Holiday[] {
  return db.prepare('SELECT * FROM holidays WHERE user_id = ? ORDER BY date, id').all(userId) as Holiday[];
}

export function addHoliday(userId: string, date: string, name: string): void {
  db.prepare(`
    INSERT INTO holidays (user_id, date, name) VALUES (?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET name = excluded.name
  `).run(userId, date, name);
}

export function removeHoliday(userId: string, date: string): boolean {
  return db.prepare('DELETE FROM holidays WHERE user_id = ? AND date = ?').run(userId, date).changes > 0;
}

export function listVacations(userId: string): Vacation[] {
  return db.prepare('SELECT * FROM vacations WHERE user_id = ? ORDER BY start_date, id').all(userId) as Vacation[];
}

export function addVacation(userId: string, startDate: string, endDate: string, name: string): number {
  const result = db.prepare(`
    INSERT INTO vacations (user_id, start_date, end_date, name) VALUES (?, ?, ?, ?)
  `).run(userId, startDate, endDate, name);
  return Number(result.lastInsertRowid);
}

export function removeVacation(userId: string, vacationId: number): boolean {
  return db.prepare('DELETE FROM vacations WHERE user_id = ? AND id = ?').run(userId, vacationId).changes > 0;
}
