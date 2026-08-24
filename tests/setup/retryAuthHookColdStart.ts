// PENANGANAN COLD START AUTH HOOK (23 Agu 2026).
//
// GEJALA ASLI (bukan dugaan -- direproduksi lokal terhadap fabrix-ci-test):
//   Error: Login failed for financemanager.marginwatchtest@debug.mrp:
//          Failed to reach hook within maximum time of 5.000000 seconds
//
// PENYEBAB: setiap login di proyek ini memanggil Custom Access Token Hook, yaitu
// Edge Function `custom-access-token` yang menyuntikkan klaim `company_id` dan
// `app_role` ke JWT (seluruh kebijakan RLS bergantung padanya). Bila fungsi itu
// sedang DINGIN (belum dipanggil beberapa menit), booting-nya bisa melewati
// batas 5 detik yang DIPATOK SUPABASE AUTH sendiri -- batas server, bukan batas
// vitest, jadi TIDAK bisa dinaikkan lewat `--hookTimeout` atau konfigurasi test
// apa pun.
//
// AKIBATNYA test menjadi GOYAH (flaky), dan itu cocok dengan yang terlihat di CI:
// commit 0fb2d9f HIJAU, commit 07eb257 MERAH, padahal isinya setara. Berkas yang
// kena bukan itu-itu saja -- pernah attendance_geo_qr_w1 (11 gagal), pernah
// margin_watch. Yang menentukan bukan berkasnya, melainkan login mana yang
// kebetulan jatuh saat fungsinya dingin.
//
// KENAPA DICEGAT DI LAPIS JARINGAN, BUKAN DI HELPER LOGIN:
// ada 34 titik `signInWithPassword` tersebar di 26 berkas test dengan enam bentuk
// penulisan berbeda. Menulis ulang semuanya berisiko besar dan tetap akan bocor
// begitu ada berkas test baru. Satu cegatan di lapis fetch menutup semuanya
// sekaligus, termasuk berkas yang belum ditulis.
//
// CAKUPAN SENGAJA DIPERSEMPIT: hanya mengulang bila BENAR-BENAR pola ini --
// permintaan ke endpoint auth, balasan 5xx, dan badan balasan menyebut kegagalan
// menjangkau hook. Kegagalan login lain (sandi salah, pengguna tidak ada, kunci
// ditolak) TIDAK diulang, supaya pengaman ini tidak pernah menutupi kesalahan
// sungguhan dengan cara mengulanginya sampai kebetulan lolos.

// ANGKA INI TERIKAT PADA hookTimeout/testTimeout DI vitest.config.ts -- jangan
// diubah salah satunya saja. Tiap percobaan yang gagal menghabiskan 5 detik penuh
// (batas Supabase Auth) DITAMBAH jeda di bawah. Enam percobaan = 6x5 detik + 19
// detik jeda = ~49 detik. hookTimeout 300 detik dipilih dari KASUS TERBURUK NYATA,
// bukan dari satu login: tests/kpi_module.test.ts melakukan 5 login dalam SATU
// beforeAll, jadi 5 x 49 = 245 detik masih harus muat.
//
// Versi pertama (4 percobaan, jeda 1500/3000/5000) ternyata sudah menghabiskan
// ~29,5 detik -- praktis seluruh hookTimeout 30 detik waktu itu. Jadi test bisa
// gagal karena hook-nya kehabisan waktu, BUKAN karena login-nya benar-benar
// menyerah: pengaman yang seolah-olah bekerja, padahal kalah oleh batas lain.
// DI LUAR JANGKAUAN PENGAMAN INI (aturan II.2):
//   - Hanya mencegat permintaan yang melewati globalThis.fetch. Pustaka yang memakai
//     mekanisme jaringan lain tidak tersentuh.
//   - Hanya endpoint /auth/v1/. Kelambatan di endpoint lain tidak diulang.
//   - Hanya pola "gagal menjangkau hook". Kegagalan login lain SENGAJA tidak diulang.
//   - TIDAK memperbaiki sebabnya, hanya menahan akibatnya. Bila pengulangan makin sering
//     terpakai, itu tanda ada yang memburuk -- lihat penghitung di check-test-threshold.js.
const MAX_ATTEMPTS = 6;
const BACKOFF_MS = [1000, 2000, 3000, 5000, 8000];

