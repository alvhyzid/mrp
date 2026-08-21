import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { computeStandardCostPerUnit } from '../src/features/mrp/server/computeStandardCostPerUnit';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// Kerangka studi kasus MLVT ETAWAFIT (Bagian D, migrasi
// 20260827120000_mlvt_case_study_skeleton.sql) -- describe pertama BACA SAJA data
// company_id=1 (PT ITM) yang sengaja dibangun migrasi tsb, tidak membuat/menghapus
// apa pun. describe kedua pakai fixture perusahaan TERPISAH (pola sama dengan
// tests/production_batch_lifecycle.test.ts) untuk skenario negatif yang perlu login
// sebagai user nyata -- akun debug company_id=1 (company.a@debug.mrp dst.) BUKAN
// fixture milik tes ini, password aslinya tidak diketahui/tidak boleh ditebak.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error(
    'Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.'
  );
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('Kerangka Studi Kasus MLVT ETAWAFIT (Bagian D) — data company_id=1', () => {
  let companyId: number;
  let itemBoxId: number;
  let itemSachetId: number;

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').select('company_id').eq('name', 'PT ITM').single();
    if (!company) throw new Error('Company PT ITM tidak ditemukan -- migrasi skeleton MLVT belum berjalan di environment ini.');
    companyId = company.company_id;

    const { data: box } = await adminClient.from('items').select('item_id').eq('company_id', companyId).eq('item_code', 'MLVT-BOX/001ITM').single();
    if (!box) throw new Error('Item MLVT-BOX/001ITM tidak ditemukan.');
    itemBoxId = box.item_id;

    const { data: sachet } = await adminClient.from('items').select('item_id').eq('company_id', companyId).eq('item_code', 'MLVT-SACHET/001ITM').single();
    itemSachetId = sachet!.item_id;
  });

  it('(positif) biaya kemasan per box eksplosi BOM tepat Rp7.198,47 (10 sachet x Rp469,8470 + Box Etawa Fit Rp2.500) -- bahan baku premix TETAP ditandai belum lengkap, TIDAK diam-diam dianggap 0', async () => {
    // 27 Agu 2026 (tugas faktor Sachet Roll): faktor konversi dikoreksi dari
    // 3.333,333333 -> TEPAT 3333 sachet/roll (3333 x 15cm = 499,95m dari roll
    // 500m, sisa 5cm tidak cukup jadi 1 sachet). standard_cost sachet dikoreksi
    // jadi 1.566.000/3333 = 469,8470 (presisi penuh numeric(14,4), BUKAN
    // dibulatkan ke 469,85 seperti sebelumnya) -- konsekuensi yang sudah
    // disetujui pemilik produk: kemasan/box bergeser Rp7.198,50 -> Rp7.198,47
    // (selisih Rp0,03/box), BUKAN regresi.
    const result = await computeStandardCostPerUnit(adminClient as any, companyId, itemBoxId);
    expect(result.packagingCostPerUnit).toBeCloseTo(7198.47, 2);
    expect(result.complete).toBe(false);
    expect(result.missingCostItemCodes.sort()).toEqual(['PMBASE-MLVT/001ITM', 'PMHOT-MLVT/001ITM', 'PMSPC-MLVT/001ITM', 'PMSW-MLVT/001ITM'].sort());
  });

  it('(positif) routing Sachet & Box tersalin PERSIS dari docs/routing-serbuk-10-tahap-referensi.md (5 tahap masing-masing, work_center Filling Sachet di tahap 4 Sachet)', async () => {
    const { data: routingSachet } = await adminClient.from('routings').select('routing_id').eq('company_id', companyId).eq('item_id', itemSachetId).single();
    const { data: steps } = await adminClient.from('routing_steps').select('sequence_no, step_name, active_duration_minutes, work_center_id, duration_per_unit_minutes').eq('routing_id', routingSachet!.routing_id).order('sequence_no');
    expect(steps).toHaveLength(5);
    expect(steps![3].step_name).toBe('Filling Sachet');
    expect(Number(steps![3].duration_per_unit_minutes)).toBeCloseTo(0.028571, 6);
    expect(steps![3].work_center_id).not.toBeNull();
  });

  it('(regresi) faktor konversi Sachet Roll Etawa Fit TEPAT 3333 sachet/roll (bukan 3.333,333333) dan standard_cost TEPAT 1.566.000/3333 pada presisi penuh (bukan dibulatkan ke 469,85)', async () => {
    const { data: item } = await adminClient.from('items').select('uom_conversion_factor, standard_cost').eq('company_id', companyId).eq('item_code', 'SACHET-ROLL-ETAWAFIT/001ITM').single();
    expect(Number(item!.uom_conversion_factor)).toBe(3333);
    expect(Number(item!.standard_cost)).toBeCloseTo(469.847, 4);
    // 25.000 sachet pesanan MLVT (2.500 box x 10) TIDAK LAGI jatuh tepat 7,5 roll
    // dengan faktor 3333 -- butuh 7,5008 roll, dibulatkan ke ATAS jadi 8 roll saat beli.
    const rollsNeeded = 25000 / Number(item!.uom_conversion_factor);
    expect(rollsNeeded).toBeCloseTo(7.5008, 3);
    expect(rollsNeeded).not.toBeCloseTo(7.5, 6);
    expect(Math.ceil(rollsNeeded)).toBe(8);
  });

  it('(regresi) yield MLVT-BOX BUKAN 95% -- dikoreksi ke 100% eksplisit "belum diukur" (yield akan dipelajari dari batch nyata, bukan ditanam di muka)', async () => {
    const { data: box } = await adminClient.from('items').select('item_id').eq('company_id', companyId).eq('item_code', 'MLVT-BOX/001ITM').single();
    const { data: ps } = await adminClient.from('production_standards').select('*').eq('company_id', companyId).eq('item_id', box!.item_id).eq('metric_key', 'yield_percentage').is('routing_step_id', null).single();
    expect(Number(ps!.value)).toBe(100);
    expect(ps!.value).not.toBe(95);
    expect(ps!.sample_count).toBe(0);
    expect(ps!.source).toBe('ESTIMASI_MANUAL');
    expect(ps!.pin_reason).toContain('BELUM DIUKUR');
  });

  it('(negatif) coba buat PO client BARU dengan po_number DUPLIKAT ("182/RND/SUMG/VI/2026") untuk company yang sama -> ditolak unique constraint database', async () => {
    const { data: customer } = await adminClient.from('customers').select('customer_id').eq('company_id', companyId).eq('name', 'PT. Sastro Utama Media Grup').single();
    const { error } = await adminClient.from('customer_purchase_orders').insert([
      { company_id: companyId, customer_id: customer!.customer_id, po_number: '182/RND/SUMG/VI/2026', status: 'new' }
    ]);
    expect(error).not.toBeNull();
    expect(String(error?.message)).toContain('duplicate key');
  });
});

