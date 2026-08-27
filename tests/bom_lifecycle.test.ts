import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { deleteOrArchiveBom, restoreBom } from '../src/features/mrp/server/deleteOrArchiveBom';
import { listBoms } from '../src/features/mrp/server/listBoms';
import { createWorkOrder } from '../src/features/mrp/server/createWorkOrder';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// ============================================================================
// DS-17 — SIKLUS HIDUP BOM
// ============================================================================
// Keluhan yang melahirkannya: "BOM yang dibuat lewat layar TIDAK BISA dihapus lewat
// layar" — dan selama BOM-nya ada, item komponennya ikut tertahan, karena server menolak
// menghapus item yang masih dipakai. Satu BOM salah ketik menahan beberapa item selamanya.
//
// KEPUTUSAN BISNIS YANG DIUJI DI SINI (pemilik produk, 27 Agu 2026):
//   BOM belum dipakai            -> HAPUS permanen
//   BOM dipakai Work Order       -> ARSIP
//   BOM dipakai batch produksi   -> ARSIP, dan snapshot batch TIDAK BOLEH berubah
//   BOM diarsipkan               -> TIDAK BOLEH dipakai Work Order baru
//   Pemulihan                    -> ADA
//   Yang memutuskan              -> SERVER, bukan pengguna
//
// BEDANYA DARI ROUTING, dan ini diuji langsung di (c): Routing MENOLAK pengarsipan bila
// ada batch berjalan. BOM tidak. Batch memakai `snapshotted_bom_id` — salinan bekunya
// sendiri — jadi mengarsipkan BOM induk tidak mengubah satu angka pun di batch itu.
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

