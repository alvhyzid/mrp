import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { aksiCustomerPurchaseOrder } from '../src/features/mrp/server/aksiCustomerPurchaseOrder';
import { listCustomerPurchaseOrders } from '../src/features/mrp/server/listCustomerPurchaseOrders';
import { ensureAuthUser } from './ensureAuthUser';
import { tanpaKomentar } from './util/tanpaKomentar';

// WS-S04 + WS-S05 — aksi terkendali PO klien BESERTA jejak keputusannya (BD-06, BD-07).
//
// Kedua pekerjaan itu diuji dalam satu berkas karena memang tidak bisa dipisah: kolom
// jejak yang lahir tanpa penulis akan selamanya null, dan kolom `reason` di
// status_transition_log sudah membuktikannya -- ia ada sejak awal dan nol baris pernah
// mengisinya.
//
// YANG TIDAK DICAKUP, disebut supaya tidak dikira lebih luas: berkas ini menguji PO klien.
// Ia TIDAK menguji siklus hidup Sales Order (WS-S01), dan TIDAK menguji alur "Sales
// mengajukan permintaan pembatalan" -- jalur pengajuan itu memang belum dibangun.

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
  return new NextRequest('http://localhost/api/customer-purchase-orders/aksi', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(isi)
  });
}

describe('WS-S04 + WS-S05 — aksi terkendali PO klien & jejak keputusan', () => {
  let companyId: number;
  let customerId: number;
  let itemId: number;
  const token: Record<string, string> = {};
  const sesi: Record<string, SupabaseClient> = {};

  const PERAN: Record<string, string> = {
    finance: 'finance_manager',
    ppic: 'ppic_manager',
    bos: 'general_manager',
    gudang: 'warehouse_staff'
  };
  const email = (k: string) => `wss05.${k}@debug.mrp`;

  async function buatPo(nomor: string): Promise<number> {
    const { data, error } = await adminClient
      .from('customer_purchase_orders')
      .insert([{ company_id: companyId, customer_id: customerId, po_number: nomor, po_date: '2026-08-29', payment_terms: 'full', status: 'new' }])
      .select('customer_purchase_order_id')
      .single();
    if (error) throw new Error(`insert CPO gagal: ${error.message}`);
    await adminClient.from('customer_purchase_order_lines').insert([{ customer_purchase_order_id: data!.customer_purchase_order_id, item_id: itemId, qty_ordered: 5, unit_price: 1000 }]);
    return data!.customer_purchase_order_id;
  }

  async function jejak(poId: number) {
    const { data } = await adminClient
      .from('status_transition_log')
      .select('from_status, to_status, reason, reason_category, actor_name_snapshot, actor_role_snapshot, actor_department_snapshot, changed_by')
      .eq('table_name', 'customer_purchase_orders')
      .eq('record_id', poId)
      .order('status_transition_log_id', { ascending: true });
    return data ?? [];
  }

  beforeAll(async () => {
    const { data: company } = await adminClient.from('companies').insert([{ name: 'WsSLimaTestCorp', industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
    companyId = company!.company_id;
    const { data: item } = await adminClient.from('items').insert([{ company_id: companyId, item_code: 'WSS05-FG', name: 'Produk uji', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs' }]).select('item_id').single();
    itemId = item!.item_id;
    const { data: customer } = await adminClient.from('customers').insert([{ company_id: companyId, name: 'Klien WS-S05', customer_type: 'company' }]).select('customer_id').single();
    customerId = customer!.customer_id;

    for (const [kunci, peran] of Object.entries(PERAN)) {
      await adminClient.from('users').delete().eq('email', email(kunci));
      const uid = await ensureAuthUser(adminClient, email(kunci), roleTestPassword!, { full_name: `Uji ${kunci}` });
      const { error } = await adminClient.from('users').insert([{ auth_uid: uid, company_id: companyId, name: `Uji ${kunci}`, email: email(kunci), role: peran, status: 'active' }]);
      if (error) throw new Error(`insert users ${kunci} gagal: ${error.message}`);
      sesi[kunci] = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
      token[kunci] = (await sesi[kunci].auth.signInWithPassword({ email: email(kunci), password: roleTestPassword! })).data.session!.access_token;
    }
  }, 240000);

  afterAll(async () => {
    for (const k of Object.keys(PERAN)) await sesi[k]?.auth.signOut().catch(() => {});
    const { data: cpoRows } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('company_id', companyId);
    const ids = (cpoRows ?? []).map((r) => r.customer_purchase_order_id);
    if (ids.length) {
      await adminClient.from('customer_po_approvals').delete().in('customer_purchase_order_id', ids);
      await adminClient.from('customer_purchase_order_lines').delete().in('customer_purchase_order_id', ids);
    }
    await adminClient.from('customer_purchase_orders').delete().eq('company_id', companyId);
    await adminClient.from('status_transition_log').delete().eq('company_id', companyId);
    await adminClient.from('users').delete().in('email', Object.keys(PERAN).map(email));
    await adminClient.from('items').delete().eq('company_id', companyId);
    await adminClient.from('customers').delete().eq('company_id', companyId);
    await adminClient.from('companies').delete().eq('company_id', companyId);
  }, 240000);

  // ---- (A) TAHAN, dan jejaknya benar-benar terisi ----

  it('(a) Finance menahan PO — status berpindah DAN jejaknya menyebut siapa, peran, departemen, alasan', async () => {
    const poId = await buatPo('PO-WSS05-A');
    const hasil = await aksiCustomerPurchaseOrder(permintaan(token.finance, { customer_purchase_order_id: poId, reason_category: 'kondisi_pembayaran' }), 'tahan');
    expect(hasil.status).toBe(200);

    const { data: po } = await adminClient.from('customer_purchase_orders').select('status').eq('customer_purchase_order_id', poId).single();
    expect(po!.status).toBe('on_hold');

    const baris = await jejak(poId);
    expect(baris).toHaveLength(1);
    expect(baris[0].from_status).toBe('new');
    expect(baris[0].to_status).toBe('on_hold');
    expect(baris[0].reason_category).toBe('kondisi_pembayaran');
    expect(baris[0].actor_name_snapshot).toBe('Uji finance');
    expect(baris[0].actor_role_snapshot).toBe('finance_manager');
    expect(baris[0].actor_department_snapshot).toBe('finance');
    expect(baris[0].changed_by).toBeTruthy();
  });

  // ---- (B) BD-06: penghalang satu departemen tidak boleh dilepas departemen lain ----

  it('(b) PPIC TIDAK bisa melepas tahanan milik Finance', async () => {
    const { data: po } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('po_number', 'PO-WSS05-A').single();
    const hasil = await aksiCustomerPurchaseOrder(permintaan(token.ppic, { customer_purchase_order_id: po!.customer_purchase_order_id, reason_category: 'penghalang_selesai' }), 'lepas');
    expect(hasil.status).toBe(403);
    expect(String((hasil.body as { error: string }).error)).toContain('finance');
    const { data: sesudah } = await adminClient.from('customer_purchase_orders').select('status').eq('customer_purchase_order_id', po!.customer_purchase_order_id).single();
    expect(sesudah!.status).toBe('on_hold');
  });

  it('(c) Finance BISA melepas tahanannya sendiri, dan pelepasannya ikut tercatat', async () => {
    const { data: po } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('po_number', 'PO-WSS05-A').single();
    const poId = po!.customer_purchase_order_id;
    const hasil = await aksiCustomerPurchaseOrder(permintaan(token.finance, { customer_purchase_order_id: poId, reason_category: 'pembayaran_terverifikasi' }), 'lepas');
    expect(hasil.status).toBe(200);
    const { data: sesudah } = await adminClient.from('customer_purchase_orders').select('status').eq('customer_purchase_order_id', poId).single();
    expect(sesudah!.status).toBe('new');
    const baris = await jejak(poId);
    expect(baris).toHaveLength(2);
    expect(baris[1].to_status).toBe('new');
    expect(baris[1].reason_category).toBe('pembayaran_terverifikasi');
  });

  // ---- (C) KATALOG ALASAN ditegakkan server ----

  it('(d) kategori alasan yang tidak ada di katalog DITOLAK', async () => {
    const poId = await buatPo('PO-WSS05-D');
    const hasil = await aksiCustomerPurchaseOrder(permintaan(token.finance, { customer_purchase_order_id: poId, reason_category: 'alasan_karangan' }), 'tahan');
    expect(hasil.status).toBe(400);
    expect(String((hasil.body as { error: string }).error)).toContain('tidak dikenali');
  });

  it('(e) kategori "lainnya" TANPA catatan ditolak, dan galatnya menempel di kolom catatan', async () => {
    const { data: po } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('po_number', 'PO-WSS05-D').single();
    const hasil = await aksiCustomerPurchaseOrder(permintaan(token.finance, { customer_purchase_order_id: po!.customer_purchase_order_id, reason_category: 'lainnya', reason_note: '   ' }), 'tahan');
    expect(hasil.status).toBe(400);
    expect((hasil.body as { field?: string }).field).toBe('reason_note');
  });

  it('(f) kategori "lainnya" DENGAN catatan diterima, dan catatannya tersimpan', async () => {
    const { data: po } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('po_number', 'PO-WSS05-D').single();
    const poId = po!.customer_purchase_order_id;
    const hasil = await aksiCustomerPurchaseOrder(permintaan(token.finance, { customer_purchase_order_id: poId, reason_category: 'lainnya', reason_note: 'Menunggu konfirmasi dari pemilik' }), 'tahan');
    expect(hasil.status).toBe(200);
    const baris = await jejak(poId);
    expect(baris[0].reason).toBe('Menunggu konfirmasi dari pemilik');
  });

  it('(g) kategori milik departemen lain TIDAK bisa dipakai', async () => {
    const poId = await buatPo('PO-WSS05-G');
    // 'kapasitas_tidak_tersedia' terikat departemen ppic; Finance tidak boleh memakainya.
    const hasil = await aksiCustomerPurchaseOrder(permintaan(token.finance, { customer_purchase_order_id: poId, reason_category: 'kapasitas_tidak_tersedia' }), 'tahan');
    expect(hasil.status).toBe(403);
    expect(String((hasil.body as { error: string }).error)).toContain('ppic');
  });

  // ---- (D) WEWENANG ----

  it('(h) peran tanpa departemen keputusan TIDAK bisa menahan', async () => {
    const poId = await buatPo('PO-WSS05-H');
    const hasil = await aksiCustomerPurchaseOrder(permintaan(token.gudang, { customer_purchase_order_id: poId, reason_category: 'lainnya', reason_note: 'coba' }), 'tahan');
    expect(hasil.status).toBe(403);
  });

  it('(i) hanya Manager/GM yang boleh membatalkan', async () => {
    const poId = await buatPo('PO-WSS05-I');
    const ditolak = await aksiCustomerPurchaseOrder(permintaan(token.finance, { customer_purchase_order_id: poId, reason_category: 'permintaan_pelanggan' }), 'batalkan');
    expect(ditolak.status).toBe(403);
    const diterima = await aksiCustomerPurchaseOrder(permintaan(token.bos, { customer_purchase_order_id: poId, reason_category: 'permintaan_pelanggan' }), 'batalkan');
    expect(diterima.status).toBe(200);
    const { data: po } = await adminClient.from('customer_purchase_orders').select('status').eq('customer_purchase_order_id', poId).single();
    expect(po!.status).toBe('cancelled');
  });

  it('(j) pembatalan bersifat FINAL — PO yang sudah dibatalkan tidak bisa ditahan lagi', async () => {
    const { data: po } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('po_number', 'PO-WSS05-I').single();
    const hasil = await aksiCustomerPurchaseOrder(permintaan(token.finance, { customer_purchase_order_id: po!.customer_purchase_order_id, reason_category: 'kondisi_pembayaran' }), 'tahan');
    expect(hasil.status).toBe(400);
  });

  // ---- (E) INTEGRITAS HISTORIS ----

  it('(k) mengganti nama & peran pengguna SETELAHNYA tidak mengubah jejak lama', async () => {
    const { data: po } = await adminClient.from('customer_purchase_orders').select('customer_purchase_order_id').eq('po_number', 'PO-WSS05-A').single();
    await adminClient.from('users').update({ name: 'Nama Sudah Berganti', role: 'viewer' }).eq('email', email('finance'));
    const baris = await jejak(po!.customer_purchase_order_id);
    expect(baris[0].actor_name_snapshot).toBe('Uji finance');
    expect(baris[0].actor_role_snapshot).toBe('finance_manager');
    // dikembalikan supaya test lain tidak terpengaruh
    await adminClient.from('users').update({ name: 'Uji finance', role: 'finance_manager' }).eq('email', email('finance'));
  });

  it('(l) baris lama tanpa pelaku TIDAK dikarang — ditandai tidak diketahui', async () => {
    const poId = await buatPo('PO-WSS05-L');
    // Meniru baris warisan: perpindahan status lewat jalur yang TIDAK menitipkan konteks.
    await adminClient.from('customer_purchase_orders').update({ status: 'on_hold' }).eq('customer_purchase_order_id', poId);
    const req = new NextRequest('http://localhost/api/customer-purchase-orders', { method: 'GET', headers: { Authorization: `Bearer ${token.bos}` } });
    const hasil = await listCustomerPurchaseOrders(req);
    const daftar = (hasil.body as { purchaseOrders: { customer_purchase_order_id: number; riwayat_keputusan: { kelengkapan: string; pelaku_nama: string | null }[] }[] }).purchaseOrders;
    const target = daftar.find((p) => p.customer_purchase_order_id === poId)!;
    expect(target.riwayat_keputusan).toHaveLength(1);
    expect(target.riwayat_keputusan[0].kelengkapan).toBe('tidak_diketahui');
    expect(target.riwayat_keputusan[0].pelaku_nama).toBeNull();
  });

  // ---- (E2) TANPA LOGIN: DUA lapis, dan keduanya diuji terpisah ----
  //
  // Ditemukan penjaga proyek ini (function_grant_security_audit), BUKAN oleh pembacaan
  // kode, dan bentuknya layak diingat: Postgres memberi EXECUTE ke PUBLIC secara BAWAAN
  // pada setiap fungsi baru, jadi `grant ... to authenticated` MENAMBAH dan tidak
  // membatasi. Keempat fungsi ini sempat bisa dipanggil tanpa login sama sekali.
  //
  // Lebih halus lagi -- dan inilah alasan dua test, bukan satu: gerbang di DALAM
  // fungsinya pun tidak berbunyi untuk pemanggil tanpa klaim JWT, karena
  // `v_po.company_id <> NULL` bernilai NULL dan `if NULL` TIDAK PERNAH dieksekusi.
  // Gerbangnya DILEWATI, bukan menolak. Mencabut grant saja akan menutup gejalanya
  // sambil meninggalkan sebabnya -- dan sebab itu akan menggigit lagi begitu ada
  // fungsi baru yang lupa dicabut grant-nya.

  it('(e2a) tanpa login: ketiga aksi TIDAK BISA dieksekusi sama sekali', async () => {
    const anonClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
    const poId = await buatPo('PO-WSS05-ANON');
    for (const fungsi of ['tahan_po_klien', 'lepas_po_klien', 'batalkan_po_klien']) {
      const { error } = await anonClient.rpc(fungsi, {
        p_customer_purchase_order_id: poId,
        p_reason_category: 'lainnya',
        p_reason_note: 'percobaan tanpa login'
      });
      // MEMERIKSA ALASANNYA, bukan sekadar "ada galat". Diuji lewat mutasi:
      // mengembalikan grant ke PUBLIC membuat versi pertama test ini TETAP HIJAU --
      // karena pemanggilnya tetap ditolak, hanya oleh pemeriksaan di dalam fungsinya,
      // bukan oleh grant. Penjaga yang lulus karena alasan yang salah adalah penjaga
      // yang tidak menjaga apa yang dikiranya dijaga.
      // 42501 = permission denied, yaitu penolakan di tingkat GRANT.
      expect(error, `${fungsi} seharusnya menolak pemanggil tanpa login`).not.toBeNull();
      expect(error!.code, `${fungsi} harus ditolak di tingkat GRANT (42501), bukan hanya oleh pemeriksaan di dalamnya`).toBe('42501');
    }
    const { data: po } = await adminClient.from('customer_purchase_orders').select('status').eq('customer_purchase_order_id', poId).single();
    expect(po!.status).toBe('new');
  });

  it('(e2b) penolong konteks keputusan TIDAK bisa dipanggil dari luar, bahkan oleh yang sudah login', async () => {
    const { error } = await sesi.bos.rpc('pasang_konteks_keputusan', {
      p_entity: 'customer_purchase_orders',
      p_action: 'hold',
      p_reason_category: 'lainnya',
      p_reason_note: 'coba panggil langsung'
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('42501');
  });

  // ---- (F) PENJAGA: NOL sistem audit kedua ----

  it('(m) nol tabel jejak keputusan kedua dibuat untuk Sales', () => {
    const pelanggar: string[] = [];
    const sisir = (dir: string) => {
      for (const entri of readdirSync(dir, { withFileTypes: true })) {
        const jalur = join(dir, entri.name);
        if (entri.isDirectory()) { sisir(jalur); continue; }
        if (!entri.name.endsWith('.sql')) continue;
        const isi = readFileSync(jalur, 'utf8').toLowerCase();
        for (const dilarang of ['sales_decision_log', 'sales_approval_log', 'sales_activity_log', 'sales_audit_log']) {
          if (isi.includes(`create table if not exists ${dilarang}`) || isi.includes(`create table ${dilarang}`)) {
            pelanggar.push(`${entri.name} -> ${dilarang}`);
          }
        }
      }
    };
    sisir(join(AKAR, 'supabase/migrations'));
    expect(pelanggar).toEqual([]);
  });

  it('(n) aksi PO klien seluruhnya lewat fungsi basis data, bukan update dari aplikasi', () => {
    const berkas = tanpaKomentar(readFileSync(join(AKAR, 'src/features/mrp/server/aksiCustomerPurchaseOrder.ts'), 'utf8'));
    expect(berkas).toContain("rpc(FUNGSI[aksi]");
    expect(berkas).toContain('getUserScopedClient');
    // update langsung akan memindahkan status TANPA pelaku dan TANPA alasan --
    // jejaknya terlihat ada, isinya kosong.
    expect(berkas).not.toMatch(/from\('customer_purchase_orders'\)[\s\S]{0,120}\.update\(/);
  });
});
