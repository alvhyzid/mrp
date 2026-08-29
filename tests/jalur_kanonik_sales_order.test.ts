import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { processCustomerPurchaseOrder } from '../src/features/mrp/server/processCustomerPurchaseOrder';
import { listSalesOrders } from '../src/features/mrp/server/listSalesOrders';
import { ensureAuthUser } from './ensureAuthUser';
import { tanpaKomentar } from './util/tanpaKomentar';

// WS-S03 (SC-04 + SC-01b) — SATU jalur kanonik pembuatan Sales Order.
//
// Sebelum pekerjaan ini ada DUA implementasi lengkap: fungsi basis data yang
// atomik dan menyalin snapshot identitas tetapi tidak pernah dipanggil, dan
// jalur TypeScript yang dipakai route tetapi memakai kompensasi delete manual
// dan tidak menyalin snapshot. Berkas ini menjaga hasil penyatuannya.
//
// BATAS YANG DISEBUT TERANG-TERANGAN, karena menyembunyikannya akan memberi rasa
// aman yang tidak berdasar: kriteria terima menyebut "kegagalan di tahap INSERT
// BARIS tidak meninggalkan Sales Order yatim". Kegagalan itu TIDAK BISA DIPAKSA
// dari permukaan yang bisa dicapai test -- diukur, bukan diduga: sales_order_lines
// dan customer_purchase_order_lines punya kekangan yang IDENTIK (FK item yang sama,
// numeric(14,4) yang sama, nol CHECK di keduanya), jadi baris PO klien yang sah
// SELALU sah sebagai baris Sales Order. Yang diuji di sini adalah keatomikan
// SATUAN KERJANYA lewat kegagalan yang MEMANG bisa dicapai -- tabrakan nomor SO --
// dan buktinya lebih kuat dari sekadar "SO tidak yatim": PO klien pun TIDAK
// berpindah status, padahal perpindahan itu terjadi di langkah TERAKHIR fungsi.
// Bila transaksinya tidak utuh, salah satu dari ketiganya akan tertinggal.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !roleTestPassword || !anonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEBUG_ROLE_TEST_PASSWORD, dan anon key wajib diset.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const AKAR = join(__dirname, '..');

function permintaan(token: string, isi: unknown): NextRequest {
  return new NextRequest('http://localhost/api/customer-purchase-orders/process', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(isi)
  });
}

