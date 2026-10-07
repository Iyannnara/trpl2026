import { randomBytes } from 'node:crypto';
import express from 'express';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import path from 'node:path';
import { config } from './config.js';
import { database } from './database.js';
import { SQLiteSessionStore } from './session-store.js';
import { verifyCsrf } from './security.js';
import { createAuthRouter } from './routes/auth.js';
import { createMembersRouter } from './routes/members.js';
import { createInformationRouter } from './routes/information.js';
import { createPhotosRouter } from './routes/photos.js';
import { createScheduleRouter } from './routes/schedule.js';
import { createTasksRouter } from './routes/tasks.js';

export const app = express();
app.disable('x-powered-by');
if (config.production) app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'blob:', 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
    },
  },
}));
app.use(express.json({ limit: '24kb', type: 'application/json' }));

const sessionStore = new SQLiteSessionStore(database);
const pruneInterval = setInterval(() => sessionStore.prune(), 15 * 60 * 1000);
pruneInterval.unref();

app.use(session({
  name: 'trpl.sid',
  secret: config.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.production,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  },
}));
app.use('/api', verifyCsrf);

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api/auth', createAuthRouter(database, loginLimiter));
app.use('/api/information', createInformationRouter(database));
app.use('/api/schedule', createScheduleRouter(database));
app.use('/api/tasks', createTasksRouter(database));
app.use('/api/photos', createPhotosRouter(database, uploadLimiter));
app.use('/api/members', createMembersRouter(database));
app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
app.use('/api', (_request, response) => response.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

if (config.production) {
  const clientDirectory = path.join(config.root, 'dist');
  app.use(express.static(clientDirectory, { dotfiles: 'deny', index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_request, response) => response.sendFile(path.join(clientDirectory, 'index.html')));
}

app.use((error, _request, response, _next) => {
  if (response.headersSent) return;
  if (error?.code === 'LIMIT_FILE_SIZE') return response.status(413).json({ error: 'Ukuran foto maksimal 5 MB.' });
  if (error?.name === 'MulterError') return response.status(400).json({ error: 'Unggahan foto tidak valid.' });
  console.error('Request failed.');
  return response.status(500).json({ error: 'Terjadi kesalahan. Coba lagi nanti.' });
});

export { sessionStore };