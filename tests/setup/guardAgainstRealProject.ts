// Pengawas TINGKAT PROJECT (23 Agu 2026, ditemukan lewat S.2/1.3 -- persiapan
// transfer Supabase). Invariant 9 (`tests/testCompanyCleanup.ts`,
// REAL_TENANT_COMPANY_IDS) melindungi BARIS company_id=1 -- itu SELALU bekerja,
// dibuktikan lagi hari ini (test yang berjalan bersamaan sesi ini membuat
// company_id BARU-nya sendiri, tidak pernah menyentuh company_id=1). TAPI tidak
// ada satu pun yang mencegah test suite dijalankan terhadap PROJECT Supabase
// yang SAMA dengan tempat data nyata PT ITM hidup -- karena `.env.local` yang
// dipakai `npm run dev` (untuk melihat data nyata, lihat INF-11) adalah
// `.env.local` YANG SAMA yang dibaca `npx vitest run` (lihat vitest.config.ts
// baris "Vitest tidak otomatis memuat .env.local..."). Baris company_id=1
// terlindungi; PROJECT-nya tidak. Test suite lokal SELALU membuat+menghapus
// company barunya sendiri di project SUNGGUHAN yang sama sepanjang proyek ini
// berjalan -- bekerja karena disiplin (auto-increment company_id + cleanup
// mandiri), bukan karena ada pengaman eksplisit yang menolak jalankan sama
// sekali.
//
// Pengawas ini menutup celah itu: menolak KERAS menjalankan test suite lokal
// terhadap project yang diketahui berisi data nyata, KECUALI dijalankan dengan
// flag eksplisit yang menyatakan sadar risikonya. CI TIDAK terpengaruh --
// job "Rebuild Schema from Migrations" & "Typecheck & Test Suite" memakai
// instance Postgres EFEMER (`supabase db start`, database baru kosong tiap
// run, bukan project ini sama sekali) via Docker di runner GitHub, jadi
// `NEXT_PUBLIC_SUPABASE_URL` di CI tidak pernah cocok dengan daftar di bawah.
//
// KNOWN_REAL_PROJECT_REFS: hardcode sengaja (pola sama seperti
// REAL_TENANT_COMPANY_IDS di testCompanyCleanup.ts) -- daftar project Supabase
// yang PERNAH/SEDANG jadi rumah data nyata PT ITM. Tambah entri baru di sini
// SETELAH transfer organisasi (S.1-S.7) kalau project ref berubah, JANGAN
// hapus entri lama kecuali project itu benar-benar dihapus permanen.
// SATU SUMBER KEBENARAN: daftar project data nyata dibaca dari
// scripts/guard-real-project.js (INF-14, 23 Agu 2026) -- supaya tidak ada dua
// daftar terpisah yang bisa berbeda diam-diam saat salah satunya diperbarui.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { KNOWN_REAL_PROJECT_REFS } = require('../../scripts/guard-real-project');

function extractProjectRef(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  const match = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
  return match ? match[1] : null;
}

const projectRef = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
const isKnownRealProject = projectRef !== null && KNOWN_REAL_PROJECT_REFS.includes(projectRef);
const explicitlyAllowed = process.env.ALLOW_TESTS_AGAINST_REAL_PROJECT === 'true';

if (isKnownRealProject && !explicitlyAllowed) {
  throw new Error(
    `\n\nPENGAWAS TINGKAT PROJECT: test suite ini akan berjalan terhadap project Supabase "${projectRef}", ` +
      `yang terdaftar sebagai RUMAH DATA NYATA PT ITM (KNOWN_REAL_PROJECT_REFS di tests/setup/guardAgainstRealProject.ts). ` +
      `DITOLAK secara default -- bukan karena baris company_id=1 dalam bahaya (Invariant 9 tetap melindunginya terpisah), ` +
      `tapi karena tidak seharusnya test suite lokal diam-diam menulis ke project yang sama dengan data sungguhan tanpa ` +
      `kesadaran eksplisit siapa pun yang menjalankannya.\n\n` +
      `Bila memang bermaksud menjalankan test terhadap project ini (mis. tidak ada project Supabase lain yang tersedia untuk ` +
      `pengembangan lokal saat ini), jalankan ulang dengan flag eksplisit:\n\n` +
      `  ALLOW_TESTS_AGAINST_REAL_PROJECT=true npx vitest run\n\n`
  );
}
