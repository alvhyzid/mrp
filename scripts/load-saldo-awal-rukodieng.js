// Muat Saldo Awal Stok Plant Ruko Dieng (gummy) — dari file stok opname gudang
// lama, format BEDA dari Karanglo: CODE, NAME, STOK, UNIT, ROW BASE, PACKAGING
// (TANPA harga/nilai) — unit_cost harus digabung dari file harga TERPISAH
// (belum ada saat script ini ditulis, 20 Agu 2026).
//
// SENGAJA lewat API RESMI /api/stock-adjustments/opening-balance (pola sama
// persis dengan scripts/load-saldo-awal-karanglo.js) — BUKAN insert SQL
// langsung.
//
// PENTING — script ini SENGAJA MENOLAK MEMUAT apa pun sampai file harga
// tersedia (--price-file=path/ke/harga.csv, format CODE,UNIT_COST). Tanpa
// argumen itu, script jalan dalam mode LAPORAN SAJA (--report, default) —
// parse stok opname, tampilkan klasifikasi & temuan, TIDAK menyentuh database
// sama sekali. Ini supaya "siapkan jalur & klasifikasinya sekarang, muat nanti
// setelah harga datang" (instruksi pemilik produk 20 Agu 2026) benar-benar
// aman dijalankan sekarang tanpa risiko memuat data harga karangan.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });


// INF-14 (23 Agu 2026) -- pengawas tingkat project: skrip ini MENULIS data,
// jadi WAJIB gagal keras bila diarahkan ke project berisi data nyata.
require('./guard-real-project').assertNotRealProject('scripts/load-saldo-awal-rukodieng.js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const BASE_URL = process.env.SEED_BASE_URL || 'http://localhost:3000';

const STOCK_CSV_PATH = process.env.RUKO_DIENG_STOCK_CSV || path.join(require('os').homedir(), 'Downloads', 'STOCK OPNAME.csv');
const priceFileArg = process.argv.find((a) => a.startsWith('--price-file='));
const PRICE_CSV_PATH = priceFileArg ? priceFileArg.split('=')[1] : null;

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()));
    return row;
  });
}

// ============================================================================
// KLASIFIKASI (mengikuti keputusan pemilik produk, 20 Agu 2026):
// - qty NEGATIF -> masalah integritas data gudang lama, JANGAN dimuat sebagai
//   negatif (ledger kita tidak boleh punya stok negatif) -> dimuat sebagai 0,
//   dicatat di laporan sebagai selisih yang perlu diinvestigasi.
// - qty 0 -> tidak ada yang dimuat (create_opening_balance_lot menolak qty<=0
//   lagipula) -- item master TIDAK otomatis dibuat untuk baris qty=0 supaya
//   tidak membanjiri master data dengan ratusan item yang belum tentu relevan
//   (banyak baris qty=0 di file ini kelihatannya sisa/rencana lama).
// - Barang MEREK LAIN klien yang sama (Nilaya/Bastian/Queensi -- kode NIL/
//   BAST/QS/prefix serupa) -> tetap diklasifikasi & dimuat (client-supplied,
//   demi traceability), TIDAK di-skip.
// - "BOTOL ZALA PUTIH KECIL" (KP-BOT-ZALAS-GC30) -> item BARU terpisah, BUKAN
//   dipetakan ke item botol N200 SAS001 (produk beda: Zala isi 30 vs isi 60).
// - "GUMMY PREMIX ORDER 4" (BASE-04) -> type WIP (premix gummy nyata ada
//   stoknya), BUKAN raw_material.
// ============================================================================
const SPECIAL_ITEM_TYPE_OVERRIDES = {
  'BASE-04': 'wip' // GUMMY PREMIX ORDER 4 -- WIP premix, bukan bahan mentah
};

function classifyType(row) {
  if (SPECIAL_ITEM_TYPE_OVERRIDES[row.CODE]) return SPECIAL_ITEM_TYPE_OVERRIDES[row.CODE];
  const rowBase = (row['ROW BASE'] || '').toUpperCase();
  const name = (row.NAME || '').toUpperCase();
  if (name.startsWith('FG-') || /^FG[A-Z]*-\d/.test(row.CODE) || row.CODE.startsWith('FG-')) return 'finished_good';
  if (rowBase === 'SOLID' && (row.UNIT === 'PCS' || row.UNIT === 'BOX' || row.UNIT === 'BOTTLE' || row.UNIT === 'Roll')) return 'packaging';
  if (rowBase === 'POWDER' || rowBase === 'GRANULE' || rowBase === 'LIQUID OIL' || rowBase === 'LIQUID WATER') return 'raw_material';
  return 'raw_material'; // fallback konservatif -- baris tanpa ROW BASE (banyak yg qty=0)
}

