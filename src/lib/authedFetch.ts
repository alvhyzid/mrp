import { supabase } from './supabaseClient';

// PEMANGGIL API BER-LOGIN, SATU UNTUK SEMUA HALAMAN (AUD-35, 25 Agu 2026).
//
// ============================================================================
// KENAPA BERKAS INI ADA
// ============================================================================
// Server proyek ini menerima kredensial HANYA lewat header Authorization: Bearer.
// `getCurrentUser` di src/lib/supabaseServer.ts memanggil `parseBearerToken`, yang MELEMPAR
// GALAT bila header itu tidak ada. TIDAK ADA jalur cookie, dan tidak pernah ada.
//
// Artinya satu halaman yang lupa mengirim header itu TIDAK gagal dengan pesan yang jelas —
// ia dijawab 401, lalu halamannya sendiri mengalihkan pengguna ke layar masuk. Dari luar,
// halaman itu tampak "butuh login" padahal penggunanya SUDAH login.
//
// Itu persis yang terjadi pada halaman Setelan Perhitungan: ia dibangun, diuji lapisan
// servernya, diukur tipografi dan jaraknya dari CSS hasil build, dinyatakan selesai — dan
// TIDAK PERNAH BISA DIBUKA SEKALI PUN. Pemilik produk sempat diminta memeriksanya dua kali;
// keduanya mustahil berhasil.
//
// ============================================================================
// KENAPA BERSAMA, BUKAN DISALIN LAGI
// ============================================================================
// Diukur 25 Agu 2026: 36 halaman menulis pengambilan tokennya masing-masing. Ke-35 di
// antaranya kebetulan benar. Yang ke-36 tidak, dan tidak ada yang menyadarinya selama
// berhari-hari — karena tidak ada satu tempat pun yang bisa diperiksa.
//
// Ini kelas cacat "dua jalur hidup untuk hal yang sama" yang sudah dicatat berkali-kali di
// proyek ini. Halaman baru WAJIB memakai berkas ini; penjaganya ada di
// tests/authed_fetch_wajib.test.ts.

export class SesiTidakValid extends Error {
  constructor() {
    super('Sesi tidak valid atau sudah berakhir.');
    this.name = 'SesiTidakValid';
  }
}

async function ambilToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

/// Memanggil API internal dengan kredensial yang benar.
///
/// MELEMPAR `SesiTidakValid` bila sesinya memang tidak ada — SENGAJA, bukan mengembalikan
/// 401 diam-diam. Halaman yang memanggilnya harus memutuskan sendiri apa yang terjadi
/// berikutnya (mengalihkan ke layar masuk, atau menampilkan pesan), dan keputusan itu tidak
/// boleh disembunyikan di dalam pembungkus ini.
export async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await ambilToken();
  if (!token) throw new SesiTidakValid();

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  // FormData mengatur Content-Type-nya sendiri BESERTA boundary-nya. Menetapkannya di sini
  // akan merusak unggahan berkas — batas multipart-nya hilang dan server tidak bisa
  // memisahkan bagian-bagiannya.
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(path, { ...options, headers });
}

/// Bentuk yang paling sering dipakai: panggil, baca JSON-nya, kembalikan bersama status.
export async function authedJson<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await authedFetch(path, options);
  const body = (await res.json()) as T;
  return { ok: res.ok, status: res.status, body };
}
