-- Koreksi ABS-05: CI job "Typecheck & Test Suite" (menjalankan SELURUH
-- suite, termasuk tests/attendance_geo_qr_w1.test.ts) LULUS BERSIH di
-- commit 57637fe -- padahal file test yang sama gagal 100% konsisten
-- (401 di semua panggilan) setiap kali dijalankan LOKAL di sandbox sesi
-- ini, termasuk setelah `git stash` menyingkirkan semua perubahan sesi.
-- Kesimpulan paling mungkin (BUKAN kepastian mutlak -- GitHub Actions
-- tidak melaporkan hasil per-test, cuma per-job): ini artefak lingkungan
-- SANDBOX LOKAL (dugaan kuat: clock/jam sistem sandbox tidak presisi,
-- pola sama seperti "JWT issued at future" yang pernah dicatat HANDOFF
-- Sesi 2B) -- BUKAN bug produk sungguhan, karena CI (runner dengan jam
-- akurat) tidak mengalaminya sama sekali.
update public.build_tasks
set urgency = 'bisa_menunggu',
    notes = coalesce(notes || E'\n\n', '') || 'KOREKSI 22 Agu 2026: CI (job Typecheck & Test Suite, commit 57637fe) LULUS BERSIH menjalankan file test ini -- kontradiksi langsung dengan kegagalan 100% konsisten yang teramati lokal. Dugaan kuat (bukan kepastian): artefak clock/jam sandbox lokal, bukan bug produk sungguhan. Diturunkan dari Penting ke Bisa Menunggu -- perlu 1 kali lagi dijalankan di lingkungan lain (mis. staging) untuk memastikan sebelum ditutup total.'
where task_code = 'ABS-05';
