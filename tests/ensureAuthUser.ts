import type { SupabaseClient } from '@supabase/supabase-js';

// AUD-21 — PENYEBAB KEGOYAHAN SUITE, DIREPRODUKSI DAN DITUTUP (24 Agu 2026).
//
// GEJALA: sebuah berkas test mati di beforeAll dengan
//   "TypeError: Cannot read properties of null (reading 'id')"
// lalu LULUS PENUH saat dijalankan sendiri, lalu suite berikutnya hijau tanpa satu baris
// pun berubah. Terlihat seperti kegoyahan acak. Bukan.
//
// PENYEBABNYA PASTI, dibuktikan lewat REPRODUKSI (bukan dugaan): 10 berkas test memakai
//
//     const u = await adminClient.auth.admin.createUser({ email, ... });
//     authUid = u.data.user!.id;      // <-- error TIDAK PERNAH diperiksa
//
// Bila pengguna auth dengan email itu MASIH ADA dari run sebelumnya — karena run
// terputus, atau pembersihannya gagal sebagian — createUser menjawab "email already
// registered", `data.user` bernilai null, dan tanda `!` menutupi kenyataan itu sampai
// `.id` meledak. Reproduksi: pengguna auth dibuat manual, berkas dijalankan, galat yang
// muncul SAMA PERSIS.
//
// Jadi kegoyahannya BUKAN acak — ia bergantung pada apakah run SEBELUMNYA sempat
// membersihkan dirinya. Itu sebabnya ia hilang saat berkas dijalankan sendiri di mesin
// yang bersih, dan muncul lagi di suite penuh yang panjang.
//
// 23 berkas lain SUDAH menangani ini dengan benar (menangkap "already been registered"
// lalu mencari pengguna yang sudah ada). Helper ini menjadikan pola tangguh itu SATU
// tempat, supaya berkas ke-34 yang lahir bulan depan tidak perlu mengingatnya.
export async function ensureAuthUser(
  adminClient: SupabaseClient,
  email: string,
  password: string,
  userMetadata?: Record<string, unknown>
): Promise<string> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...(userMetadata ? { user_metadata: userMetadata } : {})
  });

  if (data?.user) return data.user.id;

  // Galat SELAIN "sudah terdaftar" TIDAK ditelan — itu kegagalan sungguhan dan harus
  // berisik. Menelan semuanya akan mengganti satu kegoyahan dengan kegoyahan lain.
  if (error && !error.message.includes('already been registered')) {
    throw new Error(`Gagal membuat pengguna auth ${email}: ${error.message}`);
    }

  // Sudah terdaftar dari run sebelumnya -> pakai yang ada.
  //
  // perPage 200 (bukan 100 seperti pola lama): project CI hanya berisi belasan pengguna,
  // tapi angka 100 adalah batas yang akan terlampaui diam-diam begitu jumlahnya tumbuh,
  // dan kegagalannya akan terlihat persis seperti kegoyahan ini lagi.
  for (let page = 1; page <= 5; page += 1) {
    const { data: daftar, error: daftarError } = await adminClient.auth.admin.listUsers({ perPage: 200, page });
    if (daftarError) throw new Error(`Gagal mencari pengguna auth ${email}: ${daftarError.message}`);
    const ketemu = daftar?.users?.find((u) => u.email === email);
    if (ketemu) return ketemu.id;
    if (!daftar?.users?.length || daftar.users.length < 200) break;
  }

  throw new Error(
    `Pengguna auth ${email} dilaporkan SUDAH TERDAFTAR tetapi tidak ditemukan saat dicari. ` +
      `Ini kondisi yang tidak boleh terjadi — jangan diamkan sebagai kegoyahan.`
  );
}
