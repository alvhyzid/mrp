import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ensureAuthUser } from './ensureAuthUser';

// DEC-S13 — PELEPASAN DARURAT PENGHALANG PO KLIEN.
//
// YANG DIUJI, dan tiap satu punya testnya sendiri:
//   DARURAT != MELEWATI WEWENANG   -- ia wewenang LAIN yang lebih tinggi, bukan pintu belakang
//   BUKAN JALAN PINTAS             -- penghalang milik departemen sendiri WAJIB lewat jalur biasa
//   GAGAL TERTUTUP                 -- tanpa identitas/perusahaan/wewenang -> TOLAK
//   SEJARAH TIDAK DITULIS ULANG    -- baris penahanan ASLI diperiksa ulang sesudahnya
//
// Test terakhir yang paling mudah terlewat: pelepasan darurat yang "berhasil" tetapi membuat
// seolah departemen penahan sendiri yang melepasnya adalah kerusakan, bukan fitur.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !roleTestPassword || !anonKey) {
  throw new Error('Environment untuk test belum lengkap.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('DEC-S13 — pelepasan darurat penghalang PO klien', () => {
  let companyA: number;
  let companyB: number;
  let poFinance: number;   // ditahan departemen finance
  let poManager: number;   // ditahan departemen manager (kepemimpinan)
  let poBebas: number;     // tidak pernah ditahan
  let customerA: number;
  const sesi: Record<string, SupabaseClient> = {};
  const email = (k: string) => `decs13.${k.toLowerCase()}@debug.mrp`;

  async function buatPerusahaan(nama: string) {
    const { data: c, error } = await adminClient.from('companies').insert([{ name: nama, industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    if (error) throw new Error(`fixture company gagal: ${error.message}`);
    const cid = c!.company_id;
    const { data: cu, error: eCu } = await adminClient.from('customers').insert([{ company_id: cid, name: 'K', customer_type: 'company' }]).select('customer_id').single();
    if (eCu) throw new Error(`fixture customer gagal: ${eCu.message}`);
    return { cid, customerId: cu!.customer_id };
  }

  async function buatPo(cid: number, customerId: number, nomor: string) {
    const { data, error } = await adminClient.from('customer_purchase_orders').insert([{
      company_id: cid, customer_id: customerId, po_number: nomor, po_date: '2026-08-30',
      payment_terms: 'full', status: 'new'
    }]).select('customer_purchase_order_id').single();
    if (error) throw new Error(`fixture PO ${nomor} gagal: ${error.message}`);
    return data!.customer_purchase_order_id;
  }

  async function buatSesi(kunci: string, cid: number, peran: string) {
    await adminClient.from('users').delete().eq('email', email(kunci));
    const uid = await ensureAuthUser(adminClient, email(kunci), roleTestPassword!, { full_name: `DecS13 ${kunci}` });
    const { error } = await adminClient.from('users').insert([{ auth_uid: uid, company_id: cid, name: `DecS13 ${kunci}`, email: email(kunci), role: peran, status: 'active' }]);
    if (error) throw new Error(`insert users ${kunci} gagal: ${error.message}`);
    const c = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { error: le } = await c.auth.signInWithPassword({ email: email(kunci), password: roleTestPassword! });
    if (le) throw new Error(`login ${kunci} gagal: ${le.message}`);
    sesi[kunci] = c;
  }

  beforeAll(async () => {
    const { data: sisa } = await adminClient.from('companies').select('company_id').like('name', 'DecS13%');
    for (const c of sisa ?? []) if (c.company_id !== 1) await adminClient.rpc('debug_force_delete_company', { p_company_id: c.company_id });

    const a = await buatPerusahaan('DecS13ATestCorp');
    companyA = a.cid; customerA = a.customerId;
    const b = await buatPerusahaan('DecS13BTestCorp');
    companyB = b.cid;

    sesi.anon = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    await buatSesi('financeA', companyA, 'finance_manager');
    await buatSesi('ppicA', companyA, 'ppic_manager');
    await buatSesi('salesA', companyA, 'sales');
    await buatSesi('gudangA', companyA, 'warehouse_staff');
    await buatSesi('bosA', companyA, 'company_admin');
    await buatSesi('gmA', companyA, 'general_manager');
    await buatSesi('bosB', companyB, 'company_admin');
    // GM perusahaan LAIN: lolos gerbang wewenang, lalu WAJIB tertahan gerbang perusahaan.
    // Memakai peran tanpa wewenang darurat akan menguji gerbang yang salah.
    await buatSesi('gmB', companyB, 'general_manager');

    poFinance = await buatPo(companyA, customerA, `PO-DECS13-F-${companyA}`);
    poManager = await buatPo(companyA, customerA, `PO-DECS13-M-${companyA}`);
    poBebas = await buatPo(companyA, customerA, `PO-DECS13-B-${companyA}`);

    // Penahanan SUNGGUHAN lewat jalur resminya -- bukan update langsung, supaya jejak
    // departemen penahannya benar-benar lahir seperti di produksi.
    const { error: e1 } = await sesi.financeA.rpc('tahan_po_klien', {
      p_customer_purchase_order_id: poFinance, p_reason_category: 'kondisi_pembayaran', p_reason_note: 'Menunggu bukti transfer.'
    });
    if (e1) throw new Error(`fixture penahanan finance gagal: ${e1.message}`);

    const { error: e2 } = await sesi.bosA.rpc('tahan_po_klien', {
      p_customer_purchase_order_id: poManager, p_reason_category: 'risiko_komersial', p_reason_note: null
    });
    if (e2) throw new Error(`fixture penahanan manager gagal: ${e2.message}`);
  }, 300000);

  afterAll(async () => {
    for (const k of Object.keys(sesi)) await sesi[k]?.auth.signOut().catch(() => {});
    for (const cid of [companyA, companyB]) {
      if (!cid) continue;
      // Kegagalan pembersihan TIDAK ditelan diam-diam -- sisa fixture yang tidak dilaporkan
      // adalah cara paling mudah membuat run berikutnya gagal karena sebab yang salah.
      const { error } = await adminClient.rpc('debug_force_delete_company', { p_company_id: cid });
      if (error) console.error(`PEMBERSIHAN GAGAL untuk company ${cid}: ${error.message}`);
    }
    await adminClient.from('users').delete().in('email', ['financeA', 'ppicA', 'salesA', 'gudangA', 'bosA', 'gmA', 'bosB', 'gmB'].map(email));
  }, 300000);

  const darurat = (k: string, poId: number, kategori = 'pemegang_wewenang_tidak_tersedia', catatan: string | null = 'Manajer keuangan sedang cuti dan tidak bisa dihubungi.') =>
    sesi[k].rpc('lepas_darurat_po_klien', { p_customer_purchase_order_id: poId, p_reason_category: kategori, p_reason_note: catatan });

  const jejak = async (poId: number) =>
    (await adminClient
      .from('status_transition_log')
      .select('status_transition_log_id, from_status, to_status, actor_name_snapshot, actor_role_snapshot, actor_department_snapshot, reason_category, reason, authority_basis, overridden_department, changed_at')
      .eq('table_name', 'customer_purchase_orders')
      .eq('record_id', poId)
      .order('status_transition_log_id', { ascending: true })).data ?? [];

  // ---- GAGAL TERTUTUP ----

  it('(1) anonim DITOLAK', async () => {
    const { error } = await sesi.anon.rpc('lepas_darurat_po_klien', {
      p_customer_purchase_order_id: poFinance, p_reason_category: 'pemegang_wewenang_tidak_tersedia', p_reason_note: 'x'
    });
    expect(error).not.toBeNull();
    // Ditolak di LAPISAN IZIN basis data, bukan oleh aturan bisnis.
    expect(error!.code).toBe('42501');
  });

  it('(2) General Manager perusahaan LAIN tidak menemukan PO ini — isolasi tenant', async () => {
    const { error } = await darurat('gmB', poFinance);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak ditemukan di perusahaan Anda');
  });

  it('(3) Sales DITOLAK — tidak punya wewenang darurat', async () => {
    const { error } = await darurat('salesA', poFinance);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak berwenang melakukan pelepasan darurat');
  });

  it('(4) PPIC Manager DITOLAK — punya departemen, tidak punya wewenang darurat', async () => {
    const { error } = await darurat('ppicA', poFinance);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak berwenang melakukan pelepasan darurat');
  });

  it('(5) gudang DITOLAK — tanpa departemen keputusan sama sekali', async () => {
    const { error } = await darurat('gudangA', poFinance);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak berwenang melakukan pelepasan darurat');
  });

  it('(6a) Company Admin DITOLAK — administrator sistem BUKAN wewenang darurat', async () => {
    // Dipersempit 30 Agu 2026: company_admin mengelola pengguna dan setelan; memberinya
    // wewenang melampaui penghalang departemen berarti wewenang teknis diam-diam jadi
    // wewenang komersial.
    const { error } = await darurat('bosA', poFinance);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak berwenang melakukan pelepasan darurat');
  });

  it('(6) departemen penahan sendiri DITOLAK memakai jalur darurat', async () => {
    const { error } = await darurat('financeA', poFinance);
    expect(error).not.toBeNull();
    // Finance memang boleh melepas -- tapi lewat jalur BIASA. Darurat bukan jalan pintas.
    expect(error!.message).toContain('tidak berwenang melakukan pelepasan darurat');
  });

  it('(7) General Manager DITOLAK bila penghalangnya milik departemennya sendiri', async () => {
    const { error } = await darurat('gmA', poManager);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('Pakai pelepasan biasa');
  });

  it('(8) PO yang tidak sedang ditahan DITOLAK', async () => {
    const { error } = await darurat('gmA', poBebas);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak sedang ditahan');
  });

  it('(9) kategori alasan tidak dikenali DITOLAK', async () => {
    const { error } = await darurat('gmA', poFinance, 'kategori_karangan');
    expect(error).not.toBeNull();
    expect(error!.message).toContain('Kategori alasan tidak dikenali');
  });

  it('(10) kategori tanpa catatan DITOLAK — keempat kategori darurat mewajibkan catatan', async () => {
    const { error } = await darurat('gmA', poFinance, 'keputusan_pimpinan', null);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('mewajibkan catatan tambahan');
  });

  // ---- JALUR BERHASIL ----

  it('(11) General Manager BISA melepas penghalang departemen lain', async () => {
    const sebelum = await jejak(poFinance);
    const penahananSebelum = sebelum.find((j) => j.to_status === 'on_hold');
    expect(penahananSebelum, 'prasyarat: penahanan asli harus ada').toBeTruthy();

    const { error } = await darurat('gmA', poFinance);
    expect(error, JSON.stringify(error)).toBeNull();

    const { data: po } = await adminClient.from('customer_purchase_orders').select('status').eq('customer_purchase_order_id', poFinance).single();
    expect(po!.status).toBe('new');
  });

  it('(12) jejaknya memuat pelaku, alasan, DASAR WEWENANG, dan departemen yang dilampaui', async () => {
    const baris = (await jejak(poFinance)).filter((j) => j.from_status === 'on_hold' && j.to_status === 'new');
    expect(baris).toHaveLength(1);
    const j = baris[0];
    expect(j.actor_name_snapshot).toContain('DecS13');
    expect(j.actor_role_snapshot).toBe('general_manager');
    expect(j.actor_department_snapshot).toBe('manager');
    expect(j.reason_category).toBe('pemegang_wewenang_tidak_tersedia');
    expect(j.reason).toContain('cuti');
    expect(j.authority_basis).toContain('DEC-S13');
    // Inilah yang membedakannya dari pelepasan biasa: departemen yang dilampaui DISEBUT.
    expect(j.overridden_department).toBe('finance');
  });

  it('(13) penahanan ASLI tidak ditulis ulang — pelaku, alasan, dan waktunya utuh', async () => {
    const penahanan = (await jejak(poFinance)).filter((j) => j.to_status === 'on_hold');
    expect(penahanan).toHaveLength(1);
    const j = penahanan[0];
    expect(j.actor_role_snapshot).toBe('finance_manager');
    expect(j.actor_department_snapshot).toBe('finance');
    expect(j.reason_category).toBe('kondisi_pembayaran');
    expect(j.reason).toContain('bukti transfer');
    // Dasar wewenang kosong: penahanan biasa BUKAN keputusan darurat.
    expect(j.authority_basis).toBeNull();
    expect(j.overridden_department).toBeNull();
  });

  it('(14) pelepasan darurat TIDAK terlihat seperti pelepasan biasa', async () => {
    const semua = await jejak(poFinance);
    const biasa = semua.filter((j) => j.from_status === 'on_hold' && j.to_status === 'new' && j.authority_basis === null);
    expect(biasa, 'nol baris pelepasan biasa yang menyamar').toHaveLength(0);
  });

  it('(15) pelepasan biasa oleh departemen penahan TETAP BEKERJA — darurat tidak menggantikannya', async () => {
    // Kasus berhasil yang berwenang, berdampingan dengan seluruh kasus ditolak di atas:
    // penjaga yang menolak semua orang tidak boleh menyamar jadi penjaga yang benar.
    const { error: eTahan } = await sesi.financeA.rpc('tahan_po_klien', {
      p_customer_purchase_order_id: poFinance, p_reason_category: 'tunggakan', p_reason_note: null
    });
    expect(eTahan, JSON.stringify(eTahan)).toBeNull();

    const { error } = await sesi.financeA.rpc('lepas_po_klien', {
      p_customer_purchase_order_id: poFinance, p_reason_category: 'tunggakan_selesai', p_reason_note: null
    });
    expect(error, JSON.stringify(error)).toBeNull();

    const { data: po } = await adminClient.from('customer_purchase_orders').select('status').eq('customer_purchase_order_id', poFinance).single();
    expect(po!.status).toBe('new');
  });
});
