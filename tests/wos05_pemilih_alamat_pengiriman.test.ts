import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tanpaKomentar } from './util/tanpaKomentar';

// WO-S05 (SC-05b) -- alamat tersimpan dapat DIPILIH saat membuat pengiriman.
//
// KENAPA PENJAGA SUMBER, BUKAN TEST PERILAKU SERVER. Perilaku server-nya SUDAH
// terbukti dan tidak diubah sedikit pun oleh pekerjaan ini: `pmb07b_delivery_addresses`
// sudah membuktikan bahwa alamat yang dipilih dibekukan, dan bahwa mengubah alamat
// master SETELAH surat jalan terbit tidak mengubah surat jalan itu. Menulis ulang
// pembuktian yang sama di sini hanya akan menghasilkan test kedua untuk hal yang sama.
//
// Yang BARU dan karena itu berisiko adalah PINTUNYA: server sudah menerima
// `delivery_address_id` sejak PMB-07b, tetapi halaman Pengiriman tidak pernah
// mengirimnya. Risiko yang dijaga di sini adalah pintu itu dicabut atau melenceng
// tanpa ada yang menyadarinya.
//
// YANG TIDAK DICAKUP BERKAS INI, disebut supaya tidak dikira lebih luas: ia TIDAK
// membuktikan tampilannya benar di layar (itu bukti peramban di enam lebar), dan
// TIDAK membuktikan sumber kebenaran alamat -- itu sudah dijaga pmb07b.

const AKAR = join(__dirname, '..');
const halaman = tanpaKomentar(readFileSync(join(AKAR, 'src/features/mrp/pages/ShipmentsPage.tsx'), 'utf8'));
const gaya = readFileSync(join(AKAR, 'app/(shell)/shipments/shipments.scss'), 'utf8');

describe('WO-S05 — pemilih alamat tersimpan di formulir pengiriman', () => {
  // (a) Daftar alamat benar-benar DIMUAT, lewat endpoint yang sudah ada -- bukan
  //     lewat endpoint baru yang menduplikasi kemampuan yang sama.
  it('(a) memuat daftar alamat lewat endpoint yang sudah ada', () => {
    expect(halaman).toContain('/api/customer-delivery-addresses?customer_id=');
  });

  // (b) Id benar-benar DIKIRIM. Ini butir yang paling mungkin hilang saat kode
  //     dirapikan, dan hilangnya TIDAK terlihat: pengiriman tetap tercipta, hanya
  //     jejak alamatnya yang lenyap.
  it('(b) mengirim delivery_address_id saat alamat tersimpan dipilih', () => {
    expect(halaman).toMatch(/delivery_address_id:\s*Number\(alamatDipilih\)/);
    expect(halaman).toMatch(/alamatDipilih\s*!==\s*ALAMAT_SEKALI_PAKAI/);
  });

  // (c) Alamat sekali pakai TETAP ADA. Menghapusnya akan membuat pelanggan tanpa
  //     alamat tersimpan tidak bisa dikirimi sama sekali.
  it('(c) alamat sekali pakai tetap bisa diketik', () => {
    expect(halaman).toMatch(/const ALAMAT_SEKALI_PAKAI = 'sekali-pakai'/);
    expect(halaman).toContain('Ketik alamat sekali pakai');
  });

  // (d) Alamat TERARSIP disaring. Server sudah menolaknya, tetapi menawarkannya di
  //     layar lalu menolaknya saat disimpan adalah kegagalan yang bisa dicegah.
  it('(d) alamat terarsip tidak ditawarkan', () => {
    expect(halaman).toMatch(/filter\(\(a\) => !a\.archived_at\)/);
  });

  // (e) TIGA keadaan dibedakan: memuat, kosong, gagal. Menyatukan "gagal dimuat"
  //     dengan "belum punya alamat" membuat orang mengetik ulang tanpa tahu bahwa
  //     alamatnya sebenarnya ada.
  it('(e) keadaan memuat, kosong, dan gagal dibedakan satu sama lain', () => {
    expect(halaman).toContain('Memuat alamat tersimpan');
    expect(halaman).toContain('belum punya alamat tersimpan');
    expect(halaman).toMatch(/alamatGalat\s*\?/);
    expect(halaman).toMatch(/setAlamatGalat\(/);
  });

  // (f) SATU isian, SATU label. Aturan CLAUDE.md 25 Agu 2026: isian yang secara makna
  //     satu hal wajib punya satu label, bukan label per bagian.
  it('(f) pemilih dan kotak ketik berbagi satu label "Alamat tujuan"', () => {
    const labelAlamat = halaman.match(/labelText="Alamat tujuan"/g) ?? [];
    expect(labelAlamat.length).toBe(1);
    expect(halaman).toMatch(/hideLabel=\{alamatTersimpan\.length > 0\}/);
  });

  // (g) Properti KOSONG tidak sama dengan properti TIDAK ADA (aturan 25 Agu 2026).
  //     `labelText=""` tetap merender elemen labelnya dan membuat kontrol tanpa nama
  //     bagi pembaca layar.
  it('(g) tidak ada labelText kosong di halaman ini', () => {
    expect(halaman).not.toMatch(/labelText=""/);
    expect(halaman).not.toMatch(/titleText=""/);
  });

  // (h) Alamat yang dipilih dari daftar TIDAK bisa diketik ulang. Bila bisa, teks
  //     yang tampil dan alamat yang dirujuk id-nya dapat berbeda -- dan server akan
  //     menimpanya diam-diam, sehingga yang tercetak bukan yang terbaca di layar.
  it('(h) alamat dari daftar bersifat baca-saja di kotak teksnya', () => {
    expect(halaman).toMatch(/readOnly=\{alamatDipilih !== ALAMAT_SEKALI_PAKAI\}/);
  });

  // (i) Nol angka px dan nol warna heksadesimal pada gaya baru (aturan DS D.1).
  it('(i) gaya baru memakai token, bukan angka px atau warna heksadesimal', () => {
    const blokBaru = gaya.slice(gaya.indexOf('.kirim-form__keterangan'));
    expect(blokBaru).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(blokBaru).not.toMatch(/\b\d+px\b/);
    expect(blokBaru).toContain('$text-secondary');
    expect(blokBaru).toContain('$text-error');
  });

  // (j) SUMBER KEBENARAN TIDAK BERGESER. Halaman ini tidak boleh mulai membaca
  //     `customers.shipping_address` (kolom lama yang nasibnya menunggu BL-04),
  //     dan tidak boleh berhenti mengirim teks alamatnya.
  it('(j) tidak menyentuh kolom lama customers.shipping_address', () => {
    expect(halaman).not.toContain('shipping_address');
    expect(halaman).toMatch(/delivery_address:\s*deliveryAddress\.trim\(\)/);
  });
});
