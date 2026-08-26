import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { tanpaKomentar } from './util/tanpaKomentar';
import { join } from 'path';

// AUD-21 — PENGAWAS PERMANEN: pembuatan pengguna auth di test WAJIB lewat ensureAuthUser.
//
// KENAPA PENGAWAS INI ADA, dan kenapa menyisir dengan mata tidak cukup.
//
// AUD-21 pertama kali diperbaiki dengan mengganti 15 titik rapuh di 10 berkas, lalu
// DINYATAKAN SELESAI. Satu berkas terlewat: `margin_watch.test.ts` -- dan bukan hanya satu,
// ternyata 23 berkas lain masih memanggil `createUser` langsung. Yang terlewat itu membuat
// TIGA CI merah berturut-turut, yang sempat dikira kemunduran menyeluruh sampai lognya
// benar-benar dibaca.
//
// Galat yang muncul selalu jauh dari sebabnya:
//     TypeError: Cannot read properties of null (reading 'id')
// Sebab sebenarnya: email sudah terdaftar dari run sebelumnya, `createUser` mengembalikan
// error, `data.user` null, dan tanda seru non-null menutupinya sampai meledak di `.id`.
//
// ATURAN YANG DIJAGA BERKAS INI: perbaikan atas sebuah KELAS cacat belum selesai sampai ada
// pengawas yang menjamin (a) tidak ada yang tersisa, dan (b) tidak ada yang lahir baru.
// Perbaikan yang menyisir sebagian lalu dinyatakan selesai LEBIH BERBAHAYA daripada
// perbaikan yang belum dimulai, karena orang berhenti mencurigainya.
//
// DI LUAR JANGKAUAN PENGAWAS INI (aturan II.2):
//   - Hanya menyisir berkas di `tests/`. Skrip di `scripts/` dan kode aplikasi tidak dilihat.
//   - Mencocokkan TEKS, bukan memahami program. Pemanggilan yang dirakit lewat variabel
//     (mis. `const fn = adminClient.auth.admin; fn.createUser(...)`) tidak akan tertangkap.
//   - Tidak memeriksa apakah ensureAuthUser DIPAKAI DENGAN BENAR -- hanya bahwa jalur
//     mentahnya tidak dipakai lagi.

const DIR_TEST = __dirname;
const BERKAS_DIKECUALIKAN = new Set([
  // Satu-satunya tempat yang MEMANG boleh memanggilnya: helper-nya sendiri.
  'ensureAuthUser.ts',
  // Pengawas ini sendiri menyebut nama pemanggilannya di komentar & pola.
  'auth_user_lewat_helper_watchdog.test.ts'
]);

const POLA_TERLARANG = /auth\s*\.\s*admin\s*\.\s*createUser\s*\(/;

describe('AUD-21 — pembuatan pengguna auth di test wajib lewat ensureAuthUser', () => {
  it('tidak ada berkas test yang memanggil createUser langsung', () => {
    const pelanggaran: string[] = [];

    for (const nama of readdirSync(DIR_TEST)) {
      if (!nama.endsWith('.ts') || BERKAS_DIKECUALIKAN.has(nama)) continue;
      // Komentar dibuang lebih dulu lewat pembantu bersama (AUD-42): sebelum 27 Agu 2026
      // berkas ini menyisir teks mentah, jadi satu kalimat penjelasan yang MENYEBUT
      // auth.admin.createUser sudah cukup untuk membuatnya menuduh berkas yang bersih.
      // Panjang teks dipertahankan pembantu itu, jadi nomor baris tetap benar.
      const isi = tanpaKomentar(readFileSync(join(DIR_TEST, nama), 'utf8'));
      isi.split('\n').forEach((baris, i) => {
        if (POLA_TERLARANG.test(baris)) pelanggaran.push(`${nama}:${i + 1}`);
      });
    }

    expect(
      pelanggaran,
      `Berkas berikut memanggil auth.admin.createUser LANGSUNG:\n  ${pelanggaran.join('\n  ')}\n\n` +
        'Ganti dengan `await ensureAuthUser(adminClient, email, password, metadata)` dari ' +
        './ensureAuthUser. Pemanggilan langsung GAGAL saat email sudah terdaftar dari run ' +
        'sebelumnya, dan galatnya muncul jauh dari sebabnya ("Cannot read properties of null").'
    ).toEqual([]);
  });

  it('helper-nya sendiri masih ada dan masih menangani "sudah terdaftar"', () => {
    // Dibersihkan juga: bila kelak pemanggilan createUser-nya dikomentari, penjaga ini
    // HARUS gagal — bukan lulus karena menemukan namanya di dalam komentar.
    const isi = tanpaKomentar(readFileSync(join(DIR_TEST, 'ensureAuthUser.ts'), 'utf8'));

    expect(POLA_TERLARANG.test(isi), 'ensureAuthUser harus tetap yang memanggil createUser').toBe(true);
    expect(
      isi.includes('already been registered'),
      'ensureAuthUser harus tetap menangani kasus "email sudah terdaftar" — itu seluruh alasan ia ada'
    ).toBe(true);
  });
});
