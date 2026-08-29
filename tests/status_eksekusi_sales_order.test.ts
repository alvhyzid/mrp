// WS-A / DEC-S11 — STATUS KOMERSIAL vs VISIBILITAS EKSEKUSI.
//
// ============================================================================
// ATURAN YANG DIJAGA BERKAS INI
// ============================================================================
// Sales Order memiliki kebenaran KOMERSIAL. Ia TIDAK memiliki kebenaran produksi maupun
// pengiriman. Arahan bisnis DEC-S11:
//   `cancelled`     -> milik Sales
//   `in_production` -> milik Manufacturing (Work Order)
//   `completed`     -> butuh bukti lintas domain (pengiriman + konfirmasi)
//
// Karena itu status eksekusi DITURUNKAN saat dibaca, dan TIDAK PERNAH disimpan di
// `sales_orders`. Menyimpannya akan melahirkan sumber kebenaran kedua untuk hal yang sudah
// dimiliki domain lain -- persis yang dilarang.
//
// Registry state machine kanonik menutup bagiannya dengan "Do not copy these blindly into
// code. Reconcile with current implementation" -- jadi nama status TIDAK disalin dari contoh
// di sana; yang dijaga di sini adalah KEPEMILIKANNYA.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tanpaKomentar } from './util/tanpaKomentar';
import { turunkanEksekusiSo } from '../src/features/mrp/server/eksekusiSalesOrder';

const baris = (qty: number, terkirim: number) => ({ qty_ordered: qty, qty_shipped: terkirim });

describe('WS-A — visibilitas eksekusi Sales Order diturunkan, bukan disimpan', () => {
  it('(a) tanpa Work Order: produksi "belum"', () => {
    expect(turunkanEksekusiSo([baris(10, 0)], []).produksi).toBe('belum');
  });

  it('(b) Work Order ada tetapi belum jalan: "direncanakan"', () => {
    expect(turunkanEksekusiSo([baris(10, 0)], ['planned']).produksi).toBe('direncanakan');
  });

  it('(c) satu Work Order berjalan: "berjalan" — walau yang lain masih direncanakan', () => {
    expect(turunkanEksekusiSo([baris(10, 0)], ['planned', 'in_progress']).produksi).toBe('berjalan');
  });

  it('(d) seluruh Work Order selesai: "selesai"', () => {
    expect(turunkanEksekusiSo([baris(10, 0)], ['completed', 'completed']).produksi).toBe('selesai');
  });

  it('(e) Work Order batal TIDAK dihitung sebagai berjalan maupun selesai', () => {
    // Sebuah WO yang dibatalkan bukan bukti produksi berjalan, dan bukan bukti selesai.
    expect(turunkanEksekusiSo([baris(10, 0)], ['cancelled']).produksi).toBe('belum');
    expect(turunkanEksekusiSo([baris(10, 0)], ['completed', 'cancelled']).produksi).toBe('selesai');
  });

  it('(f) pengiriman diturunkan dari qty terkirim vs dipesan', () => {
    expect(turunkanEksekusiSo([baris(10, 0)], []).pengiriman).toBe('belum');
    expect(turunkanEksekusiSo([baris(10, 4)], []).pengiriman).toBe('sebagian');
    expect(turunkanEksekusiSo([baris(10, 10)], []).pengiriman).toBe('penuh');
    // Beberapa baris: penuh HANYA bila seluruh baris terpenuhi.
    expect(turunkanEksekusiSo([baris(10, 10), baris(5, 2)], []).pengiriman).toBe('sebagian');
    expect(turunkanEksekusiSo([baris(10, 10), baris(5, 5)], []).pengiriman).toBe('penuh');
  });

  it('(g) kirim berlebih tidak membuatnya lebih dari "penuh"', () => {
    expect(turunkanEksekusiSo([baris(10, 12)], []).pengiriman).toBe('penuh');
  });

  it('(h) Sales Order tanpa baris tidak mengaku terkirim penuh', () => {
    // Nol baris berarti tidak ada komitmen -- bukan komitmen yang sudah dipenuhi.
    expect(turunkanEksekusiSo([], []).pengiriman).toBe('belum');
  });

  it('(i) NOL kode menyimpan status eksekusi ke sales_orders', () => {
    // Penjaga inti DEC-S11. Bila kelak seseorang menambah kolom produksi/pengiriman di
    // sales_orders atau menulis statusnya, kebenaran domain lain terduplikasi -- dan
    // penjaga ini berbunyi.
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/server/eksekusiSalesOrder.ts'), 'utf8'));
    expect(s, 'modul penurunan tidak boleh menyentuh basis data sama sekali').not.toMatch(/from\('/);
    expect(s).not.toMatch(/adminClient/);
  });

  it('(j) daftar Sales Order mengirim eksekusi sebagai turunan, bukan kolom tersimpan', () => {
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/server/listSalesOrders.ts'), 'utf8'));
    expect(s, 'harus memakai fungsi penurunan bersama').toMatch(/turunkanEksekusiSo/);
    expect(s, 'status Work Order wajib ikut dibaca untuk menurunkannya').toMatch(/work_orders'\)\s*\n?\s*\.select\([^)]*status/);
  });

  it('(k) layar memisahkan status komersial dari visibilitas eksekusi', () => {
    const s = tanpaKomentar(readFileSync(join(process.cwd(), 'src/features/mrp/pages/SalesOrdersPage.tsx'), 'utf8'));
    // Versi pertama penjaga ini mencari nama peta saja — dan itu TERLALU LONGGAR: mencabut
    // DEFINISINYA sambil meninggalkan pemakaiannya di JSX tetap membuatnya HIJAU. Diperketat
    // ke definisi, karena definisi yang hilang berarti labelnya tidak ada.
    expect(s, 'definisi label produksi turunan').toMatch(/const eksekusiProduksiLabels\s*:/);
    expect(s, 'definisi label pengiriman turunan').toMatch(/const eksekusiPengirimanLabels\s*:/);
    expect(s, 'keduanya dipakai di layar').toMatch(/eksekusiProduksiLabels\[/);
    expect(s, 'keduanya dipakai di layar').toMatch(/eksekusiPengirimanLabels\[/);
    // Keduanya WAJIB dijelaskan sebagai turunan, bukan status Sales.
    expect(s, 'layar harus menyebut bahwa eksekusi berasal dari domain lain').toMatch(/Produksi|Pengiriman/);
  });
});
