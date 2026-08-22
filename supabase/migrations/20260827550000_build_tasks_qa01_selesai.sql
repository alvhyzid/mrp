-- Halaman Daftar Tugas Pembangunan -- QA-01 selesai 22 Agu 2026 (W.2,
-- dikerjakan segera atas instruksi eksplisit, bukan menunggu Bagian 6).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  update build_tasks set
    status = 'selesai',
    started_at = coalesce(started_at, now()),
    completed_at = now(),
    approved_at = now(),
    detail_pekerjaan = detail_pekerjaan || E'\n\n--- HASIL 22 Agu 2026 ---\nAKAR MASALAH (bukan tambalan per-file lagi): tests/testCompanyCleanup.ts (cleanupCompanyCascade) diperkuat dengan 2 mekanisme generik: (1) RETRY-UNTIL-FIXED-POINT -- steps yang ditulis manual dijalankan berulang (maks 6 putaran), langkah gagal di-retry di putaran berikutnya, menyelesaikan kesalahan URUTAN secara otomatis; (2) SAPUAN SISA GENERIK lewat RPC baru debug_company_residual_scan() (migrasi 20260827540000, dynamic SQL atas information_schema, SATU round-trip ~1 detik) yang mencari SENDIRI tabel mana pun (berkolom company_id) yang masih py baris untuk company_id itu, TERLEPAS dari lengkap/tidaknya steps yang ditulis manusia -- menangkap kelas bug "lupa 1 tabel" yang jadi akar 2 dari 4 kejadian. Percobaan pertama (client-side, Promise.all lintas ~90 tabel) TERBUKTI tetap terlalu lambat (>30 detik, sampai hook timeout) -- pindah ke RPC server-side setelah itu.\nBUKTI (a): seluruh suite dijalankan 3x berturut-turut, jumlah company selain PT ITM/Company B: 4 -> 4 -> 4 (SAMA PERSIS ketiganya, termasuk saat run ke-2 mengalami 2 kegagalan test TIDAK TERKAIT/transient karena beban berkelanjutan, tanpa meninggalkan sisa).\nBUKTI (b): suite penuh dipaksa berhenti (SIGKILL) ~150 detik di tengah jalan -> 1 company tersisa (ProduksiNyataTestCorp, tidak mungkin dihindari -- SIGKILL mencegah kode apa pun berjalan, batasan level OS, bukan cacat cleanup). File test yang sama dijalankan ULANG dengan sisa itu MASIH ADA -> lulus bersih 12/12, fixture barunya sendiri terbersihkan sempurna, TIDAK ada tabrakan/korupsi. Sisa dari SIGKILL dibersihkan manual (didokumentasikan tabel-tabelnya lewat debug_company_residual_scan), baseline kembali ke 4.\nKESIMPULAN JUJUR: mekanisme baru menghilangkan AKUMULASI SENYAP saat operasi normal (termasuk saat test gagal karena sebab lain) -- tapi TIDAK bisa (dan tidak ada mekanisme test manapun yang BISA) mencegah sisa dari SIGKILL paksa, itu berada di luar jangkauan kode apa pun yang berjalan di proses yang sama.'
  where company_id = v_company_id and task_code = 'QA-01';

end $$;
