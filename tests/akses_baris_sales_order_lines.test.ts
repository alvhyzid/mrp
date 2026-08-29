import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';

// WO-S03 (SC-03) — sales_order_lines adalah SATU-SATUNYA tabel Sales yang RLS-nya
// menyala dengan NOL kebijakan (disensus 29 Agu 2026: 8 tabel Sales lain punya 1-3
// kebijakan). Migrasi 20260904100000 menutupnya dengan menyalin pola induk.
//
// KENAPA TEST INI HARUS MEMAKAI KLIEN BER-RLS, BUKAN SERVICE ROLE. Seluruh jalur
// aplikasi Sales memakai service role yang MELEWATI RLS. Menguji lewat jalur itu
// akan lulus baik kebijakannya ada maupun tidak -- yaitu test yang terlihat
// meyakinkan dan tidak mengandung informasi. Karena itu tiap pemeriksaan di bawah
// memakai sesi login sungguhan (anon key + signInWithPassword).
//
// YANG TIDAK DICAKUP TEST INI, disebut supaya tidak dikira lebih luas dari
// kenyataannya: ia menguji ISOLASI BACA dan PENOLAKAN TULIS lewat RLS. Ia TIDAK
// menguji jalur aplikasi (yang tetap service role), dan TIDAK menguji SC-01,
// SC-02, SC-04, maupun SC-05.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !roleTestPassword || !anonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEBUG_ROLE_TEST_PASSWORD, dan anon key wajib diset.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

type Tenant = {
  companyId: number;
  salesOrderId: number;
  lineId: number;
  sesi: SupabaseClient;
  email: string;
};

