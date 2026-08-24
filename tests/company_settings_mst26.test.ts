import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCompanySettings, updateCompanySettings } from '../src/features/company/server/companySettings';
import { KATALOG_SETELAN, validasiSetelan } from '../src/features/company/server/companySettingsCatalog';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// MST-26 (25 Agu 2026) — SETELAN PERUSAHAAN punya jalur tulis, jejak, dan tanggal berlaku.
//
// LAHIR DARI TEMUAN NYATA: 17 setelan yang dibaca SELURUH perhitungan biaya SDM, HPP, dan
// margin ternyata tidak punya SATU PUN jalur tulis di aplikasi. Nilainya di PT ITM lahir
// dari skrip sekali-pakai, dan bukan dari migrasi -- jadi membangun ulang skema dari nol pun
// tidak menghasilkannya. Perusahaan baru berdiri tanpa satu pun setelan, dan angkanya bukan
// salah: ia tidak ada.
//
// DI LUAR JANGKAUAN TEST INI (aturan II.2):
//   - Menguji jalur SERVER. Tampilan layarnya tidak disentuh sama sekali.
//   - Membuktikan jejak TERTULIS; TIDAK membuktikan ada perhitungan yang MEMBACANYA.
//     Keenam pembaca setelan masih memakai nilai SEKARANG, bukan nilai yang berlaku pada
//     tanggal transaksi. Itu batas yang disengaja dan dicatat, bukan yang terlewat.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function permintaan(method: string, token: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/company/settings', {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

