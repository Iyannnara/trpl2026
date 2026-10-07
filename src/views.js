import { scheduleSource } from './schedule.js';

const weekdays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const navItems = [
  ['home', { id: 'Beranda', en: 'Home' }],
  ['schedule', { id: 'Jadwal', en: 'Schedule' }],
  ['information', { id: 'Informasi', en: 'Information' }],
  ['tasks', { id: 'Tugas', en: 'Tasks' }],
  ['gallery', { id: 'Galeri', en: 'Gallery' }],
  ['members', { id: 'Anggota', en: 'Members' }],
];

const uiText = {
  id: {
    login: 'Masuk',
    logout: 'Keluar',
    guest: 'Pengunjung',
    member: 'ANGGOTA',
    admin: 'ADMIN',
    enter: 'Masuk ↗',
    profile: 'Buka profil',
    language: 'ID',
    open: 'Buka',
  },
  en: {
    login: 'Login',
    logout: 'Logout',
    guest: 'Guest',
    member: 'MEMBER',
    admin: 'ADMIN',
    enter: 'Login ↗',
    profile: 'Open profile',
    language: 'EN',
    open: 'Open',
  },
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function dateLabel() {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());
}

function currentDay() {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date());
}

function classMarkup(item, canManage = false, language = 'en') {
  const lecturerText = language === 'en' ? 'Lecturer name not available in the source schedule' : 'Nama dosen belum tersedia di sumber jadwal';
  const roomText = language === 'en' ? 'Room not available' : 'Ruang belum tersedia';
  const editLabel = language === 'en' ? 'Edit' : 'Ubah';
  const deleteLabel = language === 'en' ? 'Delete' : 'Hapus';
  const statusLabels = { moved: 'KELAS PINDAH', cancelled: 'KELAS BATAL', tentative: 'BELUM PASTI' };
  const statusBadge = statusLabels[item.status]
    ? `<span class="schedule-status schedule-status-${item.status}">${statusLabels[item.status]}</span>`
    : '';
  return `
    <article class="class-row">
      <time class="class-time">${escapeHtml(item.time)}</time>
      <div class="class-details">
        <h3>${escapeHtml(item.course)}${statusBadge}</h3>
        <p>${escapeHtml(item.lecturer ?? lecturerText)}</p>
        <p class="room">${escapeHtml(item.room ?? roomText)}</p>
      </div>
      ${canManage ? `<div class="task-admin-actions"><button data-edit-schedule="${item.id}">${editLabel}</button><button data-delete-schedule="${item.id}">${deleteLabel}</button></div>` : ''}
    </article>`;
}

