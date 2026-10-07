import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import argon2 from 'argon2';
import Database from 'better-sqlite3';

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'trpl-api-test-'));
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-that-is-longer-than-32-bytes';
process.env.DATA_DIRECTORY = temporaryDirectory;
process.env.DATABASE_PATH = path.join(temporaryDirectory, 'test.sqlite');
process.env.UPLOAD_DIRECTORY = path.join(temporaryDirectory, 'uploads');

const legacyDatabase = new Database(process.env.DATABASE_PATH);
legacyDatabase.exec(`
  CREATE TABLE class_schedule (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    course TEXT NOT NULL,
    time TEXT NOT NULL,
    lecturer TEXT,
    room TEXT
  );
`);
legacyDatabase.close();

const [{ app }, { database }] = await Promise.all([
  import('../server/app.js'),
  import('../server/database.js'),
]);

const passwordOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const memberHash = await argon2.hash('123456789', passwordOptions);
const adminHash = await argon2.hash('987654321', passwordOptions);
const secondMemberHash = await argon2.hash('246813579', passwordOptions);
database.prepare('INSERT INTO users (full_name, name_key, nim_hash, role) VALUES (?, ?, ?, ?)')
  .run('Anggota Uji', 'anggota uji', memberHash, 'member');
database.prepare('INSERT INTO users (full_name, name_key, nim_hash, role) VALUES (?, ?, ?, ?)')
  .run('Admin Uji', 'admin uji', adminHash, 'admin');
database.prepare('INSERT INTO users (full_name, name_key, nim_hash, role) VALUES (?, ?, ?, ?)')
  .run('Anggota Kedua', 'anggota kedua', secondMemberHash, 'member');

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

function createClient() {
  let cookie = '';
  let csrfToken = '';

  return {
    async request(pathname, { method = 'GET', json, body, skipCsrf = false } = {}) {
      const headers = {};
      if (cookie) headers.Cookie = cookie;
      if (json !== undefined) headers['Content-Type'] = 'application/json';
      if (!skipCsrf && !['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-CSRF-Token'] = csrfToken;
      const response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers,
        body: json === undefined ? body : JSON.stringify(json),
      });
      const setCookies = response.headers.getSetCookie();
      if (setCookies.length) cookie = setCookies.at(-1).split(';', 1)[0];
      if (response.status === 204) return { response, payload: null };
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.arrayBuffer();
      if (payload.csrfToken) csrfToken = payload.csrfToken;
      return { response, payload };
    },
    async csrf() {
      return this.request('/api/auth/csrf');
    },
    async login(name, nim) {
      return this.request('/api/auth/login', { method: 'POST', json: { name, nim } });
    },
  };
}

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  database.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
});

