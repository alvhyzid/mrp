-- B.2 selesai (GDG-05 + lot kedaluwarsa) + kejadian KEDUA AUD-21.

update build_tasks
set status = 'selesai', completed_at = now(),
    notes = coalesce(notes,'') || E'\n\n' ||
      '24 Agu 2026 — SELESAI bersama B.2 (lot kedaluwarsa), sengaja TIDAK terpisah: FEFO yang ' ||
      'menyertakan lot kedaluwarsa lebih buruk daripada FEFO yang tidak dipanggil sama sekali, karena ' ||
      'ia AKTIF menyarankan bahan yang tidak boleh dipakai dengan tampilan yang terlihat resmi. ' ||
      'suggest_fefo_lots kini mengecualikan lot kedaluwarsa (dua lapis: lewat status DAN lewat ' ||
      'pemeriksaan tanggal langsung) dan menandai lot yang tanggalnya belum diketahui lewat kolom ' ||
      'tanggal_belum_diketahui. Izinnya juga dikunci: dicabut dari public/anon.'
where task_code = 'GDG-05' and company_id = 1;

update build_tasks
set detail_pekerjaan = detail_pekerjaan || E'\n\n' ||
      E'KEJADIAN KEDUA (24 Agu 2026) — BERKAS BERBEDA: tests/baseline_lock_separation.test.ts mati di ' ||
      E'beforeAll dengan "TypeError: Cannot read properties of null (reading id)", lalu LULUS 8/8 saat ' ||
      E'dijalankan sendiri, lalu suite penuh berikutnya HIJAU tanpa perubahan kode apa pun.\n\n' ||
      E'INI MENGUBAH SIFAT TEMUANNYA: kegoyahan BUKAN milik satu berkas (ai_project_dashboard), ' ||
      E'melainkan masalah ISOLASI DI TINGKAT SUITE. Dua berkas berbeda, gejala berbeda, pola sama: ' ||
      E'fixture yang seharusnya ada ternyata tidak ada saat berkas itu berjalan di dalam suite.\n\n' ||
      E'DUGAAN YANG SUDAH DIPERIKSA DAN GUGUR: pengguna auth menumpuk melampaui batas 100 pada pola ' ||
      E'listUsers({perPage:100, page:1}) yang dipakai 23 berkas test, sehingga pencarian cadangan diam-diam ' ||
      E'gagal. Diperiksa langsung: hanya 8 pengguna auth di project CI. GUGUR.\n' ||
      E'TAPI POLANYA TETAP RAPUH dan layak diperbaiki terpisah: 23 berkas bergantung pada halaman ' ||
      E'pertama berisi maksimal 100 pengguna. Hari ini aman; itu bom waktu sejenis dengan tanggal UTC.',
    urgency = 'mendesak',
    notes = coalesce(notes,'') || E'\n\n24 Agu 2026 — urgensi dinaikkan ke MENDESAK setelah kejadian kedua di berkas berbeda. Test goyah melatih orang mengabaikan kegagalan, dan sekarang terbukti bukan kasus tunggal.'
where task_code = 'AUD-21' and company_id = 1;