export function shellMarkup(session, activePage, language = 'en', theme = 'light') {
  const text = uiText[language] ?? uiText.en;
  const isLoggedIn = Boolean(session?.user || session?.name);
  const displayName = String(session?.name || '').trim();
  const initials = displayName ? displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() : 'G';
  const themeAction = theme === 'dark'
    ? (language === 'en' ? 'Switch to light mode' : 'Ganti ke mode terang')
    : (language === 'en' ? 'Switch to dark mode' : 'Ganti ke mode gelap');
  const visibleNavItems = isLoggedIn ? navItems : navItems.filter(([key]) => ['home', 'schedule', 'information', 'gallery'].includes(key));
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" href="#home" data-page="home"><span class="brand-mark">r.</span><span>ruang kelas <b>TRPL</b></span></a>
        <p class="sidebar-label">${language === 'en' ? 'CLASS' : 'KELAS'}</p>
        <nav aria-label="${language === 'en' ? 'Main navigation' : 'Navigasi utama'}">${visibleNavItems.map(([key, label]) => `
          <button class="nav-link ${activePage === key ? 'active' : ''}" data-page="${key}" ${activePage === key ? 'aria-current="page"' : ''}>
            <span class="nav-index">${String(navItems.findIndex(([id]) => id === key) + 1).padStart(2, '0')}</span>${label[language] ?? label.id}
          </button>`).join('')}</nav>
        <div class="sidebar-bottom"><span class="sidebar-term">RUANG DIGITAL<br />KELAS TRPL</span>${isLoggedIn ? `<button class="logout-link" data-action="logout">${text.logout} <span aria-hidden="true">↗</span></button>` : `<button class="logout-link" data-action="login">${text.login} <span aria-hidden="true">↗</span></button>`}</div>
      </aside>
      <main class="workspace">
        <header class="topbar"><div><span class="topbar-date">${escapeHtml(dateLabel())}</span></div><div class="profile"><button class="theme-switch" data-theme-toggle aria-label="${themeAction}" title="${themeAction}" aria-pressed="${theme === 'dark'}"><span class="theme-icon" aria-hidden="true">${theme === 'dark' ? '☼' : '☾'}</span></button><button class="language-switch" data-language="${language === 'id' ? 'en' : 'id'}" aria-label="Switch language">${text.language}</button>${isLoggedIn ? `<button class="profile-trigger" data-page="profile" aria-label="${language === 'en' ? 'Open profile' : 'Buka profil'} ${escapeHtml(displayName)}"><span class="avatar">${escapeHtml(initials)}</span><span>${escapeHtml(displayName)}</span><span class="role-label">${session.role === 'admin' ? text.admin : text.member}</span></button>` : `<span class="guest-label">${text.guest}</span><button class="topbar-login" data-action="login">${text.enter}</button>`}</div></header>
        <div id="page-content"></div>
        <footer class="page-footer"><span>RUANG KELAS TRPL</span><span>Data jadwal bersumber dari <a href="${scheduleSource}" target="_blank" rel="noreferrer">Jadwal Kuliah TRPL ↗</a></span></footer>
      </main>
    </div>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}

function weeklySchedule(session) {
  return weekdays.map((day) => ({
    day,
    classes: session.schedule.filter((item) => item.day === day),
  }));
}