async function buatTenant(nama: string, email: string, peran: string): Promise<Tenant> {
  const { data: company } = await adminClient
    .from('companies')
    .insert([{ name: nama, industry_type: 'manufacturing', status: 'trial' }])
    .select('company_id')
    .single();
  const companyId = company!.company_id;

  const { data: plant } = await adminClient
    .from('production_plants')
    .insert([{ company_id: companyId, name: `Pabrik ${nama}`, center_lat: -7.9, center_lng: 112.6, geofence_radius_meters: 150 }])
    .select('production_plant_id')
    .single();

  const { data: item } = await adminClient
    .from('items')
    .insert([{ company_id: companyId, item_code: `WOS03-${companyId}`, name: 'Item uji WO-S03', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs' }])
    .select('item_id')
    .single();

  const { data: customer } = await adminClient
    .from('customers')
    .insert([{ company_id: companyId, name: `Klien ${nama}`, customer_type: 'company' }])
    .select('customer_id')
    .single();

  const { data: cpo, error: cpoError } = await adminClient
    .from('customer_purchase_orders')
    .insert([{ company_id: companyId, customer_id: customer!.customer_id, po_number: `PO-WOS03-${companyId}`, po_date: '2026-08-29', payment_terms: 'full', status: 'new' }])
    .select('customer_purchase_order_id')
    .single();
  if (cpoError) throw new Error(`insert customer_purchase_orders gagal: ${cpoError.message}`);

  const { data: so, error: soError } = await adminClient
    .from('sales_orders')
    .insert([{ company_id: companyId, customer_purchase_order_id: cpo!.customer_purchase_order_id, customer_id: customer!.customer_id, production_plant_id: plant!.production_plant_id, status: 'confirmed', so_number: `001/8-WOS${companyId}/2026` }])
    .select('sales_order_id')
    .single();
  if (soError) throw new Error(`insert sales_orders gagal: ${soError.message}`);

  const { data: line, error: lineError } = await adminClient
    .from('sales_order_lines')
    .insert([{ sales_order_id: so!.sales_order_id, item_id: item!.item_id, qty_ordered: 10, unit_price: 1000 }])
    .select('sales_order_line_id')
    .single();
  if (lineError) throw new Error(`insert sales_order_lines gagal: ${lineError.message}`);

  // Baris users milik email fixture ini dibuang DULU. Alasannya bukan kerapian:
  // klaim company_id di JWT diambil dari baris users saat login. Bila run
  // sebelumnya terputus dan meninggalkan baris users yang menunjuk company LAMA,
  // insert di bawah gagal diam-diam karena email unik, sesi login membawa
  // company yang salah, dan seluruh pemeriksaan RLS di bawah melaporkan "nol
  // baris" -- yaitu KEGAGALAN YANG TERLIHAT PERSIS SEPERTI KEBIJAKAN YANG BEKERJA.
  // Sudah terjadi sekali saat menulis test ini, dan itulah kenapa baris ini ada.
  await adminClient.from('users').delete().eq('email', email);
  const authUid = await ensureAuthUser(adminClient, email, roleTestPassword!, { full_name: `Pengguna ${nama}` });
  const { error: userError } = await adminClient.from('users').insert([{ auth_uid: authUid, company_id: companyId, name: `Pengguna ${nama}`, email, role: peran, status: 'active' }]);
  if (userError) throw new Error(`insert users gagal: ${userError.message}`);

  const sesi = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
  await sesi.auth.signInWithPassword({ email, password: roleTestPassword! });

  return { companyId, salesOrderId: so!.sales_order_id, lineId: line!.sales_order_line_id, sesi, email };
}

describe('WO-S03 — akses baris sales_order_lines (RLS)', () => {
  let a: Tenant;
  let b: Tenant;
  let cPembaca: Tenant;

  beforeAll(async () => {
    a = await buatTenant('WosTigaATestCorp', 'wos03.a@debug.mrp', 'company_admin');
    b = await buatTenant('WosTigaBTestCorp', 'wos03.b@debug.mrp', 'company_admin');
    cPembaca = await buatTenant('WosTigaCTestCorp', 'wos03.c@debug.mrp', 'warehouse_staff');
  }, 120000);

  afterAll(async () => {
    for (const t of [a, b, cPembaca]) {
      if (!t) continue;
      await t.sesi.auth.signOut().catch(() => {});
      await adminClient.from('sales_order_lines').delete().eq('sales_order_id', t.salesOrderId);
      await adminClient.from('sales_orders').delete().eq('company_id', t.companyId);
      const { data: cpoRows } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('company_id', t.companyId);
      const cpoIds = (cpoRows ?? []).map((r) => r.customer_purchase_order_id);
      if (cpoIds.length) await adminClient.from('customer_po_approvals').delete().in('customer_purchase_order_id', cpoIds);
      await adminClient.from('customer_purchase_orders').delete().eq('company_id', t.companyId);
      await cleanupCompanyCascade(adminClient, t.companyId, [
        ['status_transition_log', async () => await adminClient.from('status_transition_log').delete().eq('company_id', t.companyId)],
        ['users', async () => await adminClient.from('users').delete().eq('email', t.email)],
        ['items', async () => await adminClient.from('items').delete().eq('company_id', t.companyId)],
        ['customers', async () => await adminClient.from('customers').delete().eq('company_id', t.companyId)],
        ['production_plants', async () => await adminClient.from('production_plants').delete().eq('company_id', t.companyId)],
        ['companies', async () => await adminClient.from('companies').delete().eq('company_id', t.companyId)]
      ]);
    }
  }, 120000);

  // (a) BERWENANG, COMPANY SAMA -> baris terlihat.
  it('pengguna company yang sama BISA membaca baris Sales Order-nya', async () => {
    const { data, error } = await a.sesi.from('sales_order_lines').select('sales_order_line_id, qty_ordered').eq('sales_order_id', a.salesOrderId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].sales_order_line_id).toBe(a.lineId);
  });

  // (c) COMPANY LAIN -> NOL BARIS. Ini inti isolasi tenant, dan ia diuji dengan
  //     meminta baris milik tenant lain SECARA LANGSUNG lewat id-nya -- bukan
  //     dengan meminta "semua" lalu berharap tidak kebetulan kosong.
  it('pengguna company LAIN mendapat NOL baris meski menyebut id-nya langsung', async () => {
    const { data, error } = await b.sesi.from('sales_order_lines').select('sales_order_line_id').eq('sales_order_line_id', a.lineId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('pengguna company LAIN juga tidak melihatnya lewat sales_order_id induk', async () => {
    const { data } = await b.sesi.from('sales_order_lines').select('sales_order_line_id').eq('sales_order_id', a.salesOrderId);
    expect(data).toEqual([]);
  });

  // (d) TULIS: peran tanpa wewenang ditolak DI SERVER, bukan disembunyikan tombolnya.
  //     warehouse_staff tidak ada di daftar peran kebijakan tulis.
  it('peran tanpa wewenang tulis TIDAK bisa menyisipkan baris (ditolak server)', async () => {
    const { data: itemLain } = await adminClient.from('items').select('item_id').eq('company_id', cPembaca.companyId).limit(1).single();
    const { error } = await cPembaca.sesi
      .from('sales_order_lines')
      .insert([{ sales_order_id: cPembaca.salesOrderId, item_id: itemLain!.item_id, qty_ordered: 1, unit_price: 1 }]);
    expect(error).not.toBeNull();
  });

  it('peran tanpa wewenang tulis TIDAK bisa mengubah baris company-nya sendiri', async () => {
    const { error, count } = await cPembaca.sesi
      .from('sales_order_lines')
      .update({ qty_ordered: 999 }, { count: 'exact' })
      .eq('sales_order_line_id', cPembaca.lineId);
    // RLS menolak lewat salah satu dari dua bentuk: galat, atau nol baris terkena.
    expect(error !== null || count === 0).toBe(true);
    const { data: sesudah } = await adminClient.from('sales_order_lines').select('qty_ordered').eq('sales_order_line_id', cPembaca.lineId).single();
    expect(Number(sesudah!.qty_ordered)).toBe(10);
  });

  // (e) PERAN BERWENANG di company yang sama TETAP bisa menulis -- supaya
  //     kebijakan barunya tidak diam-diam mematikan kemampuan yang sah.
  it('peran berwenang company yang sama TETAP bisa mengubah barisnya', async () => {
    const { error } = await a.sesi.from('sales_order_lines').update({ qty_ordered: 11 }).eq('sales_order_line_id', a.lineId);
    expect(error).toBeNull();
    const { data: sesudah } = await adminClient.from('sales_order_lines').select('qty_ordered').eq('sales_order_line_id', a.lineId).single();
    expect(Number(sesudah!.qty_ordered)).toBe(11);
  });

  // (f) BERWENANG TAPI COMPANY LAIN -> tetap ditolak. Menguji bahwa peran saja
  //     tidak cukup; kepemilikan induk tetap ditegakkan.
  it('peran berwenang dari company LAIN tetap tidak bisa mengubah baris tenant lain', async () => {
    const { error, count } = await b.sesi
      .from('sales_order_lines')
      .update({ qty_ordered: 777 }, { count: 'exact' })
      .eq('sales_order_line_id', a.lineId);
    expect(error !== null || count === 0).toBe(true);
    const { data: sesudah } = await adminClient.from('sales_order_lines').select('qty_ordered').eq('sales_order_line_id', a.lineId).single();
    expect(Number(sesudah!.qty_ordered)).not.toBe(777);
  });
});
