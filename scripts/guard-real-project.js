// PENGAWAS TINGKAT PROJECT untuk SKRIP (INF-14, 23 Agu 2026).
//
// Latar: pengawas yang dipasang lebih dulu (tests/setup/guardAgainstRealProject.ts)
// HANYA menjaga test suite. 13 skrip di scripts/ membaca .env.local LANGSUNG lewat
// dotenv + supabase-js, tidak melewati pengawas apa pun -- menjalankan salah satunya
// terhadap project berisi data nyata akan langsung menulis/menghapus tanpa penghalang.
// Beberapa di antaranya (cleanup-demo-data.js, seed-*) namanya sendiri menyiratkan
// tindakan yang merusak bila salah sasaran.
//
// Berkas ini adalah SATU-SATUNYA SUMBER KEBENARAN daftar project data nyata --
// tests/setup/guardAgainstRealProject.ts membacanya dari sini juga, supaya tidak
// ada dua daftar yang bisa berbeda diam-diam (kelas bug yang sudah berulang di
// proyek ini: satu tempat diperbarui, tempat lain terlewat).
//
// KETERBATASAN JUJUR -- yang TIDAK bisa dijaga berkas ini:
// perintah CLI langsung (`npx supabase db query --linked`, `db push`, `db reset`)
// TIDAK melewati kode Node mana pun, jadi tidak bisa dicegat dari sini. Untuk itu
// tersedia `npm run check:target` (scripts/check-linked-project.js) yang MELAPORKAN
// project mana yang sedang ter-link sebelum tindakan berisiko -- itu alat bantu
// kesadaran, BUKAN penghalang. Penutupan sungguhan untuk jalur CLI hanya mungkin
// bila project data nyata tidak pernah ter-link di mesin kerja sama sekali, dan itu
// keputusan operasional pemilik produk (lihat INF-02).

const KNOWN_REAL_PROJECT_REFS = ['kfvtrwuuqcjfkkuqizxt'];

const ALLOW_ENV = 'ALLOW_SCRIPTS_AGAINST_REAL_PROJECT';

function extractProjectRef(supabaseUrl) {
  if (!supabaseUrl) return null;
  const m = String(supabaseUrl).match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
  return m ? m[1] : null;
}

// Panggil di baris PALING AWAL skrip yang MENULIS/MENGHAPUS data (setelah
// dotenv.config, sebelum membuat client Supabase). Skrip yang murni MEMBACA
// (mis. backup-export-json.js) SENGAJA tidak memanggil ini -- backup memang
// harus bisa membaca data nyata, itu tujuannya.
function assertNotRealProject(scriptName) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ref = extractProjectRef(url);
  const isReal = ref !== null && KNOWN_REAL_PROJECT_REFS.includes(ref);
  const allowed = process.env[ALLOW_ENV] === 'true';

  if (isReal && !allowed) {
    console.error(
      `\nPENGAWAS TINGKAT PROJECT MENOLAK MENJALANKAN "${scriptName || 'skrip ini'}".\n\n` +
        `NEXT_PUBLIC_SUPABASE_URL menunjuk project "${ref}", yang terdaftar sebagai RUMAH DATA NYATA PT ITM\n` +
        `(KNOWN_REAL_PROJECT_REFS di scripts/guard-real-project.js).\n\n` +
        `Skrip ini MENULIS/MENGHAPUS data. Menjalankannya di project data nyata bisa merusak data\n` +
        `sungguhan (gaji 31 orang, master item, pesanan) tanpa ada yang menahan.\n\n` +
        `Bila memang SENGAJA dan sudah dipertimbangkan, jalankan ulang dengan izin eksplisit:\n\n` +
        `  ${ALLOW_ENV}=true node ${scriptName || '<skrip>'}\n\n` +
        `Untuk mengarahkan ke project lain, set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY\n` +
        `project itu (mis. lewat env di depan perintah), JANGAN mengubah .env.local secara permanen.\n`
    );
    process.exit(1);
  }

  if (isReal && allowed) {
    console.warn(
      `\nPERINGATAN: "${scriptName || 'skrip ini'}" berjalan terhadap PROJECT DATA NYATA (${ref}) ` +
        `dengan izin eksplisit ${ALLOW_ENV}=true.\n`
    );
  }
}

module.exports = { assertNotRealProject, extractProjectRef, KNOWN_REAL_PROJECT_REFS, ALLOW_ENV };