describe('process_customer_purchase_order() — proses ulang PO yang sudah processed (replikasi skenario PO MLVT)', () => {
  let fixtureCompanyId: number;
  let plantId: number;
  let cpoId: number;
  let adminAuthUid: string;

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'MlvtReprocessTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    fixtureCompanyId = company!.company_id;

    const { data: plant } = await adminClient.from('production_plants').insert([{ company_id: fixtureCompanyId, name: 'Plant MlvtReprocessTest', is_active: true }]).select('production_plant_id').single();
    plantId = plant!.production_plant_id;

    const { data: item } = await adminClient.from('items').insert([{ company_id: fixtureCompanyId, item_code: 'MLVTREPROC-ITEM', name: 'Item MlvtReprocessTest', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }]).select('item_id').single();
    const { data: customer } = await adminClient.from('customers').insert([{ company_id: fixtureCompanyId, name: 'Customer MlvtReprocessTest', customer_type: 'company' }]).select('customer_id').single();

    // PO dibuat LANGSUNG berstatus 'processed' -- meniru PO MLVT sungguhan (dibuat
    // via migrasi, bukan lewat alur approval UI normal) supaya skenario "coba proses
    // ulang PO yang sudah processed" bisa direplikasi persis tanpa menyentuh data nyata.
    const { data: cpo } = await adminClient
      .from('customer_purchase_orders')
      .insert([{ company_id: fixtureCompanyId, customer_id: customer!.customer_id, po_number: 'MLVTREPROC-PO-1', status: 'processed', processed_at: new Date().toISOString() }])
      .select('customer_purchase_order_id')
      .single();
    cpoId = cpo!.customer_purchase_order_id;
    await adminClient.from('customer_purchase_order_lines').insert([{ customer_purchase_order_id: cpoId, item_id: item!.item_id, qty_ordered: 10, unit_price: 1000 }]);
    await adminClient.from('customer_po_approvals').insert([
      { customer_purchase_order_id: cpoId, department: 'finance', status: 'approved' },
      { customer_purchase_order_id: cpoId, department: 'ppic', status: 'approved' },
      { customer_purchase_order_id: cpoId, department: 'manager', status: 'approved' }
    ]);

    const adminUser = await adminClient.auth.admin.createUser({ email: 'admin.mlvtreproctest@debug.mrp', password: roleTestPassword, email_confirm: true, user_metadata: { full_name: 'Admin MlvtReprocessTest' } });
    adminAuthUid = adminUser.data.user!.id;
    await adminClient.from('users').insert([{ auth_uid: adminAuthUid, company_id: fixtureCompanyId, name: 'Admin MlvtReprocessTest', email: 'admin.mlvtreproctest@debug.mrp', role: 'company_admin', status: 'active' }]);
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['customer_po_approvals', () => adminClient.from('customer_po_approvals').delete().eq('customer_purchase_order_id', cpoId)],
      ['customer_purchase_order_lines', () => adminClient.from('customer_purchase_order_lines').delete().eq('customer_purchase_order_id', cpoId)],
      ['customer_purchase_orders', () => adminClient.from('customer_purchase_orders').delete().eq('company_id', fixtureCompanyId)],
      ['customers', () => adminClient.from('customers').delete().eq('company_id', fixtureCompanyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', fixtureCompanyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', fixtureCompanyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', fixtureCompanyId)],
      ['auth:ppic', () => adminClient.auth.admin.deleteUser(adminAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, fixtureCompanyId, cleanupSteps);
  });

  it('(negatif) coba PROSES ULANG PO client yang sudah berstatus processed -> ditolak fungsi process_customer_purchase_order(), status TIDAK berubah', async () => {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { error: loginError } = await client.auth.signInWithPassword({ email: 'admin.mlvtreproctest@debug.mrp', password: roleTestPassword! });
    if (loginError) throw new Error(`Login gagal: ${loginError.message}`);

    const { error: rpcError } = await client.rpc('process_customer_purchase_order', {
      p_customer_purchase_order_id: cpoId,
      p_production_plant_id: plantId
    });
    expect(rpcError).not.toBeNull();
    expect(String(rpcError?.message)).toContain('hanya bisa diproses dari status new');

    const { data: cpoAfter } = await adminClient.from('customer_purchase_orders').select('status').eq('customer_purchase_order_id', cpoId).single();
    expect(cpoAfter!.status).toBe('processed'); // tidak berubah/rusak
  });
});
