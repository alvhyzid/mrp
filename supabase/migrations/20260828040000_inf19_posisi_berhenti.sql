-- INF-19 (23 Agu 2026) -- catat POSISI PERSIS berhenti, sesuai butir 1.6
-- ("bila buntu setelah usaha wajar: catat posisi persis, lanjut").
do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name='PT ITM' limit 1;
  if v_company_id is null then raise notice 'PT ITM tidak ditemukan -- dilewati.'; return; end if;

  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nPOSISI BERHENTI 23 Agu 2026 (butir 1.6) -- SUDAH SANGAT DEKAT, tersisa satu hal yang belum ketemu.\n\n' ||
      E'SUDAH SELESAI & TERBUKTI:\n' ||
      E'  1. Edge Function `custom-access-token` ter-deploy ke fabrix-ci-test (`--use-api --no-verify-jwt`, tanpa Docker).\n' ||
      E'  2. Secret `CUSTOM_ACCESS_TOKEN_HOOK_SECRETS` terpasang (dikonfirmasi lewat `secrets list`).\n' ||
      E'  3. Auth Hook aktif lewat Management API: `hook_custom_access_token_enabled=true` + uri + secret.\n' ||
      E'  4. DIBUKTIKAN dengan cara yang sama seperti diagnosisnya: login lalu decode token -> `company_id=3` + `app_role=company_admin` MUNCUL (sebelumnya kedua klaim tidak ada).\n' ||
      E'  5. Akun uji + tenant Company A/B ter-seed (8 akun).\n' ||
      E'  6. Dua pengawas data nyata dibungkus `describe.skipIf(!isRealDataProject())` -- dicatat AUD-13 supaya jaminannya tidak hilang.\n' ||
      E'  7. SUITE PENUH LOKAL terhadap fabrix-ci-test: **45/45 file, 268 lulus + 7 dilewati sadar** -- termasuk saat dijalankan dengan env PERSIS seperti CI (hanya 6 secret, `.env.local` disingkirkan sementara).\n\n' ||
      E'YANG BELUM KETEMU: CI di GitHub TETAP MERAH di job "Typecheck & Test Suite" padahal suite yang sama hijau lokal terhadap project yang sama dengan kunci yang sama.\n\n' ||
      E'YANG SUDAH DICORET dari daftar kemungkinan (masing-masing diperiksa, bukan diasumsikan):\n' ||
      E'  - BUKAN salah project: FABRIX-APP, fabrix-ci-test, DAN staging lama (nclke...) SEMUANYA nol jejak fixture -- artinya test gagal SEBELUM menyentuh database.\n' ||
      E'  - BUKAN secret kurang: test hanya butuh 3 DEBUG_*_PASSWORD, ketiganya ada di ci.yml.\n' ||
      E'  - BUKAN berkas tidak ter-commit: `scripts/guard-real-project.js` + `check-linked-project.js` terlacak git DAN ada di origin/main; `scripts/` tidak di-gitignore.\n' ||
      E'  - BUKAN env lokal menutupi: direplikasi dengan `.env.local` disingkirkan sementara, tetap lulus.\n\n' ||
      E'HIPOTESIS YANG BELUM DIUJI (butuh log CI yang tidak bisa diunduh dari sini -- API mensyaratkan hak admin repo, 403 berulang sejak lama): Auth Hook kini dipanggil pada SETIAP login, dan test melakukan banyak login. Cold start Edge Function + satu HTTP call per login bisa mendorong hook `beforeAll` melewati batas 30 detik di runner CI yang jaringannya lebih lambat/bervariasi -- pola yang SAMA PERSIS dengan riwayat proyek ini (hookTimeout dinaikkan 10s->30s dulu karena sebab serupa). Bila benar, perbaikannya menaikkan `hookTimeout`/`testTimeout` di vitest.config.ts, BUKAN mengubah kode aplikasi.\n\n' ||
      E'LANGKAH BERIKUTNYA YANG DISARANKAN: minta pemilik produk membuka satu run CI yang gagal di tab Actions dan menyalin 20 baris galat pertamanya -- itu memotong seluruh tebakan di atas dalam satu langkah. Semua jalur otomatis untuk membacanya sudah buntu.'
  where task_code='INF-19' and company_id=v_company_id;
end $$;
