import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createWorkOrder } from '../src/features/mrp/server/createWorkOrder';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// Konsolidasi production_plants (migrasi 20260827090000) -- plant "belum
// beroperasi" (is_active=false, dipakai untuk "Puncak Dieng") sekarang HARUS
// menolak pembuatan Work Order, dan referensi ke plant yang sudah dihapus
// (mis. bekas "Pabrik Utama PT ITM"/"KL Bizhub" berdiri sendiri, keduanya
// dihapus saat konsolidasi) juga harus ditolak. Fixture perusahaan TERPISAH
// ("PlantConsolidationTestCorp"), pola sama dengan
// tests/production_batch_lifecycle.test.ts.

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

function makeRequest(url: string, token: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

describe('Konsolidasi Production Plants — Work Order ditolak di plant tidak aktif / plant terhapus', () => {
  let companyId: number;
  let activePlantId: number;
  let inactivePlantId: number; // meniru "Puncak Dieng" -- belum beroperasi
  let deletedPlantId: number; // dibuat lalu dihapus -- meniru bekas "Pabrik Utama"/"KL Bizhub" berdiri sendiri
  let itemId: number;
  let bomId: number;

  let ppicAuthUid: string;
  let ppicToken: string;

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
    // AUD-21 (25 Agu 2026): pembuatan pengguna auth SELALU lewat ensureAuthUser.
    // Bentuk hasilnya sengaja dipertahankan supaya kode di bawahnya tidak ikut berubah;
    // `error` selalu null karena ensureAuthUser sudah menangani "sudah terdaftar" sendiri.
    const { data, error } = {
      data: { user: { id: await ensureAuthUser(adminClient, email, roleTestPassword, { full_name: fullName }) } },
      error: null as { message: string } | null
    };
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
      .insert([{ name: 'PlantConsolidationTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyError) throw new Error(companyError.message);
    companyId = company.company_id;

    const { data: plants, error: plantError } = await adminClient
      .from('production_plants')
      .insert([
        { company_id: companyId, name: 'Plant Aktif', is_active: true },
        { company_id: companyId, name: 'Plant Belum Beroperasi', is_active: false },
        { company_id: companyId, name: 'Plant Akan Dihapus', is_active: true }
      ])
      .select('production_plant_id, name');
    if (plantError) throw new Error(plantError.message);
    activePlantId = plants!.find((p) => p.name === 'Plant Aktif')!.production_plant_id;
    inactivePlantId = plants!.find((p) => p.name === 'Plant Belum Beroperasi')!.production_plant_id;
    deletedPlantId = plants!.find((p) => p.name === 'Plant Akan Dihapus')!.production_plant_id;

    // Hapus baris plant-nya (meniru pembersihan "Pabrik Utama PT ITM" / "KL
    // Bizhub" berdiri sendiri saat konsolidasi) -- ID-nya TETAP dipakai di test
    // sebagai referensi ke plant yang sudah tidak ada.
    const { error: deletePlantError } = await adminClient.from('production_plants').delete().eq('production_plant_id', deletedPlantId);
    if (deletePlantError) throw new Error(deletePlantError.message);

    const ppicUser = await getOrCreateAuthUser('ppic.plantconsolidationtest@debug.mrp', 'PPIC PlantConsolidationTest');
    ppicAuthUid = ppicUser.id;

    const { error: usersError } = await adminClient.from('users').upsert(
      [{ auth_uid: ppicAuthUid, company_id: companyId, name: 'PPIC PlantConsolidationTest', email: 'ppic.plantconsolidationtest@debug.mrp', role: 'ppic_manager', status: 'active' }],
      { onConflict: 'auth_uid' }
    );
    if (usersError) throw new Error(usersError.message);

    ppicToken = await loginToken('ppic.plantconsolidationtest@debug.mrp');

    const { data: item, error: itemError } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'PLANTCONSOL-ITEM', name: 'Item PlantConsolidationTest', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    if (itemError) throw new Error(itemError.message);
    itemId = item.item_id;

    const { data: bom, error: bomError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomError) throw new Error(bomError.message);
    bomId = bom.bom_id;
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['auth:ppic', () => adminClient.auth.admin.deleteUser(ppicAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('(negatif 1) Work Order di plant BELUM BEROPERASI (is_active=false, meniru "Puncak Dieng") -> ditolak 400', async () => {
    const req = makeRequest('http://localhost/api/work-orders', ppicToken, 'POST', {
      production_plant_id: inactivePlantId,
      bom_id: bomId,
      sales_order_line_id: null,
      routing_id: null,
      planned_qty: 100,
      priority: 'normal'
    });
    const result = await createWorkOrder(req);
    expect(result.status).toBe(400);
    expect(String(result.body.error)).toContain('belum beroperasi');

    const { count } = await adminClient.from('work_orders').select('*', { count: 'exact', head: true }).eq('production_plant_id', inactivePlantId);
    expect(count).toBe(0);
  });

  it('(negatif 2) Work Order mereferensikan plant yang SUDAH DIHAPUS (meniru bekas "Pabrik Utama"/"KL Bizhub" berdiri sendiri) -> ditolak 400', async () => {
    const req = makeRequest('http://localhost/api/work-orders', ppicToken, 'POST', {
      production_plant_id: deletedPlantId,
      bom_id: bomId,
      sales_order_line_id: null,
      routing_id: null,
      planned_qty: 100,
      priority: 'normal'
    });
    const result = await createWorkOrder(req);
    expect(result.status).toBe(400);
    expect(String(result.body.error)).toContain('tidak ditemukan');
  });

  it('(positif) Work Order di plant AKTIF -> berhasil dibuat', async () => {
    const req = makeRequest('http://localhost/api/work-orders', ppicToken, 'POST', {
      production_plant_id: activePlantId,
      bom_id: bomId,
      sales_order_line_id: null,
      routing_id: null,
      planned_qty: 100,
      priority: 'normal'
    });
    const result = await createWorkOrder(req);
    expect(result.status).toBe(200);
    expect(result.body.work_order_id).toBeTruthy();
  });
});
