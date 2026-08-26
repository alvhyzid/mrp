import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// GDG-10 lanjutan — KESIAPAN WORK ORDER DIHITUNG DARI DATA, BUKAN DARI ADANYA PERINGATAN.
//
// ============================================================================
// KENAPA TEST INI HARUS ADA SEBELUM PERINGATAN LAMA DICABUT
// ============================================================================
// Peringatan `material_shortage` per Work Order bukan cuma pemberitahuan: selama ini ia
// satu-satunya hal yang membuat sebuah Work Order tampil "Terhambat". Mencabutnya lebih dulu
// akan membuat Work Order yang bahannya kurang tampil "Siap Mulai" — dan TIDAK ADA satu pun
// yang gagal atau berwarna merah saat itu terjadi.
//
// Test ini membuktikan penggantinya bekerja: dengan SELURUH peringatan dihapus dari tabel,
// kesiapannya tetap terbaca "blocked" karena dihitung langsung dari bahan.
//
// Aturan yang mendasarinya ada di CLAUDE.md: "Pengaman lama dicabut HANYA setelah
// penggantinya terbukti bekerja."

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diset.');
const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('Kesiapan Work Order dihitung dari data (GDG-10 lanjutan)', () => {
  let companyId: number;
  let plantId: number;
  let bahanCukup: number;
  let bahanKurang: number;
  let produk: number;
  let woKurang: number;
  let woCukup: number;

  beforeAll(async () => {
    const { data: company } = await adminClient
      .from('companies')
      .insert([{ name: 'KesiapanDariDataTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant Uji Kesiapan', is_active: true }])
      .select('production_plant_id')
      .single();
    plantId = plant!.production_plant_id;

    const buatItem = async (kode: string, nama: string) => {
      const { data } = await adminClient
        .from('items')
        .insert([{ company_id: companyId, item_code: kode, name: nama, type: 'raw_material', base_uom: 'kg', purchase_uom: 'kg', uom_conversion_factor: 1, min_stock_level: 0, is_active: true }])
        .select('item_id')
        .single();
      return data!.item_id as number;
    };
    bahanCukup = await buatItem('KSP-CUKUP', 'Bahan Uji Cukup');
    bahanKurang = await buatItem('KSP-KURANG', 'Bahan Uji Kurang');
    produk = await buatItem('KSP-PRODUK', 'Produk Uji Kesiapan');

    const buatLot = async (itemId: number, nomor: string, qty: number) => {
      await adminClient.from('lots').insert([
        { company_id: companyId, production_plant_id: plantId, item_id: itemId, lot_number: nomor, source_type: 'purchased', status: 'available', produced_or_received_date: new Date().toISOString().slice(0, 10), quantity_on_hand: qty }
      ]);
    };
    await buatLot(bahanCukup, 'KSP-LOT-CUKUP', 1000);
    await buatLot(bahanKurang, 'KSP-LOT-KURANG', 5);

    const buatBom = async (komponen: number, qtyPerUnit: number) => {
      const { data } = await adminClient
        .from('boms')
        .insert([{ company_id: companyId, parent_item_id: produk, version: komponen, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
        .select('bom_id')
        .single();
      await adminClient.from('bom_lines').insert([{ bom_id: data!.bom_id, component_item_id: komponen, qty_per_unit_output: qtyPerUnit, uom: 'kg', routing_step_id: null }]);
      return data!.bom_id as number;
    };
    const bomKurang = await buatBom(bahanKurang, 1); // butuh 100, ada 5
    const bomCukup = await buatBom(bahanCukup, 1); // butuh 100, ada 1000

    const { data: wos } = await adminClient
      .from('work_orders')
      .insert([
        { company_id: companyId, production_plant_id: plantId, item_id: produk, bom_id: bomKurang, planned_qty: 100, status: 'planned' },
        { company_id: companyId, production_plant_id: plantId, item_id: produk, bom_id: bomCukup, planned_qty: 100, status: 'planned' }
      ])
      .select('work_order_id, bom_id');
    woKurang = wos!.find((w) => w.bom_id === bomKurang)!.work_order_id;
    woCukup = wos!.find((w) => w.bom_id === bomCukup)!.work_order_id;
  }, 120000);

  afterAll(async () => {
    await cleanupCompanyCascade(adminClient, companyId, [
      ['system_alerts', async () => await adminClient.from('system_alerts').delete().eq('company_id', companyId)],
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
      ['production_plants', async () => await adminClient.from('production_plants').delete().eq('company_id', companyId)]
    ]);
  }, 120000);

  it('TANPA satu pun baris peringatan, Work Order yang bahannya kurang TETAP terbaca terhambat', async () => {
    // Inti pembuktian. Seluruh peringatan dihapus lebih dulu supaya tidak ada yang bisa
    // menyangka hasilnya datang dari sumber lama.
    await adminClient.from('system_alerts').delete().eq('company_id', companyId);
    const { count } = await adminClient.from('system_alerts').select('*', { count: 'exact', head: true }).eq('company_id', companyId);
    expect(count).toBe(0);

    const { data } = await adminClient
      .from('work_orders_readiness')
      .select('work_order_id, readiness, kekurangan_bahan, open_alert_count')
      .eq('company_id', companyId);

    const kurang = data!.find((r) => r.work_order_id === woKurang)!;
    expect(kurang.readiness).toBe('blocked');
    expect(kurang.kekurangan_bahan).toBe(true);
    // Dan terbukti BUKAN datang dari peringatan: hitungannya nol.
    expect(kurang.open_alert_count).toBe(0);
  }, 120000);

  it('Work Order yang bahannya cukup TETAP siap mulai — penggantinya tidak memblokir semua orang', async () => {
    const { data } = await adminClient
      .from('work_orders_readiness')
      .select('work_order_id, readiness, kekurangan_bahan')
      .eq('company_id', companyId);

    const cukup = data!.find((r) => r.work_order_id === woCukup)!;
    expect(cukup.readiness).toBe('ready');
    expect(cukup.kekurangan_bahan).toBe(false);
  }, 120000);

  it('begitu bahannya datang, kesiapannya berubah sendiri tanpa ada yang menutup peringatan', async () => {
    await adminClient.from('lots').insert([
      { company_id: companyId, production_plant_id: plantId, item_id: bahanKurang, lot_number: 'KSP-LOT-DATANG', source_type: 'purchased', status: 'available', produced_or_received_date: new Date().toISOString().slice(0, 10), quantity_on_hand: 200 }
    ]);

    const { data } = await adminClient
      .from('work_orders_readiness')
      .select('work_order_id, readiness, kekurangan_bahan')
      .eq('company_id', companyId)
      .eq('work_order_id', woKurang)
      .single();

    // Dihitung dari data berarti TIDAK ADA keadaan basi yang perlu dibersihkan siapa pun.
    expect(data!.kekurangan_bahan).toBe(false);
    expect(data!.readiness).toBe('ready');
  }, 120000);
});
