import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { tanpaKomentar } from './util/tanpaKomentar';

// ============================================================================
// PILOT REVISI UI #1 — /routing
// ============================================================================
// Dua cacat yang diperbaiki, keduanya punya pola pengganti yang SUDAH TERBUKTI di
// repositori ini — jadi pilot ini menguji apakah governance-nya benar-benar bisa
// diterapkan, bukan menciptakan pola baru.
//
// D-1  Baris tahap memakai breakpoint LEBAR LAYAR, padahal barisnya hidup DI DALAM
//      modal yang justru MENYEMPIT saat layar melebar. Terukur sebelum perbaikan:
//        viewport 1280 -> modal 768px -> 3 kolom -> 223px per kontrol
//        viewport 1440 -> modal 691px -> 3 kolom -> 197px per kontrol
//      Layar MELEBAR, kontrolnya justru MENYEMPIT. Ini kelas DS-22 persis.
//      Tinggi baris di 360px terukur 608px — terparah di repositori.
//
// D-2  window.confirm untuk penghapusan permanen Routing. Dilarang standar aksi
//      merusak; penggantinya Modal Carbon varian danger, pola yang sudah dipakai
//      DS-17 di halaman BOM.
// ============================================================================

const SCSS = 'app/(shell)/routing/routing.scss';
const HALAMAN = 'src/features/mrp/pages/RoutingsPage.tsx';

function blok(isi: string, pemilih: string): string | null {
  const i = isi.indexOf(pemilih + ' {');
  if (i === -1) return null;
  let dalam = 0;
  for (let j = isi.indexOf('{', i); j < isi.length; j++) {
    if (isi[j] === '{') dalam++;
    else if (isi[j] === '}') { dalam--; if (dalam === 0) return isi.slice(i, j + 1); }
  }
  return null;
}

describe('Pilot /routing — D-1 baris tahap mengikuti lebar wadah', () => {
  const scss = tanpaKomentar(readFileSync(SCSS, 'utf8'));
  const baris = blok(scss, '.routing-tahap__baris');

  it('(a) kolom diturunkan dari lebar WADAH, bukan lebar layar', () => {
    expect(baris, 'blok .routing-tahap__baris tidak ditemukan').not.toBeNull();
    expect(baris!).toMatch(/repeat\(\s*auto-fit\s*,\s*minmax\(/);
  });

  it('(b) NOL breakpoint lebar layar yang menentukan jumlah kolom', () => {
    expect(
      /@include breakpoint\(/.test(baris!),
      'breakpoint lebar layar bertabrakan dengan lebar modal yang menyempit'
    ).toBe(false);
    expect(baris!).not.toMatch(/repeat\(\s*\d+\s*,/);
  });

  it('(c) lantai lebar dibungkus min(..., 100%)', () => {
    // Tanpa pembungkus itu, minmax MELUBER saat wadahnya lebih sempit dari lantainya —
    // persis kelas cacat yang sedang diperbaiki.
    const m = baris!.match(/minmax\(\s*min\(\s*([\d.]+)rem\s*,\s*100%\s*\)/);
    expect(m, 'lantai wajib ditulis min(<n>rem, 100%)').not.toBeNull();
    const rem = Number(m![1]);
    expect(rem, 'lantai terlalu sempit').toBeGreaterThanOrEqual(14);
    expect(rem, 'lantai terlalu lebar untuk wadah tersempit').toBeLessThanOrEqual(15.5);
  });

  it('(d) tombol hapus tahap tetap menempati barisnya sendiri dan terpisah', () => {
    expect(scss).toMatch(/\.routing-tahap__baris \.cds--btn--danger--tertiary/);
  });

  it('(e) komentar tidak lagi menyebut jumlah kolom yang tidak berlaku', () => {
    // Komentar yang menyebut "tujuh kolom" berdiri dua baris di atas aturan yang
    // menetapkan tiga. Komentar yang berbohong lebih berbahaya daripada tidak ada:
    // pembaca berikutnya mengira sudah memahami aturannya.
    const mentah = readFileSync(SCSS, 'utf8');
    const i = mentah.indexOf('.routing-tahap__baris');
    const komentarSebelum = mentah.slice(Math.max(0, i - 700), i);
    expect(komentarSebelum, 'komentar menyebut jumlah kolom yang sudah tidak berlaku').not.toMatch(
      /tujuh kolom|7 kolom/
    );
  });
});

describe('Pilot /routing — D-2 aksi merusak tanpa window.confirm', () => {
  const tsx = tanpaKomentar(readFileSync(HALAMAN, 'utf8'));

  it('(f) nol window.confirm', () => {
    expect((tsx.match(/window\.confirm/g) || []).length).toBe(0);
  });

  // Versi pertama kedua uji ini memakai indexOf('<Modal') dan MENUDUH SALAH: ia menangkap
  // `<ModalHeader` milik modal formulir yang berdiri lebih dulu di berkas. Diperketat ke
  // `<Modal ` dengan spasi — dan `blokModal` kini WAJIB ditemukan, supaya uji (h) tidak
  // bisa lolos hampa saat modalnya tidak ada sama sekali.
  const iModal = tsx.search(/<Modal\s/);
  const blokModal = iModal > -1 ? tsx.slice(iModal, iModal + 900) : null;

  it('(g) konfirmasi hapus lewat Modal Carbon varian danger', () => {
    expect(iModal, 'Modal Carbon tidak ditemukan').toBeGreaterThan(-1);
    expect(blokModal!, 'modal konfirmasi hapus wajib bervarian danger').toMatch(/\bdanger\b/);
  });

  it('(h) konfirmasi menyebut NAMA dan VERSI yang akan dihapus', () => {
    // Konfirmasi yang cuma bertanya "yakin hapus?" tidak menolong orang yang salah
    // menekan baris. Pola yang sama sudah dipakai DS-17 di halaman BOM.
    expect(iModal, 'Modal Carbon tidak ditemukan').toBeGreaterThan(-1);
    expect(blokModal!).toMatch(/item_code/);
    expect(blokModal!).toMatch(/version/);
  });

  it('(i) aksi merusak tetap terpisah dari aksi biasa', () => {
    const scss = tanpaKomentar(readFileSync(SCSS, 'utf8'));
    expect(scss).toMatch(/\.routing-aksi__merusak/);
    expect(tsx).toMatch(/danger--tertiary/);
  });
});
