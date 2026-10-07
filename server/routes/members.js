import express from 'express';
import { requireAuth } from '../security.js';

export function createMembersRouter(database) {
  const router = express.Router();
  router.get('/', requireAuth, (_request, response) => {
    const members = database.prepare('SELECT id, full_name AS name, role FROM users ORDER BY full_name').all();
    response.json({ members });
  });
  return router;
}