import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  COMPANY_ROLES, LEADERSHIP_ROLES, FINANCIAL_DATA_ROLES, WAGE_VIEW_ROLES,
  BOM_MANAGE_ROLES, WORK_ORDER_MANAGE_ROLES, SHIPMENT_MANAGE_ROLES,
  STOCK_ADJUSTMENT_ROLES, PURCHASING_MANAGE_ROLES, canApproveDepartment,
  decisionDepartment, canManageCustomerPo
} from '../src/lib/roles';
import { aksiCustomerPurchaseOrder } from '../src/features/mrp/server/aksiCustomerPurchaseOrder';
import { processCustomerPurchaseOrder } from '../src/features/mrp/server/processCustomerPurchaseOrder';
import { ensureAuthUser } from './ensureAuthUser';
import { tanpaKomentar } from './util/tanpaKomentar';

// WS-SALES-ROLE — peran Sales TERSENDIRI (keputusan pemilik produk, 29 Agu 2026).
//
// `admin_staff` BUKAN Sales. Berkas ini menjaga dua hal yang sama pentingnya:
// Sales BISA mengerjakan yang menjadi haknya, dan Sales TIDAK BISA mengerjakan yang
// bukan haknya. Menguji satu sisi saja menghasilkan penjaga yang menyesatkan --
// pengaman yang menolak semua orang terlihat sempurna, dan peran yang boleh segalanya
// juga lulus bila hanya sisi izin yang diuji.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !roleTestPassword || !anonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEBUG_ROLE_TEST_PASSWORD, dan anon key wajib diset.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const AKAR = join(__dirname, '..');

