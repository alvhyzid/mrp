// KABAR "PROFIL BERUBAH" — SATU PINTU BERSAMA (MM.1, 25 Agu 2026).
//
// ============================================================================
// KENAPA BERKAS INI ADA, dan kenapa nama kabarnya TIDAK boleh ditulis lepas
// ============================================================================
// Kerangka aplikasi (AppShellCarbon) mengambil data penggunanya sendiri lewat /api/me satu
// kali saat dibuka. Halaman Profil mengambil salinannya sendiri juga. Keduanya tidak saling
// tahu — jadi setelah foto tersimpan, header masih menampilkan yang lama.
//
// Yang dipilih pemilik produk (cara A): halaman Profil MENGUMUMKAN, header MENDENGARKAN.
// Muat ulang halaman DILARANG, dan menjadikan header pemilik data seluruh pengguna adalah
// pekerjaan tersendiri yang menyentuh 36 halaman (tercatat sebagai PLT-06).
//
// Nama kabarnya hidup DI SATU TEMPAT INI, bukan sebagai teks lepas di dua berkas. Alasannya
// bukan kerapian: teks lepas adalah "dua jalur hidup untuk hal yang sama" dalam bentuk
// paling halus. Bila salah satunya diubah tanpa yang lain, kabarnya BERHENTI SAMPAI tanpa
// satu pun galat — header cuma diam menampilkan foto lama, dan tidak ada yang tahu kenapa.
//
// DI LUAR JANGKAUAN, dan disebut supaya tidak dikira lebih: kabar ini hanya sampai ke TAB
// YANG SAMA. Tab lain yang sedang terbuka tidak ikut berubah sampai ia dimuat ulang. Itu
// diterima untuk sekarang; bila kelak perlu lintas tab, jalurnya BroadcastChannel — dan
// tempatnya tetap berkas ini, bukan berkas ketiga.

export const PROFIL_BERUBAH = 'fabrix:profil-berubah';

export interface DetailProfilBerubah {
  /// Alamat foto profil terbaru, atau null bila fotonya dihapus.
  avatarUrl: string | null;
  /// Nama tampil terbaru. Ikut dikirim karena halaman Profil juga bisa mengubahnya.
  nama?: string | null;
}

/// Dipanggil halaman Profil SETELAH server menjawab berhasil — bukan sebelum. Mengumumkan
/// perubahan yang belum tentu tersimpan akan membuat header menampilkan sesuatu yang tidak
/// ada di database.
export function umumkanProfilBerubah(detail: DetailProfilBerubah): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<DetailProfilBerubah>(PROFIL_BERUBAH, { detail }));
}

/// Dipanggil kerangka aplikasi. Mengembalikan fungsi pembatal, supaya pendengarnya ikut
/// dilepas saat komponennya dilepas — pendengar yang tertinggal akan menumpuk tiap kali
/// kerangka dirender ulang.
export function dengarkanProfilBerubah(tangani: (detail: DetailProfilBerubah) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const pendengar = (e: Event) => {
    const detail = (e as CustomEvent<DetailProfilBerubah>).detail;
    if (detail) tangani(detail);
  };
  window.addEventListener(PROFIL_BERUBAH, pendengar);
  return () => window.removeEventListener(PROFIL_BERUBAH, pendengar);
}
