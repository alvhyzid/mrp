import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Menguji PENGAMAN-nya sendiri, bukan Supabase. Pengaman yang tidak pernah diuji
// sama saja dengan pengaman yang tidak ada -- dan yang satu ini justru berbahaya
// bila salah: kalau cakupannya kelebaran, ia akan mengulang kegagalan login yang
// SUNGGUHAN sampai kebetulan lolos, dan menyembunyikan bug.
//
// Karena tests/setup/retryAuthHookColdStart.ts menambal globalThis.fetch pada saat
// diimpor, tiap kasus di bawah memasang fetch tiruan LEBIH DULU, lalu memuat ulang
// modulnya dengan resetModules supaya tambalannya membungkus fetch tiruan itu.

const COLD_START_BODY = JSON.stringify({
  error: 'Failed to reach hook within maximum time of 5.000000 seconds'
});

const asliFetch = globalThis.fetch;

async function pasangPengaman(fetchTiruan: typeof fetch) {
  globalThis.fetch = fetchTiruan;
  vi.resetModules();
  await import('./setup/retryAuthHookColdStart');
  return globalThis.fetch;
}

describe('Pengaman cold start Auth Hook (tests/setup/retryAuthHookColdStart.ts)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Berkas ini SENGAJA memicu pengulangan, dan dikecualikan dari pencatatan karena
    // host tiruannya (x.supabase.co) berbeda dari host project yang sedang dipakai --
    // lihat catatPemakaian(). Tidak ada penanda lingkungan yang perlu dipasang di sini;
    // versi sebelumnya memakai penanda itu dan justru membuat pengulangan SUNGGUHAN
    // ikut hilang dari hitungan.
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = asliFetch;
  });

  async function jalankan(fetchTiruan: typeof fetch, url: string) {
    const terbungkus = await pasangPengaman(fetchTiruan);
    const janji = terbungkus(url, { method: 'POST', body: '{}', headers: { 'x-audit-exclude': '1' } });
    await vi.runAllTimersAsync();
    return janji;
  }

  it('mengulang login yang gagal karena hook dingin, lalu berhasil', async () => {
    let panggilan = 0;
    const tiruan = vi.fn(async () => {
      panggilan += 1;
      if (panggilan < 3) return new Response(COLD_START_BODY, { status: 500 });
      return new Response(JSON.stringify({ access_token: 'ok' }), { status: 200 });
    }) as unknown as typeof fetch;

    const res = await jalankan(tiruan, 'https://x.supabase.co/auth/v1/token?grant_type=password');

    expect(panggilan).toBe(3);
    expect(res.status).toBe(200);
  });

  it('TIDAK mengulang kegagalan login sungguhan (sandi salah) — hanya sekali panggil', async () => {
    let panggilan = 0;
    const tiruan = vi.fn(async () => {
      panggilan += 1;
      return new Response(JSON.stringify({ error: 'Invalid login credentials' }), { status: 400 });
    }) as unknown as typeof fetch;

    const res = await jalankan(tiruan, 'https://x.supabase.co/auth/v1/token?grant_type=password');

    expect(panggilan).toBe(1);
    expect(res.status).toBe(400);
  });

  it('TIDAK mengulang galat 500 yang bukan soal hook — hanya sekali panggil', async () => {
    let panggilan = 0;
    const tiruan = vi.fn(async () => {
      panggilan += 1;
      return new Response(JSON.stringify({ error: 'internal server error' }), { status: 500 });
    }) as unknown as typeof fetch;

    const res = await jalankan(tiruan, 'https://x.supabase.co/auth/v1/token?grant_type=password');

    expect(panggilan).toBe(1);
    expect(res.status).toBe(500);
  });

  it('TIDAK menyentuh permintaan non-auth, sekalipun jawabannya mirip', async () => {
    let panggilan = 0;
    const tiruan = vi.fn(async () => {
      panggilan += 1;
      return new Response(COLD_START_BODY, { status: 500 });
    }) as unknown as typeof fetch;

    const res = await jalankan(tiruan, 'https://x.supabase.co/rest/v1/companies?select=company_id');

    expect(panggilan).toBe(1);
    expect(res.status).toBe(500);
  });

  it('menyerah setelah batas percobaan, tidak mengulang selamanya', async () => {
    let panggilan = 0;
    const tiruan = vi.fn(async () => {
      panggilan += 1;
      return new Response(COLD_START_BODY, { status: 500 });
    }) as unknown as typeof fetch;

    const res = await jalankan(tiruan, 'https://x.supabase.co/auth/v1/token?grant_type=password');

    expect(panggilan).toBe(6);
    expect(res.status).toBe(500);
  });
});

