import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDashboardSummary } from '../src/features/auth/server/getDashboardSummary';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';
import { tanpaKomentar } from './util/tanpaKomentar';

// ============================================================================
// UX-D1 — RINGKASAN DASHBOARD: ALAMAT KANONIK & GALAT YANG TERLIHAT
// ============================================================================
// Cacat yang melahirkannya (diukur di peramban 27 Agu 2026, bukan diduga):
//
//   DashboardPage memanggil `/api/dashboard/summary` (bersarang).
//   Route yang ada bernama `/api/dashboard-summary` (datar, bertanda hubung).
//
// Yang terjadi BUKAN sekadar "data tidak muncul". Next.js menjawab alamat yang tidak ada
// dengan HALAMAN 404 BER-HTML. `response.json()` melempar SEBELUM baris `if (!response.ok)`
// sempat berjalan, sehingga `setSummaryLoading(false)` dan `setSummaryError(...)` TIDAK
// PERNAH tercapai. Akibatnya empat kartu berhenti SELAMANYA di keadaan memuat, tanpa satu
// pun pesan — dan galatnya hanya muncul sebagai "Uncaught (in promise) SyntaxError" di
// konsol peramban, tempat yang tidak dilihat siapa pun.
//
// ============================================================================
// KENAPA UJI PERTAMA DI BAWAH MENYISIR SELURUH HALAMAN, BUKAN HANYA DASHBOARD
// ============================================================================
// Memperbaiki satu alamat tidak mencegah alamat berikutnya salah ketik. Yang mencegahnya
// adalah pemeriksaan bahwa SETIAP alamat `/api/...` yang ditulis halaman mana pun benar-benar
// punya route di App Router.
//
// Ini BUKAN pencocokan teks belaka: ia menelusuri pohon `app/api` sungguhan, memahami segmen
// dinamis `[param]`, dan menuntut adanya berkas `route.ts` di ujungnya. Uji ini MERAH pada
// keadaan sebelum perbaikan dan HIJAU sesudahnya — dibuktikan dua arah, bukan diasumsikan.
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeGetRequest(url: string, token: string): NextRequest {
  return new NextRequest(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
}

/// Menelusuri app/api sungguhan. Segmen `${...}` pada template literal dianggap cocok dengan
/// segmen dinamis `[param]` — itulah bentuk yang dipakai halaman untuk id.
function routeAda(jalur: string): boolean {
  const segmen = jalur.replace(/^\/api\//, '').split('/').filter(Boolean);
  let dir = 'app/api';
  for (const s of segmen) {
    if (!existsSync(dir)) return false;
    const anak = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    if (!s.includes('${') && anak.includes(s)) {
      dir = join(dir, s);
      continue;
    }
    const dinamis = anak.find((n) => /^\[.+\]$/.test(n));
    if (!dinamis) return false;
    dir = join(dir, dinamis);
  }
  return existsSync(join(dir, 'route.ts'));
}

function berkasSumber(): string[] {
  const out: string[] = [];
  for (const domain of readdirSync('src/features')) {
    for (const sub of ['pages', 'components', 'server']) {
      const p = join('src/features', domain, sub);
      try {
        for (const f of readdirSync(p)) if (f.endsWith('.tsx') || f.endsWith('.ts')) out.push(join(p, f));
      } catch { /* domain tanpa subfolder itu */ }
    }
  }
  return out;
}

describe('UX-D1 — ringkasan dashboard: alamat kanonik & galat yang terlihat', () => {
  it('(a) SETIAP alamat /api yang ditulis kode punya route sungguhan di App Router', () => {
    const temuan: string[] = [];
    for (const f of berkasSumber()) {
      // Komentar dibuang lebih dulu: alamat yang disebut di dalam penjelasan bukan panggilan.
      const isi = tanpaKomentar(readFileSync(f, 'utf8'));
      for (const m of isi.matchAll(/['"`](\/api\/[^'"`\s]*)['"`]/g)) {
        const jalur = m[1].split('?')[0];
        if (!routeAda(jalur)) temuan.push(`${jalur}  <-  ${f}`);
      }
    }
    expect(temuan, `Alamat /api tanpa route di app/api:\n${temuan.join('\n')}`).toEqual([]);
  });

  it('(b) DashboardPage memanggil alamat KANONIK yang datar, bukan yang bersarang', () => {
    const isi = tanpaKomentar(readFileSync('src/features/auth/pages/DashboardPage.tsx', 'utf8'));
    expect(isi).toContain('/api/dashboard-summary');
    // Bentuk bersarang tidak pernah ada dan tidak boleh kembali.
    expect(isi).not.toContain('/api/dashboard/summary');
  });

  it('(c) pemuat ringkasan MENGHENTIKAN pemuatan di semua jalur keluar', () => {
    const isi = tanpaKomentar(readFileSync('src/features/auth/pages/DashboardPage.tsx', 'utf8'));
    // `finally` adalah satu-satunya bentuk yang menjamin tidak ada jalan keluar yang
    // meninggalkan kerangka abu-abu berputar selamanya. Tanpa ini, cacat aslinya bisa
    // kembali lewat sebab lain (galat 500, gangguan gateway) meski alamatnya sudah benar.
    expect(isi).toMatch(/finally\s*\{[^}]*setSummaryLoading\(false\)/);
    // Pembacaan JSON WAJIB terbungkus penangkap galat: respons bukan-JSON adalah persis
    // yang membuat layar mati diam-diam.
    expect(isi).toMatch(/try\s*\{\s*data\s*=\s*await\s+response\.json\(\)/);
  });

  it('(d) angka yang TIDAK diketahui tidak ditulis sebagai nol', () => {
    const isi = tanpaKomentar(readFileSync('src/features/auth/pages/DashboardPage.tsx', 'utf8'));
    // Menampilkan 0 untuk data yang gagal dimuat adalah berbohong dengan percaya diri.
    expect(isi).not.toMatch(/metrik__angka[^>]*>\{m\.nilai \?\? 0\}/);
    expect(isi).toContain('tampilkanAngka');
  });
});

describe('UX-D1 — kontrak server getDashboardSummary', () => {
  let companyId: number;
  let asingCompanyId: number;
  let adminToken: string;
  let staffToken: string;
  let adminAuthUid: string;
  let staffAuthUid: string;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'DashboardSummaryTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    const { data: asing } = await adminClient.from('companies').insert([{ name: 'DashboardSummaryAsingTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    asingCompanyId = asing!.company_id;

    adminAuthUid = await ensureAuthUser(adminClient, 'admin.dashboardsummarytest@debug.mrp', roleTestPassword!);
    await adminClient.from('users').insert([{ auth_uid: adminAuthUid, company_id: companyId, name: 'Admin DashboardSummaryTest', email: 'admin.dashboardsummarytest@debug.mrp', role: 'company_admin', status: 'active' }]);
    adminToken = await loginToken('admin.dashboardsummarytest@debug.mrp');

    staffAuthUid = await ensureAuthUser(adminClient, 'staff.dashboardsummarytest@debug.mrp', roleTestPassword!);
    await adminClient.from('users').insert([{ auth_uid: staffAuthUid, company_id: companyId, name: 'Staf DashboardSummaryTest', email: 'staff.dashboardsummarytest@debug.mrp', role: 'production_staff', status: 'active' }]);
    staffToken = await loginToken('staff.dashboardsummarytest@debug.mrp');

    // Karyawan aktif MILIK TENANT INI, plus satu milik tenant asing sebagai umpan:
    // bila lingkupnya bocor, angkanya akan ikut menghitung yang asing.
    //
    // GALATNYA DIPERIKSA, bukan diabaikan. Versi pertama uji ini menulis tanpa memeriksa,
    // memakai nama kolom yang tidak ada (`employee_code`/`full_name`), dan yang gagal
    // BUKAN penulisannya melainkan asersinya — merah di tempat yang salah, dengan pesan
    // yang tidak menyebut sebabnya sama sekali. Itu persis kelas cacat AUD-43.
    const { error: galatKaryawan } = await adminClient.from('employees').insert([
      { company_id: companyId, name: 'Karyawan DashboardSummaryTest', wage_type: 'monthly', wage_rate: 1000000, is_active: true },
      { company_id: asingCompanyId, name: 'Karyawan Tenant Asing', wage_type: 'monthly', wage_rate: 1000000, is_active: true }
    ]);
    if (galatKaryawan) throw new Error(`Fixture karyawan gagal dibuat: ${galatKaryawan.message}`);
  }, 60000);

  afterAll(async () => {
    // Bentuk yang sama dengan tests/bom_lifecycle.test.ts: pembersih bersama menuntut
    // langkah bertipe longgar karena pembangun kueri Supabase bukan Promise sungguhan.
    const cleanupSteps: Array<[string, () => any]> = [
      ['employees', () => adminClient.from('employees').delete().in('company_id', [companyId, asingCompanyId])],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['companies', () => adminClient.from('companies').delete().in('company_id', [companyId, asingCompanyId])]
    ];
    await cleanupCompanyCascade(adminClient, [companyId, asingCompanyId], cleanupSteps);
    for (const uid of [adminAuthUid, staffAuthUid]) {
      if (uid) await adminClient.auth.admin.deleteUser(uid);
    }
  }, 60000);

  it('(e) jalur berhasil menjawab EMPAT angka dengan bentuk yang dibaca layar', async () => {
    const res = await getDashboardSummary(makeGetRequest('http://localhost/api/dashboard-summary', adminToken));
    expect(res.status).toBe(200);
    for (const kunci of ['newPoCount', 'activeSoCount', 'activeEmployeeCount', 'belowMinStockCount']) {
      expect(typeof res.body[kunci], `kunci ${kunci}`).toBe('number');
    }
  });

  it('(f) angkanya BERLINGKUP TENANT — karyawan tenant lain tidak ikut terhitung', async () => {
    const res = await getDashboardSummary(makeGetRequest('http://localhost/api/dashboard-summary', adminToken));
    // Tenant ini punya TEPAT satu karyawan aktif; tenant asing juga punya satu.
    // Angka 2 berarti lingkupnya bocor.
    expect(res.body.activeEmployeeCount).toBe(1);
  });

  it('(g) peran tanpa wewenang DITOLAK di server (403), bukan sekadar disembunyikan tombolnya', async () => {
    const res = await getDashboardSummary(makeGetRequest('http://localhost/api/dashboard-summary', staffToken));
    expect(res.status).toBe(403);
    expect(String(res.body.error)).toContain('Admin Perusahaan');
  });

  it('(h) tanpa kredensial DITOLAK, dan pesannya tidak membocorkan isi dalam', async () => {
    const res = await getDashboardSummary(new NextRequest('http://localhost/api/dashboard-summary', { method: 'GET' }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    const pesan = String(res.body.error ?? '');
    // Tidak boleh membocorkan jejak tumpukan, kunci, nama tabel dalam, atau alamat basis data.
    expect(pesan).not.toMatch(/at\s+\w+\s+\(|\.ts:\d+|service_role|supabase\.co|SUPABASE_|eyJ[A-Za-z0-9_-]{10,}/);
  });
});
