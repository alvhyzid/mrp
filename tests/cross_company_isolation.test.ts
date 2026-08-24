import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

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

// Sesi 2C (docs/rencana-kerja-playbook-ams.md), Lapis 1 B.9 — bagian "isolasi antar
// company" yang belum ada di test manapun (role_hierarchy_financial_access.test.ts
// dan employee_attendance_access.test.ts menguji akses ANTAR ROLE dalam 1 company,
// bukan antar company). File ini BARU, tidak mengubah 3 file test yang sudah ada.
// Pola fixture-nya sama seperti RoleTestCorp di role_hierarchy_financial_access.test.ts:
// 2 company fixture terpisah dibuat di beforeAll, dibersihkan total di afterAll — TIDAK
// memakai tenant debug permanen (Company A/B dari scripts/seed-debug-tenants.js) supaya
// test ini bisa jalan berulang kali tanpa efek samping ke data debug yang dipakai manual.
describe('cross-company RLS isolation verification', () => {
  let companyXId: number;
  let companyYId: number;
  let plantXId: number;
  let itemXId: number;
  let lotXId: number;
  let employeeXId: number;
  let workOrderXId: number;

  let userXAuthUid: string;
  let userYAuthUid: string;

  async function findAuthUserByEmail(email: string) {
    let page = 1;
    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 100, page });
      if (error) throw new Error(`Failed to list auth users: ${error.message}`);
      if (!data?.users?.length) return null;
      const found = data.users.find((u: any) => u.email === email);
      if (found) return found;
      if (!data.nextPage) return null;
      page += 1;
    }
  }

  async function getOrCreateAuthUser(email: string, password: string, fullName: string) {
    const existing = await findAuthUserByEmail(email);
    if (existing) return existing;
    // AUD-21 (25 Agu 2026): pembuatan pengguna auth SELALU lewat ensureAuthUser.
    // Bentuk hasilnya sengaja dipertahankan supaya kode di bawahnya tidak ikut berubah;
    // `error` selalu null karena ensureAuthUser sudah menangani "sudah terdaftar" sendiri.
    const { data, error } = {
      data: { user: { id: await ensureAuthUser(adminClient, email, password, { full_name: fullName }) } },
      error: null as { message: string } | null
    };
    if (error) throw new Error(`Failed to create auth user ${email}: ${error.message}`);
    return data.user;
  }

  async function signInAs(email: string): Promise<SupabaseClient> {
    const client = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
    });
  }

  beforeAll(async () => {
    const { data: companyX, error: companyXError } = await adminClient
      .from('companies')
      .insert([{ name: 'IsolationTestCorp X', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyXError) throw new Error(`Failed to create fixture company X: ${companyXError.message}`);
    companyXId = companyX.company_id;

    const { data: companyY, error: companyYError } = await adminClient
      .from('companies')
      .insert([{ name: 'IsolationTestCorp Y', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    if (companyYError) throw new Error(`Failed to create fixture company Y: ${companyYError.message}`);
    companyYId = companyY.company_id;

    const { data: plantX, error: plantXError } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyXId, name: 'Plant IsolationTest X', is_active: true }])
      .select('production_plant_id')
      .single();
    if (plantXError) throw new Error(`Failed to create fixture plant X: ${plantXError.message}`);
    plantXId = plantX.production_plant_id;

    const userX = await getOrCreateAuthUser('userx.isolationtest@debug.mrp', roleTestPassword, 'User Company X');
    const userY = await getOrCreateAuthUser('usery.isolationtest@debug.mrp', roleTestPassword, 'User Company Y');
    userXAuthUid = userX.id;
    userYAuthUid = userY.id;

    const { error: appUsersError } = await adminClient.from('users').upsert(
      [
        { auth_uid: userXAuthUid, company_id: companyXId, name: 'User Company X', email: 'userx.isolationtest@debug.mrp', role: 'company_admin', status: 'active' },
        { auth_uid: userYAuthUid, company_id: companyYId, name: 'User Company Y', email: 'usery.isolationtest@debug.mrp', role: 'company_admin', status: 'active' }
      ],
      { onConflict: 'auth_uid' }
    );
    if (appUsersError) throw new Error(`Failed to create fixture users: ${appUsersError.message}`);

    const { data: employeeX, error: employeeXError } = await adminClient
      .from('employees')
      .insert([{ company_id: companyXId, production_plant_id: plantXId, name: 'Operator IsolationTest X', position: 'Operator Produksi', wage_type: 'daily', wage_rate: 190000, is_active: true }])
      .select('employee_id')
      .single();
    if (employeeXError) throw new Error(`Failed to create fixture employee X: ${employeeXError.message}`);
    employeeXId = employeeX.employee_id;

    const { data: itemX, error: itemXError } = await adminClient
      .from('items')
      .insert([{ company_id: companyXId, item_code: 'ISOTEST-X-ITEM', name: 'Item IsolationTest X', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    if (itemXError) throw new Error(`Failed to create fixture item X: ${itemXError.message}`);
    itemXId = itemX.item_id;

    const { data: lotX, error: lotXError } = await adminClient
      .from('lots')
      .insert([{ company_id: companyXId, production_plant_id: plantXId, item_id: itemXId, lot_number: 'LOT-ISOTEST-X-1', quantity_on_hand: 50, source_type: 'purchased', status: 'available' }])
      .select('lot_id')
      .single();
    if (lotXError) throw new Error(`Failed to create fixture lot X: ${lotXError.message}`);
    lotXId = lotX.lot_id;

    const { data: bomX, error: bomXError } = await adminClient
      .from('boms')
      .insert([{ company_id: companyXId, parent_item_id: itemXId, version: 1, standard_yield_qty: 1, standard_yield_uom: 'g', status: 'active' }])
      .select('bom_id')
      .single();
    if (bomXError) throw new Error(`Failed to create fixture bom X: ${bomXError.message}`);

    const { data: workOrderX, error: woXError } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyXId, production_plant_id: plantXId, item_id: itemXId, bom_id: bomX.bom_id, planned_qty: 10, status: 'planned' }])
      .select('work_order_id')
      .single();
    if (woXError) throw new Error(`Failed to create fixture work order X: ${woXError.message}`);
    workOrderXId = workOrderX.work_order_id;
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['stock_movements', () => adminClient.from('stock_movements').delete().eq('company_id', companyXId)],
      ['work_order_assignments', () => adminClient.from('work_order_assignments').delete().eq('work_order_id', workOrderXId)],
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyXId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyXId)],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyXId)],
      ['lots', () => adminClient.from('lots').delete().eq('company_id', companyXId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyXId)],
      ['employees', () => adminClient.from('employees').delete().eq('company_id', companyXId)],
      ['users', () => adminClient.from('users').delete().in('company_id', [companyXId, companyYId])],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyXId)],
      ['auth:user_x', () => adminClient.auth.admin.deleteUser(userXAuthUid)],
      ['auth:user_y', () => adminClient.auth.admin.deleteUser(userYAuthUid)]
    ];

    await cleanupCompanyCascade(adminClient, [companyXId, companyYId], cleanupSteps);
  });

  it('user Company Y: SELECT items milik Company X -> 0 baris', async () => {
    const client = await signInAs('usery.isolationtest@debug.mrp');
    const { data, error } = await client.from('items').select('item_id').eq('company_id', companyXId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('user Company Y: SELECT lots milik Company X -> 0 baris', async () => {
    const client = await signInAs('usery.isolationtest@debug.mrp');
    const { data, error } = await client.from('lots').select('lot_id, quantity_on_hand').eq('company_id', companyXId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('user Company Y: SELECT work_orders milik Company X -> 0 baris', async () => {
    const client = await signInAs('usery.isolationtest@debug.mrp');
    const { data, error } = await client.from('work_orders').select('work_order_id').eq('company_id', companyXId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('user Company Y: SELECT employees_secure milik Company X -> 0 baris (bukan cuma wage_rate ter-mask, tapi barisnya sendiri tidak muncul)', async () => {
    const client = await signInAs('usery.isolationtest@debug.mrp');
    const { data, error } = await client.from('employees_secure').select('employee_id, name, wage_rate').eq('employee_id', employeeXId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('user Company Y: SELECT companies -> baris Company X tidak ikut muncul (hanya lihat company sendiri)', async () => {
    const client = await signInAs('usery.isolationtest@debug.mrp');
    const { data, error } = await client.from('companies').select('company_id').eq('company_id', companyXId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('user Company Y: INSERT lot langsung ke company_id milik Company X -> ditolak RLS', async () => {
    const client = await signInAs('usery.isolationtest@debug.mrp');
    const { error } = await client
      .from('lots')
      .insert([{ company_id: companyXId, production_plant_id: plantXId, item_id: itemXId, lot_number: 'LOT-ISOTEST-INTRUSION', quantity_on_hand: 1, source_type: 'purchased', status: 'available' }]);
    expect(error).not.toBeNull();
  });

  it('sebagai kontrol: user Company X TETAP bisa lihat datanya sendiri (isolasi bukan karena semua akses diblok)', async () => {
    const client = await signInAs('userx.isolationtest@debug.mrp');
    const { data, error } = await client.from('lots').select('lot_id, quantity_on_hand').eq('lot_id', lotXId).single();
    expect(error).toBeNull();
    expect(Number(data!.quantity_on_hand)).toBe(50);
  });
});
