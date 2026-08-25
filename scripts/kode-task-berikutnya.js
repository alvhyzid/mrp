#!/usr/bin/env node
// MENCARI KODE TASK KOSONG BERIKUTNYA (E.3, 25 Agu 2026).
//
// KENAPA SKRIP INI ADA:
// Bentrok kode task sudah terjadi EMPAT DARI EMPAT kali kode ditebak. Tiga kali pertama
// `on conflict do nothing` menelan insert-nya diam-diam; keempat kali penjaga mencegah
// penimpaan TAPI task-nya tetap tidak lahir.
//
// Menebak sudah terbukti gagal seluruhnya. Yang membuat jalan benar lebih mudah daripada
// menebak adalah menyediakan jawabannya dalam satu perintah.
//
// PAKAI:  node scripts/kode-task-berikutnya.js SEC
//         node scripts/kode-task-berikutnya.js          (seluruh modul sekaligus)
const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('node:fs');

for (const baris of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = baris.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

(async () => {
  const modul = (process.argv[2] || '').toUpperCase();
  const { data, error } = await admin.from('build_tasks').select('task_code');
  if (error) {
    console.error('Gagal membaca build_tasks:', error.message);
    process.exit(1);
  }

  const perModul = new Map();
  for (const r of data) {
    const m = /^([A-Z]+)-(\d+)$/.exec(r.task_code);
    if (!m) continue;
    if (!perModul.has(m[1])) perModul.set(m[1], new Set());
    perModul.get(m[1]).add(Number(m[2]));
  }

  const cetak = (kode) => {
    const dipakai = perModul.get(kode) ?? new Set();
    let n = 1;
    while (dipakai.has(n)) n++;
    const maks = dipakai.size ? Math.max(...dipakai) : 0;
    console.log(`  ${kode}-${String(n).padStart(2, '0')}   (terpakai ${dipakai.size}, tertinggi ${kode}-${String(maks).padStart(2, '0')})`);
  };

  if (modul) {
    if (!perModul.has(modul)) console.log(`  ${modul}-01   (modul baru, belum ada task)`);
    else cetak(modul);
  } else {
    console.log('  KODE KOSONG BERIKUTNYA PER MODUL:');
    [...perModul.keys()].sort().forEach(cetak);
  }
})();