function homePage(session, language = 'en') {
  if (!session.name) {
    const photos = session.photos.slice().reverse().map((photo, index) => photoMarkup(photo, index, session, language)).join('');
    return `
      <section class="guest-welcome" aria-labelledby="guest-welcome-title">
        <div class="welcome-meta"><span><i></i> OFFICIAL CLASS SPACE</span><span>TRPL · 2026</span></div>
        <div class="welcome-content"><p class="welcome-kicker">WELCOME TO</p><h1 id="guest-welcome-title">TRPL <span>CLASS OF <b>2026</b></span></h1><p><span class="welcome-typewriter" data-typewriter="Welcome to the web home of the TRPL Class of 2026." aria-label="Welcome to the web home of the TRPL Class of 2026."></span><span class="welcome-caret" aria-hidden="true"></span></p></div>
        <span class="welcome-watermark" aria-hidden="true">26</span>
        <div class="welcome-footer"><span>LEARN · CREATE · CONNECT</span><span class="welcome-rule"></span><span>01 / 26</span></div>
      </section>
      <section class="page-heading guest-home-heading"><div><p class="eyebrow">${language === 'en' ? 'TRPL CLASS ROOM / MOMENTS' : 'RUANG KELAS TRPL / MOMEN'}</p><h1>${language === 'en' ? 'Class moments.' : 'Momen kelas.'}</h1><p class="page-subtitle">${language === 'en' ? 'Browse photos from class activities.' : 'Lihat foto-foto kegiatan kelas.'}</p></div><span class="source-pill">${session.photos.length} ${language === 'en' ? 'PHOTOS' : 'FOTO'}</span></section>
      <section class="guest-home-gallery" aria-label="${language === 'en' ? 'Class activity photos' : 'Foto kegiatan kelas'}">${photos || `<div class="home-gallery-empty"><span class="empty-mark">▧</span><p>${language === 'en' ? 'No class photos yet.' : 'Belum ada foto kegiatan.'}</p></div>`}</section>
      <div class="guest-gallery-action"><span>${language === 'en' ? 'Have a photo to share?' : 'Punya foto untuk dibagikan?'}</span><button class="button button-primary" data-action="login">${language === 'en' ? 'Login to upload +' : 'Masuk untuk unggah +'}</button></div>`;
  }
  const schedule = weeklySchedule(session);
  const today = schedule.find(({ day }) => day.toLocaleLowerCase('id-ID') === currentDay().toLocaleLowerCase('id-ID'));
  const todayClasses = today?.classes ?? [];
  const featured = todayClasses.length
    ? todayClasses.map((item) => classMarkup(item)).join('')
    : `<div class="empty-line"><span>—</span><p>${language === 'en' ? 'There are no classes scheduled for today.' : 'Tidak ada kelas terjadwal hari ini.'}</p></div>`;
  const nextClasses = schedule.filter(({ day }) => ['Selasa', 'Rabu', 'Kamis', 'Jumat'].includes(day)).flatMap(({ day, classes }) => classes.map((item) => ({ ...item, day })));
  const photos = session.photos.slice().reverse().map((photo, index) => photoMarkup(photo, index, session)).join('');
  return `
    <section class="page-heading"><div><p class="eyebrow">${language === 'en' ? 'CLASS ROOM / HOME' : 'RUANG KELAS / BERANDA'}</p><h1>${session.name ? (language === 'en' ? `Hello, ${escapeHtml(session.name.split(/\s+/)[0])}.` : `Halo, ${escapeHtml(session.name.split(/\s+/)[0])}.`) : (language === 'en' ? 'TRPL classroom.' : 'Ruang kelas TRPL.')}</h1><p class="page-subtitle">${language === 'en' ? 'Your one place for class updates and activities.' : 'Satu tempat untuk kabar dan kegiatan kelasmu.'}</p></div><span class="heading-date">${escapeHtml(dateLabel())}</span></section>
    <section class="home-grid">
      <div class="content-section today-section"><div class="section-heading"><div><p class="eyebrow">${language === 'en' ? 'TODAY\'S AGENDA' : 'AGENDA HARI INI'}</p><h2>${escapeHtml(today?.day ?? currentDay())}</h2></div><button class="text-link" data-page="schedule">${language === 'en' ? 'Full schedule ↗' : 'Jadwal lengkap ↗'}</button></div>${featured}</div>
      <aside class="class-count"><span class="eyebrow">${language === 'en' ? 'COURSE WEEK' : 'MINGGU PERKULIAHAN'}</span><strong>0${nextClasses.length}</strong><p>${language === 'en' ? 'meetings recorded<br />from Tuesday to Friday' : 'pertemuan tercatat<br />dari Selasa sampai Jumat'}</p><span class="count-rule"></span><p class="count-note">${language === 'en' ? 'Monday and weekends have no lecture entries in the source.' : 'Senin dan akhir pekan tidak memiliki jadwal kuliah pada sumber.'}</p></aside>
    </section>
    <section class="home-gallery">
      <div class="section-heading"><div><p class="eyebrow">${language === 'en' ? 'CLASS MOMENTS' : 'MOMEN KELAS'}</p><h2>${language === 'en' ? 'Activity gallery' : 'Galeri kegiatan'}</h2></div><div class="gallery-actions"><button class="text-link" data-page="gallery">${language === 'en' ? 'View gallery ↗' : 'Lihat galeri ↗'}</button><button class="button button-primary home-upload" data-action="upload">${session.name ? (language === 'en' ? 'Upload photo +' : 'Unggah foto +') : (language === 'en' ? 'Login to upload +' : 'Masuk untuk unggah +')}</button></div></div>
      ${photos ? `<div class="gallery-grid home-gallery-grid">${photos}</div>` : `<div class="home-gallery-empty"><span class="empty-mark">▧</span><p>${language === 'en' ? 'No class photos yet.' : 'Belum ada foto kegiatan.'}</p></div>`}
      <p class="gallery-demo-note">${language === 'en' ? 'Class activity photos · uploads are saved to the gallery.' : 'Foto kegiatan kelas · unggahan tersimpan di galeri.'}</p>
    </section>
    <section class="content-section home-lower"><div class="section-heading"><div><p class="eyebrow">${language === 'en' ? 'CLASS ACTIVITY' : 'AKTIVITAS KELAS'}</p><h2>${language === 'en' ? 'Shared space' : 'Ruang bersama'}</h2></div><span class="section-aside">${language === 'en' ? 'Tasks · classmates' : 'Tugas · teman sekelas'}</span></div><div class="quick-links">${[['tasks', language === 'en' ? 'Task list' : 'Daftar tugas', language === 'en' ? 'No tasks available yet' : 'Belum ada tugas tersedia'], ['members', language === 'en' ? 'Class members' : 'Anggota kelas', language === 'en' ? 'Member list not available yet' : 'Daftar belum tersedia']].map(([page, title, text]) => `<button class="quick-link" data-page="${page}"><span><strong>${title}</strong><small>${text}</small></span><span class="quick-arrow">↗</span></button>`).join('')}</div></section>`;
}

