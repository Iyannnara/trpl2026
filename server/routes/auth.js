import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import express from 'express';
import { z } from 'zod';
import { normalizeName, issueCsrfToken, requireAuth, currentUser } from '../security.js';

const passwordOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const dummyHash = argon2.hash(randomBytes(32), passwordOptions);
const loginSchema = z.object({
  name: z.string().trim().min(2).max(120),
  nim: z.string().regex(/^\d{6,20}$/),
});

function regenerateSession(session) {
  return new Promise((resolve, reject) => {
    session.regenerate((error) => error ? reject(error) : resolve());
  });
}

export function createAuthRouter(database, loginLimiter) {
  const router = express.Router();

  router.get('/csrf', issueCsrfToken);
  router.get('/session', (request, response) => {
    response.json({ user: request.session.user ? currentUser(request) : null });
  });

  router.post('/login', loginLimiter, async (request, response, next) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: 'Nama atau NIM tidak valid.' });

    try {
      const nameKey = normalizeName(parsed.data.name);
      const candidates = database.prepare('SELECT id, full_name, nim_hash, role FROM users WHERE name_key = ?').all(nameKey);
      let matchedUser = null;
      for (const candidate of candidates) {
        if (await argon2.verify(candidate.nim_hash, parsed.data.nim)) {
          matchedUser = candidate;
          break;
        }
      }
      if (!candidates.length) await argon2.verify(await dummyHash, parsed.data.nim);
      if (!matchedUser) return response.status(401).json({ error: 'Nama atau NIM tidak cocok.' });

      await regenerateSession(request.session);
      request.session.user = { id: matchedUser.id, name: matchedUser.full_name, role: matchedUser.role };
      request.session.csrfToken = randomBytes(32).toString('hex');
      request.session.save((error) => {
        if (error) return next(error);
        return response.json({ user: currentUser(request), csrfToken: request.session.csrfToken });
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', requireAuth, (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error);
      response.clearCookie('trpl.sid', { httpOnly: true, sameSite: 'lax', secure: request.secure, path: '/' });
      return response.status(204).end();
    });
  });

  return router;
}