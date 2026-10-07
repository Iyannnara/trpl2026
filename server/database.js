import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { config } from './config.js';
import { schedule } from '../src/schedule.js';

mkdirSync(config.dataDirectory, { recursive: true, mode: 0o700 });
mkdirSync(config.uploadDirectory, { recursive: true, mode: 0o700 });

export const database = new Database(config.databasePath);
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');

database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    name_key TEXT NOT NULL,
    nim_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS users_name_key_idx ON users(name_key);

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS class_schedule (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    course TEXT NOT NULL,
    time TEXT NOT NULL,
    lecturer TEXT,
    room TEXT,
    status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'moved', 'cancelled', 'tentative'))
  );

  CREATE TABLE IF NOT EXISTS information_announcements (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('mandatory_activity', 'public_holiday')),
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    event_date TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    course TEXT NOT NULL,
    description TEXT NOT NULL,
    deadline TEXT NOT NULL,
    place TEXT,
    submission_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS task_completions (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    caption TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const scheduleColumns = database.pragma('table_info(class_schedule)');
if (!scheduleColumns.some(({ name }) => name === 'status')) {
  database.exec(`ALTER TABLE class_schedule ADD COLUMN status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'moved', 'cancelled', 'tentative'))`);
}

const scheduleCount = database.prepare('SELECT COUNT(*) AS total FROM class_schedule').get().total;
if (scheduleCount === 0) {
  const insertSchedule = database.prepare(`
    INSERT INTO class_schedule (day, course, time, lecturer, room)
    VALUES (?, ?, ?, ?, ?)
  `);
  const seedSchedule = database.transaction(() => {
    for (const day of schedule) {
      for (const item of day.classes) {
        insertSchedule.run(day.day, item.course, item.time, item.lecturer, item.room);
      }
    }
  });
  seedSchedule();
}