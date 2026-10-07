import ExcelJS from 'exceljs';
import argon2 from 'argon2';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../server/config.js';
import { database } from '../server/database.js';
import { normalizeName } from '../server/security.js';

const fallbackRosterCandidates = [
  process.argv[2],
  config.rosterPath,
  path.resolve(config.root, 'data/roster.xlsx'),
  path.resolve(config.root, 'private/roster.xlsx'),
].filter(Boolean);

const rosterPath = fallbackRosterCandidates.find((candidate) => existsSync(candidate)) || fallbackRosterCandidates.at(-1);
if (!rosterPath) throw new Error('Set ROSTER_XLSX_PATH or pass the workbook path as the first argument.');
if (database.prepare('SELECT COUNT(*) AS total FROM users').get().total > 0) {
  throw new Error('The database already has accounts. Import into a fresh database to avoid replacing user data.');
}
if (config.adminNameMatches.length === 0) {
  throw new Error('Set ADMIN_NAME_MATCHES to unique name fragments for the class admins.');
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(rosterPath);
const sheet = workbook.worksheets[0];
if (!sheet) throw new Error('The workbook has no worksheets.');

function cellText(cell) {
  if (!cell) return '';
  const value = cell.text ?? cell.value;
  if (value == null) return '';
  if (typeof value === 'object') {
    return String(value.text ?? value.result ?? '').trim();
  }
  return String(value).trim();
}

let headerRowNumber = -1;
let nimColumnIndex = -1;
let nameColumnIndex = -1;

for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
  const row = sheet.getRow(rowNumber);
  const cells = [];
  for (let columnNumber = 1; columnNumber <= sheet.columnCount; columnNumber += 1) {
    cells.push(cellText(row.getCell(columnNumber)));
  }
  const normalizedCells = cells.map((value) => value.toLowerCase());

  const nimIndex = normalizedCells.findIndex((value) => value.includes('nim'));
  const nameIndex = normalizedCells.findIndex((value) => value.includes('nama'));
  if (nimIndex !== -1 && nameIndex !== -1) {
    headerRowNumber = rowNumber;
    nimColumnIndex = nimIndex + 1;
    nameColumnIndex = nameIndex + 1;
    break;
  }
}

if (headerRowNumber === -1 || nimColumnIndex === -1 || nameColumnIndex === -1) {
  throw new Error('No roster header row with NIM and Nama columns was found.');
}

const rows = [];
for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
  const row = sheet.getRow(rowNumber);
  const nimCell = row.getCell(nimColumnIndex);
  const nameCell = row.getCell(nameColumnIndex);
  const nim = cellText(nimCell).replace(/\s+/g, '').replace(/[^\d]/g, '');
  const rawName = cellText(nameCell);

  if (!nim || !rawName || !rawName.trim()) continue;
  if (!/^\d{6,20}$/.test(nim) || rawName.length < 2) continue;

  const fullName = rawName.replace(/\s*\(\+?\d[\d\s().-]{6,}\)\s*$/, '').trim();
  if (fullName.length < 2 || fullName.length > 120) continue;
  rows.push({ fullName, nameKey: normalizeName(fullName), nim });
}

if (rows.length === 0) throw new Error('No rows with a numeric NIM and student name were found after the roster header.');
if (new Set(rows.map(({ nim }) => nim)).size !== rows.length) throw new Error('The workbook contains duplicate NIM entries.');

const adminIds = new Set();
for (const selector of config.adminNameMatches) {
  const normalizedSelector = normalizeName(selector);
  const matches = rows.filter(({ nameKey }) => nameKey.includes(normalizedSelector));
  if (matches.length !== 1) {
    throw new Error('Each configured admin name must match exactly one roster entry. Check ADMIN_NAME_MATCHES.');
  }
  adminIds.add(matches[0].nim);
}

const passwordOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const hashedRows = [];
for (const row of rows) {
  hashedRows.push({
    fullName: row.fullName,
    nameKey: row.nameKey,
    nimHash: await argon2.hash(row.nim, passwordOptions),
    role: adminIds.has(row.nim) ? 'admin' : 'member',
  });
}

const insertUser = database.prepare(`
  INSERT INTO users (full_name, name_key, nim_hash, role) VALUES (?, ?, ?, ?)
`);
database.transaction((users) => {
  for (const user of users) insertUser.run(user.fullName, user.nameKey, user.nimHash, user.role);
})(hashedRows);

console.log(`Imported ${hashedRows.length} roster accounts; ${adminIds.size} admin roles assigned.`);
database.close();