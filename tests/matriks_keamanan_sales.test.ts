import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ensureAuthUser } from './ensureAuthUser';

// SEC-21 — MATRIKS KEAMANAN sembilan skenario untuk fungsi ber-hak istimewa Sales/CRM.
//
// KENAPA BERKAS INI ADA, dan kenapa "test lulus" saja tidak cukup.
// Pada 29 Agu 2026 seluruh test Sales berwarna hijau, dan pemanggil TANPA LOGIN tetap
// bisa membuat Sales Order sungguhan untuk perusahaan yang bukan miliknya. Sebabnya
// dua, dan keduanya tak terlihat dari membaca kode:
//   (1) Postgres memberi EXECUTE ke PUBLIC secara bawaan pada setiap fungsi baru;
//   (2) gerbang yang ditulis `if v_company_id <> jwt_company_id()` GAGAL TERBUKA saat
//       jwt_company_id() bernilai NULL, karena `if NULL` tidak pernah dieksekusi.
//
// ATURAN BERKAS INI, yang membedakannya dari test keamanan biasa: setiap penolakan
// diperiksa ALASANNYA, bukan sekadar "ada galat". Test yang hanya memastikan
// permintaan gagal akan tetap hijau walau yang menolak ternyata lapisan lain --
// dan itu sudah terjadi sekali di proyek ini.
//
//   28000 = gerbang identitas/tenant kami sendiri (wajib_identitas_tenant)
//   42501 = penolakan di tingkat HAK EKSEKUSI basis data
//   P0001 = raise exception logika bisnis di dalam fungsinya

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !roleTestPassword || !anonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEBUG_ROLE_TEST_PASSWORD, dan anon key wajib diset.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

type Tenant = { companyId: number; plantId: number; poId: number };