describe('MST-26 — setelan perusahaan: jalur tulis, jejak, tanggal berlaku', () => {
  let companyId: number;
  let emailAdmin: string;
  let emailStaf: string;
  let tokenAdmin: string;
  let tokenStaf: string;

  beforeAll(async () => {
    const penanda = Date.now();
    const { data: company, error } = await adminClient
      .from('companies')
      .insert([{ name: 'SetelanMst26TestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (error || !company) throw new Error(`Gagal membuat company fixture: ${error?.message}`);
    companyId = company.company_id;

    emailAdmin = `mst26.admin.${penanda}@debug.mrp`;
    emailStaf = `mst26.staf.${penanda}@debug.mrp`;

    const uidAdmin = await ensureAuthUser(adminClient, emailAdmin, roleTestPassword);
    const uidStaf = await ensureAuthUser(adminClient, emailStaf, roleTestPassword);

    const { error: userError } = await adminClient.from('users').insert([
      { company_id: companyId, auth_uid: uidAdmin, email: emailAdmin, name: 'Admin Mst26', role: 'company_admin', status: 'active' },
      { company_id: companyId, auth_uid: uidStaf, email: emailStaf, name: 'Staf Mst26', role: 'production_staff', status: 'active' }
    ]);
    if (userError) throw new Error(`Gagal membuat users fixture: ${userError.message}`);

    const klien = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const masuk = async (email: string) => {
      const { data, error: e } = await klien.auth.signInWithPassword({ email, password: roleTestPassword! });
      if (e || !data.session) throw new Error(`Gagal login ${email}: ${e?.message}`);
      return data.session.access_token;
    };
    tokenAdmin = await masuk(emailAdmin);
    tokenStaf = await masuk(emailStaf);
  });

  afterAll(async () => {
    await cleanupCompanyCascade(adminClient, companyId, [
      ['company_settings_history', async () => await adminClient.from('company_settings_history').delete().eq('company_id', companyId)],
      ['company_settings', async () => await adminClient.from('company_settings').delete().eq('company_id', companyId)],
      ['users', async () => await adminClient.from('users').delete().eq('company_id', companyId)]
    ]);
    for (const email of [emailAdmin, emailStaf]) {
      const { data } = await adminClient.auth.admin.listUsers({ perPage: 200, page: 1 });
      const u = (data?.users ?? []).find((x) => x.email === email);
      if (u) await adminClient.auth.admin.deleteUser(u.id).catch(() => undefined);
    }
  });

  it('perusahaan BARU melihat seluruh 17 setelan, semuanya bertanda belum diisi', async () => {
    const hasil = await getCompanySettings(permintaan('GET', tokenAdmin));
    expect(hasil.status).toBe(200);
    const body = hasil.body as Record<string, unknown>;

    // Daftarnya datang dari KATALOG, bukan dari isi database. Kalau dari database, perusahaan
    // baru akan melihat halaman kosong tanpa tahu ada 17 hal yang perlu diisi.
    expect((body.setelan as unknown[]).length).toBe(KATALOG_SETELAN.length);
    expect(body.belum_diisi).toBe(KATALOG_SETELAN.length);
    expect(body.boleh_mengubah).toBe(true);
  });

  it('peran tanpa wewenang DITOLAK di server, bukan sekadar tombolnya disembunyikan', async () => {
    const hasil = await updateCompanySettings(
      permintaan('PATCH', tokenStaf, {
        perubahan: [{ kunci: 'currency_code', nilai: 'USD' }],
        berlaku_sejak: '2026-08-25'
      })
    );
    expect(hasil.status).toBe(403);

    const { data } = await adminClient.from('company_settings').select('setting_key').eq('company_id', companyId);
    expect(data ?? []).toHaveLength(0);
  });

  it('nilai di luar batas ditolak dengan pesan Bahasa Indonesia, dan NOL yang tersimpan', async () => {
    const hasil = await updateCompanySettings(
      permintaan('PATCH', tokenAdmin, {
        perubahan: [
          { kunci: 'payroll_period_start_day', nilai: '26' },
          { kunci: 'bpjs_kesehatan_employer_rate_percent', nilai: '250' }
        ],
        berlaku_sejak: '2026-08-25'
      })
    );
    expect(hasil.status).toBe(400);
    expect(String((hasil.body as Record<string, unknown>).error)).toMatch(/tidak boleh lebih dari 100/i);

    // SELURUHNYA ditolak, bukan sebagian tersimpan. Setengah berubah pada angka yang
    // menentukan HPP lebih buruk daripada gagal seluruhnya.
    const { data } = await adminClient.from('company_settings').select('setting_key').eq('company_id', companyId);
    expect(data ?? []).toHaveLength(0);
  });

  it('tanggal berlaku WAJIB — tanpa itu perubahan ditolak', async () => {
    const hasil = await updateCompanySettings(
      permintaan('PATCH', tokenAdmin, { perubahan: [{ kunci: 'currency_code', nilai: 'IDR' }] })
    );
    expect(hasil.status).toBe(400);
    expect(String((hasil.body as Record<string, unknown>).error)).toMatch(/tanggal berlaku/i);
  });

  it('perubahan tersimpan DAN jejaknya mencatat siapa, dari apa ke apa, sejak kapan berlaku', async () => {
    const hasil = await updateCompanySettings(
      permintaan('PATCH', tokenAdmin, {
        perubahan: [
          { kunci: 'payroll_period_start_day', nilai: '26' },
          { kunci: 'bpjs_kesehatan_employer_rate_percent', nilai: '4' }
        ],
        berlaku_sejak: '2026-08-01',
        alasan: 'Pengisian awal'
      })
    );
    expect(hasil.status).toBe(200);
    expect((hasil.body as Record<string, unknown>).tersimpan).toBe(2);

    const { data: jejak } = await adminClient
      .from('company_settings_history')
      .select('setting_key, old_value, new_value, effective_from, changed_by_name, changed_by_role, reason')
      .eq('company_id', companyId)
      .order('company_settings_history_id');

    expect(jejak ?? []).toHaveLength(2);
    const pertama = (jejak ?? [])[0];
    expect(pertama.old_value).toBeNull();
    expect(pertama.effective_from).toBe('2026-08-01');
    expect(pertama.changed_by_name).toBe('Admin Mst26');
    expect(pertama.changed_by_role).toBe('company_admin');
    expect(pertama.reason).toBe('Pengisian awal');
  });

  it('mengirim nilai yang SAMA tidak melahirkan jejak palsu', async () => {
    const { count: sebelum } = await adminClient
      .from('company_settings_history')
      .select('company_settings_history_id', { count: 'exact', head: true })
      .eq('company_id', companyId);

    const hasil = await updateCompanySettings(
      permintaan('PATCH', tokenAdmin, {
        perubahan: [{ kunci: 'payroll_period_start_day', nilai: '26' }],
        berlaku_sejak: '2026-08-25'
      })
    );
    expect(hasil.status).toBe(200);
    expect((hasil.body as Record<string, unknown>).tersimpan).toBe(0);

    const { count: sesudah } = await adminClient
      .from('company_settings_history')
      .select('company_settings_history_id', { count: 'exact', head: true })
      .eq('company_id', companyId);
    expect(sesudah).toBe(sebelum);
  });

  it('katalog dan validasinya sejalan — setiap setelan bisa divalidasi', () => {
    for (const def of KATALOG_SETELAN) {
      expect(validasiSetelan(def.kunci, '')).toMatch(/wajib diisi/i);
      if (def.jenis === 'pilihan') {
        expect(def.pilihan?.length ?? 0).toBeGreaterThan(0);
        expect(validasiSetelan(def.kunci, def.pilihan![0].nilai)).toBeNull();
      }
    }
    expect(validasiSetelan('kunci-karangan', 'x')).toMatch(/tidak dikenal/i);
  });
});
