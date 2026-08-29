// VISIBILITAS EKSEKUSI SALES ORDER — DITURUNKAN, TIDAK PERNAH DISIMPAN.
//
// ============================================================================================
// KENAPA BERKAS INI ADA
// ============================================================================================
// Sales Order memiliki kebenaran KOMERSIAL: apa yang dijanjikan ke pelanggan, dan apakah
// janji itu masih berlaku. Ia TIDAK memiliki kebenaran produksi maupun pengiriman — keduanya
// milik Manufacturing (Work Order) dan Logistik (shipments).
//
// Arahan bisnis DEC-S11 memisahkannya secara eksplisit:
//   `cancelled`     -> milik Sales
//   `in_production` -> milik Manufacturing
//   `completed`     -> butuh bukti lintas domain
//
// Kalau status produksi ikut DISIMPAN di `sales_orders`, lahirlah sumber kebenaran KEDUA untuk
// hal yang sudah dimiliki domain lain: dua angka yang bisa berbeda, dan tidak ada yang tahu
// mana yang benar saat keduanya menyimpang. Karena itu berkas ini MENURUNKAN status eksekusi
// saat dibaca, dari data yang sudah dimiliki pemiliknya masing-masing.
//
// SENGAJA MURNI: nol query, nol klien basis data. Pemanggilnyalah yang membaca data; berkas
// ini hanya menghitung. Itu juga yang membuatnya bisa diuji tanpa basis data sama sekali.

export type ProduksiTurunan = 'belum' | 'direncanakan' | 'berjalan' | 'selesai';
export type PengirimanTurunan = 'belum' | 'sebagian' | 'penuh';

export interface EksekusiSo {
  /// Diturunkan dari status Work Order yang menunjuk baris SO ini. Pemiliknya Manufacturing.
  produksi: ProduksiTurunan;
  /// Diturunkan dari qty terkirim vs qty dipesan. Pemiliknya Logistik lewat `qty_shipped`,
  /// yang dipelihara pemicu basis data saat pengiriman diproses.
  pengiriman: PengirimanTurunan;
}

interface BarisSo {
  qty_ordered: number | string;
  qty_shipped: number | string | null;
}

export function turunkanEksekusiSo(
  lines: readonly BarisSo[],
  statusWorkOrder: readonly string[]
): EksekusiSo {
  // ---- PRODUKSI --------------------------------------------------------------------------
  // Work Order yang DIBATALKAN sengaja tidak dihitung: ia bukan bukti produksi berjalan, dan
  // bukan bukti produksi selesai. Menghitungnya akan membuat SO yang seluruh WO-nya batal
  // tampak "selesai diproduksi".
  const hidup = statusWorkOrder.filter((s) => s !== 'cancelled');
  let produksi: ProduksiTurunan = 'belum';
  if (hidup.length > 0) {
    if (hidup.every((s) => s === 'completed')) produksi = 'selesai';
    else if (hidup.some((s) => s !== 'planned')) produksi = 'berjalan';
    else produksi = 'direncanakan';
  }

  // ---- PENGIRIMAN ------------------------------------------------------------------------
  // "Penuh" hanya bila SELURUH baris terpenuhi. Sales Order tanpa baris dilaporkan "belum":
  // nol baris berarti tidak ada komitmen, bukan komitmen yang sudah dipenuhi.
  let pengiriman: PengirimanTurunan = 'belum';
  if (lines.length > 0) {
    const adaTerkirim = lines.some((l) => Number(l.qty_shipped ?? 0) > 0);
    const semuaPenuh = lines.every((l) => Number(l.qty_shipped ?? 0) >= Number(l.qty_ordered));
    if (semuaPenuh) pengiriman = 'penuh';
    else if (adaTerkirim) pengiriman = 'sebagian';
  }

  return { produksi, pengiriman };
}