function schedulePage(session, language = 'en') {
  const schedule = weeklySchedule(session);
  const totalClasses = schedule.reduce((total, day) => total + day.classes.length, 0);
  const adminForm = session.role === 'admin' ? `
    <form id="schedule-form" class="admin-task-form"><p class="eyebrow">${language === 'en' ? 'MANAGE SCHEDULE' : 'KELOLA JADWAL'}</p><input type="hidden" name="scheduleId" /><label>${language === 'en' ? 'Day' : 'Hari'}<select name="day" required>${weekdays.map((day) => `<option value="${day}">${day}</option>`).join('')}</select></label><label>${language === 'en' ? 'Course' : 'Mata kuliah'}<input name="course" required maxlength="160" /></label><label>${language === 'en' ? 'Time' : 'Jam'}<input name="time" required maxlength="60" placeholder="07.30–10.29" /></label><label>Status<select name="status"><option value="normal">Normal</option><option value="moved">Kelas pindah</option><option value="cancelled">Kelas batal</option><option value="tentative">Belum pasti</option></select></label><label>${language === 'en' ? 'Lecturer' : 'Dosen'}<input name="lecturer" maxlength="240" /></label><label>${language === 'en' ? 'Room' : 'Ruang'}<input name="room" maxlength="180" /></label><button class="button button-primary" type="submit">${language === 'en' ? 'Save schedule' : 'Simpan jadwal'}</button><p id="schedule-error" class="form-message" role="alert" hidden></p></form>` : '';
  return `
    <section class="page-heading"><div><p class="eyebrow">${language === 'en' ? 'CLASS ROOM / SCHEDULE' : 'RUANG KELAS / JADWAL'}</p><h1>${language === 'en' ? 'Class schedule' : 'Jadwal kuliah'}</h1><p class="page-subtitle">${language === 'en' ? 'All meetings in one week.' : 'Semua pertemuan dalam satu minggu.'}</p></div><span class="source-pill">${language === 'en' ? 'OFFICIAL CLASS SOURCE' : 'SUMBER RESMI KELAS'}</span></section>
    ${adminForm}
    <div class="schedule-summary"><strong>${totalClasses}</strong><span>${language === 'en' ? 'meetings<br />Tuesday–Friday' : 'pertemuan<br />Selasa–Jumat'}</span><span class="summary-divider"></span><span>${language === 'en' ? 'Lecturers not listed remain as they are in the source.' : 'Nama dosen yang tidak tercantum tetap ditandai apa adanya.'}</span></div>
    <section class="week-list">${schedule.map(({ day, classes }) => `<section class="day-group"><div class="day-heading"><h2>${escapeHtml(day)}</h2><span>${classes.length ? `${classes.length} ${language === 'en' ? 'classes' : 'kelas'}` : language === 'en' ? 'OFF' : 'LIBUR'}</span></div>${classes.length ? `<div class="day-classes">${classes.map((item) => classMarkup(item, session.role === 'admin', language)).join('')}</div>` : `<p class="day-empty">${language === 'en' ? 'No class schedule.' : 'Tidak ada jadwal kuliah.'}</p>`}</section>`).join('')}</section>
    <p class="source-note">${language === 'en' ? 'If there are updates, match them with the' : 'Jika ada perubahan, cocokkan dengan'} <a href="${scheduleSource}" target="_blank" rel="noreferrer">${language === 'en' ? 'class schedule source page' : 'halaman sumber jadwal'} ↗</a>.</p>`;
}

