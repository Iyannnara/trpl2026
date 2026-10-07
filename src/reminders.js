const weekdayNumbers = {
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
  Minggu: 7,
};

const classReminderWindow = 15 * 60 * 1000;
const taskReminderWindow = 24 * 60 * 60 * 1000;

function nextClassStart(item, now) {
  const weekday = weekdayNumbers[item.day];
  const time = String(item.time ?? '').match(/^\s*(\d{1,2})[.:](\d{2})/);
  if (!weekday || !time) return null;

  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (hour > 23 || minute > 59) return null;

  const today = now.getDay() || 7;
  const start = new Date(now);
  start.setDate(start.getDate() + ((weekday - today + 7) % 7));
  start.setHours(hour, minute, 0, 0);
  if (start <= now) start.setDate(start.getDate() + 7);
  return start;
}

export function collectUpcomingReminders(schedule, tasks, now = new Date()) {
  const reminders = [];

  for (const item of schedule) {
    if (item.status === 'cancelled') continue;
    const startsAt = nextClassStart(item, now);
    if (!startsAt) continue;
    const remainingMs = startsAt.getTime() - now.getTime();
    if (remainingMs > classReminderWindow) continue;
    reminders.push({
      key: `class:${item.id ?? `${item.day}:${item.course}:${item.time}`}:${startsAt.getTime()}`,
      type: 'class',
      id: item.id,
      day: item.day,
      time: item.time,
      title: item.course,
      at: startsAt,
      remainingMs,
    });
  }

  for (const task of tasks) {
    if (task.completed) continue;
    const deadline = new Date(task.deadline);
    if (Number.isNaN(deadline.getTime())) continue;
    const remainingMs = deadline.getTime() - now.getTime();
    if (remainingMs <= 0 || remainingMs > taskReminderWindow) continue;
    reminders.push({
      key: `task:${task.id ?? task.title}:${deadline.getTime()}`,
      type: 'task',
      id: task.id,
      title: task.title,
      at: deadline,
      remainingMs,
    });
  }

  return reminders.sort((first, second) => first.at - second.at);
}