function normalizeUom(unit) {
  const u = (unit || '').trim().toLowerCase();
  if (u === 'gram') return 'g';
  if (u === 'pcs') return 'pcs';
  if (u === 'box') return 'box';
  if (u === 'bottle') return 'botol';
  if (u === 'liter') return 'liter';
  if (u === 'roll') return 'roll';
  if (u === 'bundle') return 'bundle';
  return u || 'pcs';
}

function analyzeStockCsv() {
  const raw = fs.readFileSync(STOCK_CSV_PATH, 'utf8');
  const rows = parseCsv(raw);

  const negativeRows = rows.filter((r) => Number(r.STOK) < 0);
  const positiveRows = rows.filter((r) => Number(r.STOK) > 0);
  const zeroRows = rows.filter((r) => Number(r.STOK) === 0);

  return { rows, negativeRows, positiveRows, zeroRows };
}

function printReport() {
  const { rows, negativeRows, positiveRows, zeroRows } = analyzeStockCsv();

  console.log(`=== Laporan Klasifikasi Stok Opname Ruko Dieng (${STOCK_CSV_PATH}) ===`);
  console.log(`Total baris: ${rows.length}`);
  console.log(`Baris dengan stok > 0 (akan dimuat sebagai lot): ${positiveRows.length}`);
  console.log(`Baris dengan stok = 0 (TIDAK dimuat, item master TIDAK otomatis dibuat): ${zeroRows.length}`);
  console.log(`Baris dengan stok NEGATIF (dimuat sebagai 0 + dicatat sebagai temuan): ${negativeRows.length}`);

  console.log('\n--- TEMUAN: stok negatif (masalah integritas gudang lama, perlu diinvestigasi) ---');
  for (const r of negativeRows) {
    console.log(`  ${r.CODE.padEnd(14)} ${r.NAME.padEnd(35)} ${r.STOK} ${r.UNIT}`);
  }

  console.log('\n--- Item spesial yang butuh keputusan/perhatian ---');
  const botolZalaKecil = rows.find((r) => r.CODE === 'KP-BOT-ZALAS-GC30');
  if (botolZalaKecil) console.log(`  ${botolZalaKecil.CODE}: "${botolZalaKecil.NAME}" (${botolZalaKecil.STOK} pcs) -> item BARU terpisah dari botol N200 SAS001 (varian Zala isi 30, bukan isi 60).`);
  const gummyPremix4 = rows.find((r) => r.CODE === 'BASE-04');
  if (gummyPremix4) console.log(`  ${gummyPremix4.CODE}: "${gummyPremix4.NAME}" (${gummyPremix4.STOK} g) -> dipetakan sebagai type WIP, bukan raw_material.`);

  const otherBrandRows = positiveRows.filter((r) => /NIL|BAST|QUEENSI|-QS-/i.test(r.CODE) || /NILAYA|BASTIAN|QUEENSI/i.test(r.NAME));
  console.log(`\n--- Barang merek lain klien yang sama (Nilaya/Bastian/Queensi), stok > 0: ${otherBrandRows.length} baris ---`);
  for (const r of otherBrandRows) console.log(`  ${r.CODE.padEnd(24)} ${r.NAME}`);

  console.log('\nSelanjutnya: jalankan ulang dengan --price-file=path/ke/harga.csv (format CODE,UNIT_COST) untuk benar-benar memuat lot saldo awal.');
}

