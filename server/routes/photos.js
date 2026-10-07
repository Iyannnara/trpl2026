import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import fileUpload from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';
import { config } from '../config.js';
import { currentUser, requireAuth } from '../security.js';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const captionSchema = z.string().trim().max(160).default('');
const upload = fileUpload({
  storage: fileUpload.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, fieldSize: 1024 },
});

function photoRow(database, id) {
  return database.prepare(`
    SELECT p.id, p.caption, p.mime_type AS mimeType, p.created_at AS createdAt,
      p.user_id AS uploaderId, u.full_name AS uploaderName
    FROM photos p JOIN users u ON u.id = p.user_id WHERE p.id = ?
  `).get(id);
}

export function createPhotosRouter(database, uploadLimiter) {
  const router = express.Router();

  router.get('/', (request, response) => {
    const photos = database.prepare(`
      SELECT p.id, p.caption, p.mime_type AS mimeType, p.created_at AS createdAt,
        p.user_id AS uploaderId, u.full_name AS uploaderName
      FROM photos p JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC, p.id DESC
    `).all().map((photo) => ({
      ...photo,
      canDelete: request.session.user?.id === photo.uploaderId || request.session.user?.role === 'admin',
      url: `/api/photos/${photo.id}/content`,
    }));
    return response.json({ photos });
  });

  router.get('/:id/content', async (request, response) => {
    const photo = photoRow(database, request.params.id);
    if (!photo) return response.status(404).json({ error: 'Foto tidak ditemukan.' });
    const fileName = database.prepare('SELECT file_name FROM photos WHERE id = ?').get(request.params.id).file_name;
    try {
      const file = await readFile(path.join(config.uploadDirectory, fileName));
      response.set('Content-Type', photo.mimeType);
      response.set('Content-Disposition', `inline; filename="photo-${request.params.id}"`);
      response.set('Cache-Control', 'public, max-age=3600');
      response.set('X-Content-Type-Options', 'nosniff');
      return response.send(file);
    } catch {
      return response.status(404).json({ error: 'Foto tidak ditemukan.' });
    }
  });

  router.post('/', uploadLimiter, requireAuth, upload.single('photo'), async (request, response) => {
    const caption = captionSchema.safeParse(request.body.caption ?? '');
    if (!caption.success) return response.status(400).json({ error: 'Keterangan foto tidak valid.' });
    if (!request.file) return response.status(400).json({ error: 'Pilih foto terlebih dahulu.' });

    const detectedType = await fileTypeFromBuffer(request.file.buffer);
    if (!detectedType || !allowedTypes.has(detectedType.mime)) {
      return response.status(415).json({ error: 'Unggah file JPG, PNG, atau WebP yang valid.' });
    }

    const id = randomUUID();
    const fileName = `${randomUUID()}.${detectedType.ext}`;
    const filePath = path.join(config.uploadDirectory, fileName);
    await mkdir(config.uploadDirectory, { recursive: true, mode: 0o700 });
    try {
      await writeFile(filePath, request.file.buffer, { flag: 'wx', mode: 0o600 });
      database.prepare(`
        INSERT INTO photos (id, user_id, caption, file_name, mime_type) VALUES (?, ?, ?, ?, ?)
      `).run(id, currentUser(request).id, caption.data, fileName, detectedType.mime);
    } catch (error) {
      await unlink(filePath).catch(() => {});
      throw error;
    }

    return response.status(201).json({
      photo: { ...photoRow(database, id), canDelete: true, url: `/api/photos/${id}/content` },
    });
  });

  router.delete('/:id', requireAuth, (request, response) => {
    const photo = database.prepare('SELECT id, user_id, file_name FROM photos WHERE id = ?').get(request.params.id);
    if (!photo) return response.status(404).json({ error: 'Foto tidak ditemukan.' });
    if (photo.user_id !== currentUser(request).id && currentUser(request).role !== 'admin') {
      return response.status(403).json({ error: 'Akses tidak diizinkan.' });
    }
    database.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
    unlink(path.join(config.uploadDirectory, photo.file_name)).catch(() => {});
    return response.status(204).end();
  });

  return router;
}