import test from 'node:test';
import assert from 'node:assert/strict';
import { pageMarkup } from '../src/views.js';

test('Information includes mandatory and public notices plus moved or cancelled classes', () => {
  const markup = pageMarkup('information', {
    role: 'member',
    information: [
      { id: 1, category: 'mandatory_activity', title: 'Mandatory activity', details: 'Bring your laptop.', eventDate: '2026-12-25' },
      { id: 2, category: 'public_holiday', title: 'Public holiday', details: '', eventDate: '2026-12-26' },
    ],
    schedule: [
      { id: 3, status: 'moved', course: 'Moved class', day: 'Kamis', time: '08.00–09.00', room: 'Lab A' },
      { id: 4, status: 'cancelled', course: 'Cancelled class', day: 'Jumat', time: '09.00–10.00', room: null },
      { id: 5, status: 'normal', course: 'Regular class', day: 'Senin', time: '10.00–11.00', room: null },
    ],
  }, 'en');

  assert.match(markup, /MANDATORY ACTIVITY/);
  assert.match(markup, /PUBLIC HOLIDAY/);
  assert.match(markup, /CLASS MOVED/);
  assert.match(markup, /CLASS CANCELLED/);
  assert.doesNotMatch(markup, /Regular class/);
  assert.doesNotMatch(markup, /information-form/);
});

test('Information publishing controls are available to admins', () => {
  const markup = pageMarkup('information', { role: 'admin', information: [], schedule: [] }, 'id');

  assert.match(markup, /id="information-form"/);
  assert.match(markup, /Kegiatan wajib/);
  assert.match(markup, /Libur tanggal merah/);
});