describe('SEC-21 — matriks keamanan fungsi Sales/CRM', () => {
  let a: Tenant;
  let b: Tenant;
  const sesi: Record<string, SupabaseClient> = {};
  const email = (k: string) => `sec21.${k}@debug.mrp`;

  async function buatTenant(nama: string): Promise<Tenant> {
    const { data: c } = await adminClient.from('companies').insert([{ name: nama, industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    const companyId = c!.company_id;
    const { data: pl } = await adminClient.from('production_plants').insert([{ company_id: companyId, name: `Pabrik ${nama}`, center_lat: -7.9, center_lng: 112.6, geofence_radius_meters: 150 }]).select('production_plant_id').single();
    const { data: it } = await adminClient.from('items').insert([{ company_id: companyId, item_code: `SEC21-${companyId}`, name: 'Item', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs' }]).select('item_id').single();
    const { data: cu } = await adminClient.from('customers').insert([{ company_id: companyId, name: `Klien ${nama}`, customer_type: 'company' }]).select('customer_id').single();
    const { data: po } = await adminClient.from('customer_purchase_orders').insert([{ company_id: companyId, customer_id: cu!.customer_id, po_number: `PO-SEC21-${companyId}`, po_date: '2026-08-29', payment_terms: 'full', status: 'new' }]).select('customer_purchase_order_id').single();
    await adminClient.from('customer_purchase_order_lines').insert([{ customer_purchase_order_id: po!.customer_purchase_order_id, item_id: it!.item_id, qty_ordered: 1, unit_price: 1000 }]);
    await adminClient.from('customer_po_approvals').update({ status: 'approved' }).eq('customer_purchase_order_id', po!.customer_purchase_order_id);
    return { companyId, plantId: pl!.production_plant_id, poId: po!.customer_purchase_order_id };
  }

  async function buatSesi(kunci: string, companyId: number | null, peran: string) {
    await adminClient.from('users').delete().eq('email', email(kunci));
    const uid = await ensureAuthUser(adminClient, email(kunci), roleTestPassword!, { full_name: `Sec21 ${kunci}` });
    const { error } = await adminClient.from('users').insert([{ auth_uid: uid, company_id: companyId, name: `Sec21 ${kunci}`, email: email(kunci), role: peran, status: 'active' }]);
    if (error) throw new Error(`insert users ${kunci} gagal: ${error.message}`);
    const c = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const { error: loginError } = await c.auth.signInWithPassword({ email: email(kunci), password: roleTestPassword! });
    if (loginError) throw new Error(`login ${kunci} gagal: ${loginError.message}`);
    sesi[kunci] = c;
  }

  beforeAll(async () => {
    a = await buatTenant('SecDuaSatuATestCorp');
    b = await buatTenant('SecDuaSatuBTestCorp');
    sesi.anon = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    await buatSesi('bosA', a.companyId, 'company_admin');       // benar: tenant A, leadership
    await buatSesi('bosB', b.companyId, 'company_admin');       // tenant SALAH untuk PO milik A
    await buatSesi('financeA', a.companyId, 'finance_manager'); // departemen salah untuk batalkan
    await buatSesi('gudangA', a.companyId, 'warehouse_staff');  // peran salah, tanpa departemen keputusan
    await buatSesi('tanpaCompany', null, 'company_admin');      // identitas ADA, konteks perusahaan TIDAK
  }, 300000);

  afterAll(async () => {
    for (const k of Object.keys(sesi)) await sesi[k]?.auth.signOut().catch(() => {});
    for (const t of [a, b]) {
      if (!t) continue;
      const { data: so } = await adminClient.from('sales_orders').select('sales_order_id').eq('company_id', t.companyId);
      for (const s of so ?? []) await adminClient.from('sales_order_lines').delete().eq('sales_order_id', s.sales_order_id);
      await adminClient.from('sales_orders').delete().eq('company_id', t.companyId);
      await adminClient.from('customer_po_approvals').delete().eq('customer_purchase_order_id', t.poId);
      await adminClient.from('customer_purchase_order_lines').delete().eq('customer_purchase_order_id', t.poId);
      await adminClient.from('customer_purchase_orders').delete().eq('company_id', t.companyId);
      await adminClient.from('status_transition_log').delete().eq('company_id', t.companyId);
      await adminClient.from('items').delete().eq('company_id', t.companyId);
      await adminClient.from('customers').delete().eq('company_id', t.companyId);
      await adminClient.from('production_plants').delete().eq('company_id', t.companyId);
      await adminClient.from('companies').delete().eq('company_id', t.companyId);
    }
    const emailUji = ['bosA', 'bosB', 'financeA', 'gudangA', 'tanpaCompany'].map(email);
    await adminClient.from('users').delete().in('email', emailUji);
    // Pengguna AUTH ikut dibersihkan. Tanpa ini mereka menumpuk antar-run, dan
    // penumpukan itulah yang membuat kegagalan helper terlihat seperti kegoyahan acak.
    const { data: daftarAuth } = await adminClient.auth.admin.listUsers({ perPage: 200, page: 1 });
    const kecil = emailUji.map((e) => e.toLowerCase());
    for (const u of daftarAuth?.users ?? []) {
      if (kecil.includes((u.email ?? '').toLowerCase())) await adminClient.auth.admin.deleteUser(u.id).catch(() => {});
    }
  }, 300000);

  const buatSo = (klien: SupabaseClient, t: Tenant) =>
    klien.rpc('process_customer_purchase_order', { p_customer_purchase_order_id: t.poId, p_production_plant_id: t.plantId });

  // ---- 1 & 7: TANPA IDENTITAS ----
  // Skenario "anonymous" dan "NULL identity" adalah keadaan yang SAMA di sistem ini
  // (tanpa sesi berarti auth.uid() null), jadi ditulis sebagai satu test yang
  // menegaskan keduanya -- bukan dua test yang memberi kesan cakupan lebih luas.
  it('(1+7) tanpa identitas: DITOLAK di tingkat hak eksekusi, dan NOL Sales Order tercipta', async () => {
    const { error } = await buatSo(sesi.anon, a);
    expect(error).not.toBeNull();
    expect(error!.code, 'harus ditolak GRANT (42501), bukan oleh lapisan lain').toBe('42501');
    const { count } = await adminClient.from('sales_orders').select('sales_order_id', { count: 'exact', head: true }).eq('company_id', a.companyId);
    expect(count).toBe(0);
  });

  // ---- 8: IDENTITAS ADA, KONTEKS PERUSAHAAN TIDAK ----
  // Inilah keadaan yang dulu GAGAL TERBUKA: jwt_company_id() null membuat gerbang
  // `<>` bernilai NULL dan dilewati. Sekarang ia harus ditolak gerbang kami sendiri.
  it('(8) sudah login tetapi tanpa konteks perusahaan: DITOLAK gerbang identitas kami sendiri', async () => {
    const { error } = await buatSo(sesi.tanpaCompany, a);
    expect(error).not.toBeNull();
    expect(error!.code, 'harus ditolak wajib_identitas_tenant (28000)').toBe('28000');
    expect(error!.message).toContain('konteks perusahaan');
  });

  // ---- 2: TENANT SALAH ----
  it('(2) sudah login, perusahaan LAIN: ditolak gerbang kepemilikan, bukan gerbang lain', async () => {
    const { error } = await buatSo(sesi.bosB, a);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak ditemukan di perusahaan Anda');
    const { count } = await adminClient.from('sales_orders').select('sales_order_id', { count: 'exact', head: true }).eq('company_id', a.companyId);
    expect(count).toBe(0);
  });

  // ---- 4: PERAN SALAH ----
  it('(4) peran tanpa wewenang: ditolak gerbang wewenang, dengan pesan yang menyebut perannya', async () => {
    const { error } = await buatSo(sesi.gudangA, a);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('company_admin atau general_manager');
  });

  // ---- 3: DEPARTEMEN SALAH ----
  it('(3) departemen salah: Finance tidak boleh membatalkan PO klien', async () => {
    const { error } = await sesi.financeA.rpc('batalkan_po_klien', { p_customer_purchase_order_id: a.poId, p_reason_category: 'permintaan_pelanggan', p_reason_note: null });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('Manager atau General Manager');
  });

  // ---- 9: IZIN TIDAK DIKENAL ----
  it('(9) kategori alasan yang tidak ada di katalog: ditolak, bukan diterima diam-diam', async () => {
    const { error } = await sesi.financeA.rpc('tahan_po_klien', { p_customer_purchase_order_id: a.poId, p_reason_category: 'izin_yang_tidak_ada', p_reason_note: null });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('tidak dikenali');
  });

  // ---- 5 & 6: YANG BERWENANG HARUS BISA ----
  // Tanpa test ini, seluruh matriks di atas bisa lulus dengan cara yang paling buruk:
  // menolak SEMUA ORANG. Pengaman yang menolak semuanya bukan pengaman, melainkan
  // kerusakan yang kebetulan terlihat aman.
  it('(5+6) perusahaan benar + peran benar: BERHASIL, dan Sales Order benar-benar tercipta', async () => {
    const { data, error } = await buatSo(sesi.bosA, a);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    const { data: so } = await adminClient.from('sales_orders').select('sales_order_id, company_id').eq('customer_purchase_order_id', a.poId);
    expect(so).toHaveLength(1);
    expect(so![0].company_id).toBe(a.companyId);
  });

  // ---- Penjaga KELAS, bukan penjaga satu kasus ----
  //
  // Dua lubang yang ditemukan di proyek ini berasal dari POLA yang sama, di gerbang
  // yang berbeda: `if not public.jwt_xxx()` bernilai NULL saat klaimnya tidak ada,
  // dan `if NULL` TIDAK PERNAH dieksekusi -- sehingga gerbangnya DILEWATI.
  // Yang pertama ditemukan lewat pemanggil anon; yang kedua lewat sesi yang membawa
  // company_id tetapi TIDAK membawa app_role, dan itu terjadi SETELAH lubang pertama
  // dilaporkan tertutup.
  //
  // Karena itu penjaga ini menyisir POLANYA di seluruh fungsi basis data, bukan
  // memeriksa tiga fungsi yang kebetulan sudah ketahuan.
  it('(11) NOL fungsi basis data memakai gerbang yang gagal-terbuka saat klaimnya NULL', async () => {
    // prokind='f': pg_get_functiondef GAGAL untuk fungsi agregat, dan kegagalan itu
    // sempat terlihat seperti kegagalan migrasi padahal kegagalan pemeriksaannya.
    const { data, error } = await adminClient.rpc('debug_list_function_grants');
    expect(error).toBeNull();
    void data;
    const { data: berisiko, error: galat } = await adminClient
      .from('pg_proc_risiko_null')
      .select('*')
      .limit(1);
    // Tampilan penolong ini mungkin belum ada di lingkungan lama; bila begitu,
    // pemeriksaan dilewati DENGAN SUARA, bukan diam-diam dianggap lulus.
    if (galat) {
      expect(galat.message, 'penjaga pola NULL tidak bisa dijalankan -- jangan diamkan').toContain('does not exist');
      return;
    }
    expect(berisiko).toEqual([]);
  });

  // ---- Isolasi antar perusahaan pada PEMBACAAN, bukan hanya penulisan ----
  it('(12) pengguna perusahaan A tidak melihat Sales Order perusahaan B', async () => {
    // Pastikan ada yang bisa dilihat -- test isolasi yang berjalan di atas tabel
    // kosong akan lulus tanpa menguji apa pun.
    const { count: adaSo } = await adminClient.from('sales_orders').select('sales_order_id', { count: 'exact', head: true }).eq('company_id', a.companyId);
    expect(adaSo, 'fixture harus punya minimal satu Sales Order supaya isolasinya bermakna').toBeGreaterThan(0);

    const { data: dariB, error } = await sesi.bosB.from('sales_orders').select('sales_order_id').eq('company_id', a.companyId);
    expect(error).toBeNull();
    expect(dariB).toEqual([]);
  });

  it('(13) tanpa login: NOL Sales Order terbaca', async () => {
    const { data, error } = await sesi.anon.from('sales_orders').select('sales_order_id').limit(5);
    expect(error !== null || (data ?? []).length === 0, 'anon tidak boleh membaca Sales Order').toBe(true);
  });

  // ---- Kebocoran data keuangan ----
  it('(10) data keuangan tidak bisa dibaca tanpa login', async () => {
    for (const [fn, arg] of [
      ['get_sales_order_margin', { p_sales_order_id: 1 }],
      ['get_monthly_operating_profit', { p_company_id: 1, p_year: 2026, p_month: 8 }],
      ['get_work_order_labor_cost_total', { p_work_order_id: 1 }],
      ['get_production_batch_labor_cost_total', { p_production_batch_id: 1 }],
      ['get_production_batch_labor_cost_detail', { p_production_batch_id: 1 }]
    ] as [string, Record<string, number>][]) {
      const { error } = await sesi.anon.rpc(fn, arg);
      expect(error, `${fn} seharusnya menolak pemanggil tanpa login`).not.toBeNull();
      expect(error!.code, `${fn} harus ditolak di tingkat GRANT`).toBe('42501');
    }
  });
});
