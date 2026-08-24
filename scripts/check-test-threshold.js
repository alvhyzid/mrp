// PENGAWAS AMBANG JUMLAH TEST (SS.1, 23 Agu 2026).
//
// Lahir dari temuan QQ.4: test yang DILEWATI diam-diam jauh lebih berbahaya
// daripada test yang gagal. Berkas yang seluruh isinya di-skip lewat
// `describe.skipIf` tetap dihitung PASSED -- artinya CI bisa "hijau" sementara
// hampir tidak ada yang benar-benar diuji. Pengawas ini menutup lubang itu:
// bukan cuma "tidak ada yang gagal", tapi "cukup banyak yang benar-benar jalan".
// DI LUAR JANGKAUAN PENGAWAS INI (aturan II.2):
//   - KEBUTAAN STRUKTURAL: ia menghitung BERAPA test berjalan, bukan APA yang diuji.
//     Test yang berjalan tapi tidak menegaskan apa pun (atau menegaskan hal yang salah)
//     tetap dihitung LULUS. Angka yang naik tidak berarti jaminannya bertambah.
//   - TIDAK melihat cakupan kode. Berkas yang tidak pernah diuji sama sekali tidak
//     menurunkan angka mana pun.
//   - Ambangnya ditulis tangan; menaikkannya saat test dihapus akan meloloskan penurunan
//     yang sesungguhnya. Itu sebabnya perubahan ambang wajib disertai alasan tertulis.
const fs = require('fs');
const path = require('path');

const MIN_PASSED = 307;   // sekarang 327 (+7 dari tests/company_settings_mst26.test.ts, DS-1) -- ruang ~20
const MAX_SKIPPED = 10;   // sekarang 7 dilewati sadar (2 pengawas data nyata)
const EXPECTED_FILES = 54;  // +storage_ikut_terhapus (JJ.1), +backup_table_list_lengkap (LL), +auth_user_lewat_helper_watchdog (TT), +company_settings_mst26 (DS-1)

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
// `numTotalTestSuites` TERLIHAT seperti jumlah berkas, tapi BUKAN -- itu jumlah blok
// `describe` (terbukti: 104 blok dari 46 berkas). Yang benar-benar berarti "berkas test
// yang berjalan" adalah panjang `testResults`. Salah pakai di versi pertama pengawas ini
// membuat ambangnya membandingkan angka yang artinya bukan itu.
const files = Array.isArray(r.testResults) ? r.testResults.length : 0;

// PEMAKAIAN PENGULANGAN LOGIN (TT.1). Pengulangan itu obat yang bisa menutupi
// penyakit: ia memang dipasang untuk menelan lonjakan latensi sesekali, tapi kalau
// suatu hari login melambat karena sebab LAIN, ia akan menutupinya sampai parah.
// Karena itu angkanya dilaporkan tiap run. Yang penting bukan angka hari ini,
// melainkan ARAHNYA: naik terus dari run ke run = ada yang memburuk, bukan ragam biasa.
//
// PATOKAN 24 Agu 2026: 0-2 pengulangan sungguhan per run penuh (46 berkas, 275 test,
// ~770 detik). Angka 2 tercatat pada run yang tetap HIJAU — artinya dua login yang
// tadinya akan gagal berhasil diselamatkan oleh pengulangan. Itu bukti pertama jaring
// ini bekerja pada login sungguhan, dan baru muncul SETELAH syarat "status >= 500"
// dilepas: dengan syarat itu, pengaman ini DIAM justru saat dibutuhkan.
//
// ANGKA INI DUA KALI SALAH DIBACA sebelum akhirnya benar, keduanya karena membaca LOG
// KONSOL dengan `grep -c` alih-alih membaca catatan: baris pengulangan milik test
// uji-diri tidak bisa dibedakan dari yang sungguhan, sehingga 7 baris tiruan sempat
// dilaporkan sebagai patokan "7 pengulangan per run". Sejak itu tiap baris log menyebut
// host DAN menyebut apakah ia dicatat. YANG SAH DIPAKAI SEBAGAI PATOKAN ADALAH ANGKA
// DARI BERKAS CATATAN INI, BUKAN HASIL grep ATAS LOG.
const MAX_RETRIES = 40;   // patokan 0-2; ambang dipasang longgar supaya yang tertangkap
                          // adalah KEMUNDURAN NYATA, bukan ragam wajar hari ke hari
let retries = 0;
const auditFile = path.join(process.cwd(), 'retry-audit.log');
if (fs.existsSync(auditFile)) {
  retries = fs.readFileSync(auditFile, 'utf8').split('\n').filter((l) => l.trim()).length;
}

const problems = [];
if (failed > 0) problems.push(`${failed} test GAGAL`);

// LUBANG YANG BARU KETAHUAN 23 Agu 2026: sebuah berkas bisa MATI DI beforeAll dan
// menyumbang NOL test gagal -- seluruh test-nya dilaporkan "dilewati", bukan "gagal".
// Waktu itu process_mining.test.ts mati begitu, dan `numFailedTests` tetap 0. Yang
// menangkapnya cuma ambang jumlah test dilewati; kalau kebetulan masih di bawah batas,
// kematian itu lolos tanpa suara. Karena itu status BERKAS ikut diperiksa.
// SAMA SEPERTI numTotalTestSuites, `numFailedTestSuites` menghitung blok `describe`,
// BUKAN berkas -- terbukti melaporkan 4 padahal vitest menyebut 2 berkas gagal. Kesalahan
// yang PERSIS SAMA dengan yang sudah diperbaiki beberapa baris di atas, terulang karena
// nama fieldnya sekali lagi terdengar benar. Yang sah adalah status di tiap testResults.
const failedSuites = Array.isArray(r.testResults)
  ? r.testResults.filter((t) => t.status === 'failed').length
  : 0;
if (failedSuites > 0) {
  problems.push(
    `${failedSuites} BERKAS test gagal (kemungkinan besar mati di beforeAll -- test di dalamnya ` +
      `dilaporkan "dilewati", bukan "gagal", jadi tidak terhitung di angka test gagal)`
  );
}
if (retries > MAX_RETRIES) {
  problems.push(
    `pengulangan login terpakai ${retries} kali, di atas batas ${MAX_RETRIES} (patokan sehat: 0-2). ` +
      `Ini tanda login ke project CI benar-benar memburuk, bukan lonjakan biasa.`
  );
}
if (passed < MIN_PASSED) problems.push(`test lulus ${passed}, di bawah ambang ${MIN_PASSED}`);
if (skipped > MAX_SKIPPED) problems.push(`test dilewati ${skipped}, di atas batas ${MAX_SKIPPED}`);
if (files !== EXPECTED_FILES) problems.push(`berkas berjalan ${files}, seharusnya ${EXPECTED_FILES}`);

console.log(`\nPENGAWAS AMBANG -- lulus: ${passed} (min ${MIN_PASSED}) | dilewati: ${skipped} (maks ${MAX_SKIPPED}) | gagal: ${failed} | berkas: ${files} (harus ${EXPECTED_FILES})`);
console.log(`PENGULANGAN LOGIN terpakai ${retries} kali run ini (patokan 24 Agu 2026: 0-2 | batas ${MAX_RETRIES}).`);

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
