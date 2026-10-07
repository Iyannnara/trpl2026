import './styles.css';
import {
  deletePhoto,
  createInformation,
  deleteInformation,
  deleteScheduleItem,
  deleteTask,
  createScheduleItem,
  fetchMembers,
  fetchSchedule,
  fetchInformation,
  fetchTasks,
  createTask,
  initializeSession,
  login,
  logout,
  setTaskCompletion,
  updateTask,
  updateScheduleItem,
  uploadPhoto,
} from './api.js';
import { showLoadingScreen } from './loading-screen.js';
import { validatePhoto } from './photo-validation.js';
import { collectUpcomingReminders } from './reminders.js';
import { pageMarkup, shellMarkup } from './views.js';

const app = document.querySelector('#app');
const session = { user: null, name: '', role: '', photos: [], schedule: [], tasks: [], members: [], information: [], error: '' };
let activePage = 'home';
let pendingPage = '';
let appLanguage = 'en';
let appTheme = 'light';
let welcomeTypingTimer;
let reminderTimer;
let toastTimer;
const queuedReminderKeys = new Set();
const deliveredReminderKeys = new Set();

try {
  appTheme = window.localStorage.getItem('trpl-theme') === 'dark' ? 'dark' : 'light';
} catch {}
document.documentElement.dataset.theme = appTheme;

function setUser(user) {
  session.user = user;
  session.name = user?.name ?? '';
  session.role = user?.role ?? '';
}

function renderShell() {
  app.innerHTML = shellMarkup(session, activePage, appLanguage, appTheme);
  renderPage();
}

function renderPage() {
  const target = document.querySelector('#page-content');
  if (!target) return;

  const isLoggedIn = Boolean(session.user || session.name);
  if (!isLoggedIn && ['tasks', 'members', 'profile'].includes(activePage)) {
    pendingPage = activePage;
    activePage = 'login';
  }

  target.innerHTML = pageMarkup(activePage, session, appLanguage);
  const welcomeText = target.querySelector('[data-typewriter]');
  if (welcomeText) {
    window.clearInterval(welcomeTypingTimer);
    const message = welcomeText.dataset.typewriter;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      welcomeText.textContent = message;
    } else {
      let characterIndex = 0;
      welcomeTypingTimer = window.setInterval(() => {
        welcomeText.textContent = message.slice(0, ++characterIndex);
        if (characterIndex >= message.length) window.clearInterval(welcomeTypingTimer);
      }, 38);
    }
  }
  document.querySelectorAll('.nav-link').forEach((link) => {
    const isActive = link.dataset.page === activePage;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function showToast(message, duration = 3200) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), duration);
}

function reminderMessage(reminder) {
  const minutes = Math.max(1, Math.ceil(reminder.remainingMs / 60_000));
  if (reminder.type === 'class') {
    return appLanguage === 'en'
      ? `Class starts in ${minutes} minute${minutes === 1 ? '' : 's'}: ${reminder.title}`
      : `Kelas ${reminder.title} dimulai dalam ${minutes} menit.`;
  }

  const duration = minutes < 60
    ? `${minutes} ${appLanguage === 'en' ? (minutes === 1 ? 'minute' : 'minutes') : 'menit'}`
    : `${Math.ceil(minutes / 60)} ${appLanguage === 'en' ? (Math.ceil(minutes / 60) === 1 ? 'hour' : 'hours') : 'jam'}`;
  return appLanguage === 'en'
    ? `Task "${reminder.title}" is due in ${duration}.`
    : `Deadline tugas "${reminder.title}" dalam ${duration}.`;
}

function reminderRecipient() {
  return String(session.user?.id ?? session.name ?? 'guest');
}

