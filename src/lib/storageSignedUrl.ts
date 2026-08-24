import type { SupabaseClient } from '@supabase/supabase-js';

// PENUKAR URL PERMANEN -> URL BERTANDA-TANGAN BERUMUR PENDEK (JJ.1, 24 Agu 2026).
//
// Tiga bucket berpindah dari publik ke privat karena isinya data pribadi & bukti
// pengiriman (lihat migrasi 20260828290000). Nilai yang TERSIMPAN di database tidak
// diubah sedikit pun — ia tetap berbentuk URL publik seperti sedia kala — dan
// penukaran dilakukan SAAT DIBACA.
//
// KENAPA TIDAK MENULIS ULANG NILAI DI DATABASE, walau itu terlihat lebih rapi:
//   1. `document_signatures.signature_url_snapshot` adalah SNAPSHOT untuk ketertelusuran
//      dokumen yang sudah terbit. Menulis ulang isinya persis melanggar arti kata snapshot.
//   2. Signed URL berumur pendek; menyimpannya di kolom akan basi dalam hitungan menit.
//   3. Baris lama dan baris baru jadi punya dua bentuk berbeda, dan setiap pembaca harus
//      tahu bedanya. Satu bentuk tersimpan, satu tempat penukaran — lebih sedikit yang
//      bisa salah.
//
// DI LUAR JANGKAUAN BERKAS INI (aturan II.2 — batas tiap pengawas/penolong ditulis):
//   - TIDAK memeriksa siapa yang berhak melihat berkasnya. Kewenangan diperiksa di tempat
//     datanya diambil (query sudah tersaring company_id / kepemilikan baris). Fungsi ini
//     hanya menandatangani apa yang sudah diputuskan boleh dilihat di lapisan atasnya.
//   - TIDAK mendeteksi berkas yang sudah terhapus dari Storage: Supabase tetap
//     mengembalikan signed URL, dan barulah gambarnya gagal dimuat di layar.
//   - Bucket PUBLIK (company-logos, user-avatars) sengaja TIDAK lewat sini.

const PENANDA_PUBLIK = '/storage/v1/object/public/';

// 10 menit. Master Dokumen memakai 120 detik karena berkasnya dibuka sekali lalu ditutup;
// gambar di sini menempel di halaman yang bisa dibiarkan terbuka (mis. halaman cetak surat
// jalan yang ditinggal sambil menyiapkan printer). URL yang kedaluwarsa di tengah halaman
// terbuka muncul sebagai gambar rusak tanpa penjelasan — 10 menit menutup celah itu tanpa
// membuat URL-nya jadi praktis permanen.
export const UMUR_SIGNED_URL_DETIK = 600;

// Menerima dua bentuk sekaligus: URL publik lama (dengan atau tanpa "?v=...") maupun path
// telanjang. Mengembalikan null bila bentuknya tidak dikenali — pemanggil menampilkan
// "tidak ada gambar", bukan gambar rusak.
export function ambilPathStorage(nilai: string | null | undefined, bucket: string): string | null {
  if (!nilai) return null;

  const tanpaQuery = nilai.split('?')[0];
  const penanda = `${PENANDA_PUBLIK}${bucket}/`;
  const posisi = tanpaQuery.indexOf(penanda);

  if (posisi !== -1) {
    return tanpaQuery.slice(posisi + penanda.length) || null;
  }

  // Bukan URL bucket ini. Bila ia URL apa pun yang lain, ia bukan milik kita — jangan
  // ditebak. Bila ia bukan URL sama sekali, perlakukan sebagai path telanjang.
  if (tanpaQuery.startsWith('http://') || tanpaQuery.startsWith('https://')) return null;

  return tanpaQuery.replace(/^\/+/, '') || null;
}

export async function buatSignedUrl(
  adminClient: SupabaseClient,
  bucket: string,
  nilaiTersimpan: string | null | undefined,
  umurDetik: number = UMUR_SIGNED_URL_DETIK
): Promise<string | null> {
  const path = ambilPathStorage(nilaiTersimpan, bucket);
  if (!path) return null;

  const { data, error } = await adminClient.storage.from(bucket).createSignedUrl(path, umurDetik);
  if (error || !data) return null;

  return data.signedUrl;
}

// Versi banyak-sekaligus untuk daftar (mis. daftar pengiriman dengan foto per baris).
// Memakai createSignedUrls sekali jalan, bukan satu panggilan jaringan per baris.
export async function buatSignedUrlBanyak(
  adminClient: SupabaseClient,
  bucket: string,
  nilaiTersimpan: (string | null | undefined)[],
  umurDetik: number = UMUR_SIGNED_URL_DETIK
): Promise<(string | null)[]> {
  const path = nilaiTersimpan.map((n) => ambilPathStorage(n, bucket));
  const unik = Array.from(new Set(path.filter((p): p is string => p !== null)));

  if (unik.length === 0) return path.map(() => null);

  const { data, error } = await adminClient.storage.from(bucket).createSignedUrls(unik, umurDetik);
  if (error || !data) return path.map(() => null);

  const perPath = new Map<string, string>();
  for (const baris of data) {
    if (baris.path && baris.signedUrl && !baris.error) perPath.set(baris.path, baris.signedUrl);
  }

  return path.map((p) => (p ? perPath.get(p) ?? null : null));
}

export const BUCKET_TANDA_TANGAN = 'user-signatures';
export const BUCKET_FOTO_KIRIM = 'shipment-dispatch-photos';
export const BUCKET_FOTO_TERIMA = 'delivery-confirmation-photos';

// Dipakai di SETIAP tempat profil pengguna dikirim ke peramban (/api/me, getProfile,
// updateProfile, uploadSignature, uploadAvatar). Hanya `signature_url` yang ditukar —
// `avatar_url` sengaja dibiarkan apa adanya karena bucket foto profil tetap publik.
export async function appUserUntukClient<T extends { signature_url?: string | null }>(
  adminClient: SupabaseClient,
  appUser: T
): Promise<T> {
  if (!appUser?.signature_url) return appUser;
  return { ...appUser, signature_url: await buatSignedUrl(adminClient, BUCKET_TANDA_TANGAN, appUser.signature_url) };
}