function tasksPage(session, language = 'en') {
  const tasks = session.tasks ?? [];
  const canManage = session.role === 'admin';
  const taskRows = tasks.map((task) => `
    <article class="task-row">
      <label class="task-completion"><input type="checkbox" data-task-completion="${task.id}" ${task.completed ? 'checked' : ''} /><span>${language === 'en' ? 'Done' : 'Selesai'}</span></label>
      <div class="task-body"><h2>${escapeHtml(task.title)}</h2><p class="task-course">${escapeHtml(task.course)}</p><p>${escapeHtml(task.description || (language === 'en' ? 'No description provided.' : 'Tidak ada deskripsi.'))}</p><div class="task-meta"><span>${language === 'en' ? 'Deadline:' : 'Deadline:'} ${escapeHtml(new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(task.deadline)))}</span>${task.place ? `<span>${escapeHtml(task.place)}</span>` : ''}${task.submissionUrl ? `<a href="${escapeHtml(task.submissionUrl)}" target="_blank" rel="noreferrer">${language === 'en' ? 'Submission link ↗' : 'Tautan pengumpulan ↗'}</a>` : ''}</div></div>
      ${canManage ? `<div class="task-admin-actions"><button data-edit-task="${task.id}">${language === 'en' ? 'Edit' : 'Ubah'}</button><button data-delete-task="${task.id}">${language === 'en' ? 'Delete' : 'Hapus'}</button></div>` : ''}
    </article>`).join('');
  const adminForm = canManage ? `
    <form id="task-form" class="admin-task-form"><p class="eyebrow">${language === 'en' ? 'MANAGE TASKS' : 'KELOLA TUGAS'}</p><input type="hidden" name="taskId" /><label>${language === 'en' ? 'Title' : 'Judul'}<input name="title" required maxlength="160" /></label><label>${language === 'en' ? 'Course' : 'Mata kuliah'}<input name="course" required maxlength="160" /></label><label>${language === 'en' ? 'Description' : 'Deskripsi'}<textarea name="description" maxlength="4000"></textarea></label><label>${language === 'en' ? 'Deadline' : 'Deadline'}<input name="deadline" type="datetime-local" required /></label><label>${language === 'en' ? 'Location' : 'Tempat'}<input name="place" maxlength="240" /></label><label>${language === 'en' ? 'Submission link (HTTPS)' : 'Tautan pengumpulan HTTPS'}<input name="submissionUrl" type="url" maxlength="2048" /></label><button class="button button-primary" type="submit">${language === 'en' ? 'Save task' : 'Simpan tugas'}</button><p id="task-error" class="form-message" role="alert" hidden></p></form>` : '';
  return `
    <section class="page-heading"><div><p class="eyebrow">${language === 'en' ? 'CLASS ROOM / TASKS' : 'RUANG KELAS / TUGAS'}</p><h1>${language === 'en' ? 'Class tasks' : 'Tugas kelas'}</h1><p class="page-subtitle">${language === 'en' ? 'Deadlines, details, and status of your tasks.' : 'Deadline, detail, dan status tugasmu.'}</p></div><span class="source-pill">${tasks.length} ${language === 'en' ? 'TASKS' : 'TUGAS'}</span></section>
    ${adminForm}${taskRows || `<section class="empty-state"><span class="empty-mark">—</span><p class="eyebrow">${language === 'en' ? 'NO TASKS YET' : 'BELUM ADA TUGAS'}</p><h2>${language === 'en' ? 'Nothing has been shared yet.' : 'Belum ada yang dibagikan.'}</h2><p>${language === 'en' ? 'Class tasks will appear here.' : 'Tugas kelas akan ditampilkan di sini.'}</p></section>`}`;
}

