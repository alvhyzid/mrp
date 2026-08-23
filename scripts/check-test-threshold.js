// PENGAWAS AMBANG JUMLAH TEST (SS.1, 23 Agu 2026).
//
// Lahir dari temuan QQ.4: test yang DILEWATI diam-diam jauh lebih berbahaya
// daripada test yang gagal. Berkas yang seluruh isinya di-skip lewat
// `describe.skipIf` tetap dihitung PASSED -- artinya CI bisa "hijau" sementara
// hampir tidak ada yang benar-benar diuji. Pengawas ini menutup lubang itu:
// bukan cuma "tidak ada yang gagal", tapi "cukup banyak yang benar-benar jalan".
const fs = require('fs');
const path = require('path');

const MIN_PASSED = 250;   // sekarang 268 -- ruang ~18 utk perubahan wajar
const MAX_SKIPPED = 10;   // sekarang 7 dilewati sadar (2 pengawas data nyata)
const EXPECTED_FILES = 45;

const arg = process.argv[2] || 'test-results.json';
const file = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
if (!fs.existsSync(file)) {
  console.error(`\nPENGAWAS AMBANG: berkas hasil test tidak ditemukan (${file}).\nJalankan vitest dengan --reporter=json --outputFile=test-results.json lebih dulu.\n`);
  process.exit(1);
}

const r = JSON.parse(fs.readFileSync(file, 'utf8'));
const passed = r.numPassedTests ?? 0;
const failed = r.numFailedTests ?? 0;
const skipped = (r.numPendingTests ?? 0) + (r.numTodoTests ?? 0);
const files = r.numTotalTestSuites ?? (r.testResults ? r.testResults.length : 0);

const problems = [];
if (failed > 0) problems.push(`${failed} test GAGAL`);
if (passed < MIN_PASSED) problems.push(`test lulus ${passed}, di bawah ambang ${MIN_PASSED}`);
if (skipped > MAX_SKIPPED) problems.push(`test dilewati ${skipped}, di atas batas ${MAX_SKIPPED}`);
if (files !== EXPECTED_FILES) problems.push(`berkas berjalan ${files}, seharusnya ${EXPECTED_FILES}`);

console.log(`\nPENGAWAS AMBANG -- lulus: ${passed} (min ${MIN_PASSED}) | dilewati: ${skipped} (maks ${MAX_SKIPPED}) | gagal: ${failed} | berkas: ${files} (harus ${EXPECTED_FILES})`);

if (problems.length > 0) {
  console.error(
    `\nPENGAWAS AMBANG GAGAL KERAS:\n` +
      problems.map((p) => `  - ${p}`).join('\n') +
      `\n\nCI hijau TIDAK cukup -- yang dijaga di sini adalah apakah test benar-benar BERJALAN,\n` +
      `bukan sekadar tidak ada yang merah. Berkas yang seluruh isinya dilewati tetap dihitung\n` +
      `"passed" oleh vitest, jadi tanpa pengawas ini suite bisa mati diam-diam.\n\n` +
      `Bila penurunan ini DISENGAJA (mis. test dihapus atau sengaja dilewati), perbarui\n` +
      `MIN_PASSED / MAX_SKIPPED / EXPECTED_FILES di scripts/check-test-threshold.js\n` +
      `beserta alasannya -- jangan dibiarkan lewat diam-diam.\n`
  );
  process.exit(1);
}
console.log('PENGAWAS AMBANG: LULUS.\n');
