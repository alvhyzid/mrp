#!/usr/bin/env node
// INF-11 — MENYIAPKAN ULANG DATA UAT DI PROJECT STAGING.
//
// SATU PERINTAH untuk mengembalikan staging ke keadaan bersih dan siap diuji orang:
//     node scripts/staging-uat-reset.js
//
// ============================================================================================
// PENGAMAN PALING PENTING, DAN ALASANNYA
// ============================================================================================
// Skrip ini MENGHAPUS data. Bila kelak seseorang menjalankannya dengan .env.local yang
// menunjuk project NYATA, ia akan menghapus data PT Indo Taste. Karena itu ref project
// staging DITULIS KERAS di sini dan dibandingkan dengan URL yang dipakai -- bukan sekadar
// "pastikan environment-nya benar", karena kalimat itu bergantung pada orang mengingatnya.
//
// Pengaman ini SENGAJA tidak bisa dilewati lewat flag.
//
// ============================================================================================
// YANG TIDAK BISA DISEEDING, DAN ITU BUKAN KELALAIAN
// ============================================================================================
// Quotation, Sample, Complaint, dan RMA TIDAK PUNYA TABEL di FABRIX hari ini. Keputusan
// bisnisnya sudah ditutup (DEC-S02/S03/S07), implementasinya belum ada. Membuat tabel
// bayangan hanya supaya daftar UAT terlihat penuh akan melahirkan kapabilitas palsu.
const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('node:fs');

const REF_STAGING = 'nclkepwlsgmfbslgsajq';
const BERKAS_ENV = '.env.staging.local';