function queueUpcomingReminders() {
  const reminders = collectUpcomingReminders(session.schedule, session.user ? session.tasks : []);
  const recipient = reminderRecipient();
  let queuePosition = 0;

  for (const reminder of reminders) {
    const storageKey = `trpl-reminder:${recipient}:${reminder.key}`;
    if (queuedReminderKeys.has(storageKey) || deliveredReminderKeys.has(storageKey)) continue;
    try {
      if (window.localStorage.getItem(storageKey)) {
        deliveredReminderKeys.add(storageKey);
        continue;
      }
    } catch {}

    queuedReminderKeys.add(storageKey);
    const delay = queuePosition * 6500;
    queuePosition += 1;
    window.setTimeout(() => {
      queuedReminderKeys.delete(storageKey);
      if (recipient !== reminderRecipient()) return;

      if (reminder.type === 'task') {
        const task = session.tasks.find((item) => String(item.id) === String(reminder.id));
        if (!task || task.completed || new Date(task.deadline).getTime() !== reminder.at.getTime()) return;
      } else if (!session.schedule.some((item) => (
        String(item.id) === String(reminder.id)
        && item.day === reminder.day
        && item.time === reminder.time
        && item.course === reminder.title
      ))) return;

      deliveredReminderKeys.add(storageKey);
      try {
        window.localStorage.setItem(storageKey, '1');
      } catch {}
      showToast(reminderMessage(reminder), 6000);
    }, delay);
  }
}

function startReminderChecks() {
  window.clearInterval(reminderTimer);
  queueUpcomingReminders();
  reminderTimer = window.setInterval(queueUpcomingReminders, 60_000);
}

async function initializeApp() {
  try {
    const data = await initializeSession();
    setUser(data.user);
    session.photos = data.photos;
    session.schedule = data.schedule;
    session.information = data.announcements;
    if (session.user) {
      try {
        session.tasks = (await fetchTasks()).tasks;
      } catch {
        session.tasks = [];
      }
    }
  } catch {
    session.error = 'Layanan kelas belum tersedia. Coba muat ulang beberapa saat lagi.';
  }
  renderShell();
  startReminderChecks();
  if (session.error) showToast(session.error);
}

async function navigateTo(page) {
  activePage = page;
  session.error = '';
  if (page === 'schedule') {
    try {
      session.schedule = (await fetchSchedule()).schedule;
    } catch (error) {
      session.error = error.message;
    }
  }
  if (page === 'information') {
    try {
      session.information = (await fetchInformation()).announcements;
    } catch (error) {
      session.error = error.message;
    }
  }
  if (session.user && page === 'tasks') {
    try {
      session.tasks = (await fetchTasks()).tasks;
    } catch (error) {
      session.error = error.message;
    }
  }
  if (session.user && page === 'members') {
    try {
      session.members = (await fetchMembers()).members;
    } catch (error) {
      session.error = error.message;
    }
  }
  renderPage();
  queueUpcomingReminders();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (session.error) showToast(session.error);
}

showLoadingScreen(app, initializeApp, appLanguage);