// PENCATATAN PEMAKAIAN (TT.1) — diuji terpisah karena memakai waktu & berkas SUNGGUHAN,
// bukan timer palsu seperti blok di atas.
//
// Kedua sisi diuji, dan sisi kedua yang justru pernah salah: versi pertama pengecualian
// memakai variabel lingkungan dan hasilnya terbalik — pengulangan SUNGGUHAN ikut tidak
// tercatat (7 pengulangan nyata di log, penghitung melaporkan 0). Penyebabnya vitest
// memakai satu proses pekerja untuk seluruh berkas sehingga penandanya bocor melewati
// batas berkas. Karena itu di sini dibuktikan DUA-DUANYA: yang sungguhan tercatat, yang
// tiruan tidak.
describe('Pencatatan pemakaian pengulangan (patokan pemantauan kemunduran)', () => {
  const auditFile = path.join(process.cwd(), 'retry-audit.log');

  function jumlahBaris() {
    if (!fs.existsSync(auditFile)) return 0;
    return fs.readFileSync(auditFile, 'utf8').split('\n').filter((l) => l.trim()).length;
  }

  async function picuSatuPengulangan(host: string, tandai: boolean) {
    const asli = globalThis.fetch;
    let n = 0;
    globalThis.fetch = (async () => {
      n += 1;
      if (n < 2) return new Response(COLD_START_BODY, { status: 500 });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    vi.resetModules();
    await import('./setup/retryAuthHookColdStart');
    const terbungkus = globalThis.fetch;
    await terbungkus(`${host}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      body: '{}',
      headers: tandai ? { 'x-audit-exclude': '1' } : {}
    });
    globalThis.fetch = asli;
  }

  it('MENCATAT pengulangan yang tidak ditandai sebagai uji-diri', async () => {
    // Isi berkas dikembalikan setelah selesai supaya test ini sendiri tidak mencemari
    // angka patokan yang dilaporkan di akhir run -- kesalahan yang persis pernah terjadi.
    const sebelumIsi = fs.existsSync(auditFile) ? fs.readFileSync(auditFile, 'utf8') : '';
    const sebelum = jumlahBaris();

    // Host sengaja BUKAN host project sungguhan: sejak pengecualian memakai penanda
    // per-permintaan, pencatatan tidak lagi bergantung pada host sama sekali. Memakai
    // host project asli di sini justru pernah menyesatkan pembacaan log -- baris ini
    // dua kali dikira pengulangan login sungguhan, padahal milik test ini.
    await picuSatuPengulangan('https://uji-pencatatan-bukan-login-nyata.example', false);

    const sesudah = jumlahBaris();
    fs.writeFileSync(auditFile, sebelumIsi);
    expect(sesudah).toBe(sebelum + 1);
  }, 30000);

  it('TIDAK mencatat pengulangan yang ditandai sebagai permintaan uji-diri', async () => {
    const sebelumIsi = fs.existsSync(auditFile) ? fs.readFileSync(auditFile, 'utf8') : '';
    const sebelum = jumlahBaris();

    await picuSatuPengulangan('https://host-karangan-bukan-project.example', true);

    const sesudah = jumlahBaris();
    fs.writeFileSync(auditFile, sebelumIsi);
    expect(sesudah).toBe(sebelum);
  }, 30000);
});
