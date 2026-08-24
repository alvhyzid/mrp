-- BAGIAN 3 SELESAI + temuan yang lahir saat memverifikasinya (25 Agu 2026).

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'DIBERSIHKAN TUNTAS 25 Agu 2026 lewat migrasi 20260828400000 — dan 562 baris yatim yang jadi isi ' ||
    E'task ini IKUT HABIS. Diperiksa sesudahnya di 10 tabel anak sekaligus: NOL baris yatim tersisa.\n\n' ||
    E'Migrasi pembersihannya sengaja TIDAK memakai session_replication_role (justru itu penyebab task ' ||
    E'ini). Penegakan kunci asing dibiarkan hidup dan setiap tabel anak dihapus eksplisit lewat join ke ' ||
    E'induknya, supaya tabel yang terlewat GAGAL KERAS menyebut namanya alih-alih berhasil diam-diam.\n\n' ||
    E'Terbukti idempoten: dijalankan dua kali, jalankan kedua mengubah NOL baris.'
where task_code = 'AUD-31';

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'MST-22', 'Tidak Ada Layar untuk Membuat Pabrik', 'MST', 'Master Data',
  'Endpoint production-plants hanya punya GET. Tidak ada jalur membuat, mengubah, atau menonaktifkan pabrik lewat layar — ketiga pabrik PT ITM lahir dari migrasi dan skrip.',
  'Selama pabriknya sudah ada, tidak terasa. Ia menggigit saat PT ITM membuka lokasi baru, atau saat tenant kedua mulai memakai sistem dan harus mendaftarkan pabriknya sendiri — tidak ada jalan sama sekali kecuali lewat migrasi.',
  'penting', array['master-data','layar-hilang'], 'Claude Code + Pemilik Produk', 'menunggu', 'temuan_claude',
  E'DITEMUKAN 25 Agu 2026 saat menguji rantai MLVT di tenant uji: hendak membuat pabrik lewat aplikasi ' ||
  E'dan ternyata tidak ada jalurnya. app/api/production-plants/route.ts hanya mengekspor GET.\n\n' ||
  E'KAITAN YANG MEMBUAT INI LEBIH PENTING DARIPADA TERLIHAT: migrasi studi kasus MLVT MENOLAK JALAN ' ||
  E'tanpa pabrik bernama persis "KL Bizhub (Karanglo)", dan tidak ada migrasi yang membuat pabrik itu. ' ||
  E'Jadi kemampuan membangun ulang MLVT bergantung pada baris yang tidak bisa dibuat ulang lewat jalur ' ||
  E'mana pun kecuali menulis migrasi baru.'
) on conflict (company_id, task_code) do nothing;

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'SLS-06', 'PO Klien Butuh Persetujuan TIGA Departemen oleh TIGA Peran Berbeda', 'SLS', 'Penjualan',
  'PO klien tidak bisa diproses jadi SO sebelum disetujui departemen finance, ppic, dan manager. Satu pengguna tidak bisa menyetujui ketiganya — company_admin ditolak saat mencoba menyetujui departemen finance.',
  'Bukan cacat: gerbangnya memang begitu dirancang. Tapi bila pemilik produk mengerjakan rantai MLVT sendirian, ia akan MENTOK di langkah 6 tanpa tahu sebabnya — dan itu di tengah jalan, setelah 5 langkah sebelumnya sudah diisi.',
  'penting', array['penjualan','hak-akses','rantai-mlvt'], 'Claude Code + Pemilik Produk', 'menunggu', 'temuan_claude',
  E'DITEMUKAN 25 Agu 2026 saat menguji rantai di tenant uji (yang hanya punya SATU pengguna). Jawaban ' ||
  E'sistem apa adanya: "Role Anda tidak berwenang approve/reject department finance."\n\n' ||
  E'DI PT ITM INI BISA DILALUI: ada 7 akun mencakup finance_manager, ppic_manager, dan company_admin. ' ||
  E'Tapi pemilik produk harus TAHU bahwa ia perlu berpindah akun tiga kali di langkah itu.\n\n' ||
  E'YANG PERLU DIPUTUSKAN: apakah untuk latihan ini gerbangnya cukup dijelaskan (pemilik produk login ' ||
  E'bergantian), ATAU perlu jalur yang membolehkan satu orang berwenang menyetujui lebih dari satu ' ||
  E'departemen di perusahaan sekecil PT ITM. Keduanya sah; yang tidak sah adalah membiarkannya jadi ' ||
  E'kejutan di tengah jalan.'
) on conflict (company_id, task_code) do nothing;

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'SLS-07', 'Nomor Dokumen Dihitung dari Jumlah Baris — Menghapus Satu Dokumen Membuat Nomor Berikutnya Gagal', 'SLS', 'Penjualan',
  'Nomor SO, nomor batch, dan nomor surat jalan tidak disimpan di penghitung mana pun. Ketiganya dihitung ulang tiap kali dokumen dibuat: jumlah baris tahun berjalan + 1.',
  'Menghapus satu dokumen di tengah tahun membuat nomor berikutnya menabrak nomor yang masih ada. Kekangan unik menolaknya, jadi yang terjadi bukan nomor ganda melainkan PEMBUATAN DOKUMEN YANG GAGAL — dan pesannya tidak menjelaskan apa pun yang berguna bagi pengguna.',
  'penting', array['penjualan','penomoran'], 'Claude Code + Pemilik Produk', 'menunggu', 'temuan_claude',
  E'DIPERIKSA 25 Agu 2026 di generateSoNumber (processCustomerPurchaseOrder.ts) dan generateShipmentNumber ' ||
  E'(createShipmentWithSignature.ts). Keduanya memakai count(*) atas tahun berjalan.\n\n' ||
  E'KEKANGAN UNIK ADA di keempat kolom nomor (company_id + nomor), jadi nomor ganda TIDAK BISA lolos ke ' ||
  E'database. Itu kabar baik untuk kepatuhan. Yang buruk adalah bentuk kegagalannya.\n\n' ||
  E'AMAN HARI INI karena pembersihan menghapus SEMUANYA sekaligus sehingga hitungannya kembali nol dengan ' ||
  E'rapi. Ia menggigit saat satu dokumen dihapus dari kumpulan yang masih hidup.\n\n' ||
  E'PERBAIKAN YANG BENAR (bukan untuk sekarang): ambil nomor tertinggi yang pernah dipakai, bukan jumlah ' ||
  E'baris — atau simpan penghitung sungguhan yang tidak pernah mundur.'
) on conflict (company_id, task_code) do nothing;

end $$;
