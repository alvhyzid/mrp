import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { tanpaKomentar } from './util/tanpaKomentar';

// ============================================================================
// P0 — /purchasing: PENYIMPANAN BERHASIL DITAMPILKAN SEBAGAI "GAGAL"
// ============================================================================
// Rantainya, seluruhnya terbaca di kode:
//   1. handleSaveSupplier berhasil -> setSupplierFormStatus('success')
//      dan setSupplierFormMessage('Supplier baru berhasil ditambahkan.')
//   2. notifikasi dirender dengan syarat `supplierFormMessage ? ... : null` —
//      MENGABAIKAN supplierFormStatus sepenuhnya
//   3. kind="error" dan title="Gagal" DIPAKU MATI
//   4. modal TIDAK ditutup, dan formulirnya DIKOSONGKAN
//
// Ketiganya bersama-sama mengundang pengisian ulang: pengguna melihat kotak merah
// "Gagal", form kosong, modal masih terbuka — dan menekan Simpan lagi.
//
// AKAR MASALAHNYA BUKAN JUDUL. State `supplierFormStatus` SUDAH tahu jawabannya
// ('idle' | 'saving' | 'success' | 'error'); notifikasinya saja yang tidak membacanya.
//
// ============================================================================
// KEUNIKAN SUPPLIER SENGAJA TIDAK DISENTUH
// ============================================================================
// Diaudit: nol kolom kode supplier, nol pemeriksaan duplikat, dan NOL supplier di
// production — jadi tidak ada bukti empiris tentang aturan bisnisnya. Uniqueness
// hanya bisa jatuh ke `name`, yaitu nilai tampilan yang BISA BERUBAH. Menambahkan
// kekangan atas dasar tebakan akan mengulang kelas cacat yang sama dengan T-1.
// Kekangan TIDAK dibuat; pertanyaannya diangkat ke pemilik produk.
// ============================================================================

const HALAMAN = 'src/features/mrp/pages/PurchasingPage.tsx';

describe('P0 /purchasing — berhasil tidak boleh tampil sebagai gagal', () => {
  const tsx = tanpaKomentar(readFileSync(HALAMAN, 'utf8'));

  it('(a) nol notifikasi galat yang judulnya dipaku mati "Gagal" untuk pesan formulir', () => {
    // Judul yang dipaku mati membuat SETIAP pesan — termasuk pesan berhasil — terbaca
    // sebagai kegagalan.
    const dipakuMati = (tsx.match(/kind="error"[^>]*title="Gagal"/g) || []).length;
    expect(dipakuMati, 'title="Gagal" tidak boleh dipaku mati bersama kind="error"').toBe(0);
  });

  it('(b) notifikasi formulir BERSYARAT STATUS, bukan sekadar ada-tidaknya pesan', () => {
    // Inilah akar masalahnya: `pesan ? <galat/> : null` mengabaikan state yang sudah
    // tahu apakah operasinya berhasil.
    for (const state of ['supplierFormStatus', 'priceFormStatus', 'poFormStatus']) {
      if (!tsx.includes(state)) continue;
      const pesan = state.replace('Status', 'Message');
      const menyaringStatus = new RegExp(`${state}\\s*===\\s*'error'`).test(tsx);
      expect(
        menyaringStatus,
        `notifikasi untuk ${pesan} harus dikendalikan ${state}, bukan ada-tidaknya pesan`
      ).toBe(true);
    }
  });

  it('(c) berhasil menutup modal — bukan meninggalkannya terbuka dengan form kosong', () => {
    const i = tsx.indexOf("setSupplierFormStatus('success')");
    expect(i, 'jalur berhasil supplier tidak ditemukan').toBeGreaterThan(-1);
    const sesudah = tsx.slice(i, i + 700);
    expect(
      /tutupSupplierModal\(\)|setIsSupplierModalOpen\(false\)/.test(sesudah),
      'modal WAJIB ditutup saat berhasil'
    ).toBe(true);
  });

  it('(d) berhasil dilaporkan lewat notifikasi bersama, bukan kotak di dalam modal', () => {
    // Aturan proyek: modal untuk MEMUTUSKAN, notifikasi untuk MEMBERI TAHU.
    expect(tsx, 'halaman harus memakai AreaNotifikasi bersama').toMatch(/AreaNotifikasi/);
    const i = tsx.indexOf("setSupplierFormStatus('success')");
    expect(/beriTahu\('success'/.test(tsx.slice(i, i + 700)), 'berhasil harus lewat notifikasi').toBe(true);
  });

  it('(e) GAGAL tetap membuka modal dan mempertahankan isian — bisa diperbaiki', () => {
    const i = tsx.indexOf("setSupplierFormStatus('error')");
    expect(i).toBeGreaterThan(-1);
    const sesudah = tsx.slice(i, i + 400);
    expect(
      /tutupSupplierModal\(\)|setSupplierForm\(emptySupplierForm\)/.test(sesudah),
      'saat gagal, modal TIDAK boleh ditutup dan isian TIDAK boleh dikosongkan'
    ).toBe(false);
  });

  it('(f) daftar supplier tetap dimuat ulang sesudah berhasil', () => {
    const i = tsx.indexOf("setSupplierFormStatus('success')");
    expect(/loadSuppliers\(/.test(tsx.slice(i, i + 700))).toBe(true);
  });

  it('(g) KEUNIKAN supplier SENGAJA tidak dipaksakan — belum ada aturan bisnisnya', () => {
    // Uji ini menjaga supaya kekangan tidak diselundupkan tanpa keputusan.
    const migrasi = tanpaKomentar(
      readFileSync('supabase/migrations/20260812152000_suppliers_purchase_orders.sql', 'utf8')
    );
    expect(
      /unique\s*\(\s*company_id\s*,\s*name\s*\)/i.test(migrasi),
      'kekangan unik pada nama supplier belum boleh ada — aturan bisnisnya belum terbukti'
    ).toBe(false);
  });
});
