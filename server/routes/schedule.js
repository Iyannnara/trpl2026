import express from 'express';
import { z } from 'zod';
import { requireAdmin } from '../security.js';

const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const scheduleStatuses = ['normal', 'moved', 'cancelled', 'tentative'];
const scheduleSchema = z.object({
  day: z.enum(days),
  course: z.string().trim().min(1).max(160),
  time: z.string().trim().min(1).max(60),
  lecturer: z.string().trim().max(240).nullable().optional(),
  room: z.string().trim().max(180).nullable().optional(),
  status: z.enum(scheduleStatuses).default('normal'),
});

function sendValidationError(response, parsed) {
  return response.status(400).json({ error: 'Data jadwal tidak valid.', fields: parsed.error.flatten().fieldErrors });
}

export function createScheduleRouter(database) {
  const router = express.Router();

  router.get('/', (_request, response) => {
    response.json({ schedule: database.prepare('SELECT id, day, course, time, lecturer, room, status FROM class_schedule ORDER BY CASE day WHEN ? THEN 1 WHEN ? THEN 2 WHEN ? THEN 3 WHEN ? THEN 4 WHEN ? THEN 5 WHEN ? THEN 6 ELSE 7 END, time')
      .all('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu') });
  });

  router.post('/', requireAdmin, (request, response) => {
    const parsed = scheduleSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(response, parsed);
    const result = database.prepare(`
      INSERT INTO class_schedule (day, course, time, lecturer, room, status) VALUES (?, ?, ?, ?, ?, ?)
    `).run(parsed.data.day, parsed.data.course, parsed.data.time, parsed.data.lecturer ?? null, parsed.data.room ?? null, parsed.data.status);
    return response.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  router.patch('/:id', requireAdmin, (request, response) => {
    const id = Number(request.params.id);
    const parsed = scheduleSchema.partial().safeParse(request.body);
    if (!Number.isSafeInteger(id) || id < 1 || !parsed.success || Object.keys(parsed.data).length === 0) {
      return response.status(400).json({ error: 'Data jadwal tidak valid.' });
    }
    const columns = { day: 'day', course: 'course', time: 'time', lecturer: 'lecturer', room: 'room', status: 'status' };
    const entries = Object.entries(parsed.data);
    const assignments = entries.map(([key]) => `${columns[key]} = ?`).join(', ');
    const values = entries.map(([, value]) => value);
    const result = database.prepare(`UPDATE class_schedule SET ${assignments} WHERE id = ?`).run(...values, id);
    if (!result.changes) return response.status(404).json({ error: 'Jadwal tidak ditemukan.' });
    return response.status(204).end();
  });

  router.delete('/:id', requireAdmin, (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return response.status(400).json({ error: 'ID jadwal tidak valid.' });
    const result = database.prepare('DELETE FROM class_schedule WHERE id = ?').run(id);
    if (!result.changes) return response.status(404).json({ error: 'Jadwal tidak ditemukan.' });
    return response.status(204).end();
  });

  return router;
}