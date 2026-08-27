import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { tanpaKomentar } from './util/tanpaKomentar';

// ============================================================================
// DS-22 — BARIS KOMPONEN BOM: KOLOM MENGIKUTI WADAHNYA, BUKAN LEBAR LAYAR
// ============================================================================
// Cacat yang dijaga di sini BUKAN "formulirnya panjang". Formulir berulang memang panjang,
// dan Carbon sudah menandai isi yang terpotong lewat mask-image gradien pada
// .cds--modal-scroll-content yang dinyalakan ComposedModal sendiri.
//
// Cacatnya: JUMLAH KOLOM ditentukan lebar LAYAR, padahal barisnya hidup di dalam modal
// yang justru MENYEMPIT saat layar melebar (Carbon _modal.scss: 84% -> 60% mulai 1056px
// -> 48% mulai 1312px). Dua perubahan berlawanan arah bertemu di satu piksel viewport:
//
//   viewport 1055px -> wadah 886px -> 2 kolom -> 402px per kontrol -> helper 2 baris
//   viewport 1056px -> wadah 634px -> 4 kolom -> 130px per kontrol -> helper 5 baris
//
// Kolom TERSEMPIT di seluruh rentang justru ada di DESKTOP. Analisis pertama menyatakan
// desktop "kemungkinan besar tidak bermasalah" — dan itu keliru; pemeriksaan tandingan
// yang menemukannya.
//
// Uji ini membaca sumber, bukan merender — alasannya sama seperti berkas uji DS-21.
// ============================================================================

const SCSS = 'app/(shell)/boms/boms.scss';
const HALAMAN = 'src/features/mrp/pages/BomsPage.tsx';

/// Mengambil satu blok aturan CSS teratas berdasarkan pemilihnya, termasuk blok bersarang.
function blok(isi: string, pemilih: string): string | null {
  const i = isi.indexOf(pemilih + ' {');
  if (i === -1) return null;
  let dalam = 0;
  for (let j = isi.indexOf('{', i); j < isi.length; j++) {
    if (isi[j] === '{') dalam++;
    else if (isi[j] === '}') {
      dalam--;
      if (dalam === 0) return isi.slice(i, j + 1);
    }
  }
  return null;
}

describe('DS-22 — baris komponen BOM', () => {
  const scss = tanpaKomentar(readFileSync(SCSS, 'utf8'));
  const tsx = tanpaKomentar(readFileSync(HALAMAN, 'utf8'));
  const baris = blok(scss, '.bom-komponen__baris');

  it('(a) jumlah kolom diturunkan dari LEBAR YANG TERSEDIA, bukan dari lebar layar', () => {
    expect(baris, 'blok .bom-komponen__baris tidak ditemukan').not.toBeNull();
    expect(
      baris!,
      'kolomnya harus memakai auto-fit + minmax supaya membaca lebar wadahnya sendiri'
    ).toMatch(/repeat\(\s*auto-fit\s*,\s*minmax\(/);
  });

  it('(b) NOL breakpoint lebar layar yang menentukan jumlah kolom baris komponen', () => {
    // Inilah akar cacatnya. Ambang 1056px milik Carbon adalah tempat modal MENYEMPIT;
    // menaikkan jumlah kolom di ambang yang sama membuat tiap kontrol jatuh ke 130px.
    expect(
      /@include breakpoint\(/.test(baris!),
      'baris komponen tidak boleh lagi memakai breakpoint lebar layar untuk jumlah kolom'
    ).toBe(false);
    expect(baris!, 'nol grid-template-columns bernilai repeat(N, ...) tetap').not.toMatch(
      /repeat\(\s*\d+\s*,/
    );
  });

  it('(c) ada lebar minimum per kontrol, dinyatakan dalam rem, dan cukup lapang', () => {
    // Lantainya WAJIB dibungkus min(..., 100%). Tanpa itu `minmax(15rem, 1fr)` justru
    // MELUBER saat wadahnya lebih sempit dari 15rem — kolomnya menolak menyusut di bawah
    // lantainya sendiri, yang persis kelas cacat yang sedang diperbaiki batch ini.
    const m = baris!.match(/minmax\(\s*min\(\s*([\d.]+)rem\s*,\s*100%\s*\)/);
    expect(
      m,
      'lebar minimum harus ditulis min(<n>rem, 100%) supaya tidak melahirkan gulir menyamping baru'
    ).not.toBeNull();
    const rem = Number(m![1]);
    // 130px adalah lebar yang terukur merusak. 15rem = 240px memberi jarak jelas dari itu,
    // dan tetap memuat dua kolom di wadah tersempit yang punya lebih dari satu kolom (498px).
    expect(rem, 'lebar minimum per kontrol terlalu sempit').toBeGreaterThanOrEqual(14);
    expect(rem, 'lebar minimum terlalu lebar — wadah 498px tidak akan muat dua kolom').toBeLessThanOrEqual(15.5);
  });

  it('(d) perbaikannya bukan pemotongan, dan isinya tidak dipenggal', () => {
    expect(baris!).not.toMatch(/overflow-x:\s*hidden/);
    expect(baris!).not.toMatch(/overflow:\s*hidden/);
    const komponen = blok(scss, '.bom-komponen');
    expect(komponen!, 'daftar komponen tidak boleh dipenggal tinggi tetap').not.toMatch(
      /max-block-size|max-height/
    );
  });

  it('(e) tombol hapus baris tetap terpisah dan tetap dapat dijangkau', () => {
    // Aturan CLAUDE.md nomor 9: aksi merusak berjauhan dari aksi sehari-hari. Ia menempati
    // barisnya sendiri dan didorong ke ujung — itu disengaja, bukan sisa tata letak.
    expect(baris!).toMatch(/grid-column:\s*1\s*\/\s*-1/);
    expect(baris!).toMatch(/justify-self:\s*end/);
    expect(tsx, 'tombol hapus baris harus tetap ada di setiap baris').toMatch(/danger--tertiary/);
  });

  it('(f) menambah dan menghapus komponen tetap ada — perbaikan tata letak tidak boleh mencabut fungsi', () => {
    expect(tsx).toMatch(/Tambah komponen/);
    expect(tsx).toMatch(/addLine/);
    expect(tsx).toMatch(/removeLine/);
  });
});