function makeRequest(url: string, token: string, method: string): NextRequest {
  return new NextRequest(url, { method, headers: { Authorization: `Bearer ${token}` } });
}
function makeGetRequest(url: string, token: string): NextRequest {
  return new NextRequest(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
}
function makePostRequest(url: string, token: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('DS-17 — siklus hidup BOM: hapus / arsip / pulihkan, diputuskan server', () => {
  let companyId: number;
  let asingCompanyId: number;
  let plantId: number;
  let itemId: number;
  let komponenId: number;
  let routingId: number;
  let adminAuthUid: string;
  let staffAuthUid: string;
  let adminToken: string;
  let staffToken: string;

  const bomIds: number[] = [];
  const woIds: number[] = [];
  const batchIds: number[] = [];

  async function loginToken(email: string): Promise<string> {
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password: roleTestPassword! });
    if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
    return data.session.access_token;
  }

  async function buatBom(version: number): Promise<number> {
    const { data: bom } = await adminClient
      .from('boms')
      .insert([{ company_id: companyId, parent_item_id: itemId, version, standard_yield_qty: 100, standard_yield_uom: 'pcs', status: 'active', buffer_percentage: 0 }])
      .select('bom_id')
      .single();
    const bomId = bom!.bom_id;
    await adminClient.from('bom_lines').insert([{ bom_id: bomId, component_item_id: komponenId, qty_per_unit_output: 0.5, uom: 'kg' }]);
    bomIds.push(bomId);
    return bomId;
  }

  async function buatWorkOrder(bomId: number): Promise<number> {
    const { data: wo } = await adminClient
      .from('work_orders')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, bom_id: bomId, routing_id: routingId, planned_qty: 10, status: 'planned' }])
      .select('work_order_id')
      .single();
    woIds.push(wo!.work_order_id);
    return wo!.work_order_id;
  }

  /// Batch yang MEMBEKUKAN BOM — meniru keadaan setelah batch dimulai. Yang penting di
  /// sini bukan batch-nya, melainkan `snapshotted_bom_id`-nya: itulah jejak yang tidak
  /// boleh rusak oleh pengarsipan.
  async function buatBatchBersnapshot(workOrderId: number, bomId: number, batchNumber: string): Promise<number> {
    const { data } = await adminClient
      .from('production_batches')
      .insert([{ company_id: companyId, work_order_id: workOrderId, batch_number: batchNumber, planned_qty: 10, uom: 'pcs', status: 'in_progress', snapshotted_bom_id: bomId, snapshotted_bom_version: 1 }])
      .select('production_batch_id')
      .single();
    batchIds.push(data!.production_batch_id);
    return data!.production_batch_id;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'BomLifecycleTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    const { data: asing } = await adminClient.from('companies').insert([{ name: 'BomLifecycleAsingTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    asingCompanyId = asing!.company_id;

    const { data: plant } = await adminClient.from('production_plants').insert([{ company_id: companyId, name: 'Plant BomLifecycleTest', is_active: true }]).select('production_plant_id').single();
    plantId = plant!.production_plant_id;

    adminAuthUid = await ensureAuthUser(adminClient, 'admin.bomlifecycletest@debug.mrp', roleTestPassword);
    await adminClient.from('users').insert([{ auth_uid: adminAuthUid, company_id: companyId, name: 'Admin BomLifecycleTest', email: 'admin.bomlifecycletest@debug.mrp', role: 'company_admin', status: 'active' }]);
    adminToken = await loginToken('admin.bomlifecycletest@debug.mrp');

    staffAuthUid = await ensureAuthUser(adminClient, 'staff.bomlifecycletest@debug.mrp', roleTestPassword);
    await adminClient.from('users').insert([{ auth_uid: staffAuthUid, company_id: companyId, name: 'Staf BomLifecycleTest', email: 'staff.bomlifecycletest@debug.mrp', role: 'production_staff', status: 'active' }]);
    staffToken = await loginToken('staff.bomlifecycletest@debug.mrp');

    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'BLC-FG', name: 'Item BomLifecycleTest', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    itemId = item!.item_id;

    const { data: komponen } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'BLC-RM', name: 'Bahan BomLifecycleTest', type: 'raw_material', base_uom: 'kg', purchase_uom: 'kg', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    komponenId = komponen!.item_id;

    const { data: routing } = await adminClient.from('routings').insert([{ company_id: companyId, item_id: itemId, version: 1 }]).select('routing_id').single();
    routingId = routing!.routing_id;
  });

  afterAll(async () => {
    const cleanupSteps: Array<[string, () => any]> = [
      ['production_batch_bom_line_snapshots', () => adminClient.from('production_batch_bom_line_snapshots').delete().eq('company_id', companyId)],
      ['production_batches', () => adminClient.from('production_batches').delete().eq('company_id', companyId)],
      ['system_alerts', () => adminClient.from('system_alerts').delete().eq('company_id', companyId)],
      ['work_orders', () => adminClient.from('work_orders').delete().eq('company_id', companyId)],
      ['routings', () => adminClient.from('routings').delete().eq('company_id', companyId)],
      ['bom_lines', () => adminClient.from('bom_lines').delete().in('bom_id', bomIds.length ? bomIds : [-1])],
      ['boms', () => adminClient.from('boms').delete().eq('company_id', companyId)],
      ['items', () => adminClient.from('items').delete().eq('company_id', companyId)],
      ['users', () => adminClient.from('users').delete().eq('company_id', companyId)],
      ['production_plants', () => adminClient.from('production_plants').delete().eq('company_id', companyId)],
      ['companies:asing', () => adminClient.from('companies').delete().eq('company_id', asingCompanyId)],
      ['auth:admin', () => adminClient.auth.admin.deleteUser(adminAuthUid)],
      ['auth:staff', () => adminClient.auth.admin.deleteUser(staffAuthUid)]
    ];
    await cleanupCompanyCascade(adminClient, companyId, cleanupSteps);
  });

  it('(a) BOM belum pernah dipakai -> DIHAPUS permanen, baris dan bom_lines benar-benar hilang', async () => {
    const bomId = await buatBom(101);
    const res = await deleteOrArchiveBom(makeRequest(`http://localhost/api/boms/${bomId}`, adminToken, 'DELETE'), String(bomId));

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('dihapus');

    const { data: sisa } = await adminClient.from('boms').select('bom_id').eq('bom_id', bomId).maybeSingle();
    expect(sisa).toBeNull();

    // (l) nol bom_lines yatim — inilah sebab keluhan aslinya: item komponen tertahan
    // selama baris BOM-nya masih ada.
    const { count } = await adminClient.from('bom_lines').select('bom_line_id', { count: 'exact', head: true }).eq('bom_id', bomId);
    expect(count ?? 0).toBe(0);
  });

  it('(b) BOM dipakai Work Order -> DIARSIPKAN, bukan dihapus, dengan jejak siapa & kapan', async () => {
    const bomId = await buatBom(102);
    await buatWorkOrder(bomId);

    const res = await deleteOrArchiveBom(makeRequest(`http://localhost/api/boms/${bomId}`, adminToken, 'DELETE'), String(bomId));
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('diarsipkan');

    const { data: baris } = await adminClient.from('boms').select('bom_id, status, archived_at, archived_by').eq('bom_id', bomId).maybeSingle();
    expect(baris).not.toBeNull();
    expect(baris!.status).toBe('archived');
    expect(baris!.archived_at).not.toBeNull();
    expect(baris!.archived_by).not.toBeNull(); // (jejak aktor)
  });

  it('(c) BOM dibekukan batch produksi -> DIARSIPKAN, dan snapshot batch TIDAK berubah', async () => {
    const bomId = await buatBom(103);
    const woId = await buatWorkOrder(bomId);
    const batchId = await buatBatchBersnapshot(woId, bomId, `BLC-${bomId}`);

    const sebelum = await adminClient.from('production_batches').select('snapshotted_bom_id, snapshotted_bom_version, status').eq('production_batch_id', batchId).single();

    const res = await deleteOrArchiveBom(makeRequest(`http://localhost/api/boms/${bomId}`, adminToken, 'DELETE'), String(bomId));
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('diarsipkan');

    // (m) sejarah produksi UTUH — ini yang paling penting: batch berjalan pun tidak
    // terganggu, karena ia memakai salinan beku miliknya sendiri.
    const sesudah = await adminClient.from('production_batches').select('snapshotted_bom_id, snapshotted_bom_version, status').eq('production_batch_id', batchId).single();
    expect(sesudah.data).toEqual(sebelum.data);
    expect(sesudah.data!.snapshotted_bom_id).toBe(bomId);
  });

  it('(k) pesan arsip menyebut JUMLAH pemakaian yang sebenarnya, bukan kalimat kabur', async () => {
    const bomId = await buatBom(104);
    await buatWorkOrder(bomId);
    await buatWorkOrder(bomId);

    const res = await deleteOrArchiveBom(makeRequest(`http://localhost/api/boms/${bomId}`, adminToken, 'DELETE'), String(bomId));
    expect(res.status).toBe(200);
    expect((res.body.usage as { workOrders: number }).workOrders).toBe(2);
    expect(String(res.body.message)).toContain('2 Work Order');
  });

  it('(d)(e) BOM arsip HILANG dari daftar bawaan, MUNCUL dengan includeArchived=true', async () => {
    const bomId = await buatBom(105);
    await buatWorkOrder(bomId);
    await deleteOrArchiveBom(makeRequest(`http://localhost/api/boms/${bomId}`, adminToken, 'DELETE'), String(bomId));

    const bawaan = await listBoms(makeGetRequest('http://localhost/api/boms', adminToken));
    const idBawaan = (bawaan.body.boms as { bom_id: number }[]).map((b) => b.bom_id);
    expect(idBawaan).not.toContain(bomId);

    const semua = await listBoms(makeGetRequest('http://localhost/api/boms?includeArchived=true', adminToken));
    const idSemua = (semua.body.boms as { bom_id: number }[]).map((b) => b.bom_id);
    expect(idSemua).toContain(bomId);

    // KOLOMNYA IKUT TERKIRIM, bukan hanya ikut menyaring.
    //
    // Versi pertama uji ini berhenti di "barisnya muncul", dan itu LOLOS sementara layar
    // menampilkan tombol yang salah: `listBoms` mengambil `archived_at` di kueri lalu
    // menjatuhkannya dari objek jawaban. Barisnya tersaring benar, tapi layar tidak pernah
    // tahu baris itu diarsipkan, jadi ia menawarkan "Ubah + Hapus" untuk BOM yang sudah
    // diarsipkan — dan tombol "Pulihkan" tidak pernah muncul sama sekali.
    //
    // Ditemukan lewat MENJALANKAN di peramban, bukan lewat uji ini. Penjaganya ditambahkan
    // supaya kelasnya tidak bisa kembali diam-diam.
    const barisArsip = (semua.body.boms as { bom_id: number; archived_at: string | null }[]).find((b) => b.bom_id === bomId);
    expect(barisArsip?.archived_at).toBeTruthy();

    const barisAktif = (bawaan.body.boms as { bom_id: number; archived_at: string | null }[])[0];
    if (barisAktif) expect(barisAktif.archived_at).toBeNull();
  });

  it('(f) BOM arsip DITOLAK saat dipakai membuat Work Order baru — di SERVER', async () => {
    const bomId = await buatBom(106);
    await buatWorkOrder(bomId);
    await deleteOrArchiveBom(makeRequest(`http://localhost/api/boms/${bomId}`, adminToken, 'DELETE'), String(bomId));

    const res = await createWorkOrder(
      makePostRequest('http://localhost/api/work-orders', adminToken, {
        production_plant_id: plantId,
        bom_id: bomId,
        planned_qty: 5
      })
    );
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toContain('diarsipkan');
  });

  it('(g) pemulihan mengembalikan BOM jadi aktif dan menghapus jejak arsipnya', async () => {
    const bomId = await buatBom(107);
    await buatWorkOrder(bomId);
    await deleteOrArchiveBom(makeRequest(`http://localhost/api/boms/${bomId}`, adminToken, 'DELETE'), String(bomId));

    const res = await restoreBom(makeRequest(`http://localhost/api/boms/${bomId}/restore`, adminToken, 'PATCH'), String(bomId));
    expect(res.status).toBe(200);

    const { data } = await adminClient.from('boms').select('status, archived_at, archived_by').eq('bom_id', bomId).single();
    expect(data!.status).toBe('active');
    expect(data!.archived_at).toBeNull();
    expect(data!.archived_by).toBeNull();

    const bawaan = await listBoms(makeGetRequest('http://localhost/api/boms', adminToken));
    expect((bawaan.body.boms as { bom_id: number }[]).map((b) => b.bom_id)).toContain(bomId);
  });

  it('(i)(h) role tanpa izin DITOLAK server (403) untuk hapus/arsip DAN pulihkan', async () => {
    const bomId = await buatBom(108);

    const hapus = await deleteOrArchiveBom(makeRequest(`http://localhost/api/boms/${bomId}`, staffToken, 'DELETE'), String(bomId));
    expect(hapus.status).toBe(403);

    const pulih = await restoreBom(makeRequest(`http://localhost/api/boms/${bomId}/restore`, staffToken, 'PATCH'), String(bomId));
    expect(pulih.status).toBe(403);

    // Dan yang terpenting: BOM-nya masih ada. 403 yang tetap menghapus adalah 403 palsu.
    const { data } = await adminClient.from('boms').select('bom_id').eq('bom_id', bomId).maybeSingle();
    expect(data).not.toBeNull();
  });

  it('(j) BOM milik perusahaan lain TIDAK bisa disentuh, dan dijawab 404 bukan 403', async () => {
    const { data: itemAsing } = await adminClient
      .from('items')
      .insert([{ company_id: asingCompanyId, item_code: 'BLC-ASING', name: 'Item Asing', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    const { data: bomAsing } = await adminClient
      .from('boms')
      .insert([{ company_id: asingCompanyId, parent_item_id: itemAsing!.item_id, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }])
      .select('bom_id')
      .single();
    const idAsing = bomAsing!.bom_id;

    const res = await deleteOrArchiveBom(makeRequest(`http://localhost/api/boms/${idAsing}`, adminToken, 'DELETE'), String(idAsing));
    // 404, BUKAN 403: menjawab "tidak boleh" akan membocorkan bahwa barisnya ADA di tenant lain.
    expect(res.status).toBe(404);

    const { data: masihAda } = await adminClient.from('boms').select('bom_id').eq('bom_id', idAsing).maybeSingle();
    expect(masihAda).not.toBeNull();

    await adminClient.from('boms').delete().eq('bom_id', idAsing);
    await adminClient.from('items').delete().eq('item_id', itemAsing!.item_id);
  });

  it('(n) memanggil ulang pada BOM yang sudah diarsipkan ditolak, bukan mengarsipkan dua kali', async () => {
    const bomId = await buatBom(109);
    await buatWorkOrder(bomId);
    await deleteOrArchiveBom(makeRequest(`http://localhost/api/boms/${bomId}`, adminToken, 'DELETE'), String(bomId));

    const kedua = await deleteOrArchiveBom(makeRequest(`http://localhost/api/boms/${bomId}`, adminToken, 'DELETE'), String(bomId));
    expect(kedua.status).toBe(400);
    expect(String(kedua.body.error)).toContain('sudah diarsipkan');
  });
});
