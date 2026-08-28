import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { tanpaKomentar } from './util/tanpaKomentar';

// ============================================================================
// PILOT REVISI UI #2 — /work-orders
// ============================================================================
// Empat cacat diperbaiki, seluruhnya berdasar ATURAN TERTULIS yang sudah berlaku,
// bukan selera. Yang lebih besar dari itu sengaja dicatat dan TIDAK dikerjakan,
// karena kelasnya lintas halaman atau menuntut keputusan bisnis.
//
// W-1  Modal formulir DUA KOLOM. cetakan-halaman-data.md §6e mengutip Carbon:
//      "form inputs and other components expand the entire width of a modal",
//      dan menyatakan membelah jadi dua kolom DILARANG.
//      Terukur sebelum perbaikan: 1 kolom di 360px, 2 kolom dari 672px ke atas.
//
// W-2  Pesan galat membocorkan nama kolom berbahasa Inggris ke layar
//      ("Planned qty batch"). Melanggar aturan keras: seluruh teks yang dibaca
//      pemilik produk wajib Bahasa Indonesia.
//
// W-3  Keadaan kosong tanpa jalan keluar. cetakan §4 mewajibkan tombol membuat
//      data pertama pada kosong-belum-ada-data. Kedua macam kosong SUDAH
//      dibedakan dengan benar -- itu bagian sulitnya dan sudah lulus.
//
// W-4  'Siap Mulai' memakai kapital tiap kata. Aturan 25 Agu 2026: kapital hanya
//      di awal kalimat.
// ============================================================================

const HALAMAN = 'src/features/mrp/pages/WorkOrdersPage.tsx';
const SCSS = 'app/(shell)/work-orders/work-orders.scss';
const SERVER = 'src/features/mrp/server/createProductionBatch.ts';

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

describe('Pilot /work-orders', () => {
  const tsx = tanpaKomentar(readFileSync(HALAMAN, 'utf8'));
  const scss = tanpaKomentar(readFileSync(SCSS, 'utf8'));

  it('(a) W-1 modal formulir SATU KOLOM — field memenuhi lebar modal', () => {
    const form = blok(scss, '.wo-form');
    expect(form, 'blok .wo-form tidak ditemukan').not.toBeNull();
    expect(form!, 'nol kisi multi-kolom').not.toMatch(/repeat\(\s*[2-9]\s*,/);
    expect(
      /@include breakpoint\(/.test(form!),
      'nol breakpoint lebar layar — modal justru menyempit saat layar melebar'
    ).toBe(false);
  });

  it('(b) W-1 isian berpasangan tetap boleh berdampingan', () => {
    // §6e membedakan DUA KOLOM dari SATU ISIAN BERPASANGAN. Kelas lebar-penuh
    // tetap dipertahankan supaya field panjang bisa memenuhi lebar modal.
    expect(scss).toMatch(/\.wo-form__lebar-penuh/);
  });

  it('(c) W-2 nol nama kolom berbahasa Inggris di pesan yang dibaca pengguna', () => {
    for (const berkas of [HALAMAN, SERVER]) {
      const isi = tanpaKomentar(readFileSync(berkas, 'utf8'));
      expect(isi, `${berkas} membocorkan nama kolom ke layar`).not.toMatch(/Planned qty/);
    }
  });

  it('(d) W-3 KEDUA macam kosong menawarkan jalan keluarnya SENDIRI', () => {
    // Versi pertama uji ini mencari `<Button` mana pun di sekitar teks kosong, dan LOLOS
    // HAMPA saat tombol "buat pertama" dicabut -- karena cabang kosong-karena-saringan
    // punya tombolnya sendiri di jendela yang sama. Diperketat ke DUA jalan keluar yang
    // BERBEDA, masing-masing disebut namanya.
    //
    // cetakan §4: kosong-belum-ada-data -> tombol membuat data pertama;
    //             kosong-karena-saringan -> jalan menghapus saringan.
    expect(tsx, 'kosong-belum-ada-data wajib menawarkan tombol membuat').toMatch(
      /Buat Work Order pertama/
    );
    expect(tsx, 'kosong-karena-saringan wajib menawarkan jalan menghapus saringan').toMatch(
      /Hapus saringan/
    );
  });

  it('(e) W-3 dua macam kosong tetap DIBEDAKAN', () => {
    // Menyamakan keduanya adalah cacat: yang satu berarti "mulailah", yang satu
    // berarti "longgarkan saringanmu". Ini sudah benar sebelum batch ini.
    expect(tsx).toMatch(/Tidak ada Work Order yang cocok/);
    expect(tsx).toMatch(/Belum ada Work Order/);
  });

  it('(f) W-4 kapital hanya di awal kalimat pada label status', () => {
    const i = tsx.indexOf('readinessLabels');
    expect(i).toBeGreaterThan(-1);
    const b = tsx.slice(i, i + 200);
    expect(b, 'label tidak boleh berkapital tiap kata').not.toMatch(/'Siap Mulai'/);
    expect(b).toMatch(/'Siap mulai'/);
  });

  it('(g) yang SUDAH benar tidak boleh mundur — notifikasi membaca STATUS', () => {
    // Berbeda dari /purchasing: halaman ini sudah menentukan jenis notifikasi dari
    // formStatus, bukan dari ada-tidaknya pesan. Dijaga supaya tidak berubah.
    expect(tsx).toMatch(/formStatus === 'success' \? 'success' : 'error'/);
  });

  it('(h) yang SUDAH benar tidak boleh mundur — penjaga peran & window.confirm', () => {
    expect(tsx, 'penjaga peran tingkat halaman').toMatch(/accessDenied/);
    expect((tsx.match(/window\.confirm/g) || []).length).toBe(0);
  });
});
