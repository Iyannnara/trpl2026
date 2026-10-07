import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const production = process.env.NODE_ENV === 'production';
const userProvidedSessionSecret = process.env.SESSION_SECRET || '';
const placeholderSecret = userProvidedSessionSecret.startsWith('replace-')
  || userProvidedSessionSecret.length < 32;

if (production && (!userProvidedSessionSecret || placeholderSecret)) {
  throw new Error('SESSION_SECRET must be configured with at least 32 random characters in production.');
}

const sessionSecret = userProvidedSessionSecret && !placeholderSecret
  ? userProvidedSessionSecret
  : randomBytes(32).toString('hex');

export const config = {
  root,
  port: Number(process.env.PORT || 3001),
  production,
  sessionSecret,
  dataDirectory: path.resolve(root, process.env.DATA_DIRECTORY || 'data'),
  databasePath: path.resolve(root, process.env.DATABASE_PATH || 'data/classroom.sqlite'),
  uploadDirectory: path.resolve(root, process.env.UPLOAD_DIRECTORY || 'data/uploads'),
  rosterPath: process.env.ROSTER_XLSX_PATH ? path.resolve(process.env.ROSTER_XLSX_PATH) : '',
  adminNameMatches: (process.env.ADMIN_NAME_MATCHES || '')
    .split(',').map((value) => value.trim()).filter(Boolean),
};