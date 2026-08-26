import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// PENGAWAS MIGRASI TERTINGGAL (25 Agu 2026).
//
// ============================================================================
// KENAPA BERKAS INI ADA
// ============================================================================
// Menjalankan seluruh test lokal memberi 11 kegagalan, dan SEMBILAN di antaranya sama
// sekali bukan soal kode: project Supabase yang dipakai untuk uji berhenti di 171 migrasi
// sementara repo sudah 263. Tabel `company_settings_history` belum ada di sana, jadi
// halaman Setelan menjawab 500; empat test lot kedaluwarsa gagal karena strukturnya
// memang belum dibuat.
//
// Bentuk kegagalannya itulah yang berbahaya: ia terlihat PERSIS seperti kemunduran kode.
// Assertion yang meleset, status 500, angka yang tidak cocok — tidak satu pun menyebut
// "strukturnya belum ada". Sesi yang menemuinya akan menghabiskan waktu mencari
// kemunduran yang tidak pernah terjadi.
//
// Menyuruh orang "ingat periksa migrasi dulu" tidak menutup ini — yang menutupnya adalah
// pemeriksaan yang berjalan sendiri sebelum test pertama, dan menyebut ANGKANYA.
//
// SENGAJA TIDAK MENERAPKAN MIGRASINYA SENDIRI. Test suite yang diam-diam mengubah
// struktur database adalah hal yang lebih buruk daripada test yang gagal: ia mengubah
// keadaan tanpa diminta, dan di project yang salah akibatnya tidak bisa ditarik kembali.
// Berkas ini hanya MEMBERI TAHU, beserta cara memperbaikinya.
export default async function assertMigrationsUpToDate() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return; // pengawas lain sudah menolak keadaan ini lebih dulu

  const dirMigrasi = join(__dirname, '..', '..', 'supabase', 'migrations');
  const versiRepo = readdirSync(dirMigrasi)
    .filter((n) => n.endsWith('.sql'))
    .map((n) => n.split('_')[0])
    .sort();
  if (versiRepo.length === 0) return;

  const client = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Lewat fungsi, BUKAN membaca tabelnya langsung: `supabase_migrations.schema_migrations`
  // ada di skema yang tidak diekspos PostgREST. Versi pertama pengawas ini membacanya
  // langsung, gagal diam-diam, lalu LOLOS tanpa memeriksa apa pun — dan itu ketahuan hanya
  // karena pengujian sengaja "satu migrasi belum terpasang" ternyata tetap hijau.
  const { data, error } = await client.rpc('daftar_migrasi_terpasang');

  if (error || !data) {
    throw new Error(
      `\n\nPENGAWAS MIGRASI: fungsi public.daftar_migrasi_terpasang() tidak bisa dipanggil di project uji ` +
        `(${error?.message ?? 'jawaban kosong'}).\n\n` +
        'Fungsi itu sendiri lahir dari sebuah migrasi, jadi ketiadaannya BERARTI project uji tertinggal.\n' +
        'Terapkan migrasi yang kurang ke project uji itu, lalu jalankan test lagi.\n'
    );
  }

  const terpasang = new Set((data as string[]).map((v) => String(v)));
  const tertinggal = versiRepo.filter((v) => !terpasang.has(v));
  if (tertinggal.length === 0) return;

  const ref = url.replace(/^https:\/\//, '').split('.')[0];
  throw new Error(
    `\n\nPENGAWAS MIGRASI: project uji "${ref}" TERTINGGAL ${tertinggal.length} migrasi dari repo ` +
      `(${terpasang.size} terpasang, ${versiRepo.length} ada di supabase/migrations).\n\n` +
      `Migrasi tertua yang belum terpasang: ${tertinggal[0]}\n` +
      `Migrasi terbaru yang belum terpasang: ${tertinggal[tertinggal.length - 1]}\n\n` +
      'JANGAN menjalankan test dalam keadaan ini. Struktur yang belum ada menghasilkan kegagalan yang\n' +
      'terlihat PERSIS seperti kemunduran kode — assertion meleset, status 500, angka tidak cocok — dan\n' +
      'tidak satu pun menyebut bahwa tabelnya memang belum dibuat.\n\n' +
      'Perbaiki dengan menerapkan migrasi yang kurang ke project uji itu, lalu jalankan test lagi.\n'
  );
}