function galleryPage(session, language = 'en') {
  const previews = session.photos.slice().reverse().map((photo, index) => photoMarkup(photo, index, session, language)).join('');
  const upload = session.name
    ? `<form id="photo-form" class="upload-form"><div class="upload-fields"><label class="file-picker" for="photo-file"><span class="upload-symbol">＋</span><span><strong>${language === 'en' ? 'Choose class photo' : 'Pilih foto kegiatan'}</strong><small>${language === 'en' ? 'JPG, PNG, or WebP · up to 5 MB' : 'JPG, PNG, atau WebP · maksimal 5 MB'}</small></span></label><input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" /><label class="caption-field" for="photo-caption"><span class="eyebrow">${language === 'en' ? 'PHOTO CAPTION' : 'KETERANGAN FOTO'}</span><input id="photo-caption" maxlength="160" placeholder="${language === 'en' ? 'Example: Practical session today' : 'Contoh: Praktikum hari ini'}" /></label><button class="button button-primary upload-submit" type="submit">${language === 'en' ? 'Show preview' : 'Tampilkan pratinjau'}</button></div><p id="upload-error" class="form-message" role="alert" hidden></p></form>`
    : `<div class="upload-notice"><strong>${language === 'en' ? 'Login to upload' : 'Masuk untuk mengunggah'}</strong><span>${language === 'en' ? 'The gallery can be viewed without logging in. Log in with your roster account to add photos.' : 'Galeri dapat dilihat tanpa login. Masuk dengan akun roster untuk menambahkan foto.'}</span><button class="text-link" data-action="upload">${language === 'en' ? 'Login to upload ↗' : 'Masuk untuk unggah ↗'}</button></div>`;
  return `
    <section class="page-heading"><div><p class="eyebrow">${language === 'en' ? 'CLASS ROOM / GALLERY' : 'RUANG KELAS / GALERI'}</p><h1>${language === 'en' ? 'Class gallery' : 'Galeri kegiatan'}</h1><p class="page-subtitle">${language === 'en' ? 'A collection of moments from class activities.' : 'Kumpulan momen dari kegiatan kelas.'}</p></div><span class="source-pill">${language === 'en' ? 'LOCAL PREVIEW' : 'PRATINJAU LOKAL'}</span></section>
    ${upload}
    <section class="gallery-grid" aria-label="${language === 'en' ? 'Class photos' : 'Foto kegiatan'}">${previews || `<div class="empty-state gallery-empty"><span class="empty-mark">▧</span><p class="eyebrow">${language === 'en' ? 'NO PHOTOS YET' : 'BELUM ADA FOTO'}</p><h2>${language === 'en' ? 'The gallery is empty.' : 'Galeri masih kosong.'}</h2><p>${language === 'en' ? 'Selected photo previews will appear here.' : 'Pratinjau foto yang dipilih akan terlihat di sini.'}</p></div>`}</section>`;
}

