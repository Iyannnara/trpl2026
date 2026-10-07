export function showLoadingScreen(root, onReady, language = 'en') {
  const isEnglish = language === 'en';
  const brand = isEnglish ? 'class room <b>TRPL</b>' : 'ruang kelas <b>TRPL</b>';
  const kicker = isEnglish ? 'CLASS DIGITAL ROOM · 01 / 03' : 'RUANG DIGITAL KELAS · 01 / 03';
  const titleFirst = isEnglish ? 'Setting up the' : 'Menata ruang';
  const titleSecond = isEnglish ? 'learning space.' : 'untuk belajar.';
  const copy = isEnglish ? 'The class schedule and gallery are opening.' : 'Jadwal dan galeri kelas sedang dibuka.';
  const previewHeading = isEnglish ? 'TODAY\'S AGENDA' : 'AGENDA HARI INI';
  const status = isEnglish ? 'Preparing the class schedule and room' : 'Menyiapkan jadwal dan ruang kelas';
  const footer = isEnglish ? 'SOFTWARE ENGINEERING TECHNOLOGY' : 'TEKNOLOGI REKAYASA PERANGKAT LUNAK';

  root.innerHTML = `
    <main class="loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div class="loading-brand"><span class="brand-mark">r.</span><span>${brand}</span></div>
      <div class="loading-content">
        <p class="eyebrow loading-kicker">${kicker}</p>
        <h1><span class="loading-line loading-line-first">${titleFirst}</span><em class="loading-line loading-line-second">${titleSecond}</em></h1>
        <p class="loading-copy">${copy}</p>
        <div class="loading-preview" aria-hidden="true">
          <div class="loading-preview-heading"><span>${previewHeading}</span><span>TRPL · CLASS</span></div>
          <div class="loading-preview-row loading-preview-row-one"><span class="loading-time"></span><span class="loading-course"></span></div>
          <div class="loading-preview-row loading-preview-row-two"><span class="loading-time"></span><span class="loading-course"></span></div>
          <div class="loading-preview-row loading-preview-row-three"><span class="loading-time"></span><span class="loading-course"></span></div>
        </div>
        <div class="loading-track" aria-hidden="true"><span></span></div>
        <p class="loading-status"><span></span> ${status}</p>
      </div>
      <span class="loading-footer">${footer}</span>
    </main>`;

  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 800 : 2400;
  window.setTimeout(() => {
    root.querySelector('.loading-screen')?.classList.add('loading-exit');
    window.setTimeout(onReady, 260);
  }, duration);
}