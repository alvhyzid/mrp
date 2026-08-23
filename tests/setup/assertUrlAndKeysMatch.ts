// PENGAWAS URL <-> KUNCI SATU PROJECT (23 Agu 2026).
//
// Lahir dari satu kegagalan CI yang menghabiskan LIMA hipotesis (timeout,
// kunci tersamar, fungsi database hilang, pustaka tidak mendukung sb_secret_,
// dan generasi kunci) sebelum ketahuan sebabnya sepele: `NEXT_PUBLIC_SUPABASE_URL`
// menunjuk satu project sementara kuncinya milik project lain.
//
// GEJALANYA SANGAT MENYESATKAN dan itulah kenapa pengawas ini ada: test TIDAK
// tampil gagal berjamaah. Yang terjadi -- hanya berkas TANPA `beforeAll` yang
// benar-benar GAGAL (di proyek ini: currency_formatter + function_grant_security_audit),
// sementara SELURUH berkas ber-`beforeAll` tampil DILEWATI (tanda panah bawah)
// karena fixture-nya tidak pernah terbentuk. Sekilas mirip "sebagian besar test
// di-skip", bukan "kunci salah" -- dan itu mengirim penyelidikan ke arah yang keliru
// berjam-jam.
//
// Pengawas ini menggantikan seluruh tebakan itu dengan SATU pesan jelas, sebelum
// satu test pun berjalan.
export default async function assertUrlAndKeysMatch() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    throw new Error(
      '\n\nPENGAWAS URL<->KUNCI: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / ' +
        'SUPABASE_SERVICE_ROLE_KEY tidak lengkap. Test tidak dijalankan.\n'
    );
  }

  const projectRef = url.replace('https://', '').split('.')[0];

  // Satu panggilan REST paling murah yang mewajibkan kunci sah. Kalau kunci milik
  // project LAIN, PostgREST menolak dengan 401 "Invalid API key" -- persis kondisi
  // yang dulu tidak terbaca.
  async function check(label: string, key: string) {
    let res: Response;
    try {
      res = await fetch(`${url}/rest/v1/companies?select=company_id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
      });
    } catch (e) {
      throw new Error(
        `\n\nPENGAWAS URL<->KUNCI: tidak bisa menghubungi ${url} (${e instanceof Error ? e.message : String(e)}).\n`
      );
    }

    if (res.status === 401 || res.status === 403) {
      const body = await res.text();
      throw new Error(
        `\n\nPENGAWAS URL<->KUNCI GAGAL KERAS.\n\n` +
          `${label} DITOLAK oleh project "${projectRef}" (HTTP ${res.status}).\n` +
          `Jawaban server: ${body.slice(0, 200)}\n\n` +
          `Artinya URL dan kunci TIDAK menunjuk project yang sama, ATAU kunci tidak sah/kedaluwarsa.\n\n` +
          `PERIKSA ketiganya menunjuk SATU project yang sama:\n` +
          `  NEXT_PUBLIC_SUPABASE_URL       (sekarang: ${url})\n` +
          `  NEXT_PUBLIC_SUPABASE_ANON_KEY  (publishable/anon milik project itu)\n` +
          `  SUPABASE_SERVICE_ROLE_KEY      (secret/service_role milik project itu)\n\n` +
          `CATATAN: tanpa pengawas ini, gejalanya menyesatkan -- hanya berkas tanpa beforeAll\n` +
          `yang gagal, sisanya tampil "dilewati", sehingga terlihat seperti masalah skip.\n`
      );
    }
  }

  await check('SUPABASE_SERVICE_ROLE_KEY', serviceKey);
  await check('NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey);
}