app.addEventListener('click', (event) => {
  const themeToggle = event.target.closest('[data-theme-toggle]');
  if (themeToggle) {
    appTheme = appTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = appTheme;
    try {
      window.localStorage.setItem('trpl-theme', appTheme);
    } catch {}
    const action = appTheme === 'dark'
      ? (appLanguage === 'en' ? 'Switch to light mode' : 'Ganti ke mode terang')
      : (appLanguage === 'en' ? 'Switch to dark mode' : 'Ganti ke mode gelap');
    themeToggle.querySelector('.theme-icon').textContent = appTheme === 'dark' ? '☼' : '☾';
    themeToggle.setAttribute('aria-label', action);
    themeToggle.setAttribute('title', action);
    themeToggle.setAttribute('aria-pressed', String(appTheme === 'dark'));
    return;
  }

  const languageToggle = event.target.closest('[data-language]');
  if (languageToggle) {
    appLanguage = languageToggle.dataset.language === 'en' ? 'en' : 'id';
    renderShell();
    return;
  }

  const pageButton = event.target.closest('[data-page]');
  if (pageButton) {
    navigateTo(pageButton.dataset.page);
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  const isLoggedIn = Boolean(session.user || session.name);
  if (actionButton?.dataset.action === 'login' || (actionButton?.dataset.action === 'upload' && !isLoggedIn)) {
    pendingPage = actionButton.dataset.action === 'upload' ? 'gallery' : 'home';
    activePage = 'login';
    renderPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (actionButton?.dataset.action === 'upload' && isLoggedIn) {
    navigateTo('gallery');
    return;
  }

  if (actionButton?.dataset.action === 'logout') {
    logout().then(() => {
      setUser(null);
      session.tasks = [];
      activePage = 'home';
      renderShell();
    }).catch((error) => showToast(error.message));
    return;
  }

  const removeButton = event.target.closest('[data-remove-photo]');
  if (removeButton) {
    deletePhoto(removeButton.dataset.removePhoto).then(async () => {
      session.photos = (await initializeSession()).photos;
      renderPage();
      showToast('Foto dihapus.');
    }).catch((error) => showToast(error.message));
  }

  const editTaskButton = event.target.closest('[data-edit-task]');
  if (editTaskButton) {
    const task = session.tasks.find(({ id }) => id === Number(editTaskButton.dataset.editTask));
    const form = document.querySelector('#task-form');
    if (!task || !form) return;
    form.elements.taskId.value = task.id;
    form.elements.title.value = task.title;
    form.elements.course.value = task.course;
    form.elements.description.value = task.description;
    form.elements.deadline.value = new Date(task.deadline).toISOString().slice(0, 16);
    form.elements.place.value = task.place ?? '';
    form.elements.submissionUrl.value = task.submissionUrl ?? '';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const editScheduleButton = event.target.closest('[data-edit-schedule]');
  if (editScheduleButton) {
    const item = session.schedule.find(({ id }) => id === Number(editScheduleButton.dataset.editSchedule));
    const form = document.querySelector('#schedule-form');
    if (!item || !form) return;
    form.elements.scheduleId.value = item.id;
    form.elements.day.value = item.day;
    form.elements.course.value = item.course;
    form.elements.time.value = item.time;
    form.elements.status.value = item.status ?? 'normal';
    form.elements.lecturer.value = item.lecturer ?? '';
    form.elements.room.value = item.room ?? '';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const deleteScheduleButton = event.target.closest('[data-delete-schedule]');
  if (deleteScheduleButton && window.confirm('Hapus jadwal ini? Tindakan ini tidak dapat dibatalkan.')) {
    deleteScheduleItem(deleteScheduleButton.dataset.deleteSchedule)
      .then(() => navigateTo('schedule'))
      .catch((error) => showToast(error.message));
  }

  const deleteInformationButton = event.target.closest('[data-delete-information]');
  if (deleteInformationButton && window.confirm('Hapus informasi ini? Tindakan ini tidak dapat dibatalkan.')) {
    deleteInformation(deleteInformationButton.dataset.deleteInformation)
      .then(() => navigateTo('information'))
      .catch((error) => showToast(error.message));
  }

  const deleteTaskButton = event.target.closest('[data-delete-task]');
  if (deleteTaskButton && window.confirm('Hapus tugas ini? Tindakan ini tidak dapat dibatalkan.')) {
    deleteTask(deleteTaskButton.dataset.deleteTask).then(() => navigateTo('tasks')).catch((error) => showToast(error.message));
  }
});

app.addEventListener('change', (event) => {
  const completion = event.target.closest('[data-task-completion]');
  if (!completion) return;
  const task = session.tasks.find(({ id }) => id === Number(completion.dataset.taskCompletion));
  setTaskCompletion(completion.dataset.taskCompletion, completion.checked)
    .then(() => {
      if (task) task.completed = completion.checked;
      showToast(completion.checked ? 'Tugas ditandai selesai.' : 'Status tugas diperbarui.');
    })
    .catch((error) => {
      completion.checked = Boolean(task?.completed);
      showToast(error.message);
    });
});

app.addEventListener('submit', async (event) => {
  if (event.target.id === 'login-form') {
    event.preventDefault();
    const nameField = event.target.elements.name;
    const nimField = event.target.elements.nim;
    const name = nameField.value.trim();
    const nim = nimField.value.trim();
    nimField.value = '';
    if (name.length < 2 || !nim) {
      const error = document.querySelector('#login-error');
      error.textContent = 'Isi nama lengkap dan NIM.';
      error.hidden = false;
      return;
    }
    try {
      const result = await login(name, nim);
      const data = await initializeSession();
      setUser(result.user);
      session.photos = data.photos;
      session.schedule = data.schedule;
      session.information = data.announcements;
      try {
        session.tasks = (await fetchTasks()).tasks;
      } catch {
        session.tasks = [];
      }
      activePage = pendingPage || 'home';
      pendingPage = '';
      renderShell();
      startReminderChecks();
    } catch (error) {
      const message = error.status === 401
        ? 'Nama atau NIM tidak cocok.'
        : error.message || 'Login gagal. Coba lagi.';
      const errorElement = document.querySelector('#login-error');
      if (errorElement) {
        errorElement.textContent = message;
        errorElement.hidden = false;
      }
    }
    return;
  }

  if (event.target.id === 'schedule-form') {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const scheduleId = formData.get('scheduleId');
    const item = {
      day: String(formData.get('day')),
      course: String(formData.get('course')).trim(),
      time: String(formData.get('time')).trim(),
      status: String(formData.get('status')),
      lecturer: String(formData.get('lecturer')).trim() || null,
      room: String(formData.get('room')).trim() || null,
    };
    try {
      if (scheduleId) await updateScheduleItem(scheduleId, item);
      else await createScheduleItem(item);
      await navigateTo('schedule');
      showToast(scheduleId ? 'Perubahan jadwal disimpan.' : 'Jadwal ditambahkan.');
    } catch (error) {
      const errorElement = form.querySelector('#schedule-error');
      errorElement.textContent = error.message || 'Jadwal gagal disimpan.';
      errorElement.hidden = false;
    }
    return;
  }

  if (event.target.id === 'information-form') {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const announcement = {
      category: String(formData.get('category')),
      title: String(formData.get('title')).trim(),
      details: String(formData.get('details')).trim(),
      eventDate: String(formData.get('eventDate')),
    };
    try {
      await createInformation(announcement);
      await navigateTo('information');
      showToast(appLanguage === 'en' ? 'Information published.' : 'Informasi diterbitkan.');
    } catch (error) {
      const errorElement = form.querySelector('#information-error');
      errorElement.textContent = error.message || 'Informasi gagal diterbitkan.';
      errorElement.hidden = false;
    }
    return;
  }

  if (event.target.id === 'task-form') {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const taskId = formData.get('taskId');
    const task = {
      title: String(formData.get('title')).trim(),
      course: String(formData.get('course')).trim(),
      description: String(formData.get('description')).trim(),
      deadline: new Date(String(formData.get('deadline'))).toISOString(),
      place: String(formData.get('place')).trim() || null,
      submissionUrl: String(formData.get('submissionUrl')).trim() || null,
    };
    try {
      if (taskId) await updateTask(taskId, task);
      else await createTask(task);
      await navigateTo('tasks');
      showToast(taskId ? 'Perubahan tugas disimpan.' : 'Tugas ditambahkan.');
    } catch (error) {
      const errorElement = form.querySelector('#task-error');
      errorElement.textContent = error.message || 'Tugas gagal disimpan.';
      errorElement.hidden = false;
    }
    return;
  }

  if (event.target.id !== 'photo-form') return;
  event.preventDefault();
  const fileInput = event.target.querySelector('#photo-file');
  const file = fileInput.files[0];
  const error = event.target.querySelector('#upload-error');
  const validationError = await validatePhoto(file);
  if (validationError) {
    error.textContent = validationError;
    error.hidden = false;
    return;
  }

  try {
    const { photo } = await uploadPhoto(file, event.target.querySelector('#photo-caption').value.trim());
    session.photos = [photo, ...session.photos];
    activePage = 'home';
    renderShell();
    showToast('Foto berhasil diunggah.');
  } catch (error) {
    const errorElement = event.target.querySelector('#upload-error');
    errorElement.textContent = error.message || 'Foto gagal diunggah.';
    errorElement.hidden = false;
  }
});