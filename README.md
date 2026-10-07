# Ruang Kelas TRPL

Web app kelas mahasiswa dengan jadwal kuliah yang diambil dari [sumber jadwal TRPL](https://ardiikawahyudii.github.io/Jadwal-Kuliah-TRPL-S1/).

## Menjalankan

```sh
npm install
npm run dev
```

Untuk menjalankan backend, buka terminal kedua:

```sh
npm run dev:api
```

Salin `.env.example` menjadi `.env`, buat secret acak dengan `openssl rand -hex 32`, lalu atur `SESSION_SECRET`, `ROSTER_XLSX_PATH`, dan `ADMIN_NAME_MATCHES`. Letakkan workbook roster di lokasi privat yang tidak di-commit. Import akun ke database baru dengan `npm run import:roster`; importer menyimpan hash Argon2id untuk NIM dan mengabaikan nomor telepon. Jangan jalankan importer pada database yang sudah berisi akun.

Untuk produksi Apache, aktifkan modul `ssl`, `headers`, `proxy`, dan `proxy_http`, sesuaikan `deploy/apache-vhost.conf.example` dengan domain dan sertifikat TLS, lalu aktifkan VirtualHost. Contoh tersebut mengarahkan HTTP ke HTTPS, meneruskan `X-Forwarded-Proto: https`, dan mem-proxy seluruh aplikasi ke Node di `127.0.0.1:3001`.

Set `NODE_ENV=production`, secret acak yang kuat, lalu jalankan `npm run build` dan `npm start` sebagai service terkelola. Backend hanya bind ke loopback dalam mode produksi; Express mempercayai satu proxy. Cookie `Secure` aktif berdasarkan HTTPS yang diteruskan Apache.

## Struktur kode

- `src/app.js` — navigasi, pemanggilan API, dan aksi pengguna.
- `src/api.js` — klien same-origin dengan cookie sesi dan token CSRF.
- `src/views.js` — tampilan beranda, jadwal, galeri, login, anggota, dan profil.
- `src/loading-screen.js` — splash screen dan transisinya.
- `src/photo-validation.js` — pemeriksaan awal file foto di browser.
- `src/schedule.js` — seed jadwal yang bisa diperbarui.
- `src/styles.css` — gaya dan layout responsif.
- `server/index.js` — entry point API Express.
- `server/app.js` — middleware keamanan, sesi, dan route API.
- `server/database.js` — schema SQLite dan seed jadwal awal.
- `server/session-store.js` — sesi persisten di SQLite.
- `server/security.js` — CSRF dan middleware autentikasi/otorisasi.
- `server/routes/` — endpoint autentikasi, anggota, foto, jadwal, dan tugas.
- `scripts/import-roster.js` — importer XLSX yang menyimpan hash NIM.

## Keamanan dan batasan

Backend memakai Express, SQLite, Argon2id untuk hash NIM, cookie sesi `HttpOnly`/`SameSite`, token CSRF, rate limit login/unggahan, Helmet, validasi Zod, dan query berparameter. Endpoint jadwal/tugas memeriksa peran admin. Completion tugas terikat ke pengguna dari sesi. Foto memakai nama acak, disimpan di direktori privat, dan signature file diperiksa di server.

Workbook roster belum tersedia di filesystem container ini, jadi database belum memiliki akun dan login akan ditolak sampai roster diimpor. `ROSTER_XLSX_PATH=./private/roster.xlsx` mengatur `Aura` dan nama lengkap `I Gusti Ayu Diah Permata Sukmahartawan` sebagai pencocok admin; importer berhenti jika setiap pencocok tidak cocok tepat satu anggota. Nama/NIM tidak tertanam di frontend, NIM tidak disimpan plaintext, dan nomor telepon di kolom nama tidak diimpor. Belum ada tugas awal; admin dapat menambahkannya sesudah import akun.

Mode development memakai HTTP lokal dan secret sesi sementara; jangan diekspos ke internet atau digunakan untuk data produksi. Produksi memerlukan HTTPS, `NODE_ENV=production`, secret kuat, backup/perlindungan file SQLite, dan konfigurasi reverse proxy yang benar.

## Data jadwal

Data jadwal berada di `src/schedule.js`. Tujuh pertemuan beserta hari, jam, ruang, dan nama dosen yang tersedia disalin dari sumber di atas. Nama dosen tidak tersedia pada halaman sumber untuk Metode dan Model Pengembangan Perangkat Lunak serta Organisasi Komputer dan Sistem Operasi, sehingga ditampilkan sebagai belum tersedia. Jadwal perlu diperbarui dari sumber jika ada perubahan.