function informationPage(session, language = 'en') {
  const automaticNotices = (session.schedule ?? []).filter((item) => ['moved', 'cancelled'].includes(item.status)).map((item) => ({
    id: `schedule-${item.id}`,
    category: item.status === 'moved' ? 'class_moved' : 'class_cancelled',
    title: item.course,
    details: [item.day, item.time, item.room].filter(Boolean).join(' · '),
    eventDate: '',
    automatic: true,
  }));
  const announcements = (session.information ?? []).map((item) => ({ ...item, automatic: false }));
  const entries = [...announcements, ...automaticNotices].sort((first, second) => {
    if (!first.eventDate) return second.eventDate ? -1 : 0;
    if (!second.eventDate) return 1;
    return first.eventDate.localeCompare(second.eventDate);
  });
  const categoryLabels = {
    mandatory_activity: language === 'en' ? 'MANDATORY ACTIVITY' : 'KEGIATAN WAJIB',
    public_holiday: language === 'en' ? 'PUBLIC HOLIDAY' : 'LIBUR TANGGAL MERAH',
    class_cancelled: language === 'en' ? 'CLASS CANCELLED' : 'KELAS BATAL',
    class_moved: language === 'en' ? 'CLASS MOVED' : 'KELAS PINDAH',
  };
  const adminForm = session.role === 'admin' ? `
    <form id="information-form" class="admin-task-form information-form"><p class="eyebrow">${language === 'en' ? 'POST INFORMATION' : 'TAMBAH INFORMASI'}</p><label>${language === 'en' ? 'Category' : 'Kategori'}<select name="category" required><option value="mandatory_activity">${language === 'en' ? 'Mandatory activity' : 'Kegiatan wajib'}</option><option value="public_holiday">${language === 'en' ? 'Public holiday' : 'Libur tanggal merah'}</option></select></label><label>${language === 'en' ? 'Title' : 'Judul'}<input name="title" required maxlength="160" /></label><label>${language === 'en' ? 'Date' : 'Tanggal'}<input name="eventDate" type="date" required /></label><label>${language === 'en' ? 'Details' : 'Keterangan'}<textarea name="details" maxlength="4000"></textarea></label><button class="button button-primary" type="submit">${language === 'en' ? 'Publish information' : 'Terbitkan informasi'}</button><p id="information-error" class="form-message" role="alert" hidden></p></form>` : '';
  const items = entries.map((item) => {
    const dateLabel = item.eventDate
      ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'id-ID', { dateStyle: 'medium' }).format(new Date(`${item.eventDate}T12:00:00`))
      : item.details;
    return `<article class="information-item information-${item.category}"><div class="information-item-meta"><span class="information-category">${categoryLabels[item.category]}</span>${dateLabel ? `<time>${escapeHtml(dateLabel)}</time>` : ''}</div><div class="information-item-content"><h2>${escapeHtml(item.title)}</h2>${item.details && item.eventDate ? `<p>${escapeHtml(item.details)}</p>` : ''}</div>${session.role === 'admin' && !item.automatic ? `<button class="information-delete" data-delete-information="${item.id}" aria-label="${language === 'en' ? 'Delete information' : 'Hapus informasi'}">×</button>` : ''}</article>`;
  }).join('');
  return `
    <section class="page-heading"><div><p class="eyebrow">${language === 'en' ? 'CLASS ROOM / INFORMATION' : 'RUANG KELAS / INFORMASI'}</p><h1>${language === 'en' ? 'Information' : 'Informasi'}</h1><p class="page-subtitle">${language === 'en' ? 'Mandatory activities, holidays, and schedule changes.' : 'Kegiatan wajib, hari libur, dan perubahan jadwal.'}</p></div><span class="source-pill">${entries.length} ${language === 'en' ? 'UPDATES' : 'PEMBARUAN'}</span></section>
    ${adminForm}
    <section class="information-list" aria-label="${language === 'en' ? 'Class information' : 'Informasi kelas'}">${items || `<div class="empty-state"><span class="empty-mark">—</span><p class="eyebrow">${language === 'en' ? 'NO UPDATES' : 'BELUM ADA INFORMASI'}</p><h2>${language === 'en' ? 'Nothing to announce yet.' : 'Belum ada pengumuman.'}</h2><p>${language === 'en' ? 'New information will appear here.' : 'Informasi baru akan tampil di sini.'}</p></div>`}</section>`;
}

function loginPage(language = 'en') {
  return `
    <section class="page-heading"><div><p class="eyebrow">${language === 'en' ? 'CLASS ROOM / ACCESS' : 'RUANG KELAS / AKSES'}</p><h1>${language === 'en' ? 'Login to share' : 'Masuk untuk berbagi'}</h1><p class="page-subtitle">${language === 'en' ? 'The gallery remains visible without login.' : 'Galeri tetap bisa dilihat tanpa login.'}</p></div></section>
    <section class="auth-card"><p class="eyebrow">${language === 'en' ? 'CLASS ACCOUNT' : 'AKUN KELAS'}</p><h2>${language === 'en' ? 'Login to class' : 'Masuk ke kelas'}</h2><p>${language === 'en' ? 'Use the roster name and NIM as your credentials.' : 'Gunakan nama sesuai roster dan NIM sebagai kata sandi.'}</p>
      <form id="login-form" class="login-form"><label for="full-name">${language === 'en' ? 'Full name' : 'Nama lengkap'}</label><input id="full-name" name="name" autocomplete="username" maxlength="120" required placeholder="${language === 'en' ? 'Name matching the roster' : 'Nama sesuai roster'}" /><label for="student-id">NIM</label><input id="student-id" name="nim" type="password" inputmode="numeric" autocomplete="current-password" maxlength="20" required placeholder="${language === 'en' ? 'Enter NIM' : 'Masukkan NIM'}" /><button class="button button-primary login-submit" type="submit">${language === 'en' ? 'Login ↗' : 'Masuk ↗'}</button></form><p id="login-error" class="form-message" role="alert" hidden></p>
    </section>`;
}

