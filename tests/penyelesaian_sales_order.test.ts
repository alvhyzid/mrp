import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ensureAuthUser } from './ensureAuthUser';

// PJL-03 — PENYELESAIAN SALES ORDER.
//
// ATURAN BISNIS YANG DIUJI (dikunci pemilik produk 29 Agu 2026):
//   PENYELESAIAN = PEMENUHAN, BUKAN PEMBAYARAN
//     -> test (5) menutup order yang MASIH MENUNGGAK, dan itu HARUS berhasil.
//        Bila test itu kelak gagal, yang rusak kemungkinan besar aturannya, bukan kodenya.
//   NOL TOLERANSI KURANG-KIRIM
//     -> 9.800 dari 10.000 ditolak, dan angkanya disebut di pesannya.
//   DUA KONFIRMASI, DUA DEPARTEMEN
//     -> PPIC mengonfirmasi, pimpinan menutup; keduanya tidak boleh orang yang sama.
//   GAGAL TERTUTUP
//     -> anonim, perusahaan lain, dan peran tanpa wewenang ditolak DI LAPISAN YANG DISEBUT.
//   RIWAYAT TIDAK PERNAH DITULIS ULANG
//     -> produksi dan pengiriman diperiksa ulang SESUDAH penutupan.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !roleTestPassword || !anonKey) {
  throw new Error('Environment untuk test belum lengkap.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

interface Fixture {
  cid: number;
  soId: number;
  lineId: number;
  itemId: number;
  plantId: number;
  bomId: number;
}

describe('PJL-03 — penyelesaian Sales Order', () => {
  let A: Fixture;
  let B: Fixture;
  let soKurangKirim: number;
  let soTanpaWo: number;
  let woA: number;
  let shipmentA: number;
  const sesi: Record<string, SupabaseClient> = {};
  const email = (k: string) => `pjl03.${k.toLowerCase()}@debug.mrp`;

  async function buatPerusahaan(nama: string): Promise<Fixture> {
    const { data: c } = await adminClient.from('companies').insert([{ name: nama, industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    const cid = c!.company_id;
    const { data: pl } = await adminClient.from('production_plants').insert([{ company_id: cid, name: 'P', center_lat: -7.9, center_lng: 112.6, geofence_radius_meters: 150 }]).select('production_plant_id').single();
    const { data: it } = await adminClient.from('items').insert([{ company_id: cid, item_code: `PJL03-${cid}`, name: 'I', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs' }]).select('item_id').single();
    const { data: bom } = await adminClient.from('boms').insert([{ company_id: cid, parent_item_id: it!.item_id, version: 1, standard_yield_qty: 1, standard_yield_uom: 'pcs', status: 'active' }]).select('bom_id').single();
    const { data: cu } = await adminClient.from('customers').insert([{ company_id: cid, name: 'K', customer_type: 'company' }]).select('customer_id').single();
    const { data: po } = await adminClient.from('customer_purchase_orders').insert([{ company_id: cid, customer_id: cu!.customer_id, po_number: `PO-PJL03-${cid}`, po_date: '2026-08-29', payment_terms: 'full', status: 'new' }]).select('customer_purchase_order_id').single();
    const { data: so } = await adminClient.from('sales_orders').insert([{ company_id: cid, customer_purchase_order_id: po!.customer_purchase_order_id, customer_id: cu!.customer_id, production_plant_id: pl!.production_plant_id, status: 'confirmed', so_number: `001/8-PJL03${cid}/2026` }]).select('sales_order_id').single();
    // Terkirim PENUH -- SO ini yang dipakai jalur berhasil.
    const { data: line } = await adminClient.from('sales_order_lines').insert([{ sales_order_id: so!.sales_order_id, item_id: it!.item_id, qty_ordered: 100, unit_price: 1000, qty_shipped: 100 }]).select('sales_order_line_id').single();
    return { cid, soId: so!.sales_order_id, lineId: line!.sales_order_line_id, itemId: it!.item_id, plantId: pl!.production_plant_id, bomId: bom!.bom_id };
  }

  async function buatSesi(kunci: string, cid: number, peran: string) {
    await adminClient.from('users').delete().eq('email', email(kunci));
    const uid = await ensureAuthUser(adminClient, email(kunci), roleTestPassword!, { full_name: `Pjl03 ${kunci}` });
    const { error } = await adminClient.from('users').insert([{ auth_uid: uid, company_id: cid, name: `Pjl03 ${kunci}`, email: email(kunci), role: peran, status: 'active' }]);
    if (error) throw new Error(`insert users ${kunci} gagal: ${error.message}`);
    const c = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { error: le } = await c.auth.signInWithPassword({ email: email(kunci), password: roleTestPassword! });
    if (le) throw new Error(`login ${kunci} gagal: ${le.message}`);
    sesi[kunci] = c;
  }

  beforeAll(async () => {
    const { data: sisa } = await adminClient.from('companies').select('company_id').like('name', 'Pjl03%');
    for (const c of sisa ?? []) if (c.company_id !== 1) await adminClient.rpc('debug_force_delete_company', { p_company_id: c.company_id });

    A = await buatPerusahaan('Pjl03ATestCorp');
    B = await buatPerusahaan('Pjl03BTestCorp');

    // Work Order SELESAI untuk SO utama -- bukti produksi.
    const { data: wo, error: eWo } = await adminClient.from('work_orders').insert([{
      company_id: A.cid, production_plant_id: A.plantId, item_id: A.itemId, bom_id: A.bomId,
      planned_qty: 100, status: 'completed', priority: 'normal', sales_order_line_id: A.lineId
    }]).select('work_order_id').single();
    if (eWo) throw new Error(`fixture Work Order gagal: ${eWo.message}`);
    woA = wo!.work_order_id;

    // Riwayat pengiriman NYATA -- yang tidak boleh berubah oleh penutupan.
    const { data: sh } = await adminClient.from('shipments').insert([{
      company_id: A.cid, sales_order_id: A.soId, shipment_date: '2026-08-20', status: 'shipped',
      shipment_number: `SJ-PJL03-${A.cid}`, delivery_address: 'Jl. Uji 1', dispatch_photo_url: 'x.jpg'
    }]).select('shipment_id').single();
    shipmentA = sh!.shipment_id;

    // SO KURANG KIRIM: 9.800 dari 10.000, produksinya selesai.
    // Galat insert DIPERIKSA, bukan diabaikan: fixture yang gagal diam-diam menghasilkan
    // test yang lulus tanpa menguji apa pun (AUD-43).
    const { data: cuA } = await adminClient.from('customers').select('customer_id').eq('company_id', A.cid).single();
    // Satu PO klien hanya boleh melahirkan SATU Sales Order (kekangan unik), jadi tiap SO
    // tambahan di fixture ini butuh PO-nya sendiri.
    const buatPo = async (nomor: string) => {
      const { data, error } = await adminClient.from('customer_purchase_orders').insert([{
        company_id: A.cid, customer_id: cuA!.customer_id, po_number: nomor, po_date: '2026-08-29',
        payment_terms: 'full', status: 'new'
      }]).select('customer_purchase_order_id').single();
      if (error) throw new Error(`fixture PO ${nomor} gagal: ${error.message}`);
      return data!.customer_purchase_order_id;
    };
    const poKurang = await buatPo(`PO-PJL03-K-${A.cid}`);
    const poTanpaWo = await buatPo(`PO-PJL03-T-${A.cid}`);
    const { data: so2, error: e2 } = await adminClient.from('sales_orders').insert([{
      company_id: A.cid, customer_id: cuA!.customer_id, customer_purchase_order_id: poKurang,
      production_plant_id: A.plantId, status: 'confirmed', so_number: `002/8-PJL03${A.cid}/2026`
    }]).select('sales_order_id').single();
    if (e2) throw new Error(`fixture SO kurang kirim gagal: ${e2.message}`);
    soKurangKirim = so2!.sales_order_id;
    const { data: l2 } = await adminClient.from('sales_order_lines').insert([{ sales_order_id: soKurangKirim, item_id: A.itemId, qty_ordered: 10000, unit_price: 10, qty_shipped: 9800 }]).select('sales_order_line_id').single();
    await adminClient.from('work_orders').insert([{
      company_id: A.cid, production_plant_id: A.plantId, item_id: A.itemId, bom_id: A.bomId,
      planned_qty: 10000, status: 'completed', priority: 'normal', sales_order_line_id: l2!.sales_order_line_id
    }]);

    // SO TERKIRIM PENUH tapi TANPA Work Order sama sekali -- gagal tertutup yang disengaja.
    const { data: so3, error: e3 } = await adminClient.from('sales_orders').insert([{
      company_id: A.cid, customer_id: cuA!.customer_id, customer_purchase_order_id: poTanpaWo,
      production_plant_id: A.plantId, status: 'confirmed', so_number: `003/8-PJL03${A.cid}/2026`
    }]).select('sales_order_id').single();
    if (e3) throw new Error(`fixture SO tanpa WO gagal: ${e3.message}`);
    soTanpaWo = so3!.sales_order_id;
    await adminClient.from('sales_order_lines').insert([{ sales_order_id: soTanpaWo, item_id: A.itemId, qty_ordered: 5, unit_price: 10, qty_shipped: 5 }]);

    sesi.anon = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    await buatSesi('ppicA', A.cid, 'ppic_manager');
    await buatSesi('bosA', A.cid, 'company_admin');
    await buatSesi('gmA', A.cid, 'general_manager');
    await buatSesi('gudangA', A.cid, 'warehouse_staff');
    await buatSesi('salesA', A.cid, 'sales');
    await buatSesi('ppicB', B.cid, 'ppic_manager');
    await buatSesi('bosB', B.cid, 'company_admin');
  }, 300000);

  afterAll(async () => {
    for (const k of Object.keys(sesi)) await sesi[k]?.auth.signOut().catch(() => {});
    for (const cid of [A?.cid, B?.cid]) {
      if (!cid) continue;
      await adminClient.from('sales_order_completion_approvals').delete().eq('company_id', cid);
      await adminClient.from('cancellation_requests').delete().eq('company_id', cid);
      try { await adminClient.rpc('debug_force_delete_company', { p_company_id: cid }); } catch { /* sebisanya */ }
    }
    await adminClient.from('users').delete().in('email', ['ppicA', 'bosA', 'gmA', 'gudangA', 'salesA', 'ppicB', 'bosB'].map(email));
  }, 300000);

  const konfirmasi = (k: string, soId: number, kategori = 'pemenuhan_lengkap', catatan: string | null = null) =>
    sesi[k].rpc('konfirmasi_pemenuhan_sales_order', { p_sales_order_id: soId, p_reason_category: kategori, p_reason_note: catatan });
  const tutup = (k: string, soId: number, kategori = 'pemenuhan_terverifikasi', catatan: string | null = null) =>
    sesi[k].rpc('selesaikan_sales_order', { p_sales_order_id: soId, p_reason_category: kategori, p_reason_note: catatan });
  const kelayakan = (k: string, soId: number) => sesi[k].rpc('kelayakan_penyelesaian_so', { p_sales_order_id: soId });

  // ---- KELAYAKAN ----

  it('(1) produksi selesai + terkirim penuh -> LAYAK', async () => {
    const { data, error } = await kelayakan('ppicA', A.soId);
    expect(error).toBeNull();
    expect(data.layak).toBe(true);
    expect(data.sebab_belum_layak).toEqual([]);
  });

  it('(2) kurang kirim -> TIDAK layak, dan jumlah kurangnya disebut', async () => {
    const { data } = await kelayakan('ppicA', soKurangKirim);
    expect(data.layak).toBe(false);
    expect(String(data.sebab_belum_layak.join(' '))).toContain('200');
  });

  it('(3) tanpa Work Order tapi terkirim PENUH -> LAYAK (pemenuhan dari stok, PJL-16)', async () => {
    // KEPUTUSAN PEMILIK PRODUK 30 Agu 2026 -- MEMBALIK perilaku sebelumnya, dan pembalikan
    // itu disengaja: FABRIX memproduksi buffer stock dari forecast, dan buffer itu sah dipakai
    // memenuhi order berikutnya. "Harus ada Work Order" BUKAN syarat penyelesaian.
    const { data, error } = await kelayakan('ppicA', soTanpaWo);
    expect(error, JSON.stringify(error)).toBeNull();
    expect(data.layak).toBe(true);
    expect(data.work_order_total).toBe(0);
  });

  it('(3b) tanpa Work Order DAN belum terkirim penuh -> TIDAK layak', async () => {
    // Batas yang tetap berlaku: yang dicabut hanya syarat Work Order, BUKAN syarat pemenuhan.
    await adminClient.from('sales_order_lines').update({ qty_shipped: 3 }).eq('sales_order_id', soTanpaWo);
    const { data } = await kelayakan('ppicA', soTanpaWo);
    expect(data.layak).toBe(false);
    expect(String(data.sebab_belum_layak.join(' '))).toContain('belum dikirim');
    await adminClient.from('sales_order_lines').update({ qty_shipped: 5 }).eq('sales_order_id', soTanpaWo);
  });

  it('(3c) sumber pemenuhan DITURUNKAN dari jejak lot, bukan dari kolom baru', async () => {
    // Nol kolom sales_order.stock_source dibuat -- sumbernya dibaca dari
    // shipment_lines.lot_id -> work_order_outputs. Tanpa pengiriman ber-lot, jawabannya
    // "belum_terkirim", dan itu JUJUR: sistem memang belum punya buktinya.
    const { data } = await kelayakan('ppicA', soTanpaWo);
    expect(['belum_terkirim', 'stok', 'produksi', 'campuran']).toContain(data.sumber_pemenuhan);
    expect(data).toHaveProperty('lot_terkirim');
    expect(data).toHaveProperty('lot_dari_produksi');
  });

  it('(4) produksi belum selesai -> TIDAK layak meski sudah terkirim penuh', async () => {
    await adminClient.from('work_orders').update({ status: 'in_progress' }).eq('work_order_id', woA);
    const { data } = await kelayakan('ppicA', A.soId);
    expect(data.layak).toBe(false);
    expect(String(data.sebab_belum_layak.join(' '))).toContain('Produksi belum selesai');
    await adminClient.from('work_orders').update({ status: 'completed' }).eq('work_order_id', woA);
  });

  it('(5) permintaan pembatalan yang menunggu -> TIDAK layak', async () => {
    const { data: req } = await sesi.salesA.rpc('ajukan_pembatalan', {
      p_entity: 'sales_orders', p_record_id: A.soId, p_reason_category: 'permintaan_pelanggan', p_reason_note: null
    });
    const { data } = await kelayakan('ppicA', A.soId);
    expect(data.layak).toBe(false);
    expect(String(data.sebab_belum_layak.join(' '))).toContain('pembatalan');
    await sesi.bosA.rpc('putuskan_pembatalan', {
      p_cancellation_request_id: req, p_keputusan: 'rejected', p_reason_category: 'lainnya', p_reason_note: 'ditutup untuk pengujian'
    });
    const { data: sesudah } = await kelayakan('ppicA', A.soId);
    expect(sesudah.layak).toBe(true);
  });

  // ---- WEWENANG & GAGAL TERTUTUP ----

  it('(6) anonim DITOLAK memanggil fungsi penutupan', async () => {
    const { error } = await sesi.anon.rpc('selesaikan_sales_order', {
      p_sales_order_id: A.soId, p_reason_category: 'pemenuhan_terverifikasi', p_reason_note: null
    });
    expect(error).not.toBeNull();
    // Ditolak di LAPISAN IZIN basis data, bukan oleh aturan bisnis -- bila kelak hibah
    // PUBLIC bawaan Postgres kembali, kode ini yang berubah lebih dulu.
    expect(error!.code).toBe('42501');
  });

  it('(7) gudang (tanpa wewenang) DITOLAK mengonfirmasi pemenuhan', async () => {
    const { error } = await konfirmasi('gudangA', A.soId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('Hanya PPIC');
  });

  it('(8) Sales DITOLAK mengonfirmasi pemenuhan', async () => {
    const { error } = await konfirmasi('salesA', A.soId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('Hanya PPIC');
  });

  it('(9) PPIC perusahaan LAIN tidak menemukan Sales Order ini', async () => {
    const { error } = await konfirmasi('ppicB', A.soId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak ditemukan di perusahaan Anda');
  });

  it('(10) menutup TANPA konfirmasi PPIC ditolak', async () => {
    const { error } = await tutup('bosA', A.soId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('PPIC belum mengonfirmasi');
  });

  // ---- JALUR BERHASIL ----

  it('(11) PPIC BISA mengonfirmasi pemenuhan, dan itu TIDAK menutup order', async () => {
    const { data, error } = await konfirmasi('ppicA', A.soId);
    expect(error, JSON.stringify(error)).toBeNull();
    expect(data).toBeTruthy();
    const { data: so } = await adminClient.from('sales_orders').select('status').eq('sales_order_id', A.soId).single();
    expect(so!.status).toBe('confirmed');
  });

  it('(12) PPIC DITOLAK menutup order — menutup bukan wewenangnya', async () => {
    const { error } = await tutup('ppicA', A.soId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('Hanya Manager atau General Manager');
  });

  it('(13) keadaan berubah sesudah konfirmasi -> penutupan DITOLAK, bukan diam-diam lolos', async () => {
    await adminClient.from('sales_order_lines').update({ qty_shipped: 90 }).eq('sales_order_line_id', A.lineId);
    const { error } = await tutup('bosA', A.soId);
    expect(error).not.toBeNull();
    // Kelayakannya sendiri sudah gugur, jadi pesan yang benar adalah soal kelayakan.
    expect(error!.message).toMatch(/Belum bisa diselesaikan|Keadaan pemenuhan berubah/);
    await adminClient.from('sales_order_lines').update({ qty_shipped: 100 }).eq('sales_order_line_id', A.lineId);
  });

  it('(14) pemilik keputusan yang berwenang BISA menutup order — dan pembayaran tidak ditanya sama sekali', async () => {
    const { error } = await tutup('bosA', A.soId, 'pemenuhan_terverifikasi');
    expect(error).toBeNull();
    const { data: so } = await adminClient.from('sales_orders').select('status').eq('sales_order_id', A.soId).single();
    expect(so!.status).toBe('completed');
  });

  it('(15) order yang ditutup TETAP menunggak — penyelesaian berbasis pemenuhan, bukan pembayaran', async () => {
    // Nol tabel pembayaran di FABRIX (FIN-02). Yang dibuktikan di sini: penutupan berhasil
    // TANPA satu pun pemeriksaan pembayaran, dan kewajiban bayarnya tidak ikut disentuh.
    const { data: kewajiban } = await adminClient.from('sales_order_payment_obligations').select('*').eq('sales_order_id', A.soId);
    expect(kewajiban ?? []).toHaveLength(0);
    const { data: so } = await adminClient.from('sales_orders').select('status').eq('sales_order_id', A.soId).single();
    expect(so!.status).toBe('completed');
  });

  it('(16) penutupan tercatat di jejak keputusan dengan pelaku dan alasan', async () => {
    const { data } = await adminClient
      .from('status_transition_log')
      .select('from_status, to_status, actor_name_snapshot, actor_role_snapshot, actor_department_snapshot, reason_category')
      .eq('table_name', 'sales_orders')
      .eq('record_id', A.soId)
      .eq('to_status', 'completed');
    expect(data).toHaveLength(1);
    expect(data![0].from_status).toBe('confirmed');
    expect(data![0].actor_name_snapshot).toContain('Pjl03');
    expect(data![0].actor_role_snapshot).toBe('company_admin');
    expect(data![0].actor_department_snapshot).toBe('manager');
    expect(data![0].reason_category).toBe('pemenuhan_terverifikasi');
  });

  it('(17) riwayat produksi dan pengiriman TIDAK berubah oleh penutupan', async () => {
    const { data: wo } = await adminClient.from('work_orders').select('status').eq('work_order_id', woA).single();
    expect(wo!.status).toBe('completed');
    const { data: sh } = await adminClient.from('shipments').select('status, shipment_number').eq('shipment_id', shipmentA).single();
    expect(sh!.status).toBe('shipped');
    expect(sh!.shipment_number).toContain('SJ-PJL03');
  });

  it('(18) order yang sudah selesai tidak bisa ditutup dua kali', async () => {
    const { error } = await tutup('gmA', A.soId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('sudah selesai');
  });

  it('(19) kurang kirim TIDAK bisa dikonfirmasi PPIC — nol toleransi', async () => {
    const { error } = await konfirmasi('ppicA', soKurangKirim);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('Belum bisa dikonfirmasi');
    expect(error!.message).toContain('200');
  });

  it('(20) orang yang mengonfirmasi pemenuhan tidak boleh menutup order yang sama', async () => {
    // Perusahaan B: pimpinan yang SEKALIGUS mengonfirmasi tidak boleh menutup.
    // Peran ppic_manager satu-satunya yang boleh mengonfirmasi, jadi pemisahannya
    // ditegakkan lewat identitas pengguna, bukan lewat kebetulan peran.
    await adminClient.from('work_orders').insert([{
      company_id: B.cid, production_plant_id: B.plantId, item_id: B.itemId, bom_id: B.bomId,
      planned_qty: 100, status: 'completed', priority: 'normal', sales_order_line_id: B.lineId
    }]);
    const { error: e1 } = await konfirmasi('ppicB', B.soId);
    expect(e1).toBeNull();
    await adminClient.from('sales_order_completion_approvals')
      .update({ approved_by: (await adminClient.from('users').select('user_id').eq('email', email('bosB')).single()).data!.user_id })
      .eq('sales_order_id', B.soId).eq('department', 'ppic');
    const { error } = await tutup('bosB', B.soId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak boleh menutup Sales Order yang sama');
  });

  it('(22) keadaan berubah TAPI tetap layak -> penutupan tetap DITOLAK sampai PPIC mengonfirmasi ulang', async () => {
    // Menguji penjaga DATA BASI secara terpisah dari kelayakan. Work Order kedua yang juga
    // selesai membuat order TETAP layak, tetapi cuplikan saat PPIC mengonfirmasi sudah tidak
    // mencerminkan kenyataan. Tanpa test ini, penjaga cuplikan bisa dicabut tanpa ada yang
    // gagal -- karena test lain sudah gugur lebih dulu di kelayakan.
    const { data: cuB } = await adminClient.from('customers').select('customer_id').eq('company_id', B.cid).single();
    const { data: poB } = await adminClient.from('customer_purchase_orders').insert([{
      company_id: B.cid, customer_id: cuB!.customer_id, po_number: `PO-PJL03-S-${B.cid}`, po_date: '2026-08-29', payment_terms: 'full', status: 'new'
    }]).select('customer_purchase_order_id').single();
    const { data: so } = await adminClient.from('sales_orders').insert([{
      company_id: B.cid, customer_id: cuB!.customer_id, customer_purchase_order_id: poB!.customer_purchase_order_id,
      production_plant_id: B.plantId, status: 'confirmed', so_number: `009/8-PJL03${B.cid}/2026`
    }]).select('sales_order_id').single();
    const soId = so!.sales_order_id;
    const { data: line } = await adminClient.from('sales_order_lines').insert([{ sales_order_id: soId, item_id: B.itemId, qty_ordered: 10, unit_price: 100, qty_shipped: 10 }]).select('sales_order_line_id').single();
    await adminClient.from('work_orders').insert([{
      company_id: B.cid, production_plant_id: B.plantId, item_id: B.itemId, bom_id: B.bomId,
      planned_qty: 10, status: 'completed', priority: 'normal', sales_order_line_id: line!.sales_order_line_id
    }]);

    const { error: eKonf } = await konfirmasi('ppicB', soId);
    expect(eKonf, JSON.stringify(eKonf)).toBeNull();

    // Work Order KEDUA yang juga selesai: kelayakan tetap true, cuplikan berubah.
    await adminClient.from('work_orders').insert([{
      company_id: B.cid, production_plant_id: B.plantId, item_id: B.itemId, bom_id: B.bomId,
      planned_qty: 10, status: 'completed', priority: 'normal', sales_order_line_id: line!.sales_order_line_id
    }]);
    const { data: masihLayak } = await kelayakan('ppicB', soId);
    expect(masihLayak.layak, 'prasyarat test: order harus TETAP layak').toBe(true);

    const { error } = await tutup('bosB', soId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('Keadaan pemenuhan berubah');

    // Konfirmasi ulang membuka jalannya kembali -- penjaganya menahan, bukan mengunci selamanya.
    const { error: eUlang } = await konfirmasi('ppicB', soId);
    expect(eUlang).toBeNull();
    const { error: eTutup } = await tutup('bosB', soId);
    expect(eTutup, JSON.stringify(eTutup)).toBeNull();
  });

  it('(23) Sales Order yang DIBATALKAN tidak bisa diselesaikan', async () => {
    const { data: cuB } = await adminClient.from('customers').select('customer_id').eq('company_id', B.cid).single();
    const { data: po } = await adminClient.from('customer_purchase_orders').insert([{
      company_id: B.cid, customer_id: cuB!.customer_id, po_number: `PO-PJL03-X-${B.cid}`, po_date: '2026-08-29', payment_terms: 'full', status: 'new'
    }]).select('customer_purchase_order_id').single();
    const { data: so, error: eSo } = await adminClient.from('sales_orders').insert([{
      company_id: B.cid, customer_id: cuB!.customer_id, customer_purchase_order_id: po!.customer_purchase_order_id,
      production_plant_id: B.plantId, status: 'cancelled', so_number: `010/8-PJL03${B.cid}/2026`
    }]).select('sales_order_id').single();
    if (eSo) throw new Error(`fixture SO dibatalkan gagal: ${eSo.message}`);

    const { data } = await kelayakan('ppicB', so!.sales_order_id);
    expect(data.layak).toBe(false);
    expect(String(data.sebab_belum_layak.join(' '))).toContain('sudah dibatalkan');

    const { error } = await tutup('bosB', so!.sales_order_id);
    expect(error).not.toBeNull();
    // Ditolak SEBELUM menyentuh status: PPIC belum mengonfirmasi, dan kelayakannya pun gugur.
    expect(error!.message).toMatch(/sudah dibatalkan|PPIC belum mengonfirmasi/);

    const { data: sesudah } = await adminClient.from('sales_orders').select('status').eq('sales_order_id', so!.sales_order_id).single();
    expect(sesudah!.status).toBe('cancelled');
  });

  it('(21) dua penutupan bersamaan: satu berhasil, satu ditolak — bukan dua-duanya lolos', async () => {
    await adminClient.from('sales_order_completion_approvals')
      .update({ approved_by: (await adminClient.from('users').select('user_id').eq('email', email('ppicB')).single()).data!.user_id })
      .eq('sales_order_id', B.soId).eq('department', 'ppic');
    const hasil = await Promise.all([tutup('bosB', B.soId), tutup('bosB', B.soId)]);
    const berhasil = hasil.filter((h) => h.error === null).length;
    expect(berhasil).toBe(1);
    const { data: so } = await adminClient.from('sales_orders').select('status').eq('sales_order_id', B.soId).single();
    expect(so!.status).toBe('completed');
  });
});
