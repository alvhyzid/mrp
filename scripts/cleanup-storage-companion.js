#!/usr/bin/env node
// INF-23 (24 Agu 2026) — PENDAMPING PEMBERSIHAN DATA: menghapus BERKAS Storage yang
// menempel pada baris yang sebentar lagi dihapus migrasi.
//
// ================= KENAPA SKRIP TERPISAH, BUKAN BAGIAN DARI MIGRASI =================
//
// Sudah dicoba dan Postgres menolak keras:
//
//     ERROR: 42501: Direct deletion from storage tables is not allowed.
//            Use the Storage API instead.
//
// Jadi migrasi SQL secara mutlak tidak bisa menghapus berkas. Bila pembersihan data
// dijalankan tanpa pendamping ini, barisnya hilang dan berkasnya tertinggal selamanya —
// persis cara 12 berkas yatim lahir di project data nyata sebelum 24 Agu 2026.
//
// ================= KENAPA DIJALANKAN *SEBELUM* MIGRASI, BUKAN SESUDAH =================
//
// Karena jejak menuju sebuah berkas hanya hidup selama barisnya hidup. Begitu baris
// `shipments` terhapus, tidak ada lagi cara mengetahui foto mana miliknya.
//
// Urutan sebaliknya (migrasi dulu, sapu berkas "yang tidak dirujuk siapa pun" belakangan)
// terlihat lebih sederhana dan LEBIH BERBAHAYA: ia menghapus juga berkas yang memang belum
// pernah dirujuk — unggahan yang gagal di tengah jalan, atau berkas yang barisnya sedang
// dibuat detik itu. "Tidak dirujuk" bukan sinonim "tidak dibutuhkan".
//
// Urutan ini bukan teori: 24 Agu 2026, pembersihan Storage yang diletakkan SESUDAH
// penghapusan baris membuat test langsung merah — berkasnya justru selamat lalu jadi yatim.
//
// ================= RISIKO YANG DISADARI =================
//
// Bila skrip ini berhasil menghapus berkas lalu migrasinya gagal, barisnya masih ada
// sementara berkasnya sudah hilang, dan layar menampilkan gambar rusak. Karena itu:
// JALANKAN HANYA SETELAH pencadangan terbukti berisi berkasnya (scripts/backup-export-json.js
// sekarang menyalin isi Storage, bukan cuma daftar namanya).
//
// ================= DI LUAR JANGKAUAN (aturan II.2) =================
//
//   - Hanya menghapus berkas milik ENTITAS TRANSAKSI (pengiriman, konfirmasi penerimaan,
//     dokumen, tanda tangan dokumen). Foto profil, tanda tangan pengguna, dan logo
//     perusahaan SENGAJA tidak disentuh — pembersihan data tidak menghapus orangnya.
//   - Tidak menghapus BARIS apa pun. Itu tugas migrasi.
//   - Tidak menemukan berkas yang barisnya sudah hilang lebih dulu. Yang sudah yatim
//     sebelum skrip ini jalan tetap yatim; itu pekerjaan pembersihan sekali jalan yang
//     terpisah.

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tidak ada di .env.local');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const namaPerusahaan = (argv.find((a) => a.startsWith('--perusahaan=')) || '--perusahaan=PT ITM').split('=').slice(1).join('=');

const PENANDA_PUBLIK = '/storage/v1/object/public/';

function ambilPath(nilai, bucket) {
  if (!nilai) return null;
  const tanpaQuery = String(nilai).split('?')[0];
  const penanda = `${PENANDA_PUBLIK}${bucket}/`;
  const posisi = tanpaQuery.indexOf(penanda);
  if (posisi !== -1) return tanpaQuery.slice(posisi + penanda.length) || null;
  if (tanpaQuery.startsWith('http://') || tanpaQuery.startsWith('https://')) return null;
  return tanpaQuery.replace(/^\/+/, '') || null;
}

async function kumpulkan(companyId) {
  const rencana = {};

  const { data: kirim } = await admin
    .from('shipments')
    .select('shipment_id, shipment_number, dispatch_photo_url')
    .eq('company_id', companyId);

  rencana['shipment-dispatch-photos'] = (kirim || [])
    .map((s) => ({ path: ambilPath(s.dispatch_photo_url, 'shipment-dispatch-photos'), asal: `pengiriman ${s.shipment_number}` }))
    .filter((x) => x.path);

  const shipmentIds = (kirim || []).map((s) => s.shipment_id);

  let terima = [];
  if (shipmentIds.length > 0) {
    const { data } = await admin
      .from('delivery_confirmations')
      .select('shipment_id, photo_url')
      .in('shipment_id', shipmentIds);
    terima = data || [];
  }
  rencana['delivery-confirmation-photos'] = terima
    .map((t) => ({ path: ambilPath(t.photo_url, 'delivery-confirmation-photos'), asal: `konfirmasi pengiriman #${t.shipment_id}` }))
    .filter((x) => x.path);

  // Tanda tangan DOKUMEN: yang dihapus hanya salinan snapshot milik dokumen transaksi yang
  // ikut dibersihkan. Tanda tangan MILIK PENGGUNA (users.signature_url) tidak pernah ikut —
  // itu identitas orang, bukan data transaksi. Snapshot yang kebetulan menunjuk berkas yang
  // sama dengan tanda tangan pengguna aktif SENGAJA dilewati.
  const { data: ttdAktif } = await admin.from('users').select('signature_url').eq('company_id', companyId);
  const pathTtdAktif = new Set((ttdAktif || []).map((u) => ambilPath(u.signature_url, 'user-signatures')).filter(Boolean));

  const { data: ttdDokumen } = await admin
    .from('document_signatures')
    .select('document_type, document_id, signature_url_snapshot')
    .eq('company_id', companyId);

  rencana['user-signatures'] = (ttdDokumen || [])
    .map((d) => ({ path: ambilPath(d.signature_url_snapshot, 'user-signatures'), asal: `tanda tangan ${d.document_type} #${d.document_id}` }))
    .filter((x) => x.path && !pathTtdAktif.has(x.path));

  const { data: dokumen } = await admin.from('documents').select('storage_path, title').eq('company_id', companyId);
  rencana['documents'] = (dokumen || [])
    .map((d) => ({ path: d.storage_path, asal: `dokumen "${d.title}"` }))
    .filter((x) => x.path);

  return rencana;
}

