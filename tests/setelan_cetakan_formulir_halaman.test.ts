import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { tanpaKomentar } from './util/tanpaKomentar';

// ============================================================================
// CETAKAN HALAMAN FORMULIR PENUH — /company/setelan
// ============================================================================
// D-A (diterima pemilik produk): <form> sungguhan + <Tile> per kelompok makna +
// <h2> judul kelompok + kisi auto-fit + lebar terbaca yang dibatasi.
//
// Halaman ini dipilih jadi cetakan BUKAN karena paling penting, melainkan karena
// ia SATU-SATUNYA halaman formulir penuh yang sudah ada — dan ia sudah memenuhi
// hampir seluruh D-A. Yang kurang tepat satu hal: elemen <form>-nya sendiri.
//
// AKIBAT KETIADAAN <form>, dan ini bukan soal kerapian:
//   - Enter tidak menyimpan
//   - atribut `required` HTML tidak berlaku
//   - tidak ada satu titik pun untuk validasi tingkat formulir
// ============================================================================

const HALAMAN = 'src/features/company/pages/SetelanPerhitunganPage.tsx';
const SCSS = 'app/(shell)/company/setelan/setelan.scss';

describe('Cetakan halaman formulir penuh (D-A) — /company/setelan', () => {
  const tsx = tanpaKomentar(readFileSync(HALAMAN, 'utf8'));
  const scss = tanpaKomentar(readFileSync(SCSS, 'utf8'));

  it('(a) memakai elemen <form> sungguhan, bukan <div> yang menyimpan lewat onClick', () => {
    expect(tsx, 'halaman formulir penuh WAJIB berpembungkus <form>').toMatch(/<form[\s>]/);
  });

  it('(b) aksi utama adalah submit form, bukan onClick lepas', () => {
    expect(tsx, 'tombol utama harus type="submit"').toMatch(/type="submit"/);
    expect(tsx, 'form harus punya onSubmit').toMatch(/onSubmit=/);
  });

  it('(c) submit menahan perilaku bawaan peramban', () => {
    // Tanpa preventDefault, menekan Enter memuat ulang halaman dan draf hilang.
    expect(tsx).toMatch(/preventDefault\(\)/);
  });

  it('(d) kisi mengikuti lebar wadah — auto-fit, nol breakpoint lebar layar', () => {
    expect(scss).toMatch(/repeat\(\s*auto-fit\s*,\s*minmax\(\s*min\(/);
    const blok = scss.slice(scss.indexOf('.setelan-kisi'), scss.indexOf('.setelan-kisi') + 260);
    expect(/@include breakpoint\(/.test(blok), 'jumlah kolom tidak boleh dari lebar layar').toBe(false);
  });

  it('(e) lebar terbaca dibatasi — Carbon tidak membatasi apa pun', () => {
    expect(scss).toMatch(/max-(width|inline-size):\s*\d+rem/);
  });

  it('(f) kelompok memakai <Tile> + <h2>, bukan legend FormGroup', () => {
    // <legend> Carbon tampil 12px text-secondary dan BUKAN elemen heading, jadi ia
    // tidak bisa dilompati pembaca layar lewat daftar heading.
    expect(tsx).toMatch(/<Tile/);
    expect(tsx).toMatch(/<h2/);
  });

  it('(g) aksi sekunder memakai kind="secondary", bukan ghost', () => {
    // Ghost adalah penekanan TERENDAH. "Batalkan perubahan" membuang suntingan
    // pengguna — itu aksi sekunder sungguhan, bukan tautan sampingan.
    const i = tsx.indexOf('Batalkan perubahan');
    expect(i, 'tombol batalkan tidak ditemukan').toBeGreaterThan(-1);
    const blok = tsx.slice(Math.max(0, i - 320), i);
    expect(/kind="ghost"/.test(blok), 'aksi sekunder tidak boleh ghost').toBe(false);
    expect(/kind="secondary"/.test(blok), 'aksi sekunder harus kind="secondary"').toBe(true);
  });

  it('(g2) pola validasi DatePicker SELARAS dengan dateFormat-nya', () => {
    // REGRESI YANG LAHIR DARI BATCH INI, dan wajib dijaga supaya tidak kembali:
    // memasang <form> menyalakan validasi bawaan peramban. Bawaan `pattern` Carbon
    // adalah format Amerika, sedangkan picker ini disetel `Y-m-d` — sehingga
    // form.checkValidity() false dan peramban MEMBLOKIR submit DIAM-DIAM: nol
    // permintaan, nol pesan, nol galat konsol.
    const iPicker = tsx.indexOf('datePickerType');
    expect(iPicker, 'DatePicker tidak ditemukan').toBeGreaterThan(-1);
    const blok = tsx.slice(iPicker, iPicker + 1400);
    const format = blok.match(/dateFormat="([^"]+)"/);
    expect(format, 'dateFormat harus disebut eksplisit').not.toBeNull();
    if (format![1] === 'Y-m-d') {
      expect(
        blok,
        'dateFormat Y-m-d WAJIB disertai pattern yang cocok — bawaan Carbon format Amerika'
      ).toMatch(/pattern="\\d\{4\}-\\d\{2\}-\\d\{2\}"/);
    }
  });

  it('(h) kerangka halaman lewat komponen bersama', () => {
    expect(tsx).toMatch(/KepalaHalaman/);
  });

  it('(i) keadaan memuat, berhasil, dan galat ketiganya dirender', () => {
    expect(tsx, 'keadaan memuat').toMatch(/Skeleton/);
    expect(tsx, 'keadaan berhasil dan galat').toMatch(/InlineNotification/);
  });
});
