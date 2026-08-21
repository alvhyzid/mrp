-- Halaman Daftar Tugas Pembangunan -- 22 Agu 2026: INF-05 (Pengamanan Data
-- Nyata, SUPER URGENT, mendahului segalanya -- termasuk INF-01 sudah
-- selesai/menunggu persetujuan, RBD-03/04, INF-02) dicatat SEDANG DIKERJAKAN
-- lalu langsung dieksekusi di giliran yang sama. INF-06 (bersihkan 7
-- company fixture test) dicatat SAJA, TIDAK dikerjakan (prasyarat INF-05
-- selesai, sesuai instruksi eksplisit).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes, started_at, super_urgent_since
  ) values (
    v_company_id, 'INF-05', 'Pengamanan Data Nyata (backup terverifikasi + tutup pintu penerbitan tidak sengaja)',
    'INF', 'Infrastruktur & Environment',
    'Data nyata PT ITM hari ini tidak punya salinan yang bisa diandalkan. Task ini menutup celah itu -- MENDAHULUI SEGALANYA, termasuk INF-01/RBD-03/RBD-04/INF-02.',
    'Tanpa ini, satu insiden (kesalahan migrasi, penghapusan tidak sengaja, kerusakan project) bisa menghilangkan seluruh data PT ITM (payroll 63 orang, SO MLVT, master data) tanpa jalan pulih.',
    'super_urgent', ARRAY['Keamanan','Data','Integrasi']::text[], 'Claude Code', 'sedang_dikerjakan', null, 'pemilik_produk',
    $inf05$LANGKAH (dicatat lengkap supaya sesi mana pun bisa lanjut tanpa baca riwayat obrolan):

1. BACKUP HARI INI, SEBELUM APA PUN.
   a. Jalankan backup manual project yang berisi data nyata (kfvtrwuuqcjfkkuqizxt).
   b. VERIFIKASI ISINYA, jangan percaya status hijau -- buktikan ada BARIS DATA di tabel sampel (employees, lots, sales_orders, companies), bukan hanya CREATE TABLE. Doktrin proyek: workflow backup pernah hijau padahal isinya schema-only.
   c. Laporkan ukuran berkas, format (COPY atau INSERT), jumlah baris per tabel sampel.
   d. Simpan salinan di tempat yang TIDAK ikut hilang dalam 7 hari. Laporkan lokasinya. JANGAN commit berkas backup ke repo.

2. BACKUP OTOMATIS.
   a. Laporkan penyebab pasti fitur backup asli Supabase (PITR) tidak aktif -- paket gratis, atau setelan yang bisa dinyalakan tanpa biaya?
   b. Bila karena PAKET BERBAYAR: BERHENTI, laporkan biayanya ke pemilik produk -- ini keputusan pemilik produk, bukan keputusan teknis.
   c. Bila bisa dinyalakan tanpa biaya: nyalakan, BUKTIKAN snapshot pertama terbentuk.
   d. Perbaiki jalur cadangan GitHub Actions (backup-db.yml) supaya berjalan OTOMATIS TERJADWAL (bukan cuma workflow_dispatch manual), sertakan pemeriksaan isi (poin 1b) DI DALAM workflow -- backup yang tidak diperiksa isinya sama dengan tidak ada backup.

3. TUTUP PINTU PENERBITAN TIDAK SENGAJA.
   a. Perbaiki setelan Vercel project mrp-staging: push ke branch main TIDAK BOLEH otomatis menerbitkan tampilan publik lagi -- hanya branch staging yang berlaku begitu, sampai INF-02 (perapian environment) selesai.
   b. Laporkan setelan sebelum & sesudah.
   c. Buktikan: push percobaan ke main -> TIDAK menghasilkan penerbitan publik baru.
   d. Catat sebagai peringatan di detail INF-02: kebetulan baik hari ini (tampilan publik tersambung ke Supabase KOSONG) akan berubah jadi kebocoran begitu sambungan diarahkan ke data nyata -- setelan poin 3 ini WAJIB sudah benar SEBELUM INF-02 dikerjakan.

BATAS: JANGAN menyentuh data nyata sama sekali (hanya menyalin & mengubah setelan). JANGAN memperbaiki 7 company fixture test yang menumpuk (dicatat terpisah sebagai INF-06, dikerjakan nanti). JANGAN menghapus apa pun di tempat data nyata sebelum backup terbukti sah. JANGAN melanjutkan ke INF-02/RBD-03/RBD-04 setelah task ini.

BUKTI WAJIB: (a) isi backup -- jumlah baris NYATA per tabel sampel, bukan pernyataan; (b) jalankan pemulihan PERCOBAAN ke tempat kosong (staging/lokal) -- buktikan data benar-benar kembali (backup yang belum pernah diuji pulih bukan backup, hanya berkas); (c) push percobaan ke main -> tidak ada penerbitan publik baru; (d) jumlah baris di tempat data nyata SAMA PERSIS sebelum & sesudah seluruh task ini.

STOP CONDITION: backup ternyata tidak berisi data -> berhenti segera, laporkan sebagai darurat. Backup otomatis butuh biaya -> berhenti, laporkan angkanya. Pemulihan percobaan gagal -> berhenti, laporkan.$inf05$,
    'Format B.0.2 sesuai instruksi pemilik produk 22 Agu 2026.',
    now(), now()
  )
  on conflict (company_id, task_code) do nothing;

  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-06', 'Bersihkan 7 Perusahaan Bekas Test di Tempat Data Nyata',
    'INF', 'Infrastruktur & Environment',
    '7 baris company sisa pengujian (PlantConsolidationTestCorp, BaselineLockSeparationTestCorp, MarginWatchTestCorp, Sesi0BRoleTestCorp, BuildTasksTestCorp, AttendanceW1TestCorp, RoutingBomSnapshotTestCorp) menumpuk di project berisi data nyata PT ITM -- seharusnya terhapus otomatis oleh afterAll masing-masing test, tapi tidak.',
    'Tanpa dibersihkan, project data nyata terus terisi sampah fixture test -- dan ini kedua kalinya sisa test ditemukan di tempat yang salah, menandakan mekanisme pembersihan-mandiri test perlu diperiksa ulang, bukan cuma dihapus sekali lalu dilupakan.',
    'mendesak', ARRAY['Data','Keamanan']::text[], 'Claude Code', 'menunggu', null, 'temuan_claude',
    'PRASYARAT: INF-05 selesai. TIDAK ADA penghapusan apa pun di tempat data nyata sebelum backup terbukti sah dan terbukti bisa dipulihkan (bukti (a)/(b) INF-05). Lingkup: (1) periksa kenapa cleanupCompanyCascade/afterAll ke-7 test ini tidak menghapus baris companies-nya (test lama sebelum perbaikan 26 Agu 2026? atau delete companies gagal karena FK dari tabel anak yang belum dibersihkan?); (2) setelah akar penyebab jelas, hapus ke-7 baris company beserta seluruh data anaknya (cascade) dari project data nyata; (3) kalau ditemukan test lain yang masih berpotensi menyisakan fixture serupa, catat sebagai task tambahan, jangan diam-diam diperbaiki tanpa dicatat.',
    'Ditemukan sebagai efek samping audit infrastruktur INF-01 (22 Agu 2026), bukan tujuan awal audit itu.'
  )
  on conflict (company_id, task_code) do nothing;

end $$;
