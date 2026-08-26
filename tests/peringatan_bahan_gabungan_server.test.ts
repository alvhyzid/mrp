import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { refreshLowStockAlerts } from '../src/features/mrp/server/refreshLowStockAlerts';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// GDG-10 / KK.1 — peringatan gabungan, DIUJI SAMPAI KE DATABASE.
//
// Aturan kalimatnya sudah diuji tanpa database di tests/peringatan_bahan_gabungan.test.ts.
// Yang diuji DI SINI justru yang tidak bisa dilihat dari sana, dan yang paling mungkin
// salah: apakah kebutuhan produksi benar-benar terkumpul dari Work Order yang berjalan,
// apakah bahan yang TIDAK punya ambang tetap ikut diperiksa saat produksi membutuhkannya,
// dan apakah peringatan yang sudah terbuka DIPERBARUI alih-alih digandakan.
//
// Pelajaran yang melahirkan test ini sudah tercatat di CLAUDE.md: "Menjalankan menemukan
// apa yang membaca tidak bisa."

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DEBUG_ROLE_TEST_PASSWORD wajib diset.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const EMAIL = 'admin.peringatanbahan@debug.mrp';

describe('GDG-10 — satu peringatan per bahan, sebabnya di dalamnya (sampai database)', () => {
  let companyId: number;
  let plantId: number;
  let token: string;
  let authUid: string;
  let itemGabungan: number; // menipis DAN kurang untuk produksi
  let itemTanpaAmbang: number; // tanpa ambang, tapi dibutuhkan produksi
  let itemBelumPernah: number; // belum pernah dibeli -- harus DIAM
  let itemInduk: number;

  function req(): NextRequest {
    return new NextRequest('http://localhost/api/stock-alerts/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  beforeAll(async () => {
    const { data: company } = await adminClient
      .from('companies')
      .insert([{ name: 'PeringatanBahanGabunganTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant Uji Peringatan', is_active: true }])
      .select('production_plant_id')
      .single();
    plantId = plant!.production_plant_id;

    authUid = await ensureAuthUser(adminClient, EMAIL, roleTestPassword, { full_name: 'Admin PeringatanBahan' });
    await adminClient
      .from('users')
      .upsert([{ auth_uid: authUid, company_id: companyId, name: 'Admin PeringatanBahan', email: EMAIL, role: 'company_admin', status: 'active' }], { onConflict: 'auth_uid' });
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data: sesi, error: loginError } = await client.auth.signInWithPassword({ email: EMAIL, password: roleTestPassword! });
    if (loginError) throw new Error(loginError.message);
    token = sesi.session.access_token;

    const buatItem = async (kode: string, nama: string, persen: number | null) => {
      const { data } = await adminClient
        .from('items')
        .insert([{ company_id: companyId, item_code: kode, name: nama, type: 'raw_material', base_uom: 'kg', purchase_uom: 'kg', uom_conversion_factor: 1, min_stock_level: 0, min_stock_percent: persen, is_active: true }])
        .select('item_id')
        .single();
      return data!.item_id as number;
    };
    itemGabungan = await buatItem('GBG-GULA', 'Gula Uji Gabungan', 20);
    itemTanpaAmbang = await buatItem('GBG-PEKTIN', 'Pektin Uji Tanpa Ambang', null);
    itemBelumPernah = await buatItem('GBG-BARU', 'Bahan Uji Belum Pernah Dibeli', 20);
    itemInduk = await buatItem('GBG-INDUK', 'Produk Uji Induk', null);

    // Stok + riwayat "pernah masuk". Keduanya perlu: persen dihitung dari yang PERNAH
    // MASUK, bukan dari stok saat ini.
    const buatLot = async (itemId: number, nomor: string, qty: number) => {
      const { data } = await adminClient
        .from('lots')
        .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, lot_number: nomor, source_type: 'purchased', status: 'available', produced_or_received_date: new Date().toISOString().slice(0, 10), quantity_on_hand: qty }])
        .select('lot_id')
        .single();
      await adminClient.from('stock_movements').insert([{ company_id: companyId, lot_id: data!.lot_id, movement_type: 'receipt', qty: 1000 }]);
      return data!.lot_id as number;
    };
    await buatLot(itemGabungan, 'GBG-LOT-GULA', 80); // pernah masuk 1000, ambang 20% = 200 -> menipis
    await buatLot(itemTanpaAmbang, 'GBG-LOT-PEKTIN', 50); // tanpa ambang sama sekali

    const { data: bom } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemInduk, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    await adminClient.from('bom_lines').insert([
      { bom_id: bom!.bom_id, component_item_id: itemGabungan, qty_per_unit_output: 1.2, uom: 'kg', routing_step_id: null },
      { bom_id: bom!.bom_id, component_item_id: itemTanpaAmbang, qty_per_unit_output: 2, uom: 'kg', routing_step_id: null }
    ]);

    // Satu Work Order berjalan, rencana 100 -> butuh 120 kg gula (ada 80) dan 200 kg pektin
    // (ada 50). Keduanya kurang.
    await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemInduk, bom_id: bom!.bom_id, planned_qty: 100, status: 'in_progress' }]);
  }, 120000);

  afterAll(async () => {
    await cleanupCompanyCascade(adminClient, companyId, [
      ['system_alerts', async () => await adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['status_transition_log', async () => await adminClient.from('status_transition_log').delete().eq('company_id', companyId)],
      ['work_orders', async () => await adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['bom_lines', async () => {
        const { data } = await adminClient.from('boms').select('bom_id').eq('company_id', companyId);
        const ids = (data ?? []).map((b) => b.bom_id);
        return ids.length ? await adminClient.from('bom_lines').delete().in('bom_id', ids) : { error: null };
      }],
      ['boms', async () => await adminClient.from('boms').delete().eq('company_id', companyId)],
      ['stock_movements', async () => await adminClient.from('stock_movements').delete().eq('company_id', companyId)],
      ['lots', async () => await adminClient.from('lots').delete().eq('company_id', companyId)],
      ['items', async () => await adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', async () => await adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', async () => await adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth', async () => await adminClient.auth.admin.deleteUser(authUid)]
    ]);
  }, 120000);

  it('bahan yang menipis DAN kurang untuk produksi mendapat SATU peringatan yang menyebut KEDUANYA', async () => {
    const hasil = await refreshLowStockAlerts(req());
    expect(hasil.status).toBe(200);

    const { data: alerts } = await adminClient
      .from('system_alerts')
      .select('related_item_id, message, severity, alert_type, status')
      .eq('company_id', companyId)
      .eq('alert_type', 'low_stock');

    const gula = (alerts ?? []).filter((a) => a.related_item_id === itemGabungan);
    // SATU, bukan dua. Inti keputusan KK.1.
    expect(gula).toHaveLength(1);
    expect(gula[0].message).toContain('di bawah ambang');
    expect(gula[0].message).toContain('kurang 40 kg untuk 1 perintah produksi');
    // Perintah produksinya DISEBUT NAMANYA. Work Order tidak punya nomor di sistem ini, jadi
    // yang dipakai kode produknya + kuantitas rencana -- bukan angka id internal.
    expect(gula[0].message).toContain('(GBG-INDUK 100)');
    expect(gula[0].message).toContain(', DAN ');
    expect(gula[0].severity).toBe('critical');
  }, 120000);

  it('bahan TANPA ambang apa pun tetap diperiksa saat produksi membutuhkannya', async () => {
    // Sebelum GDG-10 bahan seperti ini tersaring keluar sebelum sempat dinilai — dan
    // kekurangannya untuk produksi tidak pernah berbunyi di mana pun.
    const { data: alerts } = await adminClient
      .from('system_alerts')
      .select('related_item_id, message')
      .eq('company_id', companyId)
      .eq('alert_type', 'low_stock')
      .eq('related_item_id', itemTanpaAmbang);

    expect(alerts).toHaveLength(1);
    expect(alerts![0].message).toContain('urang 150 kg');
    // Sisa stoknya sendiri tidak bisa dinilai, jadi tidak boleh ada klaim soal ambang.
    expect(alerts![0].message).not.toContain('di bawah ambang');
  }, 120000);

  it('bahan yang BELUM PERNAH DIBELI tidak menghasilkan peringatan apa pun', async () => {
    const { data: alerts } = await adminClient
      .from('system_alerts')
      .select('system_alert_id')
      .eq('company_id', companyId)
      .eq('alert_type', 'low_stock')
      .eq('related_item_id', itemBelumPernah);
    expect(alerts ?? []).toHaveLength(0);
  }, 120000);

  it('dijalankan DUA KALI tidak menggandakan peringatan', async () => {
    const hasil = await refreshLowStockAlerts(req());
    expect(hasil.status).toBe(200);
    expect((hasil.body as Record<string, unknown>).dibuat).toBe(0);

    const { data: alerts } = await adminClient
      .from('system_alerts')
      .select('related_item_id')
      .eq('company_id', companyId)
      .eq('alert_type', 'low_stock')
      .eq('status', 'open');
    expect((alerts ?? []).length).toBe(2);
  }, 120000);

  it('sebab BERTAMBAH -> pesan peringatan yang masih terbuka DIPERBARUI, bukan digandakan', async () => {
    // Work Order dibatalkan: kebutuhan produksi hilang, tinggal sebab "menipis" saja.
    await adminClient.from('work_orders').update({ status: 'cancelled' }).eq('company_id', companyId);

    const hasil = await refreshLowStockAlerts(req());
    expect(hasil.status).toBe(200);
    expect((hasil.body as Record<string, unknown>).dibuat).toBe(0);
    expect((hasil.body as Record<string, unknown>).diperbarui).toBe(1);

    // alert_type WAJIB ikut disaring. Fungsi database recompute_work_order_material_readiness
    // membuat `material_shortage` PER WORK ORDER untuk bahan yang sama (purchasing +
    // warehouse), dan itu memang belum dicabut -- lihat catatan di refreshLowStockAlerts.ts.
    const { data: gula } = await adminClient
      .from('system_alerts')
      .select('message, severity')
      .eq('company_id', companyId)
      .eq('alert_type', 'low_stock')
      .eq('related_item_id', itemGabungan)
      .eq('status', 'open');
    expect(gula).toHaveLength(1);
    // Sebab produksi sudah tidak berlaku dan HILANG dari kalimatnya. Peringatan lama yang
    // menyebut sebab yang sudah tidak ada lebih menyesatkan daripada tidak ada peringatan.
    expect(gula![0].message).not.toContain('perintah produksi');
    expect(gula![0].message).toContain('di bawah ambang');
    expect(gula![0].severity).toBe('warning');

    // Pektin tidak punya sebab tersisa sama sekali -> peringatannya DITUTUP.
    const { data: pektin } = await adminClient
      .from('system_alerts')
      .select('status')
      .eq('company_id', companyId)
      .eq('alert_type', 'low_stock')
      .eq('related_item_id', itemTanpaAmbang);
    expect(pektin!.every((a) => a.status === 'resolved')).toBe(true);
  }, 120000);
});
