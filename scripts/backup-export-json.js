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
  fs.writeFileSync(path.join(outDir, '_SUMMARY.json'), JSON.stringify({ timestamp: stamp, tableRowCounts: summary }, null, 2));
  console.log('\nSelesai:', outDir);
  console.log('Total tabel:', tables.length);
  return { outDir, summary };
}

exportAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