test('API enforces sessions, roles, completion ownership, and photo validation', async () => {
  const guest = createClient();
  const csrf = await guest.csrf();
  assert.equal(csrf.response.status, 200);
  assert.ok(csrf.response.headers.getSetCookie()[0].includes('HttpOnly'));

  const schedule = await guest.request('/api/schedule');
  assert.equal(schedule.response.status, 200);
  assert.equal(schedule.payload.schedule.length, 7);
  assert.ok(schedule.payload.schedule.every(({ status }) => status === 'normal'));
  const information = await guest.request('/api/information');
  assert.equal(information.response.status, 200);
  assert.deepEqual(information.payload.announcements, []);
  assert.equal((await guest.request('/api/tasks')).response.status, 401);
  assert.equal((await guest.request('/api/schedule', {
    method: 'POST', skipCsrf: true, json: { day: 'Senin', course: 'Tes', time: '08.00-09.00' },
  })).response.status, 403);
  assert.equal((await guest.login('Anggota Uji', '000000000')).response.status, 401);

  const member = createClient();
  await member.csrf();
  const memberLogin = await member.login('Anggota Uji', '123456789');
  assert.equal(memberLogin.response.status, 200);
  assert.equal(memberLogin.payload.user.role, 'member');
  assert.equal('nim' in memberLogin.payload.user, false);
  assert.equal((await member.request('/api/schedule', { method: 'POST', json: {
    day: 'Senin', course: 'Jadwal anggota', time: '08.00–09.00',
  } })).response.status, 403);
  assert.equal((await member.request('/api/information', { method: 'POST', json: {
    category: 'mandatory_activity', title: 'Kegiatan anggota', eventDate: '2026-12-25',
  } })).response.status, 403);
  assert.equal((await member.request('/api/tasks', { method: 'POST', json: {
    title: 'Tidak boleh', course: 'Uji', description: '', deadline: '2026-10-31T12:00:00.000Z',
  } })).response.status, 403);

  const admin = createClient();
  await admin.csrf();
  const adminLogin = await admin.login('Admin Uji', '987654321');
  assert.equal(adminLogin.response.status, 200);
  assert.equal(adminLogin.payload.user.role, 'admin');
  assert.equal((await admin.request('/api/schedule', { method: 'POST', json: {
    day: 'Senin', course: 'Jadwal admin', time: '08.00–09.00', lecturer: null, room: null, status: 'moved',
  } })).response.status, 201);
  const updatedSchedule = await admin.request('/api/schedule');
  const createdScheduleItem = updatedSchedule.payload.schedule.find(({ course }) => course === 'Jadwal admin');
  assert.equal(createdScheduleItem.status, 'moved');
  assert.equal((await admin.request(`/api/schedule/${createdScheduleItem.id}`, {
    method: 'PATCH', json: { status: 'cancelled' },
  })).response.status, 204);
  assert.equal((await admin.request('/api/schedule')).payload.schedule
    .find(({ id }) => id === createdScheduleItem.id).status, 'cancelled');
  assert.equal((await admin.request('/api/schedule', { method: 'POST', json: {
    day: 'Senin', course: 'Status tidak valid', time: '08.00–09.00', status: 'maybe',
  } })).response.status, 400);
  const announcement = await admin.request('/api/information', { method: 'POST', json: {
    category: 'mandatory_activity', title: 'Praktikum wajib', details: 'Bawa laptop.', eventDate: '2026-12-25',
  } });
  assert.equal(announcement.response.status, 201);
  assert.equal((await admin.request('/api/information', { method: 'POST', json: {
    category: 'mandatory_activity', title: 'Tanggal invalid', eventDate: '2026-13-45',
  } })).response.status, 400);
  const publicInformation = await guest.request('/api/information');
  assert.equal(publicInformation.payload.announcements[0].title, 'Praktikum wajib');
  assert.equal((await member.request(`/api/information/${announcement.payload.id}`, { method: 'DELETE' })).response.status, 403);
  assert.equal((await admin.request(`/api/information/${announcement.payload.id}`, { method: 'DELETE' })).response.status, 204);
  const createdTask = await admin.request('/api/tasks', { method: 'POST', json: {
    title: 'Tugas integrasi', course: 'Pemrograman', description: 'Tes API',
    deadline: '2026-10-31T12:00:00.000Z', place: 'Lab', submissionUrl: null,
  } });
  assert.equal(createdTask.response.status, 201);

  const tasks = await member.request('/api/tasks');
  assert.equal(tasks.response.status, 200);
  const taskId = tasks.payload.tasks[0].id;
  assert.equal(tasks.payload.tasks[0].completed, false);
  assert.equal((await member.request(`/api/tasks/${taskId}/completion`, {
    method: 'PUT', json: { completed: true },
  })).response.status, 204);
  assert.equal((await member.request(`/api/tasks/${taskId}`, {
    method: 'PATCH', json: { title: 'Anggota mencoba mengubah isi' },
  })).response.status, 403);
  assert.equal((await member.request('/api/tasks')).payload.tasks[0].completed, true);

  const secondMember = createClient();
  await secondMember.csrf();
  assert.equal((await secondMember.login('Anggota Kedua', '246813579')).response.status, 200);
  assert.equal((await secondMember.request('/api/tasks')).payload.tasks[0].completed, false);

  const fileForm = new FormData();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Z18AAAAASUVORK5CYII=', 'base64');
  fileForm.set('photo', new File([png], 'arbitrary-name.png', { type: 'image/png' }));
  fileForm.set('caption', 'Foto uji');
  const spoofedForm = new FormData();
  spoofedForm.set('photo', new File([Buffer.from('not-an-image')], 'photo.png', { type: 'image/png' }));
  assert.equal((await member.request('/api/photos', { method: 'POST', body: spoofedForm })).response.status, 415);
  const uploaded = await member.request('/api/photos', { method: 'POST', body: fileForm });
  assert.equal(uploaded.response.status, 201);
  assert.match(uploaded.payload.photo.url, /^\/api\/photos\/[0-9a-f-]+\/content$/);
  assert.equal((await guest.request(uploaded.payload.photo.url)).response.status, 200);

  assert.equal((await admin.request('/api/auth/logout', { method: 'POST' })).response.status, 204);
  await admin.csrf();
  assert.equal((await admin.login('Admin Uji', '987654321')).response.status, 200);
});