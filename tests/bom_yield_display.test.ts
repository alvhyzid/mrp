import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createBom } from '../src/features/mrp/server/createBom';
import { updateBom } from '../src/features/mrp/server/updateBom';
import { listBoms } from '../src/features/mrp/server/listBoms';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// Perbaikan tampilan BOM (21 Agu 2026) -- pemilik produk bingung membaca
// "FG-GUMMY-ZALA-N200 - v1 (56.6667 pcs)": satuan generik "pcs" tidak
// membedakan botol/karton/sachet, dan angka pecahan tanpa keterangan terlihat
// seperti salah hitung. PRINSIP UTAMA yang diuji: (1) satuan yang ditampilkan
// HARUS ikut satuan ASLI item (base_uom), bukan field standard_yield_uom yang
// bisa "pcs" generik dan drift dari item; (2) standard_yield_basis_note/source
// -- nullable, TIDAK PERNAH dikarang kalau belum diisi.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeRequest(url: string, token: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

describe('BOM yield display — satuan asli item + keterangan asal angka (bukan "pcs" generik tanpa konteks)', () => {
  let companyId: number;
  let adminToken: string;
  let botolItemId: number;
  let gramItemId: number;
  let rawItemId: number;

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient
      .from('companies')
      .insert([{ name: 'BomYieldDisplayTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyId = company!.company_id;

    const { data: authUser, error: authUserError } = await adminClient.auth.admin.createUser({
      email: 'admin.bomyieldtest@debug.mrp',
      password: roleTestPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Admin BomYieldTest' }
    });
    let authUid: string;
    if (authUserError && !authUserError.message.includes('already been registered')) throw new Error(authUserError.message);
    if (authUser?.user) {
      authUid = authUser.user.id;
    } else {
      const { data } = await adminClient.auth.admin.listUsers({ perPage: 100, page: 1 });
      authUid = data!.users.find((u: any) => u.email === 'admin.bomyieldtest@debug.mrp')!.id;
    }
    await adminClient.from('users').upsert([{ auth_uid: authUid, company_id: companyId, name: 'Admin BomYieldTest', email: 'admin.bomyieldtest@debug.mrp', role: 'company_admin', status: 'active' }], { onConflict: 'auth_uid' });
    adminToken = await loginToken('admin.bomyieldtest@debug.mrp');

    const { data: items } = await adminClient
      .from('items')
      .insert([
        { company_id: companyId, item_code: 'YIELD-BOTOL', name: 'Item Uji Botol', type: 'finished_good', base_uom: 'botol', purchase_uom: 'botol', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'YIELD-GRAM', name: 'Item Uji Gram (WIP)', type: 'wip', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 },
        { company_id: companyId, item_code: 'YIELD-RAW', name: 'Bahan Uji', type: 'raw_material', base_uom: 'g', purchase_uom: 'g', uom_conversion_factor: 1 }
      ])
      .select('item_id, item_code');
    botolItemId = items!.find((i) => i.item_code === 'YIELD-BOTOL')!.item_id;
    gramItemId = items!.find((i) => i.item_code === 'YIELD-GRAM')!.item_id;
    rawItemId = items!.find((i) => i.item_code === 'YIELD-RAW')!.item_id;
  });

  afterAll(async () => {
    const { data: boms } = await adminClient.from('boms').select('bom_id').eq('company_id', companyId);
    const bomIds = (boms ?? []).map((b) => b.bom_id);
    const { data: users } = await adminClient.from('users').select('auth_uid').eq('company_id', companyId);
    const cleanupSteps: Array<[string, () => any]> = [
      ['bom_lines', () => adminClient.from('bom_lines').delete().in('bom_id', bomIds.length ? bomIds : [-1])],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ...(users ?? []).map((u): [string, () => any] => [`auth:${u.auth_uid}`, () => adminClient.auth.admin.deleteUser(u.auth_uid)])
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('BOM dgn keterangan asal angka + sumber DIPELAJARI -- tersimpan & tampil PERSIS, bukan dikarang', async () => {
    const createReq = makeRequest('http://localhost/api/boms', adminToken, 'POST', {
      parent_item_id: botolItemId,
      standard_yield_qty: 56.6667,
      standard_yield_uom: 'botol',
      standard_yield_basis_note: '10.000 g adonan x yield 85% / 2,5 g per gummy / 60 gummy per botol',
      standard_yield_source: 'DIPELAJARI',
      status: 'active',
      lines: [{ component_item_id: rawItemId, qty_per_unit_output: 100, uom: 'g' }]
    });
    const createResult = await createBom(createReq);
    expect(createResult.status).toBe(200);

    const listReq = makeRequest('http://localhost/api/boms', adminToken, 'GET');
    const listResult = await listBoms(listReq);
    const body = listResult.body as any;
    const bom = body.boms.find((b: any) => b.parent_item_id === botolItemId);
    expect(bom.standard_yield_basis_note).toBe('10.000 g adonan x yield 85% / 2,5 g per gummy / 60 gummy per botol');
    expect(bom.standard_yield_source).toBe('DIPELAJARI');
    // Satuan yang ditampilkan HARUS ikut base_uom item ('botol'), bukan
    // standard_yield_uom terpisah yang bisa saja "pcs" generik kalau diketik beda.
    expect(bom.parent_item_base_uom).toBe('botol');
  });

  it('(NEGATIF) item dgn satuan GRAM -> parent_item_base_uom "g", BUKAN "pcs" generik', async () => {
    const createReq = makeRequest('http://localhost/api/boms', adminToken, 'POST', {
      parent_item_id: gramItemId,
      standard_yield_qty: 2290.77,
      standard_yield_uom: 'g',
      status: 'active',
      lines: [{ component_item_id: rawItemId, qty_per_unit_output: 1, uom: 'g' }]
    });
    const createResult = await createBom(createReq);
    expect(createResult.status).toBe(200);

    const listReq = makeRequest('http://localhost/api/boms', adminToken, 'GET');
    const listResult = await listBoms(listReq);
    const body = listResult.body as any;
    const bom = body.boms.find((b: any) => b.parent_item_id === gramItemId);
    expect(bom.parent_item_base_uom).toBe('g');
    expect(bom.parent_item_base_uom).not.toBe('pcs');
  });

  it('(NEGATIF) BOM TANPA keterangan/sumber diisi -> null apa adanya, BUKAN string kosong yang terlihat seperti diisi', async () => {
    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'YIELD-NO-NOTE', name: 'Item Tanpa Keterangan', type: 'finished_good', base_uom: 'karton', purchase_uom: 'karton', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();

    const createReq = makeRequest('http://localhost/api/boms', adminToken, 'POST', {
      parent_item_id: item!.item_id,
      standard_yield_qty: 10,
      standard_yield_uom: 'karton',
      status: 'active',
      lines: [{ component_item_id: rawItemId, qty_per_unit_output: 1, uom: 'g' }]
    });
    const createResult = await createBom(createReq);
    expect(createResult.status).toBe(200);

    const listReq = makeRequest('http://localhost/api/boms', adminToken, 'GET');
    const listResult = await listBoms(listReq);
    const body = listResult.body as any;
    const bom = body.boms.find((b: any) => b.parent_item_id === item!.item_id);
    expect(bom.standard_yield_basis_note).toBeNull();
    expect(bom.standard_yield_source).toBeNull();
  });

  it('(NEGATIF) standard_yield_source tidak valid ditolak', async () => {
    const createReq = makeRequest('http://localhost/api/boms', adminToken, 'POST', {
      parent_item_id: botolItemId,
      standard_yield_qty: 10,
      standard_yield_uom: 'botol',
      standard_yield_source: 'DIKARANG_SAJA',
      status: 'draft',
      lines: [{ component_item_id: rawItemId, qty_per_unit_output: 1, uom: 'g' }]
    });
    const createResult = await createBom(createReq);
    expect(createResult.status).toBe(400);
  });

  it('update BOM menambahkan keterangan asal angka ke BOM yang tadinya kosong', async () => {
    const listReq = makeRequest('http://localhost/api/boms', adminToken, 'GET');
    const listResultBefore = await listBoms(listReq);
    const bomBefore = (listResultBefore.body as any).boms.find((b: any) => b.parent_item_id === gramItemId);

    const updateReq = makeRequest('http://localhost/api/boms', adminToken, 'PATCH', {
      bom_id: bomBefore.bom_id,
      parent_item_id: gramItemId,
      standard_yield_qty: 2290.77,
      standard_yield_uom: 'g',
      standard_yield_basis_note: 'Ditambahkan belakangan lewat edit BOM',
      standard_yield_source: 'ESTIMASI_MANUAL',
      status: 'active',
      lines: [{ component_item_id: rawItemId, qty_per_unit_output: 1, uom: 'g' }]
    });
    const updateResult = await updateBom(updateReq);
    expect(updateResult.status).toBe(200);

    const listResultAfter = await listBoms(listReq);
    const bomAfter = (listResultAfter.body as any).boms.find((b: any) => b.parent_item_id === gramItemId);
    expect(bomAfter.standard_yield_basis_note).toBe('Ditambahkan belakangan lewat edit BOM');
    expect(bomAfter.standard_yield_source).toBe('ESTIMASI_MANUAL');
  });
});