describe('WS-S03 — jalur kanonik pembuatan Sales Order', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let customerId: number;
  let adminToken: string;
  let stafToken: string;
  let sesiAdmin: SupabaseClient;
  let sesiStaf: SupabaseClient;

  const EMAIL_ADMIN = 'wss03.admin@debug.mrp';
  const EMAIL_STAF = 'wss03.staf@debug.mrp';

  async function buatPoDisetujui(nomor: string, qty = 10): Promise<number> {
    const { data: cpo, error } = await adminClient
      .from('customer_purchase_orders')
      .insert([{
        company_id: companyId, customer_id: customerId, po_number: nomor, po_date: '2026-08-29',
        payment_terms: 'full', status: 'new',
        customer_name_snapshot: 'Klien Beku Saat PO Terbit',
        customer_billing_address_snapshot: 'Jl. Beku 1, Malang',
        customer_npwp_snapshot: '01.234.567.8-999.000'
      }])
      .select('customer_purchase_order_id')
      .single();
    if (error) throw new Error(`insert CPO gagal: ${error.message}`);
    const cpoId = cpo!.customer_purchase_order_id;
    await adminClient.from('customer_purchase_order_lines').insert([{ customer_purchase_order_id: cpoId, item_id: itemId, qty_ordered: qty, unit_price: 5000 }]);
    // Trigger membuat tiga persetujuan berstatus pending; ketiganya disetujui di sini.
    await adminClient.from('customer_po_approvals').update({ status: 'approved' }).eq('customer_purchase_order_id', cpoId);
    return cpoId;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'WsSTigaTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient.from('production_plants')
      .insert([{ company_id: companyId, name: 'Pabrik WS-S03', center_lat: -7.9, center_lng: 112.6, geofence_radius_meters: 150 }])
      .select('production_plant_id').single();
    plantId = plant!.production_plant_id;

    const { data: item } = await adminClient.from('items')
      .insert([{ company_id: companyId, item_code: 'WSS03-FG', name: 'Produk jadi uji', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs' }])
      .select('item_id').single();
    itemId = item!.item_id;

    const { data: customer } = await adminClient.from('customers')
      .insert([{ company_id: companyId, name: 'Klien WS-S03', customer_type: 'company', billing_address: 'Alamat master ASLI', npwp: '01.234.567.8-999.000' }])
      .select('customer_id').single();
    customerId = customer!.customer_id;

    for (const [email, peran, nama] of [[EMAIL_ADMIN, 'company_admin', 'Admin WsSTiga'], [EMAIL_STAF, 'ppic_staff', 'Staf WsSTiga']] as const) {
      await adminClient.from('users').delete().eq('email', email);
      const uid = await ensureAuthUser(adminClient, email, roleTestPassword!, { full_name: nama });
      const { error } = await adminClient.from('users').insert([{ auth_uid: uid, company_id: companyId, name: nama, email, role: peran, status: 'active' }]);
      if (error) throw new Error(`insert users gagal: ${error.message}`);
    }

    sesiAdmin = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    adminToken = (await sesiAdmin.auth.signInWithPassword({ email: EMAIL_ADMIN, password: roleTestPassword! })).data.session!.access_token;
    sesiStaf = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    stafToken = (await sesiStaf.auth.signInWithPassword({ email: EMAIL_STAF, password: roleTestPassword! })).data.session!.access_token;
  }, 180000);

  afterAll(async () => {
    await sesiAdmin?.auth.signOut().catch(() => {});
    await sesiStaf?.auth.signOut().catch(() => {});
    const { data: soRows } = await adminClient.from('sales_orders').select('sales_order_id').eq('company_id', companyId);
    for (const so of soRows ?? []) await adminClient.from('sales_order_lines').delete().eq('sales_order_id', so.sales_order_id);
    await adminClient.from('sales_orders').delete().eq('company_id', companyId);
    const { data: cpoRows } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('company_id', companyId);
    const cpoIds = (cpoRows ?? []).map((r) => r.customer_purchase_order_id);
    if (cpoIds.length) {
      await adminClient.from('customer_po_approvals').delete().in('customer_purchase_order_id', cpoIds);
      await adminClient.from('customer_purchase_order_lines').delete().in('customer_purchase_order_id', cpoIds);
    }
    await adminClient.from('customer_purchase_orders').delete().eq('company_id', companyId);
    await adminClient.from('status_transition_log').delete().eq('company_id', companyId);
    await adminClient.from('users').delete().in('email', [EMAIL_ADMIN, EMAIL_STAF]);
    await adminClient.from('items').delete().eq('company_id', companyId);
    await adminClient.from('customers').delete().eq('company_id', companyId);
    await adminClient.from('production_plants').delete().eq('company_id', companyId);
    await adminClient.from('companies').delete().eq('company_id', companyId);
  }, 180000);

  // ---- (A) BERHASIL: seluruhnya tersimpan, termasuk yang dulu HILANG ----

  it('(a) memproses PO klien menghasilkan Sales Order beserta seluruh barisnya', async () => {
    const cpoId = await buatPoDisetujui('PO-WSS03-A', 10);
    const hasil = await processCustomerPurchaseOrder(permintaan(adminToken, { customer_purchase_order_id: cpoId, production_plant_id: plantId }));
    expect(hasil.status).toBe(200);
    const soId = (hasil.body as { sales_order_id: number }).sales_order_id;
    expect(soId).toBeTruthy();
    const { data: lines } = await adminClient.from('sales_order_lines').select('item_id, qty_ordered').eq('sales_order_id', soId);
    expect(lines).toHaveLength(1);
    expect(Number(lines![0].qty_ordered)).toBe(10);
  });

  // INTI SC-01b: sebelum WS-S03, ketiga kolom ini SELALU null lewat jalur aplikasi.
  it('(b) identitas pelanggan DIBEKUKAN di Sales Order, diwarisi dari PO klien', async () => {
    const { data: so } = await adminClient
      .from('sales_orders')
      .select('customer_name_snapshot, customer_billing_address_snapshot, customer_npwp_snapshot')
      .eq('company_id', companyId).order('sales_order_id').limit(1).single();
    expect(so!.customer_name_snapshot).toBe('Klien Beku Saat PO Terbit');
    expect(so!.customer_billing_address_snapshot).toBe('Jl. Beku 1, Malang');
    expect(so!.customer_npwp_snapshot).toBe('01.234.567.8-999.000');
  });

  it('(c) layar TIDAK lagi menandainya "terbit sebelum kolom snapshot ada"', async () => {
    const req = new NextRequest('http://localhost/api/sales-orders', { method: 'GET', headers: { Authorization: `Bearer ${adminToken}` } });
    const hasil = await listSalesOrders(req);
    const daftar = (hasil.body as { salesOrders: { identity_predates_snapshot: boolean; customer_name: string }[] }).salesOrders;
    expect(daftar.length).toBeGreaterThan(0);
    expect(daftar[0].identity_predates_snapshot).toBe(false);
    expect(daftar[0].customer_name).toBe('Klien Beku Saat PO Terbit');
  });

  it('(d) mengubah master pelanggan SETELAH SO terbit TIDAK mengubah SO itu', async () => {
    await adminClient.from('customers').update({ name: 'Nama Master Yang Sudah Berubah', billing_address: 'Alamat master BARU' }).eq('customer_id', customerId);
    const { data: so } = await adminClient.from('sales_orders')
      .select('customer_name_snapshot, customer_billing_address_snapshot')
      .eq('company_id', companyId).order('sales_order_id').limit(1).single();
    expect(so!.customer_name_snapshot).toBe('Klien Beku Saat PO Terbit');
    expect(so!.customer_billing_address_snapshot).toBe('Jl. Beku 1, Malang');
  });

  // ---- (B) PENGULANGAN ----

  it('(e) memproses PO klien yang sama dua kali TIDAK melahirkan Sales Order kedua', async () => {
    const { data: cpo } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('po_number', 'PO-WSS03-A').single();
    const ulang = await processCustomerPurchaseOrder(permintaan(adminToken, { customer_purchase_order_id: cpo!.customer_purchase_order_id, production_plant_id: plantId }));
    expect(ulang.status).toBe(200);
    const { count } = await adminClient.from('sales_orders').select('sales_order_id', { count: 'exact', head: true }).eq('company_id', companyId);
    expect(count).toBe(1);
  });

  // Test (e) di atas TIDAK cukup, dan itu terbukti lewat mutasi: mencabut pengenalan
  // pengulangan DI DALAM fungsi basis data membuat test (e) TETAP HIJAU -- karena
  // lapisan aplikasi punya pemeriksaan kosmetik yang menjawab lebih dulu dan tidak
  // pernah memanggil fungsinya. Yaitu bentuk penjaga yang tidak menguji apa pun.
  // Test di bawah memanggil fungsi kanonik LANGSUNG, melewati lapisan itu, sehingga
  // yang diuji benar-benar jaminan di basis data.
  it('(e2) fungsi kanonik SENDIRI mengenali pengulangan, tanpa bantuan lapisan aplikasi', async () => {
    const cpoId = await buatPoDisetujui('PO-WSS03-E2', 4);
    const pertama = await sesiAdmin.rpc('process_customer_purchase_order', { p_customer_purchase_order_id: cpoId, p_production_plant_id: plantId });
    expect(pertama.error).toBeNull();
    const kedua = await sesiAdmin.rpc('process_customer_purchase_order', { p_customer_purchase_order_id: cpoId, p_production_plant_id: plantId });
    expect(kedua.error).toBeNull();
    expect(kedua.data).toBe(pertama.data);
    const { data: so } = await adminClient.from('sales_orders').select('sales_order_id').eq('customer_purchase_order_id', cpoId);
    expect(so).toHaveLength(1);
  });

  // ---- (C) KEATOMIKAN ----

  it('(f) kegagalan di tengah TIDAK meninggalkan sisa: nol SO, nol baris, PO tetap new', async () => {
    const cpoId = await buatPoDisetujui('PO-WSS03-F', 7);
    // Injeksi kegagalan: baris penghalang yang MEREBUT nomor SO yang akan dihitung
    // fungsi. Nomor dihitung dari jumlah baris tahun berjalan + 1, dan
    // (company_id, so_number) bersifat unik -- jadi insert Sales Order-nya PASTI
    // gagal, di titik setelah seluruh validasi lolos.
    //
    // PERHATIKAN HITUNGANNYA, di sinilah percobaan pertama meleset: baris penghalang
    // ITU SENDIRI menambah jumlah baris. Jadi bila sekarang ada N baris, setelah
    // penghalang masuk jumlahnya N+1, dan fungsi akan menghitung N+2 -- bukan N+1.
    // Penghalangnya harus membawa nomor N+2, bukan nomor berikutnya yang naif.
    const { data: adaSo } = await adminClient.from('sales_orders').select('so_number').eq('company_id', companyId);
    const urutanYangAkanDihitung = (adaSo?.length ?? 0) + 2;
    const { data: company } = await adminClient.from('companies').select('name').eq('company_id', companyId).single();
    const kode = (company!.name as string).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
    const sekarang = new Date();
    const nomorAsli = `${String(urutanYangAkanDihitung).padStart(3, '0')}/${sekarang.getMonth() + 1}-${kode}/${sekarang.getFullYear()}`;

    const { data: cpoPenghalang } = await adminClient.from('customer_purchase_orders')
      .insert([{ company_id: companyId, customer_id: customerId, po_number: 'PO-WSS03-BLOK', po_date: '2026-08-29', payment_terms: 'full', status: 'new' }])
      .select('customer_purchase_order_id').single();
    const { error: blokError } = await adminClient.from('sales_orders').insert([{
      company_id: companyId, customer_purchase_order_id: cpoPenghalang!.customer_purchase_order_id, customer_id: customerId,
      production_plant_id: plantId, status: 'confirmed', so_number: nomorAsli, idempotency_key: 'blok-wss03'
    }]);
    // Bila penghalangnya sendiri gagal masuk, seluruh test ini tidak menguji apa pun --
    // jadi kegagalan itu harus BERBUNYI, bukan lolos jadi "tidak ada galat".
    expect(blokError).toBeNull();

    const hasil = await processCustomerPurchaseOrder(permintaan(adminToken, { customer_purchase_order_id: cpoId, production_plant_id: plantId }));
    expect(hasil.status).toBeGreaterThanOrEqual(400);

    // Tiga bukti terpisah bahwa NOL bagian dari satuan kerja itu tersimpan.
    const { data: soYatim } = await adminClient.from('sales_orders').select('sales_order_id').eq('customer_purchase_order_id', cpoId);
    expect(soYatim).toEqual([]);
    const { data: cpoSesudah } = await adminClient.from('customer_purchase_orders').select('status, processed_at').eq('customer_purchase_order_id', cpoId).single();
    expect(cpoSesudah!.status).toBe('new');
    expect(cpoSesudah!.processed_at).toBeNull();
  });

  // ---- (D) WEWENANG DITEGAKKAN BASIS DATA ----

  it('(g) peran non-leadership DITOLAK, dan penolakannya datang dari basis data', async () => {
    const cpoId = await buatPoDisetujui('PO-WSS03-G', 3);
    const hasil = await processCustomerPurchaseOrder(permintaan(stafToken, { customer_purchase_order_id: cpoId, production_plant_id: plantId }));
    expect(hasil.status).toBe(403);
    const { data: so } = await adminClient.from('sales_orders').select('sales_order_id').eq('customer_purchase_order_id', cpoId);
    expect(so).toEqual([]);
  });

  it('(h) PO klien tanpa tiga persetujuan DITOLAK', async () => {
    // SENGAJA tidak memakai buatPoDisetujui lalu menurunkan salah satu persetujuan:
    // approved -> pending BUKAN transisi yang sah menurut status_transition_rules,
    // jadi penurunannya tidak pernah berlaku dan PO-nya tetap disetujui penuh --
    // test akan lulus/gagal karena alasan yang sama sekali berbeda dari yang diuji.
    const { data: cpo } = await adminClient.from('customer_purchase_orders')
      .insert([{ company_id: companyId, customer_id: customerId, po_number: 'PO-WSS03-H', po_date: '2026-08-29', payment_terms: 'full', status: 'new' }])
      .select('customer_purchase_order_id').single();
    const cpoId = cpo!.customer_purchase_order_id;
    await adminClient.from('customer_purchase_order_lines').insert([{ customer_purchase_order_id: cpoId, item_id: itemId, qty_ordered: 2, unit_price: 5000 }]);
    await adminClient.from('customer_po_approvals').update({ status: 'approved' }).eq('customer_purchase_order_id', cpoId).in('department', ['finance', 'ppic']);
    const hasil = await processCustomerPurchaseOrder(permintaan(adminToken, { customer_purchase_order_id: cpoId, production_plant_id: plantId }));
    expect(hasil.status).toBe(400);
    expect(String((hasil.body as { error: string }).error)).toContain('belum disetujui');
  });

  // ---- (E) PENJAGA JALUR KETIGA ----

  it('(i) jalur aplikasi MEMANGGIL fungsi kanonik dan tidak menulis sendiri', () => {
    const berkas = tanpaKomentar(readFileSync(join(AKAR, 'src/features/mrp/server/processCustomerPurchaseOrder.ts'), 'utf8'));
    expect(berkas).toContain("rpc('process_customer_purchase_order'");
    expect(berkas).toContain('getUserScopedClient');
    expect(berkas).not.toMatch(/from\('sales_orders'\)[\s\S]{0,120}\.insert\(/);
    expect(berkas).not.toMatch(/from\('sales_orders'\)[\s\S]{0,120}\.delete\(/);
    expect(berkas).not.toMatch(/from\('sales_order_lines'\)[\s\S]{0,120}\.insert\(/);
  });

  // Penjaga KELAS, bukan penjaga satu berkas: apa pun yang menulis sales_orders di
  // luar fungsi kanonik adalah jalur ketiga yang sedang lahir.
  it('(j) NOL berkas src/ lain yang menulis ke sales_orders atau sales_order_lines', () => {
    const pelanggar: string[] = [];
    const sisir = (dir: string) => {
      for (const entri of readdirSync(dir, { withFileTypes: true })) {
        const jalur = join(dir, entri.name);
        if (entri.isDirectory()) { sisir(jalur); continue; }
        if (!/\.tsx?$/.test(entri.name)) continue;
        const isi = tanpaKomentar(readFileSync(jalur, 'utf8'));
        for (const tabel of ['sales_orders', 'sales_order_lines']) {
          const pola = new RegExp(`from\\('${tabel}'\\)[\\s\\S]{0,160}?\\.(insert|update|delete|upsert)\\(`, 'g');
          if (pola.test(isi)) pelanggar.push(`${jalur.replace(AKAR + '/', '')} -> ${tabel}`);
        }
      }
    };
    sisir(join(AKAR, 'src'));
    expect(pelanggar).toEqual([]);
  });
});
