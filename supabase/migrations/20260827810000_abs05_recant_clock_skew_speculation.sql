-- II.5 (22 Agu 2026) -- KOREKSI ATAS KOREKSI (20260827800000). Pemilik produk
-- menolak penurunan urgensi ABS-05 karena dasarnya DUGAAN ("kemungkinan
-- artefak jam sandbox"), bukan bukti -- instruksi eksplisit: buktikan
-- penyebabnya dulu (tunjukkan selisih jam sungguhan), atau biarkan tetap
-- terbuka.
--
-- Dicoba dibuktikan, dan HASILNYA MEMATAHKAN dugaan sebelumnya (bukan
-- mengonfirmasi):
-- 1. Jam sandbox DICOCOKKAN langsung ke sumber luar (`date -u` vs header
--    HTTP Date dari www.google.com): 2026-08-22 15:06:31 UTC vs 15:06:32
--    UTC -- selisih 1 detik, dalam batas wajar latensi jaringan. TIDAK ADA
--    pergeseran jam yang bisa menjelaskan kegagalan 401 (yang akan butuh
--    selisih besar, mis. token dianggap "belum berlaku"/"sudah kedaluwarsa").
-- 2. tests/attendance_geo_qr_w1.test.ts dijalankan ULANG 3x berturut-turut
--    di sesi kerja ini (sandbox BERBEDA dari sandbox yang melaporkan
--    kegagalan 22 Agu sebelumnya) -- LULUS BERSIH 11/11 ketiga kalinya,
--    tanpa perubahan kode apa pun pada file test atau pada kode yang
--    diujinya.
--
-- KESIMPULAN JUJUR: klaim "artefak jam sandbox" di migrasi 20260827800000
-- TIDAK TERBUKTI -- dicabut. Penyebab kegagalan 401 yang teramati konsisten
-- di sesi sebelumnya TETAP TIDAK DIKETAHUI (kandidat paling mungkin sekarang:
-- kondisi sandbox-session-spesifik yang tidak persisten antar sesi kerja --
-- mis. token/kredensial lokal yang kedaluwarsa waktu itu -- tapi ini JUGA
-- dugaan, tidak dibuktikan, makanya tidak dipakai sebagai alasan penutupan).
-- Karena test SEKARANG hijau, task ini TIDAK bisa dinyatakan "terbukti
-- masih rusak" -- tapi karena test PERNAH gagal 100% konsisten tanpa
-- penjelasan yang terbukti, task ini JUGA tidak bisa dinyatakan "terbukti
-- aman". Urgensi dikembalikan ke level semula (bukan diturunkan berdasar
-- dugaan yang sudah dipatahkan) dan status TETAP terbuka/menunggu.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- update build_tasks (migrasi ini) dilewati (no-op).';
    return;
  end if;

  update public.build_tasks
  set urgency = 'penting',
      notes = coalesce(notes || E'\n\n', '') || 'KOREKSI ATAS KOREKSI (22 Agu 2026, II.5): klaim "artefak jam sandbox" (catatan 22 Agu sebelumnya) DICABUT -- dicoba dibuktikan, hasilnya JUSTRU MEMATAHKAN dugaan itu. Jam sandbox dicocokkan ke sumber luar (date -u vs header HTTP Date google.com): selisih 1 detik, bukan penjelasan yang masuk akal untuk 401. Test dijalankan ulang 3x di sesi kerja ini (sandbox berbeda dari yang melaporkan gagal): LULUS BERSIH 11/11 ketiga kalinya, tanpa perubahan kode. Penyebab kegagalan 401 yang teramati sebelumnya TETAP TIDAK DIKETAHUI -- bukan terbukti bug, bukan terbukti aman. Urgensi dikembalikan ke Penting, status tetap terbuka -- JANGAN ditutup hanya karena kebetulan hijau sekarang, dan JANGAN diturunkan lagi tanpa bukti konkret penyebabnya.'
  where task_code = 'ABS-05'
    and company_id = v_company_id;
end $$;