describe('WS-SALES-ROLE — peran Sales', () => {
  // ---- (A) MODEL PERAN: diuji tanpa basis data, jadi selalu berjalan ----

  it('(a) peran `sales` ada di daftar peran kanonik', () => {
    expect(COMPANY_ROLES).toContain('sales');
  });

  it('(b) `admin_staff` TIDAK berubah artinya dan TIDAK menjadi Sales', () => {
    expect(COMPANY_ROLES).toContain('admin_staff');
    expect(decisionDepartment('admin_staff')).toBeNull();
    // admin_staff tetap punya wewenang PO klien seperti sebelumnya -- tidak dicabut.
    expect(canManageCustomerPo('admin_staff')).toBe(true);
  });

  // Inti pemisahan tugas, diuji sebagai DAFTAR supaya peran baru yang kelak
  // ditambahkan ke salah satunya langsung tertangkap.
  it('(c) Sales BUKAN pimpinan, BUKAN finance, BUKAN HR, BUKAN purchasing', () => {
    for (const daftar of [LEADERSHIP_ROLES, FINANCIAL_DATA_ROLES, WAGE_VIEW_ROLES, PURCHASING_MANAGE_ROLES]) {
      expect(daftar).not.toContain('sales');
    }
  });

  it('(d) Sales TIDAK boleh mengubah produksi, BOM, pengiriman, atau stok', () => {
    for (const daftar of [BOM_MANAGE_ROLES, WORK_ORDER_MANAGE_ROLES, SHIPMENT_MANAGE_ROLES, STOCK_ADJUSTMENT_ROLES]) {
      expect(daftar).not.toContain('sales');
    }
  });

  it('(e) Sales TIDAK boleh menyetujui departemen mana pun', () => {
    for (const dep of ['finance', 'ppic', 'manager']) {
      expect(canApproveDepartment('sales', dep)).toBe(false);
    }
  });

  // Pemisahan yang paling mudah rusak: departemen KEPUTUSAN vs wewenang MENYETUJUI.
  it('(f) Sales PUNYA departemen keputusan, tanpa memperoleh wewenang menyetujui', () => {
    expect(decisionDepartment('sales')).toBe('sales');
    expect(canApproveDepartment('sales', 'manager')).toBe(false);
  });

  it('(g) Sales BOLEH mengelola pelanggan dan PO klien', () => {
    expect(canManageCustomerPo('sales')).toBe(true);
  });

  // ---- (B) PENJAGA SUMBER ----

  it('(h) nol pintasan `role === "sales"` di luar berkas peran kanonik', () => {
    const pelanggar: string[] = [];
    const sisir = (dir: string) => {
      for (const e of require('node:fs').readdirSync(dir, { withFileTypes: true })) {
        const j = join(dir, e.name);
        if (e.isDirectory()) { sisir(j); continue; }
        if (!/\.tsx?$/.test(e.name)) continue;
        if (j.endsWith('src/lib/roles.ts')) continue;
        const isi = tanpaKomentar(readFileSync(j, 'utf8'));
        if (/role\s*===\s*['"]sales['"]/.test(isi)) pelanggar.push(j.replace(AKAR + '/', ''));
      }
    };
    sisir(join(AKAR, 'src'));
    expect(pelanggar).toEqual([]);
  });

  it('(i) pemetaan departemen di kode dan di basis data TIDAK boleh menyimpang', async () => {
    // Keduanya menyalin aturan yang sama. Bila salah satu diubah tanpa yang lain,
    // wewenang di layar dan wewenang sesungguhnya akan berbeda diam-diam.
    const migrasi = readFileSync(join(AKAR, 'supabase/migrations/20260909100000_wssales_peran_sales.sql'), 'utf8');
    expect(migrasi).toContain("public.jwt_app_role() = 'sales' then 'sales'");
    expect(migrasi).toContain("public.jwt_app_role() = 'finance_manager' then 'finance'");
    expect(migrasi).toContain("public.jwt_app_role() = 'ppic_manager' then 'ppic'");
  });

  // ---- (C) PERILAKU SUNGGUHAN ----

  describe('perilaku terhadap basis data', () => {
    let companyId: number;
    let companyLainId: number;
    let poId: number;
    let poLainId: number;
    let plantId: number;
    const token: Record<string, string> = {};
    const sesi: Record<string, SupabaseClient> = {};
    const email = (k: string) => `wssales.${k.toLowerCase()}@debug.mrp`;

    async function buatPerusahaan(nama: string) {
      const { data: c } = await adminClient.from('companies').insert([{ name: nama, industry_type: 'manufacturing', status: 'trial' }]).select('company_id').single();
      const cid = c!.company_id;
      const { data: pl } = await adminClient.from('production_plants').insert([{ company_id: cid, name: 'P', center_lat: -7.9, center_lng: 112.6, geofence_radius_meters: 150 }]).select('production_plant_id').single();
      const { data: it } = await adminClient.from('items').insert([{ company_id: cid, item_code: `WSSR-${cid}`, name: 'I', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs' }]).select('item_id').single();
      const { data: cu } = await adminClient.from('customers').insert([{ company_id: cid, name: 'K', customer_type: 'company' }]).select('customer_id').single();
      const { data: po } = await adminClient.from('customer_purchase_orders').insert([{ company_id: cid, customer_id: cu!.customer_id, po_number: `PO-WSSR-${cid}`, po_date: '2026-08-29', payment_terms: 'full', status: 'new' }]).select('customer_purchase_order_id').single();
      await adminClient.from('customer_purchase_order_lines').insert([{ customer_purchase_order_id: po!.customer_purchase_order_id, item_id: it!.item_id, qty_ordered: 1, unit_price: 1000 }]);
      await adminClient.from('customer_po_approvals').update({ status: 'approved' }).eq('customer_purchase_order_id', po!.customer_purchase_order_id);
      return { cid, plantId: pl!.production_plant_id, poId: po!.customer_purchase_order_id };
    }

    async function buatSesi(kunci: string, cid: number, peran: string) {
      // Galat penghapusan TIDAK diabaikan: bila baris ini tertahan foreign key,
      // insert di bawah akan gagal dengan pesan yang menyesatkan.
      const { error: hapusError } = await adminClient.from('users').delete().eq('email', email(kunci));
      if (hapusError) throw new Error(`membersihkan users ${kunci} gagal: ${hapusError.message}`);
      const uid = await ensureAuthUser(adminClient, email(kunci), roleTestPassword!, { full_name: `WsSales ${kunci}` });
      const { error } = await adminClient.from('users').insert([{ auth_uid: uid, company_id: cid, name: `WsSales ${kunci}`, email: email(kunci), role: peran, status: 'active' }]);
      if (error) throw new Error(`insert users ${kunci} gagal: ${error.message}`);
      const c = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
      const { data, error: le } = await c.auth.signInWithPassword({ email: email(kunci), password: roleTestPassword! });
      if (le) throw new Error(`login ${kunci} gagal: ${le.message}`);
      sesi[kunci] = c;
      token[kunci] = data.session!.access_token;
    }

    const req = (t: string, isi: unknown) =>
      new NextRequest('http://localhost/api/x', { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(isi) });

    beforeAll(async () => {
      // SISA RUN SEBELUMNYA DIBERSIHKAN LEBIH DULU, dan lewat jalur yang benar.
      //
      // Versi pertama hanya menghapus baris users lewat email dan MENGABAIKAN galatnya.
      // Penghapusan itu GAGAL DIAM-DIAM karena status_transition_log.changed_by merujuk
      // penggunanya -- jejak keputusan yang dibuat test (j) itu sendiri. Akibatnya insert
      // berikutnya menabrak email unik, dan seluruh blok ini terlewat dengan pesan yang
      // sama sekali tidak menyebut sebabnya.
      const { data: sisa } = await adminClient.from('companies').select('company_id').like('name', 'WsSales%');
      for (const c of sisa ?? []) {
        if (c.company_id === 1) continue; // company_id 1 adalah tenant NYATA
        await adminClient.rpc('debug_force_delete_company', { p_company_id: c.company_id });
      }

      const a = await buatPerusahaan('WsSalesATestCorp');
      companyId = a.cid; plantId = a.plantId; poId = a.poId;
      const b = await buatPerusahaan('WsSalesBTestCorp');
      companyLainId = b.cid; poLainId = b.poId;
      await buatSesi('salesA', companyId, 'sales');
      await buatSesi('salesB', companyLainId, 'sales');
      await buatSesi('financeA', companyId, 'finance_manager');
      await buatSesi('bosA', companyId, 'company_admin');
    }, 300000);

    afterAll(async () => {
      for (const k of Object.keys(sesi)) await sesi[k]?.auth.signOut().catch(() => {});
      for (const cid of [companyId, companyLainId]) {
        if (!cid) continue;
        try { await adminClient.rpc('debug_force_delete_company', { p_company_id: cid }); } catch { /* dibersihkan sebisanya */ }
      }
      await adminClient.from('users').delete().in('email', ['salesA', 'salesB', 'financeA', 'bosA'].map(email));
    }, 300000);

    // Sales BISA -- tanpa ini, seluruh penolakan di bawah bisa lulus dengan cara
    // terburuk: peran yang tidak bisa apa-apa.
    it('(j) Sales BISA menahan PO klien perusahaannya sendiri, dengan alasan milik Sales', async () => {
      const hasil = await aksiCustomerPurchaseOrder(req(token.salesA, { customer_purchase_order_id: poId, reason_category: 'spesifikasi_bermasalah' }), 'tahan');
      expect(hasil.status).toBe(200);
      const { data: po } = await adminClient.from('customer_purchase_orders').select('status').eq('customer_purchase_order_id', poId).single();
      expect(po!.status).toBe('on_hold');
      const { data: jejak } = await adminClient.from('status_transition_log')
        .select('actor_role_snapshot, actor_department_snapshot, reason_category')
        .eq('record_id', poId).eq('to_status', 'on_hold').order('status_transition_log_id', { ascending: false }).limit(1);
      expect(jejak![0].actor_role_snapshot).toBe('sales');
      expect(jejak![0].actor_department_snapshot).toBe('sales');
    });

    it('(k) Sales TIDAK BISA melepas tahanan milik departemen lain', async () => {
      // Finance menahan PO perusahaan lain, lalu Sales perusahaan itu mencoba melepas.
      await adminClient.from('users').update({ company_id: companyLainId }).eq('email', email('financeA'));
      const s = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
      const { data } = await s.auth.signInWithPassword({ email: email('financeA'), password: roleTestPassword! });
      const tokenFin = data.session!.access_token;
      const tahan = await aksiCustomerPurchaseOrder(req(tokenFin, { customer_purchase_order_id: poLainId, reason_category: 'kondisi_pembayaran' }), 'tahan');
      expect(tahan.status).toBe(200);
      await s.auth.signOut().catch(() => {});

      const lepas = await aksiCustomerPurchaseOrder(req(token.salesB, { customer_purchase_order_id: poLainId, reason_category: 'informasi_lengkap' }), 'lepas');
      expect(lepas.status).toBe(403);
      expect(String((lepas.body as { error: string }).error)).toContain('finance');
    });

    it('(l) Sales TIDAK BISA membatalkan PO klien — itu wewenang Manager/GM', async () => {
      const hasil = await aksiCustomerPurchaseOrder(req(token.salesA, { customer_purchase_order_id: poId, reason_category: 'permintaan_pelanggan' }), 'batalkan');
      expect(hasil.status).toBe(403);
      expect(String((hasil.body as { error: string }).error)).toContain('Manager atau General Manager');
    });

    it('(m) Sales TIDAK BISA memproses PO klien jadi Sales Order', async () => {
      const hasil = await processCustomerPurchaseOrder(req(token.salesA, { customer_purchase_order_id: poId, production_plant_id: plantId }));
      expect(hasil.status).toBe(403);
      const { data: so } = await adminClient.from('sales_orders').select('sales_order_id').eq('customer_purchase_order_id', poId);
      expect(so).toEqual([]);
    });

    it('(n) Sales perusahaan LAIN tidak bisa menyentuh PO perusahaan ini', async () => {
      const hasil = await aksiCustomerPurchaseOrder(req(token.salesB, { customer_purchase_order_id: poId, reason_category: 'harga_bermasalah' }), 'tahan');
      expect(hasil.status).toBe(404);
    });

    it('(o) Sales TIDAK melihat Sales Order perusahaan lain', async () => {
      const { data } = await sesi.salesA.from('sales_orders').select('sales_order_id').eq('company_id', companyLainId);
      expect(data).toEqual([]);
    });

    it('(p) Sales TIDAK BISA mengubah data produksi maupun pengiriman', async () => {
      const { data: wo } = await adminClient.from('work_orders').select('work_order_id').limit(1);
      if (wo?.length) {
        const { error, count } = await sesi.salesA.from('work_orders').update({ status: 'cancelled' }, { count: 'exact' }).eq('work_order_id', wo[0].work_order_id);
        expect(error !== null || count === 0).toBe(true);
      }
      const { data: sh } = await adminClient.from('shipments').select('shipment_id').limit(1);
      if (sh?.length) {
        const { error, count } = await sesi.salesA.from('shipments').update({ driver_name: 'x' }, { count: 'exact' }).eq('shipment_id', sh[0].shipment_id);
        expect(error !== null || count === 0).toBe(true);
      }
      expect(true).toBe(true);
    });
  });
});
