import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { recordStockAdjustment } from '../src/features/mrp/server/recordStockAdjustment';
import { recordOpeningBalance } from '../src/features/mrp/server/recordOpeningBalance';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// Keputusan pemilik produk (temuan #4 audit jalan kaki, 19 Agu 2026): opname
// harian di lapangan dilakukan staf gudang biasa, bukan manager --
// warehouse_staff sekarang BOLEH mencatat penyesuaian stok/saldo awal.
// Skenario negatif TETAP: role DI LUAR gudang (production_staff) harus tetap
// ditolak -- diuji di app layer DAN langsung ke fungsi database (migration
// 20260819170000) supaya gerbangnya benar-benar dobel, bukan cuma UI.

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

function makeRequest(url: string, token: string, body: unknown): NextRequest {
  return new NextRequest(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

describe('Perluasan akses opname ke warehouse_staff (temuan #4, 19 Agu 2026)', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let lotId: number;

  let warehouseStaffAuthUid: string;
  let warehouseStaffToken: string;
  let prodStaffAuthUid: string;
  let prodStaffToken: string;

  async function getOrCreateAuthUser(email: string, fullName: string) {
    let page = 1;
    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 100, page });
      if (error) throw new Error(error.message);
      const found = data?.users?.find((u: any) => u.email === email);
      if (found) return found;
      if (!data?.nextPage) break;
      page += 1;
    }
    const { data, error } = await adminClient.auth.admin.createUser({ email, password: roleTestPassword, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error) throw new Error(error.message);
    return data.user;
  }

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .insert([{ name: 'StockAdjustStaffTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant StockAdjustStaffTest', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantError) throw new Error(plantError.message);
    plantId = plant.production_plant_id;

    const warehouseStaffUser = await getOrCreateAuthUser('whstaff.stockadjuststafftest@debug.mrp', 'Warehouse Staff StockAdjustStaffTest');
    const prodStaffUser = await getOrCreateAuthUser('prodstaff.stockadjuststafftest@debug.mrp', 'Production Staff StockAdjustStaffTest');
    warehouseStaffAuthUid = warehouseStaffUser.id;
    prodStaffAuthUid = prodStaffUser.id;

    const { error: usersError } = await adminClient.from('users').upsert(
      [
        { auth_uid: warehouseStaffAuthUid, company_id: companyId, name: 'Warehouse Staff StockAdjustStaffTest', email: 'whstaff.stockadjuststafftest@debug.mrp', role: 'warehouse_staff', status: 'active' },
        { auth_uid: prodStaffAuthUid, company_id: companyId, name: 'Production Staff StockAdjustStaffTest', email: 'prodstaff.stockadjuststafftest@debug.mrp', role: 'production_staff', status: 'active' }
      ],
      { onConflict: 'auth_uid' }
    );
    if (usersError) throw new Error(usersError.message);

    warehouseStaffToken = await loginToken('whstaff.stockadjuststafftest@debug.mrp');
    prodStaffToken = await loginToken('prodstaff.stockadjuststafftest@debug.mrp');

    const { data: item, error: itemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'STOCKADJ-STAFF-ITEM', name: 'Item StockAdjustStaffTest', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    if (itemError) throw new Error(itemError.message);
    itemId = item.item_id;

    const { data: lot, error: lotError } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, lot_number: 'STOCKADJ-STAFF-LOT', quantity_on_hand: 100, source_type: 'purchased', status: 'available' }])
      .select('lot_id')
      .single();
    if (lotError) throw new Error(lotError.message);
    lotId = lot.lot_id;
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['stock_movements', () => adminClient.from('stock_movements').delete().eq('company_id', companyId)],
      ['lots', () => adminClient.from('lots').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:warehouse_staff', () => adminClient.auth.admin.deleteUser(warehouseStaffAuthUid)],
      ['auth:prod_staff', () => adminClient.auth.admin.deleteUser(prodStaffAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('(positif) warehouse_staff BISA mencatat penyesuaian stok manual', async () => {
    const req = makeRequest('http://localhost/api/stock-adjustments', warehouseStaffToken, { lot_id: lotId, qty_delta: -5, reason_code: 'stock_opname_variance', notes: 'Uji opname warehouse_staff' });
    const result = await recordStockAdjustment(req);
    expect(result.status).toBe(200);

    const { data: lot } = await adminClient.from('lots').select('quantity_on_hand').eq('lot_id', lotId).single();
    expect(Number(lot!.quantity_on_hand)).toBe(95);
  });

  it('(positif) warehouse_staff BISA mencatat saldo awal (lot baru)', async () => {
    const req = makeRequest('http://localhost/api/stock-adjustments/opening-balance', warehouseStaffToken, {
      item_id: itemId,
      production_plant_id: plantId,
      qty: 50,
      lot_number: 'STOCKADJ-STAFF-OPENING-LOT',
      unit_cost: 10
    });
    const result = await recordOpeningBalance(req);
    expect(result.status).toBe(200);
  });

  it('(negatif) production_staff TETAP ditolak — app layer 403', async () => {
    const req = makeRequest('http://localhost/api/stock-adjustments', prodStaffToken, { lot_id: lotId, qty_delta: -1, reason_code: 'stock_opname_variance', notes: 'Harus ditolak' });
    const result = await recordStockAdjustment(req);
    expect(result.status).toBe(403);
  });

  it('(negatif) production_staff TETAP ditolak lewat RPC database langsung (bukan cuma app layer) — dipanggil sebagai authenticated sungguhan, bukan service-role', async () => {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${prodStaffToken}` } }
    });
    // anon/authenticated tidak punya EXECUTE sama sekali (migration 20260819150000)
    // -- harus 42501 permission denied, membuktikan gerbang service-role-only
    // TETAP berlaku meski role sudah diperluas.
    const result = await client.rpc('record_manual_stock_adjustment', { p_lot_id: lotId, p_qty_delta: -1, p_reason_code: 'stock_opname_variance', p_notes: null, p_created_by: null });
    expect(result.error).not.toBeNull();
    expect(result.error!.code).toBe('42501');
  });
});
