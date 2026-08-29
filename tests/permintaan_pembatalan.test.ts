import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ensureAuthUser } from './ensureAuthUser';

// WS-SALES-CANCEL — permintaan pembatalan (BD-02, BD-03, BD-06, BD-07).
//
// EMPAT PRINSIP yang diuji, dan tiap satu punya testnya sendiri:
//   PERMINTAAN != PEMBATALAN     -- mengajukan tidak boleh mengubah status dokumen
//   PEMOHON != PEMUTUS           -- termasuk bila pemohonnya seorang pimpinan
//   GAGAL TERTUTUP               -- tanpa identitas/perusahaan/peran -> tolak
//   RIWAYAT EKSEKUSI TIDAK PERNAH DIHAPUS
//
// Test terakhir adalah yang paling penting dan paling mudah terlewat: pembatalan
// yang "berhasil" tetapi menghapus riwayat pengiriman adalah kerusakan, bukan fitur.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !roleTestPassword || !anonKey) {
  throw new Error('Environment untuk test belum lengkap.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('WS-SALES-CANCEL — permintaan pembatalan', () => {
  let companyA: number;
  let companyB: number;
  let soA: number;
  let soB: number;
  let shipmentA: number;
  const sesi: Record<string, SupabaseClient> = {};
  const email = (k: string) => `wscancel.${k.toLowerCase()}@debug.mrp`;

  async function buatPerusahaan(nama: string) {
    const { data: c } = await adminClient.from('companies').insert([{ name: nama, industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    const cid = c!.company_id;
    const { data: pl } = await adminClient.from('production_plants').insert([{ company_id: cid, name: 'P', center_lat: -7.9, center_lng: 112.6, geofence_radius_meters: 150 }]).select('production_plant_id').single();
    const { data: it } = await adminClient.from('items').insert([{ company_id: cid, item_code: `WSC-${cid}`, name: 'I', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs' }]).select('item_id').single();
    const { data: cu } = await adminClient.from('customers').insert([{ company_id: cid, name: 'K', customer_type: 'company' }]).select('customer_id').single();
    const { data: po } = await adminClient.from('customer_purchase_orders').insert([{ company_id: cid, customer_id: cu!.customer_id, po_number: `PO-WSC-${cid}`, po_date: '2026-08-29', payment_terms: 'full', status: 'new' }]).select('customer_purchase_order_id').single();
    const { data: so } = await adminClient.from('sales_orders').insert([{ company_id: cid, customer_purchase_order_id: po!.customer_purchase_order_id, customer_id: cu!.customer_id, production_plant_id: pl!.production_plant_id, status: 'confirmed', so_number: `001/8-WSC${cid}/2026` }]).select('sales_order_id').single();
    await adminClient.from('sales_order_lines').insert([{ sales_order_id: so!.sales_order_id, item_id: it!.item_id, qty_ordered: 100, unit_price: 1000, qty_shipped: 40 }]);
    return { cid, soId: so!.sales_order_id, plantId: pl!.production_plant_id };
  }

  async function buatSesi(kunci: string, cid: number, peran: string) {
    const { error: hapusError } = await adminClient.from('users').delete().eq('email', email(kunci));
    if (hapusError) throw new Error(`membersihkan users ${kunci} gagal: ${hapusError.message}`);
    const uid = await ensureAuthUser(adminClient, email(kunci), roleTestPassword!, { full_name: `WsCancel ${kunci}` });
    const { error } = await adminClient.from('users').insert([{ auth_uid: uid, company_id: cid, name: `WsCancel ${kunci}`, email: email(kunci), role: peran, status: 'active' }]);
    if (error) throw new Error(`insert users ${kunci} gagal: ${error.message}`);
    const c = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { error: le } = await c.auth.signInWithPassword({ email: email(kunci), password: roleTestPassword! });
    if (le) throw new Error(`login ${kunci} gagal: ${le.message}`);
    sesi[kunci] = c;
  }

  beforeAll(async () => {
    const { data: sisa } = await adminClient.from('companies').select('company_id').like('name', 'WsCancel%');
    for (const c of sisa ?? []) if (c.company_id !== 1) await adminClient.rpc('debug_force_delete_company', { p_company_id: c.company_id });

    const a = await buatPerusahaan('WsCancelATestCorp');
    companyA = a.cid; soA = a.soId;
    const b = await buatPerusahaan('WsCancelBTestCorp');
    companyB = b.cid; soB = b.soId;

    // Riwayat pengiriman NYATA di perusahaan A -- inilah yang tidak boleh hilang.
    const { data: sh } = await adminClient.from('shipments').insert([{
      company_id: companyA, sales_order_id: soA, shipment_date: '2026-08-20', status: 'shipped',
      shipment_number: `SJ-WSC-${companyA}`, delivery_address: 'Jl. Uji 1', dispatch_photo_url: 'x.jpg'
    }]).select('shipment_id').single();
    shipmentA = sh!.shipment_id;

    sesi.anon = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    await buatSesi('salesA', companyA, 'sales');
    await buatSesi('salesB', companyB, 'sales');
    await buatSesi('bosA', companyA, 'company_admin');
    await buatSesi('bosDua', companyA, 'general_manager');
    await buatSesi('gudangA', companyA, 'warehouse_staff');
  }, 300000);

  afterAll(async () => {
    for (const k of Object.keys(sesi)) await sesi[k]?.auth.signOut().catch(() => {});
    for (const cid of [companyA, companyB]) {
      if (!cid) continue;
      await adminClient.from('cancellation_requests').delete().eq('company_id', cid);
      try { await adminClient.rpc('debug_force_delete_company', { p_company_id: cid }); } catch { /* sebisanya */ }
    }
    await adminClient.from('users').delete().in('email', ['salesA', 'salesB', 'bosA', 'bosDua', 'gudangA'].map(email));
  }, 300000);

  const ajukan = (k: string, entity: string, id: number, kategori: string, catatan: string | null = null) =>
    sesi[k].rpc('ajukan_pembatalan', { p_entity: entity, p_record_id: id, p_reason_category: kategori, p_reason_note: catatan });
  const putuskan = (k: string, reqId: number, keputusan: string, kategori: string, catatan: string | null = null) =>
    sesi[k].rpc('putuskan_pembatalan', { p_cancellation_request_id: reqId, p_keputusan: keputusan, p_reason_category: kategori, p_reason_note: catatan });

  // ---- PERMINTAAN != PEMBATALAN ----

  it('(1) Sales BISA mengajukan pembatalan SO perusahaannya', async () => {
    const { data, error } = await ajukan('salesA', 'sales_orders', soA, 'permintaan_pelanggan');
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  it('(2) mengajukan TIDAK mengubah status Sales Order — permintaan bukan pembatalan', async () => {
    const { data: so } = await adminClient.from('sales_orders').select('status').eq('sales_order_id', soA).single();
    expect(so!.status).toBe('confirmed');
  });

  it('(3) keadaan eksekusi tercatat sebagai bahan tinjauan dampak', async () => {
    const { data: req } = await adminClient.from('cancellation_requests').select('execution_snapshot, requester_role_snapshot, requester_department_snapshot').eq('record_id', soA).eq('entity', 'sales_orders').single();
    expect(req!.requester_role_snapshot).toBe('sales');
    expect(req!.requester_department_snapshot).toBe('sales');
    const snap = req!.execution_snapshot as { qty_dipesan: number; qty_terkirim: number; pengiriman: number };
    expect(Number(snap.qty_terkirim)).toBe(40);
    expect(Number(snap.pengiriman)).toBe(1);
  });

  it('(4) permintaan kedua untuk dokumen yang sama DITOLAK', async () => {
    const { error } = await ajukan('salesA', 'sales_orders', soA, 'pembatalan_pelanggan');
    expect(error).not.toBeNull();
    expect(error!.message).toContain('menunggu keputusan');
  });

  // ---- PEMOHON != PEMUTUS ----

  it('(5) Sales TIDAK BISA memutuskan permintaannya sendiri', async () => {
    const { data: req } = await adminClient.from('cancellation_requests').select('cancellation_request_id').eq('record_id', soA).eq('status', 'pending').single();
    const { error } = await putuskan('salesA', req!.cancellation_request_id, 'approved', 'disetujui_permintaan_pelanggan');
    expect(error).not.toBeNull();
    expect(error!.message).toContain('Manager atau General Manager');
  });

  it('(6) bahkan PIMPINAN tidak boleh memutuskan permintaan yang diajukannya sendiri', async () => {
    // Pimpinan mengajukan untuk SO perusahaan B... pakai SO B lewat sesi bos B? Tidak ada.
    // Dipakai SO A: batalkan permintaan Sales dulu, lalu pimpinan mengajukan sendiri.
    const { data: req } = await adminClient.from('cancellation_requests').select('cancellation_request_id').eq('record_id', soA).eq('status', 'pending').single();
    await adminClient.from('cancellation_requests').update({ status: 'withdrawn' }).eq('cancellation_request_id', req!.cancellation_request_id);

    // Pimpinan memakai kategori yang TIDAK terikat departemen ('lainnya'), karena
    // kategori 'permintaan_pelanggan' pada tindakan ini milik departemen Sales dan
    // aturan kepemilikan kategori menolak pemakaian lintas departemen. Percobaan
    // pertama test ini justru tertangkap aturan itu -- perilakunya benar, testnya
    // yang keliru memilih kategori.
    const { data: idBaru, error: e1 } = await ajukan('bosA', 'sales_orders', soA, 'lainnya', 'Diajukan pimpinan untuk menguji pemisahan tugas');
    expect(e1).toBeNull();
    const { error } = await putuskan('bosA', idBaru as number, 'approved', 'disetujui_permintaan_pelanggan');
    expect(error).not.toBeNull();
    expect(error!.message).toContain('Pemohon tidak boleh memutuskan');
  });

  it('(7) pimpinan LAIN boleh memutuskan permintaan itu', async () => {
    const { data: req } = await adminClient.from('cancellation_requests').select('cancellation_request_id').eq('record_id', soA).eq('status', 'pending').single();
    const { error } = await putuskan('bosDua', req!.cancellation_request_id, 'rejected', 'ditolak_sudah_dikirim');
    expect(error).toBeNull();
    const { data: so } = await adminClient.from('sales_orders').select('status').eq('sales_order_id', soA).single();
    expect(so!.status).toBe('confirmed');
  });

  // ---- PEMBATALAN TERKENDALI, RIWAYAT UTUH ----

  it('(8) persetujuan membatalkan SO — dan riwayat pengiriman TETAP UTUH', async () => {
    const { data: sebelumLines } = await adminClient.from('sales_order_lines').select('qty_shipped').eq('sales_order_id', soA);
    const { data: idBaru } = await ajukan('salesA', 'sales_orders', soA, 'pembatalan_pelanggan');
    const { error } = await putuskan('bosDua', idBaru as number, 'approved', 'disetujui_permintaan_pelanggan');
    expect(error).toBeNull();

    const { data: so } = await adminClient.from('sales_orders').select('status').eq('sales_order_id', soA).single();
    expect(so!.status).toBe('cancelled');

    // INTI test ini: yang sudah terjadi TIDAK hilang.
    const { data: sh } = await adminClient.from('shipments').select('shipment_id, status').eq('shipment_id', shipmentA);
    expect(sh).toHaveLength(1);
    expect(sh![0].status).toBe('shipped');
    const { data: sesudahLines } = await adminClient.from('sales_order_lines').select('qty_shipped').eq('sales_order_id', soA);
    expect(sesudahLines).toEqual(sebelumLines);
  });

  it('(9) jejak keputusan lengkap: siapa, peran, alasan, dari-ke', async () => {
    const { data: jejak } = await adminClient.from('status_transition_log')
      .select('from_status, to_status, reason_category, actor_name_snapshot, actor_role_snapshot')
      .eq('table_name', 'sales_orders').eq('record_id', soA).order('status_transition_log_id', { ascending: false }).limit(1);
    expect(jejak![0].from_status).toBe('confirmed');
    expect(jejak![0].to_status).toBe('cancelled');
    expect(jejak![0].actor_role_snapshot).toBe('general_manager');
    expect(jejak![0].reason_category).toBe('disetujui_permintaan_pelanggan');
  });

  it('(10) dokumen yang sudah dibatalkan tidak bisa diajukan lagi', async () => {
    const { error } = await ajukan('salesA', 'sales_orders', soA, 'permintaan_pelanggan');
    expect(error).not.toBeNull();
    expect(error!.message).toContain('sudah dibatalkan');
  });

  // ---- GAGAL TERTUTUP ----

  it('(11) tanpa login: DITOLAK di tingkat hak eksekusi', async () => {
    const { error } = await sesi.anon.rpc('ajukan_pembatalan', { p_entity: 'sales_orders', p_record_id: soB, p_reason_category: 'permintaan_pelanggan', p_reason_note: null });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
  });

  it('(12) peran tanpa departemen keputusan TIDAK bisa mengajukan', async () => {
    const { error } = await ajukan('gudangA', 'sales_orders', soB, 'permintaan_pelanggan');
    expect(error).not.toBeNull();
    expect(error!.message).toContain('departemen');
  });

  it('(13) Sales perusahaan LAIN tidak bisa mengajukan untuk SO perusahaan ini', async () => {
    const { error } = await ajukan('salesA', 'sales_orders', soB, 'permintaan_pelanggan');
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak ditemukan di perusahaan Anda');
  });

  it('(14) Sales TIDAK BISA mengubah status Sales Order langsung', async () => {
    const { error, count } = await sesi.salesA.from('sales_orders').update({ status: 'cancelled' }, { count: 'exact' }).eq('sales_order_id', soB);
    expect(error !== null || count === 0).toBe(true);
    const { data: so } = await adminClient.from('sales_orders').select('status').eq('sales_order_id', soB).single();
    expect(so!.status).toBe('confirmed');
  });

  // ---- KATALOG ALASAN ----

  it('(15) kategori alasan di luar katalog DITOLAK', async () => {
    const { error } = await ajukan('salesB', 'sales_orders', soB, 'alasan_karangan');
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak dikenali');
  });

  it('(16) kategori "lainnya" tanpa catatan DITOLAK, dengan catatan DITERIMA', async () => {
    const tanpa = await ajukan('salesB', 'sales_orders', soB, 'lainnya', '   ');
    expect(tanpa.error).not.toBeNull();
    expect(tanpa.error!.message).toContain('catatan tambahan');
    const dengan = await ajukan('salesB', 'sales_orders', soB, 'lainnya', 'Pelanggan pindah pemasok');
    expect(dengan.error).toBeNull();
  });

  // ---- PO KLIEN memakai jalur yang SAMA ----

  it('(17) Sales bisa mengajukan pembatalan PO klien, dan itu tidak membatalkannya', async () => {
    const { data: po } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id, status').eq('company_id', companyA).single();
    const { error } = await ajukan('salesA', 'customer_purchase_orders', po!.customer_purchase_order_id, 'permintaan_pelanggan');
    expect(error).toBeNull();
    const { data: sesudah } = await adminClient.from('customer_purchase_orders').select('status').eq('customer_purchase_order_id', po!.customer_purchase_order_id).single();
    expect(sesudah!.status).toBe(po!.status);
  });
});
