import type { SupabaseClient } from '@supabase/supabase-js';
import { ambilPathStorage } from './storageSignedUrl';

// PEMBERSIHAN BERKAS STORAGE SAAT BARIS INDUKNYA HILANG (INF-22 / JJ.1.3, 24 Agu 2026).
//
// KENAPA INI ADA DI LAPISAN APLIKASI DAN BUKAN JADI TRIGGER DATABASE — ini sudah DICOBA,
// bukan diperkirakan. Percobaan langsung di project CI (24 Agu 2026): menghapus baris
// `storage.objects` lewat SQL ditolak Postgres dengan
//
//     ERROR: 42501: Direct deletion from storage tables is not allowed.
//            Use the Storage API instead.
//
// Jadi trigger database MUSTAHIL menghapus berkas. Sebelum larangan itu terbaca, percobaan
// yang sama juga menunjukkan berkasnya MASIH BISA DIUNDUH (HTTP 200) setelah barisnya
// "dihapus" — artinya walau larangannya suatu saat dicabut, menghapus baris pun tidak
// melenyapkan berkasnya. Satu-satunya jalan yang benar-benar melenyapkan berkas adalah
// Storage API.
//
// AKIBAT YANG HARUS DIINGAT SAAT MENULIS MIGRASI PEMBERSIHAN DATA: migrasi SQL murni
// TIDAK BISA ikut membersihkan Storage. Migrasi menghapus barisnya, dan berkasnya harus
// dihapus terpisah lewat fungsi ini — kalau tidak, setiap pembersihan data melahirkan
// angkatan berkas yatim baru.
//
// DI LUAR JANGKAUAN (aturan II.2):
//   - TIDAK memeriksa apakah berkasnya masih dirujuk baris LAIN. Pemanggil yang tahu
//     konteksnya wajib memeriksa itu sendiri (lihat uploadSignature: tanda tangan yang
//     sudah menempel di dokumen terbit TIDAK BOLEH dihapus).
//   - TIDAK menyapu berkas yatim yang sudah telanjur ada. Ia mencegah yang BARU lahir;
//     yang lama dibersihkan sekali lewat pekerjaan tersendiri.
//   - Kegagalan menghapus berkas TIDAK dijadikan alasan menggagalkan operasi utama —
//     berkas yatim itu merepotkan, tapi menggagalkan penghapusan baris karena berkasnya
//     bandel justru meninggalkan keadaan yang lebih membingungkan.

export interface HasilHapusBerkas {
  bucket: string;
  diminta: number;
  terhapus: number;
  gagal: string[];
}

export async function hapusBerkasStorage(
  adminClient: SupabaseClient,
  bucket: string,
  nilaiTersimpan: (string | null | undefined)[]
): Promise<HasilHapusBerkas> {
  const path = Array.from(
    new Set(nilaiTersimpan.map((n) => ambilPathStorage(n, bucket)).filter((p): p is string => p !== null))
  );

  if (path.length === 0) return { bucket, diminta: 0, terhapus: 0, gagal: [] };

  const { data, error } = await adminClient.storage.from(bucket).remove(path);

  if (error) return { bucket, diminta: path.length, terhapus: 0, gagal: [error.message] };

  return { bucket, diminta: path.length, terhapus: (data ?? []).length, gagal: [] };
}

// Menghapus SELURUH berkas di bawah satu awalan folder (mis. seluruh tanda tangan milik
// satu auth user, atau seluruh foto milik satu perusahaan). Dipakai pembersihan tenant uji,
// di mana yang diketahui adalah foldernya, bukan daftar URL-nya.
export async function hapusFolderStorage(
  adminClient: SupabaseClient,
  bucket: string,
  awalanFolder: string
): Promise<HasilHapusBerkas> {
  const { data: isi, error: listError } = await adminClient.storage.from(bucket).list(awalanFolder, { limit: 1000 });

  if (listError) return { bucket, diminta: 0, terhapus: 0, gagal: [listError.message] };
  if (!isi || isi.length === 0) return { bucket, diminta: 0, terhapus: 0, gagal: [] };

  const path = isi.map((berkas) => `${awalanFolder}/${berkas.name}`);
  const { data, error } = await adminClient.storage.from(bucket).remove(path);

  if (error) return { bucket, diminta: path.length, terhapus: 0, gagal: [error.message] };

  return { bucket, diminta: path.length, terhapus: (data ?? []).length, gagal: [] };
}