import fs from 'node:fs';
import path from 'node:path';

// PENCATATAN PEMAKAIAN (TT.1) -- pengulangan itu obat yang bisa menutupi penyakit.
// Ia menyembunyikan lonjakan sesekali (memang itu gunanya), TAPI kalau suatu hari
// login melambat karena sebab LAIN, pengulangan akan menutupinya sampai parah tanpa
// ada yang sadar. Karena itu tiap pemakaian dicatat, dan jumlahnya dilaporkan tiap run
// oleh scripts/check-test-threshold.js. Yang dipantau bukan angkanya hari ini,
// melainkan ARAHNYA dari waktu ke waktu: naik terus = ada yang memburuk.
const AUDIT_FILE = path.join(process.cwd(), 'retry-audit.log');

// BATAS ANGGARAN TOTAL. Tanpa ini, kemunduran yang menyeluruh (mis. project CI
// benar-benar melambat) akan membuat SETIAP login mengulang sampai enam kali di
// 46 berkas -- suite tetap "hijau" tapi berjam-jam, dan penyakitnya tidak pernah
// menampakkan diri sebagai kegagalan. Begitu anggaran habis, pengulangan berhenti
// dan test dibiarkan gagal apa adanya.
const RETRY_BUDGET_MS = 300000;
let budgetTerpakaiMs = 0;

const originalFetch = globalThis.fetch;

function looksLikeAuthEndpoint(url: string) {
  return url.includes('/auth/v1/');
}

// TIDAK menyaring berdasarkan kode status. Versi pertama mensyaratkan status >= 500,
// dan akibatnya pengaman ini DIAM saat benar-benar dibutuhkan: satu run penuh gagal
// dengan pesan "Failed to reach hook within maximum time of 5.000000 seconds" sementara
// penghitung pengulangan tetap 0 -- artinya tidak sekali pun mencoba mengulang.
//
// Yang membuat pola ini khas BUKAN kode statusnya, melainkan KALIMAT di badan balasan.
// Kalimat itu sangat spesifik dan tidak muncul untuk kegagalan login jenis lain, jadi
// menyaring dengan kalimat saja tetap sempit -- sekaligus tidak lagi bergantung pada
// tebakan soal kode status yang ternyata salah.
async function isHookColdStart(res: Response) {
  if (res.ok) return false;
  try {
    const body = await res.clone().text();
    return /failed to reach hook|hook within maximum time/i.test(body);
  } catch {
    return false;
  }
}

// Ditulis ke berkas, bukan disimpan di memori, karena vitest menjalankan berkas test
// di beberapa proses pekerja -- penghitung di memori hanya akan melihat sebagian.
// Berkasnya dikosongkan di globalSetup tiap awal run.
function ambilHost(u: string | undefined) {
  if (!u) return null;
  try {
    return new URL(u).host;
  } catch {
    return null;
  }
}

// Penanda yang dipasang HANYA oleh test yang menguji pengaman ini sendiri
// (tests/auth_hook_cold_start_retry.test.ts). Lihat catatPemakaian().
const HEADER_KECUALI = 'x-audit-exclude';

function dikecualikanDariCatatan(init: RequestInit | undefined, input: unknown) {
  const h = new Headers(
    (init?.headers as HeadersInit | undefined) ??
      (input instanceof Request ? input.headers : undefined)
  );
  return h.get(HEADER_KECUALI) === '1';
}

function catatPemakaian(attempt: number, url: string) {
  try {
    fs.appendFileSync(
      AUDIT_FILE,
      JSON.stringify({ waktu: new Date().toISOString(), percobaan: attempt, url }) + '\n'
    );
  } catch {
    // Kegagalan mencatat TIDAK boleh menggagalkan test -- ini alat pemantau,
    // bukan bagian dari yang sedang diuji.
  }
}

const patchedFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

  let res = await originalFetch(input as never, init);
  if (!looksLikeAuthEndpoint(url)) return res;

  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (!(await isHookColdStart(res))) return res;

    if (budgetTerpakaiMs >= RETRY_BUDGET_MS) {
      console.error(
        `[cold start auth hook] ANGGARAN PENGULANGAN HABIS (${RETRY_BUDGET_MS} ms terpakai). ` +
          `Pengulangan DIHENTIKAN dan test dibiarkan gagal apa adanya. Ini BUKAN lonjakan biasa: ` +
          `sebanyak itu waktu terbuang mengulang login berarti ada yang benar-benar memburuk.`
      );
      return res;
    }

    const wait = BACKOFF_MS[attempt - 1] ?? 5000;
    console.warn(
      // Host ikut dicetak DENGAN SENGAJA: test yang menguji pengaman ini memakai host
      // karangan, dan tanpa penanda itu baris log-nya tidak bisa dibedakan dari
      // pengulangan sungguhan. Pernah tertukar sungguhan: 7 baris log dibaca sebagai
      // pengulangan nyata dan sempat dilaporkan sebagai patokan, padahal ketujuhnya
      // milik test uji-diri. Membaca log dengan `grep -c` TIDAK cukup tanpa host ini.
      `[cold start auth hook] host=${ambilHost(url) ?? '?'} status=${res.status} ` +
        `percobaan ${attempt}/${MAX_ATTEMPTS - 1}: Edge Function custom-access-token belum siap ` +
        `dalam 5 detik. Mengulang login dalam ${wait} ms.`
    );
    // Test yang menguji pengaman INI SENDIRI sengaja memicu pengulangan terhadap fetch
    // tiruan; kalau ikut tercatat, patokan pemantauan kemunduran jadi bohong. Ia menandai
    // permintaannya sendiri dengan header khusus.
    //
    // DUA CARA SEBELUMNYA GAGAL, dan arah gagalnya penting:
    //   1. variabel lingkungan -- bocor melewati batas berkas karena vitest memakai satu
    //      proses pekerja untuk seluruh berkas;
    //   2. pencocokan host -- pengulangan SUNGGUHAN pernah tidak tercatat (terbukti: satu
    //      pengulangan ber-host project asli terlihat di log, catatan tetap kosong),
    //      sebabnya tidak pernah tertangkap dengan pasti.
    // Keduanya gagal ke arah BERBAHAYA: melaporkan lebih sedikit dari kenyataan, yaitu
    // persis kegagalan yang pemantau ini dibuat untuk mencegah. Penanda per-permintaan
    // tidak bergantung pada keadaan apa pun di luar permintaan itu sendiri, dan bila
    // meleset ia meleset ke arah AMAN: mencatat lebih banyak, bukan lebih sedikit.
    if (dikecualikanDariCatatan(init, input)) {
      console.warn('[cold start auth hook] pengulangan ini TIDAK dicatat (permintaan uji-diri).');
    } else {
      catatPemakaian(attempt, url);
    }
    budgetTerpakaiMs += wait + 5000; // jeda + 5 detik yang sudah hangus di percobaan gagal
    await new Promise((r) => setTimeout(r, wait));
    // `init.body` bisa berupa stream sekali-pakai; untuk permintaan auth di
    // proyek ini selalu string JSON, jadi aman dipakai ulang apa adanya.
    res = await originalFetch(input as never, init);
  }

  return res;
};

globalThis.fetch = patchedFetch;

// Berkas ini bekerja lewat efek samping saat diimpor (menambal globalThis.fetch),
// bukan lewat nilai yang diekspor. `export {}` menjadikannya modul ES yang sah
// supaya bisa diimpor ulang dari test yang menguji pengaman ini sendiri.
export {};