async function main() {
  const ref = (supabaseUrl.match(/^https:\/\/([a-z0-9]+)\./) || [])[1] || '(tidak dikenali)';

  // Dicocokkan lewat NAMA, bukan id literal, supaya skrip ini sama benarnya di project mana pun.
  // Nama TIDAK dijamin unik, jadi hasilnya diperiksa: NOL berarti salah project atau salah nama;
  // LEBIH DARI SATU berarti ada kembar dan skrip ini TIDAK BOLEH menebak yang mana -- salah tebak
  // berarti menghapus berkas milik perusahaan lain. Percobaan pertama memakai `.maybeSingle()` dan
  // pesan gagalnya keluar sebagai jargon Postgres ("JSON object requested, multiple (or no) rows
  // returned") yang tidak memberi tahu apa pun tentang apa yang harus dilakukan.
  const { data: kandidat, error: errPerusahaan } = await admin
    .from('companies')
    .select('company_id, name')
    .eq('name', namaPerusahaan);

  if (errPerusahaan) {
    console.error('Gagal membaca companies:', errPerusahaan.message);
    process.exit(1);
  }
  if (!kandidat || kandidat.length === 0) {
    console.error(`Perusahaan "${namaPerusahaan}" tidak ditemukan di project ${ref}.`);
    console.error('Tidak melakukan apa pun. Periksa nama perusahaan dan project yang sedang dituju.');
    process.exit(1);
  }
  if (kandidat.length > 1) {
    console.error(`Ada ${kandidat.length} perusahaan bernama "${namaPerusahaan}" di project ${ref}:`);
    for (const k of kandidat) console.error(`    company_id=${k.company_id}`);
    console.error('Skrip ini TIDAK menebak yang mana -- salah tebak berarti menghapus berkas milik');
    console.error('perusahaan lain. Bereskan kembarannya dulu, atau pakai --perusahaan= dengan nama');
    console.error('yang benar-benar membedakan keduanya.');
    process.exit(1);
  }
  const perusahaan = kandidat[0];

  console.log(`Project     : ${ref}`);
  console.log(`Perusahaan  : ${perusahaan.name} (company_id=${perusahaan.company_id})`);
  console.log(`Mode        : ${APPLY ? 'HAPUS SUNGGUHAN (--apply)' : 'HANYA MELIHAT (tambahkan --apply untuk menghapus)'}`);
  console.log('');

  const rencana = await kumpulkan(perusahaan.company_id);
  let total = 0;

  for (const [bucket, daftar] of Object.entries(rencana)) {
    console.log(`${bucket}: ${daftar.length} berkas`);
    for (const b of daftar) console.log(`    ${b.path}   <- ${b.asal}`);
    total += daftar.length;
  }

  console.log(`\nTotal: ${total} berkas`);

  if (!APPLY) {
    console.log('\nTidak ada yang dihapus. Jalankan ulang dengan --apply setelah daftar di atas diperiksa,');
    console.log('dan SETELAH pencadangan terbukti berisi berkas-berkas itu.');
    return;
  }

  if (total === 0) {
    console.log('\nTidak ada berkas untuk dihapus.');
    return;
  }

  let terhapus = 0;
  const gagal = [];
  for (const [bucket, daftar] of Object.entries(rencana)) {
    if (daftar.length === 0) continue;
    const path = daftar.map((b) => b.path);
    const { data, error } = await admin.storage.from(bucket).remove(path);
    if (error) {
      gagal.push(`${bucket}: ${error.message}`);
      continue;
    }
    terhapus += (data || []).length;
  }

  // "Terhapus 1 dari 2" gampang terbaca sebagai KEGAGALAN, padahal biasanya berarti berkasnya
  // memang sudah tidak ada (mis. skrip ini dijalankan dua kali). Storage API hanya mengembalikan
  // berkas yang BENAR-BENAR dihapusnya, jadi selisihnya dijelaskan terpisah dari kegagalan.
  const sudahTidakAda = total - terhapus - 0;
  console.log(`\nDiminta  : ${total} berkas`);
  console.log(`Terhapus : ${terhapus}`);
  if (sudahTidakAda > 0 && gagal.length === 0) {
    console.log(`Sudah tidak ada sebelumnya: ${sudahTidakAda} (bukan kegagalan -- mis. skrip dijalankan ulang)`);
  }
  if (gagal.length > 0) {
    console.log('GAGAL:');
    for (const g of gagal) console.log(`    ${g}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
