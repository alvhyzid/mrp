// SHELF LIFE: ANGKA + SATUAN, DISIMPAN DALAM HARI (MST-18).
//
// KEPUTUSAN PEMILIK PRODUK (24 Agu 2026): isian berupa angka + pilihan satuan
// (hari/minggu/bulan/tahun), TAPI yang tersimpan di database tetap JUMLAH HARI di kolom
// `shelf_life_days` yang sudah ada.
//
// USULAN KATEGORI (Pendek / Menengah / Panjang) DITOLAK, dan alasannya penting untuk
// diingat supaya tidak diusulkan lagi: kategori MEMATIKAN FEFO. FEFO (First Expired,
// First Out) mengurutkan lot berdasarkan tanggal kedaluwarsa yang sesungguhnya. Kalau
// shelf life hanya "Menengah", tanggal kedaluwarsa tidak bisa dihitung, dan urutan
// pengeluaran stok kehilangan dasarnya. Ini bukan soal selera tampilan — kategori
// menghapus angka yang jadi dasar sebuah aturan gudang yang sudah berjalan.
//
// Keluhan yang diselesaikan tetap terselesaikan: pengguna TIDAK lagi dipaksa menghitung
// "6 bulan itu berapa hari" di kepala.

export type ShelfLifeUnit = 'hari' | 'minggu' | 'bulan' | 'tahun';

// Faktor konversi ke hari. Bulan = 30 hari dan tahun = 365 hari adalah PENYEDERHANAAN
// yang disengaja: masa simpan produk pangan dinyatakan sebagai perkiraan ("6 bulan"),
// bukan sebagai tanggal kalender yang presisi. Memakai panjang bulan sebenarnya akan
// membuat "6 bulan" bernilai berbeda-beda tergantung kapan diketik — dan itu justru
// membuat angkanya lebih sulit dipercaya, bukan lebih akurat.
export const SHELF_LIFE_UNIT_DAYS: Record<ShelfLifeUnit, number> = {
  hari: 1,
  minggu: 7,
  bulan: 30,
  tahun: 365
};

export const SHELF_LIFE_UNITS: ShelfLifeUnit[] = ['hari', 'minggu', 'bulan', 'tahun'];

export function shelfLifeToDays(nilai: number, satuan: ShelfLifeUnit): number {
  return Math.round(nilai * SHELF_LIFE_UNIT_DAYS[satuan]);
}

// Menampilkan kembali nilai yang tersimpan dengan satuan TERBESAR yang membagi habis.
//
// Tanpa ini, sesuatu yang diketik "6 bulan" akan muncul kembali sebagai "180 hari" saat
// diedit — pengguna melihat angka yang bukan angka yang ia tulis, dan mengira sistem
// mengubahnya. Pembagian harus HABIS: 200 hari tetap ditampilkan sebagai hari, karena
// "6,67 bulan" bukan sesuatu yang pernah diketik siapa pun.
export function daysToShelfLife(days: number | null): { nilai: string; satuan: ShelfLifeUnit } {
  if (days === null || !Number.isFinite(days) || days <= 0) return { nilai: '', satuan: 'hari' };
  for (const satuan of ['tahun', 'bulan', 'minggu'] as ShelfLifeUnit[]) {
    const faktor = SHELF_LIFE_UNIT_DAYS[satuan];
    if (days % faktor === 0) return { nilai: String(days / faktor), satuan };
  }
  return { nilai: String(days), satuan: 'hari' };
}

// Teks untuk dibaca manusia, dipakai di panel Detail. Menyebut jumlah harinya juga bila
// satuannya bukan hari, supaya angka yang dipakai FEFO tidak pernah tersembunyi.
export function formatShelfLife(days: number | null): string {
  if (days === null) return '—';
  const { nilai, satuan } = daysToShelfLife(days);
  if (!nilai) return '—';
  if (satuan === 'hari') return `${days} hari`;
  return `${nilai} ${satuan} (${days} hari)`;
}
