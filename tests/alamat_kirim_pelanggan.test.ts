// WS-05 — ALAMAT TUJUAN KIRIM PELANGGAN: kapabilitas yang ADA di server tetapi NOL layar.
//
// ============================================================================
// KENAPA INI DIKERJAKAN, DAN KENAPA IA BUKAN "FITUR BARU"
// ============================================================================
// Server, basis data, RLS, arsip/pulih, dan tiga route sudah ada sejak PMB-07b — dan NOL
// halaman memakainya. Audit Sales mengukurnya: 3 dari 4 route Sales tanpa pemanggil UI
// seluruhnya milik alamat kirim. Ini kapabilitas PARTIAL yang DILENGKAPI, bukan kapabilitas
// baru yang dibangun. Keputusan pemilik produk DEC-S09 menutupnya: "BUILD THE UI".
//
// Yang dijaga di sini: alamat kirim mengikuti kontrak validasi yang sama dengan tiga modul
// sebelumnya, dan layarnya memakai pola FABRIX yang sudah ada — bukan pola baru.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tanpaKomentar } from './util/tanpaKomentar';
import {
  petakanGalatAlamat,
  FIELD_ALAMAT,
  galatFieldAlamat
} from '../src/features/mrp/server/customerDeliveryAddresses';

const halaman = () =>
  tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/pages/CustomersPage.tsx'), 'utf8'));

describe('WS-05 — alamat tujuan kirim pelanggan', () => {
  it('(a) registri memuat hanya isian yang bisa ditolak server', () => {
    expect([...FIELD_ALAMAT].sort()).toEqual(['address', 'customer_id', 'label']);
  });

  it('(b) galat yang sah dipetakan ke kontrolnya', () => {
    for (const field of FIELD_ALAMAT) {
      expect(petakanGalatAlamat({ error: 'Pesan uji.', field }, 0))
        .toEqual({ jenis: 'field', field, line: undefined, pesan: 'Pesan uji.' });
    }
  });

  it('(c) nama tak dikenal atau salah ketik TIDAK menghilangkan galatnya', () => {
    for (const field of ['alamat', 'labell', 'customer', '', 'LABEL']) {
      const h = petakanGalatAlamat({ error: 'Pesan asli.', field }, 0);
      expect(h.jenis, `"${field}" tidak dikenal`).toBe('formulir');
      expect(h.pesan).toBe('Pesan asli.');
    }
  });

  it('(d) galat tingkat formulir tetap tingkat formulir', () => {
    for (const pesan of [
      'Role Anda tidak punya izin mengelola alamat tujuan kirim.',
      'Alamat tidak ditemukan.',
      'Alamat yang sudah diarsipkan tidak bisa diubah. Pulihkan dulu.'
    ]) {
      expect(petakanGalatAlamat({ error: pesan }, 0)).toEqual({ jenis: 'formulir', pesan });
    }
  });

  it('(e) modul tanpa baris berulang menolak line apa pun', () => {
    for (const line of [0, 1, 99]) {
      expect(petakanGalatAlamat({ error: 'x', field: 'label', line }, 0))
        .toEqual({ jenis: 'field', field: 'label', line: undefined, pesan: 'x' });
    }
  });

  it('(f) pembangun bertipe menyusun badan jawaban', () => {
    expect(galatFieldAlamat('Nama panggilan alamat wajib diisi.', 'label'))
      .toEqual({ error: 'Nama panggilan alamat wajib diisi.', field: 'label' });
  });

  it('(g) layar memakai POLA FABRIX yang sudah ada, bukan pola baru', () => {
    const s = halaman();
    // Baris yang bisa dimekarkan — pola yang sama dengan Purchasing, Items, BOM, Work Order.
    expect(s, 'alamat ditampilkan di baris yang dimekarkan, bukan halaman baru').toMatch(/TableExpandRow/);
    expect(s).toMatch(/TableExpandedRow/);
    // Aksi merusak lewat modal danger Carbon — BUKAN window.confirm (aturan proyek).
    expect(s, 'arsip alamat wajib lewat modal danger Carbon').toMatch(/alamatAkanDiarsipkan/);
  });

  it('(h) setiap nama registri benar-benar ditandai di layar', () => {
    const s = halaman();
    for (const f of FIELD_ALAMAT) {
      if (f === 'customer_id') continue; // pelanggan sudah tertentu dari baris yang dimekarkan
      expect(s, `"${f}" tidak ditandai invalid`).toMatch(new RegExp(`invalid=\\{Boolean\\(galatAlamat\\('${f}'\\)\\)\\}`));
      expect(s, `"${f}" ditandai TANPA pesan`).toMatch(new RegExp(`invalidText=\\{galatAlamat\\('${f}'\\)`));
    }
  });

  it('(i) layar memetakan lewat pintu bersama dan menggerbang notifikasinya', () => {
    const s = halaman();
    expect(s).toMatch(/petakanGalatAlamat/);
    expect(s, 'jangan membaca body.field mentah').not.toMatch(/body\.field/);
    expect(s, 'jangan menulis aria-invalid sendiri').not.toMatch(/aria-invalid=/);
    expect(s).toMatch(/alamatFieldError\.length === 0/);
  });

  it('(j) keadaan memuat, kosong ber-aksi, dan galat tersedia', () => {
    const s = halaman();
    expect(s, 'keadaan memuat').toMatch(/alamatLoading/);
    expect(s, 'keadaan kosong harus menawarkan aksi, bukan hanya "belum ada"').toMatch(/Tambah alamat pertama/);
    expect(s, 'keadaan galat').toMatch(/alamatError/);
  });
});
