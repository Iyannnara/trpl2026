import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import argon2 from 'argon2';
import Database from 'better-sqlite3';
import ExcelJS from 'exceljs';

test('roster importer hashes NIM, removes phone numbers, and matches admin selectors', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'trpl-roster-test-'));
  const workbookPath = path.join(directory, 'synthetic-roster.xlsx');
  const databasePath = path.join(directory, 'classroom.sqlite');
  const worksheet = new ExcelJS.Workbook().addWorksheet('Kelas');
  worksheet.addRow(['NIM', 'Nama']);
  worksheet.addRow(['1234567890', 'Kezia Aura Nafiza (081234567890)']);
  worksheet.addRow(['2345678901', 'I Gusti Ayu Diah Permata Sukmahartawan (081298765432)']);
  await worksheet.workbook.xlsx.writeFile(workbookPath);

  const result = spawnSync(process.execPath, ['scripts/import-roster.js', workbookPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SESSION_SECRET: 'test-session-secret-that-is-longer-than-32-bytes',
      DATA_DIRECTORY: directory,
      DATABASE_PATH: databasePath,
      UPLOAD_DIRECTORY: path.join(directory, 'uploads'),
      ADMIN_NAME_MATCHES: 'Aura,I Gusti Ayu Diah Permata Sukmahartawan',
    },
  });

  try {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Imported 2 roster accounts; 2 admin roles assigned\./);
    const database = new Database(databasePath);
    const users = database.prepare('SELECT full_name, name_key, nim_hash, role FROM users ORDER BY full_name').all();
    database.close();

    assert.deepEqual(users.map(({ full_name, role }) => [full_name, role]), [
      ['I Gusti Ayu Diah Permata Sukmahartawan', 'admin'],
      ['Kezia Aura Nafiza', 'admin'],
    ]);
    assert.equal(await argon2.verify(users[1].nim_hash, '1234567890'), true);
    assert.equal(users.some(({ full_name }) => full_name.includes('0812')), false);
    const databaseBytes = await readFile(databasePath);
    assert.equal(databaseBytes.includes(Buffer.from('1234567890')), false);
    assert.equal(databaseBytes.includes(Buffer.from('2345678901')), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('development mode tolerates placeholder session secrets by generating a secure fallback', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSessionSecret = process.env.SESSION_SECRET;

  process.env.NODE_ENV = 'development';
  process.env.SESSION_SECRET = 'replace-with-a-random-secret-of-at-least-32-characters';

  try {
    const { config } = await import(`../server/config.js?development-placeholder-${Date.now()}`);
    assert.equal(config.production, false);
    assert.ok(config.sessionSecret.length >= 32);
    assert.notEqual(config.sessionSecret, 'replace-with-a-random-secret-of-at-least-32-characters');
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
  }
});

test('roster importer reads rows after title blocks and header columns in real workbook layout', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'trpl-roster-layout-'));
  const workbookPath = path.join(directory, 'roster.xlsx');
  const databasePath = path.join(directory, 'classroom.sqlite');
  const worksheet = new ExcelJS.Workbook().addWorksheet('Sheet1');

  for (let i = 1; i <= 12; i += 1) {
    worksheet.addRow(['', '', '', '', '', '', '', '', '', '', '']);
  }
  worksheet.addRow(['', 'No', 'NIM', 'Nama', '', '', '', '', '', '', '']);
  worksheet.addRow(['', 'No', 'NIM', 'Nama', '1', '2', '3', '4', '5', '6', '7']);
  worksheet.addRow(['', '', '', '', '', '', '', '', '', '', '']);
  worksheet.addRow(['', '1', '1234567890', 'Kezia Aura Nafiza', '', '', '', '', '', '', '']);
  worksheet.addRow(['', '2', '2345678901', 'I Gusti Ayu Diah Permata Sukmahartawan', '', '', '', '', '', '', '']);
  worksheet.addRow(['', '', '', '', '', '', '', '', '', '', '']);

  await worksheet.workbook.xlsx.writeFile(workbookPath);

  const result = spawnSync(process.execPath, ['scripts/import-roster.js', workbookPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SESSION_SECRET: 'test-session-secret-that-is-longer-than-32-bytes',
      DATA_DIRECTORY: directory,
      DATABASE_PATH: databasePath,
      UPLOAD_DIRECTORY: path.join(directory, 'uploads'),
      ADMIN_NAME_MATCHES: 'Aura,I Gusti Ayu Diah Permata Sukmahartawan',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Imported 2 roster accounts; 2 admin roles assigned\./);
  assert.doesNotMatch(result.stdout, /1234567890|2345678901/);
});