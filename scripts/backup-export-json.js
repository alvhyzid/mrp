#!/usr/bin/env node
// INF-05 (22 Agu 2026) / S.1 (23 Agu 2026, INF-02 persiapan transfer) — backup
// data nyata lewat ekspor langsung tiap tabel via Supabase JS client (service
// role key), BUKAN pg_dump/Docker (tidak tersedia di environment kerja lokal;
// backup-db.yml di GitHub Actions memakai jalur pg_dump terpisah, tapi itu
// butuh trigger workflow_dispatch yang perlu token — tidak dilakukan dari sini
// sesuai aturan "jangan minta/terima kredensial"). Ekspor ini murni SELECT,
// tidak menulis apa pun ke database.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tidak ada di .env.local');
  process.exit(1);
}
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const tables = fs.readFileSync(path.join(__dirname, '..', 'backup-table-list.txt'), 'utf8')
  .split('\n').map((s) => s.trim()).filter(Boolean);

async function exportAll() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.env.HOME, 'Documents', 'TECHPROJECT', 'mrp-backups-tidak-di-git', `data-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const summary = {};
  for (const table of tables) {
    const rows = [];
    let from = 0;
    const pageSize = 1000;
    for (;;) {
      const { data, error } = await admin.from(table).select('*').range(from, from + pageSize - 1);
      if (error) {
        summary[table] = `ERROR: ${error.message}`;
        break;
      }
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 0));
    summary[table] = rows.length;
    process.stdout.write('.');
  }
  const storage = await exportStorage(outDir);

  fs.writeFileSync(
    path.join(outDir, '_SUMMARY.json'),
    JSON.stringify({ timestamp: stamp, tableRowCounts: summary, storage }, null, 2)
  );
  console.log('\nSelesai:', outDir);
  console.log('Total tabel:', tables.length);
  console.log('Berkas Storage:', storage.berkasTersalin, 'dari', storage.berkasDitemukan);
  return { outDir, summary, storage };
}

// BERKAS STORAGE IKUT DICADANGKAN (INF-16, ditambahkan 24 Agu 2026).
//
// KENAPA BARU SEKARANG, DAN KENAPA TIDAK BISA DITUNDA LAGI: pencadangan bawaan Supabase
// TIDAK mencakup Storage, dan itu berhenti jadi teori pada 24 Agu 2026 — foto profil akun
// admin PT ITM TERTIMPA gambar kosong dan TIDAK BISA DIPULIHKAN, karena tidak ada satu pun
// salinannya di mana pun. Tanda tangan tulisan tangan di akun yang sama selamat hanya
// karena kebetulan: berkas tanda tangan dinamai unik per unggahan, jadi yang lama tidak
// ikut tertimpa. Perbedaan nasib keduanya murni soal pola penamaan berkas.
//
// Ekspor ini menyalin ISI berkasnya, bukan cuma daftar namanya. Daftar nama tidak
// memulihkan apa pun.
//
// DI LUAR JANGKAUAN (aturan II.2):
//   - Menyalin apa yang ADA saat ini. Berkas yang sudah tertimpa sebelum hari ini tidak
//     bisa diambil kembali dari mana pun.
//   - Tidak menyimpan metadata Supabase (pemilik, waktu unggah asli) selain yang tercatat
//     di ringkasan; pemulihan berarti mengunggah ulang, bukan mengembalikan baris apa adanya.
async function exportStorage(outDir) {
  const hasil = { berkasDitemukan: 0, berkasTersalin: 0, gagal: [], perBucket: {} };

  const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
  if (bucketError) {
    hasil.gagal.push(`daftar bucket: ${bucketError.message}`);
    return hasil;
  }

  const storageDir = path.join(outDir, '_storage');
  fs.mkdirSync(storageDir, { recursive: true });

  for (const bucket of buckets || []) {
    const berkas = await listSemuaBerkas(bucket.name, '');
    hasil.perBucket[bucket.name] = berkas.length;
    hasil.berkasDitemukan += berkas.length;

    for (const nama of berkas) {
      const { data, error } = await admin.storage.from(bucket.name).download(nama);
      if (error || !data) {
        hasil.gagal.push(`${bucket.name}/${nama}: ${error ? error.message : 'kosong'}`);
        continue;
      }
      const tujuan = path.join(storageDir, bucket.name, nama);
      fs.mkdirSync(path.dirname(tujuan), { recursive: true });
      fs.writeFileSync(tujuan, Buffer.from(await data.arrayBuffer()));
      hasil.berkasTersalin += 1;
      process.stdout.write('+');
    }
  }

  return hasil;
}

// Menelusuri folder secara rekursif. `list()` hanya menyebut satu tingkat, dan entri yang
// mewakili FOLDER dikenali dari tidak adanya `id` -- bukan dari namanya, karena nama folder
// bisa saja mengandung titik seperti nama berkas.
async function listSemuaBerkas(bucket, prefix) {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return [];

  const keluar = [];
  for (const entri of data) {
    const jalur = prefix ? `${prefix}/${entri.name}` : entri.name;
    if (entri.id) keluar.push(jalur);
    else keluar.push(...(await listSemuaBerkas(bucket, jalur)));
  }
  return keluar;
}

exportAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
