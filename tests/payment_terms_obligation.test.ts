import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ensureAuthUser } from './ensureAuthUser';

// DEC-S05 — Payment Terms + Payment Obligation.
//
// YANG DIUJI DI SINI, dan urutannya mencerminkan apa yang paling mahal bila salah:
//   1. INTEGRITAS UANG   -- jumlah kewajiban WAJIB sama persis dengan nilai transaksi,
//                           termasuk saat persentase tidak habis dibagi
//   2. INTEGRITAS SEJARAH -- mengubah master TIDAK mengubah transaksi lama
//   3. BATAS DOMAIN      -- nol catatan pembayaran, nol piutang dibuat di sini
//   4. KEAMANAN          -- gagal tertutup, lintas perusahaan ditolak
//
// YANG TIDAK DIUJI, karena memang belum ada: status pembayaran yang diturunkan dari
// pembayaran sungguhan. Domain Finance untuk piutang pelanggan TIDAK ADA di FABRIX --
// disensus terhadap 101 tabel. Menguji "status jadi Paid" berarti menguji sesuatu yang
// tidak punya sumber.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !serviceRoleKey || !roleTestPassword || !anonKey) throw new Error('Environment test belum lengkap.');

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('DEC-S05 — Payment Terms & Payment Obligation', () => {
  let companyA: number;
  let companyB: number;
  let itemA: number;
  let customerA: number;
  let plantA: number;
  let cpoA: number;
  let termEnamPuluh: number;
  let termLimaPuluh: number;
  const sesi: Record<string, SupabaseClient> = {};
  const email = (k: string) => `decs05.${k.toLowerCase()}@debug.mrp`;

  async function buatPerusahaan(nama: string) {
    const { data: c } = await adminClient.from('companies').insert([{ name: nama, industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    const cid = c!.company_id;
    const { data: pl } = await adminClient.from('production_plants').insert([{ company_id: cid, name: 'P', center_lat: -7.9, center_lng: 112.6, geofence_radius_meters: 150 }]).select('production_plant_id').single();
    const { data: it } = await adminClient.from('items').insert([{ company_id: cid, item_code: `DS5-${cid}`, name: 'I', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs' }]).select('item_id').single();
    const { data: cu } = await adminClient.from('customers').insert([{ company_id: cid, name: 'K', customer_type: 'company' }]).select('customer_id').single();
    const { data: po } = await adminClient.from('customer_purchase_orders').insert([{ company_id: cid, customer_id: cu!.customer_id, po_number: `PO-DS5-${cid}`, po_date: '2026-08-29', payment_terms: 'full', status: 'new' }]).select('customer_purchase_order_id').single();
    return { cid, plantId: pl!.production_plant_id, itemId: it!.item_id, customerId: cu!.customer_id, cpoId: po!.customer_purchase_order_id };
  }

  // Sales Order dibuat dengan nilai TEPAT supaya pengujian uangnya bermakna.
  let nomorUrut = 0;
  async function buatSo(cid: number, plantId: number, customerId: number, itemId: number, qty: number, harga: number) {
    nomorUrut += 1;
    const { data: po } = await adminClient.from('customer_purchase_orders')
      .insert([{ company_id: cid, customer_id: customerId, po_number: `PO-DS5-${cid}-${nomorUrut}`, po_date: '2026-08-29', payment_terms: 'full', status: 'new' }])
      .select('customer_purchase_order_id').single();
    const { data: so, error } = await adminClient.from('sales_orders')
      .insert([{ company_id: cid, customer_purchase_order_id: po!.customer_purchase_order_id, customer_id: customerId, production_plant_id: plantId, status: 'confirmed', so_number: `${String(nomorUrut).padStart(3, '0')}/8-DS5${cid}/2026` }])
      .select('sales_order_id').single();
    if (error) throw new Error(`insert SO gagal: ${error.message}`);
    await adminClient.from('sales_order_lines').insert([{ sales_order_id: so!.sales_order_id, item_id: itemId, qty_ordered: qty, unit_price: harga }]);
    return so!.sales_order_id;
  }

  async function buatSesi(kunci: string, cid: number, peran: string) {
    const { error: he } = await adminClient.from('users').delete().eq('email', email(kunci));
    if (he) throw new Error(`membersihkan users ${kunci} gagal: ${he.message}`);
    const uid = await ensureAuthUser(adminClient, email(kunci), roleTestPassword!, { full_name: `DecS05 ${kunci}` });
    const { error } = await adminClient.from('users').insert([{ auth_uid: uid, company_id: cid, name: `DecS05 ${kunci}`, email: email(kunci), role: peran, status: 'active' }]);
    if (error) throw new Error(`insert users ${kunci} gagal: ${error.message}`);
    const c = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { error: le } = await c.auth.signInWithPassword({ email: email(kunci), password: roleTestPassword! });
    if (le) throw new Error(`login ${kunci} gagal: ${le.message}`);
    sesi[kunci] = c;
  }

  async function buatTerm(cid: number, nama: string, langkah: { seq: number; label: string; pct?: number; amount?: number; trig: string }[]) {
    const { data: t, error } = await adminClient.from('payment_terms').insert([{ company_id: cid, name: nama, description: nama, active: true }]).select('payment_term_id').single();
    if (error) throw new Error(`insert payment_terms gagal: ${error.message}`);
    await adminClient.from('payment_term_steps').insert(langkah.map((l) => ({
      payment_term_id: t!.payment_term_id, sequence_no: l.seq, label: l.label,
      percentage: l.pct ?? null, fixed_amount: l.amount ?? null, trigger_event: l.trig
    })));
    return t!.payment_term_id;
  }

  const terapkan = (k: string, soId: number, termId: number) =>
    sesi[k].rpc('terapkan_payment_terms', { p_sales_order_id: soId, p_payment_term_id: termId });

  beforeAll(async () => {
    const { data: sisa } = await adminClient.from('companies').select('company_id').like('name', 'DecS05%');
    for (const c of sisa ?? []) if (c.company_id !== 1) await adminClient.rpc('debug_force_delete_company', { p_company_id: c.company_id });

    const a = await buatPerusahaan('DecS05ATestCorp');
    companyA = a.cid; itemA = a.itemId; customerA = a.customerId; plantA = a.plantId; cpoA = a.cpoId;
    const b = await buatPerusahaan('DecS05BTestCorp');
    companyB = b.cid;
    void cpoA;

    termEnamPuluh = await buatTerm(companyA, '60% DP + 40% Sebelum Kirim', [
      { seq: 1, label: 'Uang muka', pct: 60, trig: 'konfirmasi_order' },
      { seq: 2, label: 'Sebelum pengiriman', pct: 40, trig: 'sebelum_kirim' }
    ]);
    termLimaPuluh = await buatTerm(companyA, '50% DP + 50% Sebelum Kirim', [
      { seq: 1, label: 'Uang muka', pct: 50, trig: 'konfirmasi_order' },
      { seq: 2, label: 'Sebelum pengiriman', pct: 50, trig: 'sebelum_kirim' }
    ]);

    sesi.anon = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    await buatSesi('salesA', companyA, 'sales');
    await buatSesi('salesB', companyB, 'sales');
    await buatSesi('gudangA', companyA, 'warehouse_staff');
  }, 300000);

  afterAll(async () => {
    for (const k of Object.keys(sesi)) await sesi[k]?.auth.signOut().catch(() => {});
    for (const cid of [companyA, companyB]) {
      if (!cid) continue;
      await adminClient.from('sales_order_payment_obligations').delete().eq('company_id', cid);
      await adminClient.from('payment_terms').delete().eq('company_id', cid);
      try { await adminClient.rpc('debug_force_delete_company', { p_company_id: cid }); } catch { /* sebisanya */ }
    }
    await adminClient.from('users').delete().in('email', ['salesA', 'salesB', 'gudangA'].map(email));
  }, 300000);

  // ---- (A) INTEGRITAS UANG ----

  it('(1) 60/40 atas Rp100.000.000 menghasilkan Rp60.000.000 + Rp40.000.000', async () => {
    const soId = await buatSo(companyA, plantA, customerA, itemA, 100, 1000000);
    const { data, error } = await terapkan('salesA', soId, termEnamPuluh);
    expect(error).toBeNull();
    expect(data).toBe(2);
    const { data: ob } = await adminClient.from('sales_order_payment_obligations').select('sequence_no, amount, label_snapshot').eq('sales_order_id', soId).order('sequence_no');
    expect(ob).toHaveLength(2);
    expect(Number(ob![0].amount)).toBe(60000000);
    expect(Number(ob![1].amount)).toBe(40000000);
  });

  // INTI §25: nilai yang TIDAK habis dibagi. Tanpa penyerapan sisa, ada uang yang
  // tidak pernah tertagihkan ke siapa pun -- dan tidak ada yang mengeluh.
  it('(2) nilai yang tidak habis dibagi tetap berjumlah PERSIS, tanpa sisa hilang', async () => {
    const soId = await buatSo(companyA, plantA, customerA, itemA, 1, 100000001);
    const { error } = await terapkan('salesA', soId, termEnamPuluh);
    expect(error).toBeNull();
    const { data: ob } = await adminClient.from('sales_order_payment_obligations').select('amount').eq('sales_order_id', soId);
    const jumlah = (ob ?? []).reduce((a, x) => a + Number(x.amount), 0);
    expect(jumlah).toBe(100000001);
  });

  it('(3) tiga tahap 33,33% pun berjumlah PERSIS — tahap terakhir menyerap sisanya', async () => {
    const term = await buatTerm(companyA, 'Tiga tahap tidak bulat', [
      { seq: 1, label: 'Tahap 1', pct: 33.33, trig: 'konfirmasi_order' },
      { seq: 2, label: 'Tahap 2', pct: 33.33, trig: 'sebelum_produksi' },
      { seq: 3, label: 'Tahap 3', pct: 33.34, trig: 'sebelum_kirim' }
    ]);
    const soId = await buatSo(companyA, plantA, customerA, itemA, 1, 100000007);
    const { error } = await terapkan('salesA', soId, term);
    expect(error).toBeNull();
    const { data: ob } = await adminClient.from('sales_order_payment_obligations').select('amount').eq('sales_order_id', soId);
    expect(ob).toHaveLength(3);
    const jumlah = (ob ?? []).reduce((a, x) => a + Number(x.amount), 0);
    expect(jumlah).toBe(100000007);
  });

  it('(4) nominal tetap juga didukung, bukan hanya persentase', async () => {
    const term = await buatTerm(companyA, 'DP tetap 5 juta', [
      { seq: 1, label: 'Uang muka tetap', amount: 5000000, trig: 'konfirmasi_order' },
      { seq: 2, label: 'Pelunasan', pct: 100, trig: 'sebelum_kirim' }
    ]);
    const soId = await buatSo(companyA, plantA, customerA, itemA, 1, 20000000);
    const { error } = await terapkan('salesA', soId, term);
    expect(error).toBeNull();
    const { data: ob } = await adminClient.from('sales_order_payment_obligations').select('sequence_no, amount').eq('sales_order_id', soId).order('sequence_no');
    expect(Number(ob![0].amount)).toBe(5000000);
    expect(Number(ob![1].amount)).toBe(15000000);
  });

  // Termin yang disusun keliru harus DITOLAK, bukan menulis angka yang tidak masuk akal.
  // Ini jalur yang bisa dicapai lewat data sungguhan -- berbeda dari penjaga jumlah
  // akhir, yang hanya berbunyi bila penyerapan sisa sendiri rusak (terbukti lewat
  // mutasi: mencabut penyerapan membuat fungsi menolak dengan P0001, bukan menulis
  // angka yang meleset).
  it('(4b) termin yang nominalnya melebihi nilai order DITOLAK, nol baris tertulis', async () => {
    const term = await buatTerm(companyA, 'DP tetap kelewat besar', [
      { seq: 1, label: 'Uang muka tetap', amount: 50000000, trig: 'konfirmasi_order' },
      { seq: 2, label: 'Pelunasan', pct: 100, trig: 'sebelum_kirim' }
    ]);
    const soId = await buatSo(companyA, plantA, customerA, itemA, 1, 10000000);
    const { error } = await terapkan('salesA', soId, term);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('nol atau negatif');
    const { data: ob } = await adminClient.from('sales_order_payment_obligations').select('sales_order_payment_obligation_id').eq('sales_order_id', soId);
    expect(ob, 'penolakan harus utuh -- nol baris boleh tertinggal').toEqual([]);
  });

  // ---- (B) INTEGRITAS SEJARAH ----

  it('(5) mengubah master TIDAK mengubah Sales Order yang sudah menerapkannya', async () => {
    const soLama = await buatSo(companyA, plantA, customerA, itemA, 100, 1000000);
    await terapkan('salesA', soLama, termEnamPuluh);
    // Master diubah jadi 50/50 SETELAH SO lama memakainya.
    await adminClient.from('payment_term_steps').update({ percentage: 50 }).eq('payment_term_id', termEnamPuluh).eq('sequence_no', 1);
    await adminClient.from('payment_term_steps').update({ percentage: 50 }).eq('payment_term_id', termEnamPuluh).eq('sequence_no', 2);

    const { data: ob } = await adminClient.from('sales_order_payment_obligations').select('percentage_snapshot, amount').eq('sales_order_id', soLama).order('sequence_no');
    expect(Number(ob![0].percentage_snapshot)).toBe(60);
    expect(Number(ob![0].amount)).toBe(60000000);

    const soBaru = await buatSo(companyA, plantA, customerA, itemA, 100, 1000000);
    await terapkan('salesA', soBaru, termEnamPuluh);
    const { data: obBaru } = await adminClient.from('sales_order_payment_obligations').select('amount').eq('sales_order_id', soBaru).order('sequence_no');
    expect(Number(obBaru![0].amount)).toBe(50000000);
  });

  it('(6) termin yang dinonaktifkan tidak bisa dipakai transaksi BARU, yang lama tetap sah', async () => {
    const soLama = await buatSo(companyA, plantA, customerA, itemA, 10, 1000000);
    await terapkan('salesA', soLama, termLimaPuluh);
    await adminClient.from('payment_terms').update({ active: false }).eq('payment_term_id', termLimaPuluh);

    const { data: obLama } = await adminClient.from('sales_order_payment_obligations').select('amount').eq('sales_order_id', soLama);
    expect(obLama).toHaveLength(2);

    const soBaru = await buatSo(companyA, plantA, customerA, itemA, 10, 1000000);
    const { error } = await terapkan('salesA', soBaru, termLimaPuluh);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak aktif');
  });

  it('(7) menerapkan dua kali DITOLAK — perubahan termin lewat amandemen, bukan tumpuk', async () => {
    const soId = await buatSo(companyA, plantA, customerA, itemA, 10, 1000000);
    await terapkan('salesA', soId, termEnamPuluh);
    const { error } = await terapkan('salesA', soId, termEnamPuluh);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('sudah punya jadwal pembayaran');
  });

  // ---- (C) BATAS DOMAIN ----

  it('(8) NOL catatan pembayaran atau piutang dibuat — itu milik Finance', async () => {
    const { data: kol } = await adminClient.rpc('debug_list_base_tables');
    const nama = ((kol ?? []) as { table_name: string }[]).map((x) => x.table_name);
    for (const dilarang of ['payments', 'receivables', 'accounts_receivable', 'sales_payment', 'sales_receivable']) {
      expect(nama, `${dilarang} tidak boleh dibuat dari Sales`).not.toContain(dilarang);
    }
  });

  it('(9) tabel kewajiban TIDAK punya kolom pembayaran — status tidak bisa dipalsukan', async () => {
    const { data: ob } = await adminClient.from('sales_order_payment_obligations').select('*').limit(1);
    const kolom = Object.keys((ob ?? [{}])[0] ?? {});
    for (const dilarang of ['paid_amount', 'payment_date', 'paid', 'status']) {
      expect(kolom, `kolom ${dilarang} akan menjadi sumber kebenaran pembayaran kedua`).not.toContain(dilarang);
    }
  });

  // ---- (D) KEAMANAN ----

  it('(10) tanpa login: DITOLAK di tingkat hak eksekusi', async () => {
    const { error } = await sesi.anon.rpc('terapkan_payment_terms', { p_sales_order_id: 1, p_payment_term_id: 1 });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
  });

  it('(11) peran tanpa wewenang komersial DITOLAK', async () => {
    const soId = await buatSo(companyA, plantA, customerA, itemA, 10, 1000000);
    const { error } = await terapkan('gudangA', soId, termEnamPuluh);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak boleh menetapkan termin');
  });

  it('(12) Sales perusahaan LAIN tidak bisa menerapkan termin ke SO perusahaan ini', async () => {
    const soId = await buatSo(companyA, plantA, customerA, itemA, 10, 1000000);
    const { error } = await terapkan('salesB', soId, termEnamPuluh);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak ditemukan di perusahaan Anda');
  });

  it('(13) termin perusahaan lain tidak bisa dipakai', async () => {
    const termB = await buatTerm(companyB, 'Termin milik B', [{ seq: 1, label: 'Lunas', pct: 100, trig: 'konfirmasi_order' }]);
    const soId = await buatSo(companyA, plantA, customerA, itemA, 10, 1000000);
    const { error } = await terapkan('salesA', soId, termB);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('Termin pembayaran tidak ditemukan');
  });

  it('(14) Sales TIDAK bisa mengarang kewajiban langsung ke tabelnya', async () => {
    const soId = await buatSo(companyA, plantA, customerA, itemA, 10, 1000000);
    const { error } = await sesi.salesA.from('sales_order_payment_obligations').insert([{
      company_id: companyA, sales_order_id: soId, sequence_no: 1,
      payment_term_name_snapshot: 'karangan', label_snapshot: 'karangan',
      trigger_event_snapshot: 'konfirmasi_order', amount: 1
    }]);
    expect(error).not.toBeNull();
  });
});
