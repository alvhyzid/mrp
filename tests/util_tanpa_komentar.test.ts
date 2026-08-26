import { describe, it, expect } from 'vitest';
import { tanpaKomentar, tanpaKomentarSql, nomorBaris } from './util/tanpaKomentar';

// ============================================================================
// AUD-42 — MATRIKS UJI PEMBUANG KOMENTAR
// ============================================================================
// KENAPA BERKAS INI ADA, dan kenapa baru ada sekarang:
//
// `tanpaKomentar` dibuat 26 Agu 2026 dan langsung dipakai tiga penjaga — TANPA satu pun
// test miliknya sendiri. Itu bentuk cacat yang sudah tercatat di proyek ini: mekanisme yang
// belum pernah diuji belum pernah terbukti bekerja. Persis kelas yang sama menggigit pada
// hari yang sama, saat mekanisme jatah utang pengawas DS-16 ternyata TIDAK PERNAH berlaku
// karena kuncinya tidak cocok — dan tidak ada yang tahu, sebab daftarnya masih kosong.
//
// Matriks di bawah menguji DUA ARAH untuk setiap kelas:
//   - yang HARUS dibuang (komentar) benar-benar hilang;
//   - yang HARUS BERTAHAN (kode, string, teks JSX) benar-benar utuh.
//
// Arah kedua yang menentukan. "Tidak lagi salah tuduh" tanpa arah kedua bisa berarti
// "tidak lagi menuduh apa pun".
// ============================================================================

describe('AUD-42 — tanpaKomentar (JavaScript/TypeScript/SCSS)', () => {
  it('membuang komentar satu baris, termasuk yang menempel di ujung baris kode', () => {
    const masuk = `const a = 1; // <input> mentah di sini\nconst b = 2;`;
    const keluar = tanpaKomentar(masuk);
    expect(keluar).not.toContain('<input>');
    expect(keluar).toContain('const a = 1;');
    expect(keluar).toContain('const b = 2;');
  });

  it('membuang komentar blok yang membentang beberapa baris', () => {
    const masuk = `const a = 1;\n/* baris satu <table>\n   baris dua <button> */\nconst b = 2;`;
    const keluar = tanpaKomentar(masuk);
    expect(keluar).not.toContain('<table>');
    expect(keluar).not.toContain('<button>');
    expect(keluar).toContain('const b = 2;');
  });

  it('TIDAK membuang isi string yang kebetulan menyerupai komentar', () => {
    const masuk = `const url = 'https://contoh.test/a';`;
    expect(tanpaKomentar(masuk)).toContain('https://contoh.test/a');
  });

  it('TIDAK membuang string yang memuat kata yang dicari penjaga', () => {
    // Batas yang disebut di berkas pembantunya: string TIDAK dibuang. Test ini mengunci
    // batas itu supaya perubahan berikutnya tidak diam-diam memperluas cakupannya.
    const masuk = `const pesan = 'pakai <input> untuk mengisi';`;
    expect(tanpaKomentar(masuk)).toContain('<input>');
  });

  it('menangani karakter yang di-escape di dalam string', () => {
    const masuk = `const s = 'ini \\' bukan penutup // dan ini bukan komentar';\nconst t = 1;`;
    const keluar = tanpaKomentar(masuk);
    expect(keluar).toContain('bukan komentar');
    expect(keluar).toContain('const t = 1;');
  });

  it('menangani template literal', () => {
    const masuk = 'const s = `nilai // bukan komentar ${x}`;\nconst t = 2;';
    const keluar = tanpaKomentar(masuk);
    expect(keluar).toContain('bukan komentar');
    expect(keluar).toContain('const t = 2;');
  });

  it('MEMPERTAHANKAN PANJANG dan nomor baris', () => {
    const masuk = `baris1 // buang\nbaris2\nbaris3 /* buang */ sisa`;
    const keluar = tanpaKomentar(masuk);
    expect(keluar.length).toBe(masuk.length);
    expect(keluar.split('\n').length).toBe(masuk.split('\n').length);
    expect(nomorBaris(keluar, keluar.indexOf('sisa'))).toBe(3);
  });

  it('TIDAK menyentuh teks JSX — batas yang disebut, bukan yang dijanjikan', () => {
    // Teks JSX bukan komentar. Penjaga yang mencocokkan kata polos tetap bisa salah tuduh
    // di sini, dan itu SENGAJA tidak ditutup pembantu ini.
    const masuk = `<p>Isi kolom input di bawah</p>`;
    expect(tanpaKomentar(masuk)).toContain('input');
  });
});

describe('AUD-42 — tanpaKomentarSql (SQL)', () => {
  it('membuang komentar `--` sampai akhir baris', () => {
    const masuk = `select 1;\n-- insert into items (company_id, x) values (1, 2)\nselect 2;`;
    const keluar = tanpaKomentarSql(masuk);
    expect(keluar).not.toContain('insert into items');
    expect(keluar).toContain('select 1;');
    expect(keluar).toContain('select 2;');
  });

  it('membuang komentar `--` yang menempel di ujung baris kode', () => {
    const masuk = `select 1; -- insert into items (company_id) values (1)`;
    const keluar = tanpaKomentarSql(masuk);
    expect(keluar).not.toContain('insert into items');
    expect(keluar).toContain('select 1;');
  });

  it('membuang blok /* ... */', () => {
    const masuk = `select 1;\n/* insert into items (company_id) values (1) */\nselect 2;`;
    expect(tanpaKomentarSql(masuk)).not.toContain('insert into items');
  });

  it('TIDAK menganggap `--` di dalam string sebagai komentar', () => {
    const masuk = `select 'kode--uji' as k; select 2;`;
    const keluar = tanpaKomentarSql(masuk);
    expect(keluar).toContain('kode--uji');
    expect(keluar).toContain('select 2;');
  });

  it('menangani kutip ganda ("") sebagai escape di dalam string SQL', () => {
    const masuk = `select 'bukan '' penutup -- juga bukan komentar' as k;\nselect 3;`;
    const keluar = tanpaKomentarSql(masuk);
    expect(keluar).toContain('juga bukan komentar');
    expect(keluar).toContain('select 3;');
  });

  it('TIDAK memperlakukan dollar quoting sebagai string — isinya wajib tetap tersisir', () => {
    // Ini keputusan yang disengaja dan disebut di berkas pembantunya: seluruh migrasi
    // proyek ini membungkus badan DO block dengan $mig$, dan isinya justru yang harus
    // diperiksa penjaga. Membutakannya di situ akan membuat penjaga migrasi tidak
    // memeriksa apa pun sambil tetap terlihat memeriksa.
    const masuk = `do $mig$ begin\n  insert into items (company_id) values (1);\nend $mig$;`;
    expect(tanpaKomentarSql(masuk)).toContain('insert into items (company_id)');
  });

  it('MEMPERTAHANKAN PANJANG dan nomor baris', () => {
    const masuk = `baris1 -- buang\nbaris2\nbaris3 /* buang */ sisa`;
    const keluar = tanpaKomentarSql(masuk);
    expect(keluar.length).toBe(masuk.length);
    expect(nomorBaris(keluar, keluar.indexOf('sisa'))).toBe(3);
  });
});