for (const baris of readFileSync(BERKAS_ENV, 'utf8').split('\n')) {
  const m = baris.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sandi = process.env.DEBUG_ROLE_TEST_PASSWORD || '';

if (!url.includes(REF_STAGING)) {
  console.error(`\nDITOLAK: skrip ini HANYA untuk project staging (${REF_STAGING}).`);
  console.error(`URL yang terbaca: ${url || '(kosong)'}\n`);
  process.exit(1);
}
if (!serviceKey || !sandi) {
  console.error('\nDITOLAK: SUPABASE_SERVICE_ROLE_KEY / DEBUG_ROLE_TEST_PASSWORD belum lengkap.\n');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const NAMA_COMPANY = 'UAT Manufaktur Nusantara';
const PERAN = [
  ['gm', 'general_manager', 'Gita GM'],
  ['admin', 'company_admin', 'Adi Admin Sistem'],
  ['finance', 'finance_manager', 'Fina Finance'],
  ['ppic', 'ppic_manager', 'Panca PPIC'],
  ['sales', 'sales', 'Sari Sales'],
  ['gudang', 'warehouse_staff', 'Gani Gudang']
];
const email = (k) => `${k}@uat.fabrix`;
const wajib = (label, { error }) => { if (error) throw new Error(`${label}: ${error.message}`); };

(async () => {
  console.log(`Project staging: ${url}\n`);

  // -------------------------------------------------------------------------------------
  // 1. BERSIHKAN — sisa fixture test DAN data UAT sebelumnya
  // -------------------------------------------------------------------------------------
  // Bertolak dari BARIS INDUK yang diketahui (company), bukan dari mencari yang yatim:
  // menyapu "yang tidak dirujuk siapa pun" ikut menghapus hal yang belum sempat dirujuk.
  const { data: sisa } = await admin.from('companies').select('company_id, name');
  let dihapus = 0;
  for (const c of sisa ?? []) {
    if (c.company_id === 1) continue; // baris fondasi project uji
    const { error } = await admin.rpc('debug_force_delete_company', { p_company_id: c.company_id });
    if (error) {
      // Kegagalan pembersihan TIDAK ditelan diam-diam.
      console.error(`  GAGAL menghapus company ${c.company_id} (${c.name}): ${error.message}`);
      continue;
    }
    dihapus++;
  }
  console.log(`1. Dibersihkan: ${dihapus} company sisa uji.`);

  // Auth user yatim: ada di auth, tidak punya baris users. Dihapus supaya login staging
  // tidak menyisakan identitas yang tidak dikenali aplikasi.
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const { data: appUsers } = await admin.from('users').select('auth_uid');
  const dikenal = new Set((appUsers ?? []).map((u) => u.auth_uid));
  let yatim = 0;
  for (const au of authList?.users ?? []) {
    if (dikenal.has(au.id)) continue;
    const { error } = await admin.auth.admin.deleteUser(au.id);
    if (error) { console.error(`  GAGAL menghapus auth user ${au.email}: ${error.message}`); continue; }
    yatim++;
  }
  console.log(`   Auth user yatim dihapus: ${yatim}.`);

  // -------------------------------------------------------------------------------------
  // 2. PERUSAHAAN UAT
  // -------------------------------------------------------------------------------------
  const { data: comp, error: eComp } = await admin.from('companies')
    .insert([{ name: NAMA_COMPANY, industry_type: 'manufacturing', status: 'trial' }])
    .select('company_id').single();
  wajib('membuat company UAT', { error: eComp });
  const cid = comp.company_id;
  console.log(`2. Perusahaan UAT dibuat: "${NAMA_COMPANY}" (company_id=${cid}).`);

  const { data: plant, error: ePlant } = await admin.from('production_plants')
    .insert([{ company_id: cid, name: 'Pabrik UAT Karanglo', center_lat: -7.9, center_lng: 112.6, geofence_radius_meters: 200 }])
    .select('production_plant_id').single();
  wajib('membuat pabrik', { error: ePlant });
  const plantId = plant.production_plant_id;

  // -------------------------------------------------------------------------------------
  // 3. PENGGUNA — satu per peran yang dibutuhkan daftar UAT
  // -------------------------------------------------------------------------------------
  for (const [kunci, peran, nama] of PERAN) {
    const { data: dibuat, error: eAuth } = await admin.auth.admin.createUser({
      email: email(kunci), password: sandi, email_confirm: true, user_metadata: { full_name: nama }
    });
    wajib(`membuat auth user ${kunci}`, { error: eAuth });
    const { error: eRow } = await admin.from('users').insert([{
      auth_uid: dibuat.user.id, company_id: cid, name: nama, email: email(kunci), role: peran, status: 'active'
    }]);
    wajib(`membuat baris users ${kunci}`, { error: eRow });
  }
  console.log(`3. Pengguna UAT dibuat: ${PERAN.map(([k, p]) => `${email(k)} (${p})`).join(', ')}.`);

  // -------------------------------------------------------------------------------------
  // 4. MASTER
  // -------------------------------------------------------------------------------------
  const { data: item, error: eItem } = await admin.from('items').insert([{
    company_id: cid, item_code: 'UAT-GUMMY-01', name: 'Gummy Vitamin UAT', type: 'finished_good',
    base_uom: 'pcs', purchase_uom: 'pcs'
  }]).select('item_id').single();
  wajib('membuat item', { error: eItem });

  const { data: bom, error: eBom } = await admin.from('boms').insert([{
    company_id: cid, parent_item_id: item.item_id, version: 1,
    standard_yield_qty: 1000, standard_yield_uom: 'pcs', status: 'active'
  }]).select('bom_id').single();
  wajib('membuat BOM', { error: eBom });

  const pelanggan = [];
  for (const [nama, tipe, arsip] of [
    ['PT Pelanggan Aktif UAT', 'company', null],
    ['PT Pelanggan Nonaktif UAT', 'company', new Date().toISOString()]
  ]) {
    const { data, error } = await admin.from('customers')
      .insert([{ company_id: cid, name: nama, customer_type: tipe, archived_at: arsip }])
      .select('customer_id').single();
    wajib(`membuat pelanggan ${nama}`, { error });
    pelanggan.push(data.customer_id);
  }
  const pelangganAktif = pelanggan[0];

  for (const [label, alamat] of [['Gudang Utama', 'Jl. Uji Coba No. 1, Malang'], ['Cabang Surabaya', 'Jl. Uji Coba No. 2, Surabaya']]) {
    const { error } = await admin.from('customer_delivery_addresses')
      .insert([{ company_id: cid, customer_id: pelangganAktif, label, address: alamat, pic_name: 'Bu Rina', pic_phone: '0800-0000-0000' }]);
    wajib(`membuat alamat ${label}`, { error });
  }
  console.log('4. Master dibuat: 1 item, 1 BOM, 2 pelanggan (aktif & nonaktif), 2 alamat kirim.');

  // -------------------------------------------------------------------------------------
  // 5. PO KLIEN — empat keadaan yang dibutuhkan daftar UAT
  // -------------------------------------------------------------------------------------
  const buatPo = async (nomor, status) => {
    const { data, error } = await admin.from('customer_purchase_orders').insert([{
      company_id: cid, customer_id: pelangganAktif, po_number: nomor, po_date: '2026-08-01',
      requested_ship_date: '2026-09-15', // 'full' | 'tempo' -- kolom ini BUKAN teks bebas; kekangannya hanya mengenal dua nilai.
      // Termin yang sesungguhnya (DP 60% + 40%) hidup di payment_terms/payment_term_steps.
      payment_terms: 'tempo',
      status, pic_name: 'Bu Rina', pic_phone: '0800-0000-0000'
    }]).select('customer_purchase_order_id').single();
    wajib(`membuat PO ${nomor}`, { error });
    const { error: eLine } = await admin.from('customer_purchase_order_lines').insert([{
      customer_purchase_order_id: data.customer_purchase_order_id, item_id: item.item_id,
      qty_ordered: 10000, unit_price: 2500
    }]);
    wajib(`membuat baris PO ${nomor}`, { error: eLine });
    return data.customer_purchase_order_id;
  };

  const poBaru = await buatPo('UAT-PO-001', 'new');
  const poDitahan = await buatPo('UAT-PO-002', 'on_hold');
  await buatPo('UAT-PO-003', 'cancelled');

  // Jejak penahanan oleh FINANCE -- inilah yang membuat butir "pelepasan darurat" bisa diuji:
  // General Manager harus melampaui penghalang milik DEPARTEMEN LAIN.
  const { data: finance } = await admin.from('users').select('user_id').eq('email', email('finance')).single();
  const { error: eJejak } = await admin.from('status_transition_log').insert([{
    company_id: cid, table_name: 'customer_purchase_orders', record_id: poDitahan,
    from_status: 'new', to_status: 'on_hold', changed_by: finance.user_id,
    reason: 'Menunggu bukti transfer uang muka dari pelanggan.',
    reason_category: 'kondisi_pembayaran', actor_name_snapshot: 'Fina Finance',
    actor_role_snapshot: 'finance_manager', actor_department_snapshot: 'finance'
  }]);
  wajib('membuat jejak penahanan', { error: eJejak });
  console.log('5. PO klien dibuat: UAT-PO-001 (baru), UAT-PO-002 (ditahan Finance), UAT-PO-003 (batal).');

  // -------------------------------------------------------------------------------------
  // 6. SALES ORDER — tiga keadaan penutupan
  // -------------------------------------------------------------------------------------
  const buatSo = async (nomorPo, nomorSo, qtyKirim, denganWorkOrder) => {
    const poId = await buatPo(nomorPo, 'processed');
    const { data: so, error } = await admin.from('sales_orders').insert([{
      company_id: cid, customer_purchase_order_id: poId, customer_id: pelangganAktif,
      production_plant_id: plantId, status: 'confirmed', so_number: nomorSo,
      customer_name_snapshot: 'PT Pelanggan Aktif UAT',
      customer_billing_address_snapshot: 'Jl. Uji Coba No. 1, Malang'
    }]).select('sales_order_id').single();
    wajib(`membuat SO ${nomorSo}`, { error });

    const { data: line, error: eLine } = await admin.from('sales_order_lines').insert([{
      sales_order_id: so.sales_order_id, item_id: item.item_id,
      qty_ordered: 10000, unit_price: 2500, qty_shipped: qtyKirim
    }]).select('sales_order_line_id').single();
    wajib(`membuat baris SO ${nomorSo}`, { error: eLine });

    // Lot: sumbernya menentukan apa yang dibaca layar sebagai "Dipenuhi dari".
    const { data: lot, error: eLot } = await admin.from('lots').insert([{
      company_id: cid, production_plant_id: plantId, item_id: item.item_id,
      lot_number: `UAT-LOT-${nomorSo.replace(/\W/g, '')}`, produced_or_received_date: '2026-08-10',
      // Saldo nol karena seluruhnya sudah terkirim; statusnya 'consumed' -- bukan 'active',
      // yang memang bukan nilai yang dikenal kekangan lots_status_check.
      quantity_on_hand: 0, source_type: denganWorkOrder ? 'produced' : 'opening_balance', status: 'consumed'
    }]).select('lot_id').single();
    wajib(`membuat lot ${nomorSo}`, { error: eLot });

    if (denganWorkOrder) {
      const { data: wo, error: eWo } = await admin.from('work_orders').insert([{
        company_id: cid, production_plant_id: plantId, item_id: item.item_id, bom_id: bom.bom_id,
        planned_qty: 10000, status: 'completed', priority: 'normal', sales_order_line_id: line.sales_order_line_id
      }]).select('work_order_id').single();
      wajib(`membuat Work Order ${nomorSo}`, { error: eWo });
      const { error: eOut } = await admin.from('work_order_outputs').insert([{
        // 'main_output' -- kekangan work_order_outputs hanya mengenal main_output,
        // reprocessable_waste, dan disposed_waste (prinsip multi-output CLAUDE.md nomor 5).
        work_order_id: wo.work_order_id, item_id: item.item_id, output_type: 'main_output',
        qty: 10000, lot_id: lot.lot_id
      }]);
      wajib(`membuat keluaran Work Order ${nomorSo}`, { error: eOut });
    }

    if (qtyKirim > 0) {
      const { data: sh, error: eSh } = await admin.from('shipments').insert([{
        company_id: cid, sales_order_id: so.sales_order_id, shipment_date: '2026-08-20',
        status: 'shipped', shipment_number: `UAT-SJ-${nomorSo.replace(/\W/g, '')}`,
        delivery_address: 'Jl. Uji Coba No. 1, Malang', dispatch_photo_url: 'uat/foto-contoh.jpg'
      }]).select('shipment_id').single();
      wajib(`membuat pengiriman ${nomorSo}`, { error: eSh });
      const { error: eShLine } = await admin.from('shipment_lines').insert([{
        shipment_id: sh.shipment_id, sales_order_line_id: line.sales_order_line_id,
        item_id: item.item_id, qty_shipped: qtyKirim, lot_id: lot.lot_id
      }]);
      wajib(`membuat baris pengiriman ${nomorSo}`, { error: eShLine });
    }
    return so.sales_order_id;
  };

  const soProduksi = await buatSo('UAT-PO-101', '101/8-UAT/2026', 10000, true);
  await buatSo('UAT-PO-102', '102/8-UAT/2026', 10000, false);
  await buatSo('UAT-PO-103', '103/8-UAT/2026', 9800, true);
  console.log('6. Sales Order dibuat: 101 (siap ditutup, dari produksi), 102 (siap ditutup, dari stok), 103 (kurang kirim 200).');

  // -------------------------------------------------------------------------------------
  // 7. TERMIN & KEWAJIBAN PEMBAYARAN
  // -------------------------------------------------------------------------------------
  const { data: term, error: eTerm } = await admin.from('payment_terms')
    .insert([{ company_id: cid, name: 'DP 60% lalu 40% sebelum kirim', description: 'Termin contoh untuk UAT', active: true }])
    .select('payment_term_id').single();
  wajib('membuat termin', { error: eTerm });
  const { error: eStep } = await admin.from('payment_term_steps').insert([
    { payment_term_id: term.payment_term_id, sequence_no: 1, label: 'Uang muka', percentage: 60, trigger_event: 'konfirmasi_order', due_offset_days: 0 },
    { payment_term_id: term.payment_term_id, sequence_no: 2, label: 'Sebelum pengiriman', percentage: 40, trigger_event: 'sebelum_kirim', due_offset_days: 0 }
  ]);
  wajib('membuat tahap termin', { error: eStep });

  const nilai = 10000 * 2500;
  const { error: eKew } = await admin.from('sales_order_payment_obligations').insert([
    { company_id: cid, sales_order_id: soProduksi, sequence_no: 1, payment_term_id: term.payment_term_id,
      payment_term_name_snapshot: term.name ?? 'DP 60% lalu 40% sebelum kirim', label_snapshot: 'Uang muka',
      percentage_snapshot: 60, trigger_event_snapshot: 'konfirmasi_order', due_offset_days_snapshot: 0, amount: nilai * 0.6 },
    { company_id: cid, sales_order_id: soProduksi, sequence_no: 2, payment_term_id: term.payment_term_id,
      payment_term_name_snapshot: term.name ?? 'DP 60% lalu 40% sebelum kirim', label_snapshot: 'Sebelum pengiriman',
      percentage_snapshot: 40, trigger_event_snapshot: 'sebelum_kirim', due_offset_days_snapshot: 0, amount: nilai * 0.4 }
  ]);
  wajib('membuat kewajiban pembayaran', { error: eKew });
  console.log('7. Termin & kewajiban pembayaran dipasang pada SO 101 (60% + 40% dari Rp25.000.000).');

  console.log('\nSELESAI. Staging siap untuk UAT.');
  console.log(`Masuk memakai: ${PERAN.map(([k]) => email(k)).join(' / ')}`);
  console.log('Kata sandinya sama dengan DEBUG_ROLE_TEST_PASSWORD di .env.staging.local.');
  console.log('\nYANG TIDAK BISA DISEEDING karena tabelnya memang belum ada:');
  console.log('  Quotation · Sample · Complaint · RMA — keputusan bisnisnya ditutup, implementasinya belum ada.');
})().catch((e) => { console.error('\nGAGAL:', e.message, '\n'); process.exit(1); });
