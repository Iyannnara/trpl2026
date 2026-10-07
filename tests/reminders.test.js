import test from 'node:test';
import assert from 'node:assert/strict';
import { collectUpcomingReminders } from '../src/reminders.js';

test('class reminder is due within 15 minutes and uses the next weekly occurrence', () => {
  const now = new Date(2026, 9, 7, 9, 0);
  const schedule = [
    { id: 1, day: 'Rabu', course: 'Sistem Digital', time: '09.15–12.00' },
    { id: 2, day: 'Rabu', course: 'Later class', time: '09.16–12.00' },
  ];

  const reminders = collectUpcomingReminders(schedule, [], now);

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].type, 'class');
  assert.equal(reminders[0].title, 'Sistem Digital');
  assert.equal(reminders[0].remainingMs, 15 * 60 * 1000);
});

test('class that has started is scheduled for next week, not reminded late', () => {
  const now = new Date(2026, 9, 7, 9, 16);
  const reminders = collectUpcomingReminders([
    { id: 1, day: 'Rabu', course: 'Sistem Digital', time: '09.15–12.00' },
  ], [], now);

  assert.deepEqual(reminders, []);
});

test('cancelled classes do not trigger reminders', () => {
  const reminders = collectUpcomingReminders([
    { id: 1, day: 'Rabu', course: 'Cancelled class', time: '09.15–12.00', status: 'cancelled' },
  ], [], new Date(2026, 9, 7, 9, 0));

  assert.deepEqual(reminders, []);
});

test('only incomplete tasks with valid deadlines in the next 24 hours are reminded', () => {
  const now = new Date(2026, 9, 7, 9, 0);
  const tasks = [
    { id: 1, title: 'Due soon', deadline: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), completed: false },
    { id: 2, title: 'Completed', deadline: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), completed: true },
    { id: 3, title: 'Already due', deadline: new Date(now.getTime() - 1000).toISOString(), completed: false },
    { id: 4, title: 'Later', deadline: new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString(), completed: false },
    { id: 5, title: 'Invalid', deadline: 'not-a-date', completed: false },
  ];

  const reminders = collectUpcomingReminders([], tasks, now);

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].type, 'task');
  assert.equal(reminders[0].title, 'Due soon');
  assert.equal(reminders[0].remainingMs, 60 * 60 * 1000);
});