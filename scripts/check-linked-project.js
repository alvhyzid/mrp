// Alat bantu kesadaran untuk JALUR CLI (INF-14, 23 Agu 2026).
// Perintah `npx supabase db query/push/reset --linked` TIDAK melewati kode Node,
// jadi TIDAK BISA dicegat pengawas. Yang bisa dilakukan: membuat "project mana yang
// sedang ter-link" gampang diperiksa SEBELUM tindakan berisiko.
//   npm run check:target
const fs = require('fs');
const path = require('path');
const { KNOWN_REAL_PROJECT_REFS } = require('./guard-real-project');

const refFile = path.join(__dirname, '..', 'supabase', '.temp', 'project-ref');
let ref = null;
try { ref = fs.readFileSync(refFile, 'utf8').trim(); } catch { /* belum pernah link */ }

if (!ref) {
  console.log('Belum ada project ter-link (supabase/.temp/project-ref tidak ada).');
  process.exit(0);
}
const isReal = KNOWN_REAL_PROJECT_REFS.includes(ref);
console.log(`\nProject ter-link saat ini : ${ref}`);
console.log(`Status                    : ${isReal ? '>>> DATA NYATA PT ITM <<<' : 'BUKAN data nyata (aman untuk uji)'}`);
if (isReal) {
  console.log('\nPERHATIAN: perintah `supabase db push/reset/query` apa pun akan mengenai DATA SUNGGUHAN.');
  console.log('Pastikan itu memang yang dimaksud sebelum melanjutkan.\n');
  process.exit(2);
}
console.log('');
