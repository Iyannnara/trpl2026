import express from 'express';
import { z } from 'zod';
import { currentUser, requireAdmin, requireAuth } from '../security.js';

const informationSchema = z.object({
  category: z.enum(['mandatory_activity', 'public_holiday']),
  title: z.string().trim().min(1).max(160),
  details: z.string().trim().max(4000).default(''),
  eventDate: z.iso.date(),
});

export function createInformationRouter(database) {
  const router = express.Router();

  router.get('/', (_request, response) => {
    const announcements = database.prepare(`
      SELECT id, category, title, details, event_date AS eventDate,
        created_at AS createdAt
      FROM information_announcements
      ORDER BY event_date, id DESC
    `).all();
    return response.json({ announcements });
  });

  router.post('/', requireAuth, requireAdmin, (request, response) => {
    const parsed = informationSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({ error: 'Informasi tidak valid.', fields: parsed.error.flatten().fieldErrors });
    }
    const result = database.prepare(`
      INSERT INTO information_announcements (category, title, details, event_date, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(parsed.data.category, parsed.data.title, parsed.data.details, parsed.data.eventDate, currentUser(request).id);
    return response.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  router.delete('/:id', requireAuth, requireAdmin, (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return response.status(400).json({ error: 'ID informasi tidak valid.' });
    const result = database.prepare('DELETE FROM information_announcements WHERE id = ?').run(id);
    if (!result.changes) return response.status(404).json({ error: 'Informasi tidak ditemukan.' });
    return response.status(204).end();
  });

  return router;
}