async function loadFromCsv() {
  if (!PRICE_CSV_PATH) {
    console.log('Mode LAPORAN SAJA (tidak ada --price-file) -- tidak ada yang dimuat ke database.\n');
    printReport();
    return;
  }
  if (!fs.existsSync(PRICE_CSV_PATH)) {
    throw new Error(`File harga tidak ditemukan: ${PRICE_CSV_PATH}`);
  }

  const { rows, negativeRows, positiveRows } = analyzeStockCsv();
  const priceRows = parseCsv(fs.readFileSync(PRICE_CSV_PATH, 'utf8'));
  const priceByCode = new Map(priceRows.map((r) => [r.CODE, Number(r.UNIT_COST)]));

  // Baris stok > 0 (positif) DAN negatif (dimuat sbg 0... tapi qty 0 ditolak
  // create_opening_balance_lot, jadi baris negatif TIDAK menghasilkan lot --
  // cuma dicatat di laporan, TIDAK dimuat sebagai 0 secara harfiah karena lot
  // qty=0 tidak ada gunanya dan ditolak validasi).
  const toLoad = positiveRows;
  const missingPrice = toLoad.filter((r) => !priceByCode.has(r.CODE) || !Number.isFinite(priceByCode.get(r.CODE)));
  if (missingPrice.length > 0) {
    throw new Error(`${missingPrice.length} item stok>0 belum punya harga di file harga -- LENGKAPI dulu sebelum memuat (jangan menebak harga). Contoh: ${missingPrice.slice(0, 5).map((r) => r.CODE).join(', ')}`);
  }

  const { data: company } = await admin.from('users').select('company_id').eq('email', 'company.a@debug.mrp').maybeSingle();
  const companyId = company.company_id;
  const { data: plant } = await admin.from('production_plants').select('production_plant_id').eq('company_id', companyId).eq('name', 'Ruko Dieng').maybeSingle();
  if (!plant) throw new Error('Plant Ruko Dieng belum ada.');
  const plantId = plant.production_plant_id;

  async function login(email, password) {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Login gagal: ${JSON.stringify(body)}`);
    return body.access_token;
  }
  const token = await login('company.a@debug.mrp', process.env.DEBUG_COMPANY_A_PASSWORD);

  console.log(`\n=== Memuat ${toLoad.length} lot (harga tersedia untuk semuanya) ===`);
  let loadedCount = 0;
  for (const row of toLoad) {
    const { data: existingItem } = await admin.from('items').select('item_id').eq('company_id', companyId).eq('item_code', row.CODE).maybeSingle();
    let itemId = existingItem?.item_id;
    if (!itemId) {
      const { data: created, error: createError } = await admin
        .from('items')
        .insert([{ company_id: companyId, item_code: row.CODE, name: row.NAME, type: classifyType(row), base_uom: normalizeUom(row.UNIT), purchase_uom: normalizeUom(row.UNIT), uom_conversion_factor: 1, is_active: true }])
        .select('item_id')
        .single();
      if (createError) throw new Error(`Gagal membuat item ${row.CODE}: ${createError.message}`);
      itemId = created.item_id;
      console.log(`Item baru dibuat: ${row.CODE} - ${row.NAME} (${classifyType(row)})`);
    }

    const lotNumber = `SALDO-AWAL-RUKODIENG-${row.CODE}`;
    const { data: existingLot } = await admin.from('lots').select('lot_id').eq('company_id', companyId).eq('lot_number', lotNumber).maybeSingle();
    if (existingLot) {
      console.log(`Lot ${lotNumber} sudah ada, skip (idempotent).`);
      loadedCount += 1;
      continue;
    }

    const unitCost = priceByCode.get(row.CODE);
    const res = await fetch(`${BASE_URL}/api/stock-adjustments/opening-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ item_id: itemId, production_plant_id: plantId, qty: Number(row.STOK), unit_cost: unitCost, lot_number: lotNumber, notes: `Saldo awal stok opname Ruko Dieng — kode gudang lama: ${row.CODE}` })
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Gagal muat lot ${row.CODE}: ${JSON.stringify(body)}`);
    console.log(`Loaded ${row.CODE} (${row.NAME}): qty=${row.STOK} @ unit_cost=${unitCost} -> lot_id=${body.lot_id}`);
    loadedCount += 1;
  }

  console.log(`\n=== SELESAI: ${loadedCount} lot dimuat/terverifikasi. ===`);
  console.log(`\nCATATAN: ${negativeRows.length} item stok negatif di file sumber SENGAJA TIDAK dimuat (lot qty=0 ditolak validasi, dan qty negatif tidak boleh masuk ledger) -- perlu investigasi gudang, lihat laporan di atas.`);
}

loadFromCsv().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