function photoMarkup(photo, index, session, language = 'en') {
  const altText = language === 'en' ? 'Class activity photo' : 'Foto kegiatan kelas';
  const caption = language === 'en' ? 'No caption' : 'Tanpa keterangan';
  const deleteLabel = language === 'en' ? 'Delete photo' : 'Hapus foto';
  return `<figure class="photo-item photo-enter" style="--photo-index:${Math.min(index, 8)}"><img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption || altText)}" /><figcaption>${escapeHtml(photo.caption || caption)}${photo.canDelete ? `<button data-remove-photo="${escapeHtml(photo.id)}" aria-label="${deleteLabel}">×</button>` : ''}</figcaption><small class="photo-credit">${escapeHtml(photo.uploaderName || '')}</small></figure>`;
}

function membersPage(session, language = 'en') {
  const members = session.members ?? [];
  return `
    <section class="page-heading"><div><p class="eyebrow">${language === 'en' ? 'CLASS ROOM / MEMBERS' : 'RUANG KELAS / ANGGOTA'}</p><h1>${language === 'en' ? 'Classmates' : 'Teman sekelas'}</h1><p class="page-subtitle">${language === 'en' ? 'List of registered members in the class.' : 'Daftar anggota yang terdaftar di kelas.'}</p></div><span class="source-pill">${language === 'en' ? 'PRIVATE LIST' : 'DAFTAR PRIVAT'}</span></section>
    <section class="member-list">${members.map((member) => `<article class="member-row"><span class="avatar">${escapeHtml(member.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase())}</span><strong>${escapeHtml(member.name)}</strong><span class="member-role">${member.role === 'admin' ? 'ADMIN' : language === 'en' ? 'MEMBER' : 'ANGGOTA'}</span></article>`).join('') || `<div class="empty-state"><span class="empty-mark">—</span><p class="eyebrow">${language === 'en' ? 'MEMBER LIST' : 'DAFTAR ANGGOTA'}</p><h2>${language === 'en' ? 'No member data yet.' : 'Belum ada data anggota.'}</h2><p>${language === 'en' ? 'Import the class roster from the backend to display members.' : 'Impor roster kelas melalui backend untuk menampilkan anggota.'}</p></div>`}</section>`;
}

function profilePage(session, language = 'en') {
  const initials = session.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return `
    <section class="page-heading"><div><p class="eyebrow">${language === 'en' ? 'CLASS ROOM / PROFILE' : 'RUANG KELAS / PROFIL'}</p><h1>${language === 'en' ? 'Profile' : 'Profil'}</h1><p class="page-subtitle">${language === 'en' ? 'Class account identity.' : 'Identitas akun kelas.'}</p></div><span class="source-pill">${session.role === 'admin' ? 'ADMIN' : language === 'en' ? 'MEMBER' : 'ANGGOTA'}</span></section>
    <section class="profile-card"><div class="profile-person"><span class="avatar profile-avatar">${escapeHtml(initials)}</span><div><p class="eyebrow">${language === 'en' ? 'FULL NAME' : 'NAMA LENGKAP'}</p><h2>${escapeHtml(session.name)}</h2><span class="profile-role">${session.role === 'admin' ? (language === 'en' ? 'Class admin' : 'Admin kelas') : (language === 'en' ? 'Class member' : 'Anggota kelas')}</span></div></div><div class="profile-fields"><div><span>${language === 'en' ? 'Role' : 'Peran'}</span><strong>${session.role === 'admin' ? (language === 'en' ? 'Admin' : 'Admin') : (language === 'en' ? 'Member' : 'Anggota')}</strong></div><div><span>NIM</span><strong>${language === 'en' ? 'Not shown' : 'Tidak ditampilkan'}</strong></div></div></section>`;
}

export function pageMarkup(page, session, language = 'en') {
  const pages = {
    home: homePage,
    schedule: schedulePage,
    tasks: tasksPage,
    gallery: galleryPage,
    information: informationPage,
    login: loginPage,
    members: membersPage,
    profile: profilePage,
  };
  return (pages[page] ?? homePage)(session, language);
}