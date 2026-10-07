import express from 'express';
import { z } from 'zod';
import { currentUser, requireAdmin, requireAuth } from '../security.js';

const optionalText = (limit) => z.string().trim().max(limit).nullable().optional();
const taskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  course: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).default(''),
  deadline: z.string().datetime({ offset: true }),
  place: optionalText(240),
  submissionUrl: z.string().url().max(2048).refine((value) => new URL(value).protocol === 'https:').nullable().optional(),
});

const completionSchema = z.object({ completed: z.boolean() });
const publicTaskColumns = `
  t.id, t.title, t.course, t.description, t.deadline, t.place,
  t.submission_url AS submissionUrl, COALESCE(c.completed, 0) AS completed
`;

function taskValues(data) {
  return [data.title, data.course, data.description, data.deadline, data.place ?? null, data.submissionUrl ?? null];
}

export function createTasksRouter(database) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', (request, response) => {
    const tasks = database.prepare(`
      SELECT ${publicTaskColumns} FROM tasks t
      LEFT JOIN task_completions c ON c.task_id = t.id AND c.user_id = ?
      ORDER BY t.deadline, t.id
    `).all(currentUser(request).id).map((task) => ({ ...task, completed: Boolean(task.completed) }));
    return response.json({ tasks });
  });

  router.put('/:id/completion', (request, response) => {
    const id = Number(request.params.id);
    const parsed = completionSchema.safeParse(request.body);
    if (!Number.isSafeInteger(id) || id < 1 || !parsed.success) {
      return response.status(400).json({ error: 'Status tugas tidak valid.' });
    }
    const exists = database.prepare('SELECT 1 FROM tasks WHERE id = ?').get(id);
    if (!exists) return response.status(404).json({ error: 'Tugas tidak ditemukan.' });
    database.prepare(`
      INSERT INTO task_completions (task_id, user_id, completed) VALUES (?, ?, ?)
      ON CONFLICT(task_id, user_id) DO UPDATE SET completed = excluded.completed, updated_at = CURRENT_TIMESTAMP
    `).run(id, currentUser(request).id, Number(parsed.data.completed));
    return response.status(204).end();
  });

  router.post('/', requireAdmin, (request, response) => {
    const parsed = taskSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: 'Data tugas tidak valid.', fields: parsed.error.flatten().fieldErrors });
    const result = database.prepare(`
      INSERT INTO tasks (title, course, description, deadline, place, submission_url) VALUES (?, ?, ?, ?, ?, ?)
    `).run(...taskValues(parsed.data));
    return response.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  router.patch('/:id', requireAdmin, (request, response) => {
    const id = Number(request.params.id);
    const parsed = taskSchema.partial().safeParse(request.body);
    if (!Number.isSafeInteger(id) || id < 1 || !parsed.success || Object.keys(parsed.data).length === 0) {
      return response.status(400).json({ error: 'Data tugas tidak valid.' });
    }
    const columns = {
      title: 'title', course: 'course', description: 'description', deadline: 'deadline',
      place: 'place', submissionUrl: 'submission_url',
    };
    const entries = Object.entries(parsed.data);
    const assignments = entries.map(([key]) => `${columns[key]} = ?`).join(', ');
    const result = database.prepare(`UPDATE tasks SET ${assignments} WHERE id = ?`)
      .run(...entries.map(([, value]) => value), id);
    if (!result.changes) return response.status(404).json({ error: 'Tugas tidak ditemukan.' });
    return response.status(204).end();
  });

  router.delete('/:id', requireAdmin, (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return response.status(400).json({ error: 'ID tugas tidak valid.' });
    const result = database.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    if (!result.changes) return response.status(404).json({ error: 'Tugas tidak ditemukan.' });
    return response.status(204).end();
  });

  return router;
}