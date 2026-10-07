let csrfToken = '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, options = {}) {
  const { method = 'GET', body, formData = false } = options;
  const headers = { Accept: 'application/json' };
  if (body && !formData) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-CSRF-Token'] = csrfToken;

  const response = await fetch(path, {
    method,
    headers,
    body: formData ? body : body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error || 'Permintaan gagal.', response.status);
  if (payload.csrfToken) csrfToken = payload.csrfToken;
  return payload;
}

export async function initializeSession() {
  await request('/api/auth/csrf');
  const [{ user }, { photos }, { schedule }, { announcements }] = await Promise.all([
    request('/api/auth/session'),
    request('/api/photos'),
    request('/api/schedule'),
    request('/api/information'),
  ]);
  return { user, photos, schedule, announcements };
}

export function fetchInformation() {
  return request('/api/information');
}

export function createInformation(announcement) {
  return request('/api/information', { method: 'POST', body: announcement });
}

export function deleteInformation(id) {
  return request(`/api/information/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function login(name, nim) {
  return request('/api/auth/login', { method: 'POST', body: { name, nim } });
}

export function logout() {
  return request('/api/auth/logout', { method: 'POST' }).then(async () => {
    csrfToken = '';
    await request('/api/auth/csrf');
  });
}

export function fetchMembers() {
  return request('/api/members');
}

export function fetchSchedule() {
  return request('/api/schedule');
}

export function createScheduleItem(item) {
  return request('/api/schedule', { method: 'POST', body: item });
}

export function updateScheduleItem(id, item) {
  return request(`/api/schedule/${encodeURIComponent(id)}`, { method: 'PATCH', body: item });
}

export function deleteScheduleItem(id) {
  return request(`/api/schedule/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function fetchTasks() {
  return request('/api/tasks');
}

export function setTaskCompletion(id, completed) {
  return request(`/api/tasks/${encodeURIComponent(id)}/completion`, { method: 'PUT', body: { completed } });
}

export function createTask(task) {
  return request('/api/tasks', { method: 'POST', body: task });
}

export function updateTask(id, task) {
  return request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: task });
}

export function deleteTask(id) {
  return request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function uploadPhoto(file, caption) {
  const body = new FormData();
  body.set('photo', file);
  body.set('caption', caption);
  return request('/api/photos', { method: 'POST', body, formData: true });
}

export function deletePhoto(id) {
  return request(`/api/photos/${encodeURIComponent(id)}`, { method: 'DELETE' });
}