-- MM.6 / BAGIAN 3.1 (24 Agu 2026) — ARKEOLOGI ASAL-USUL DATA PT ITM.
--
-- NOL PENGHAPUSAN di migrasi ini. Isinya murni pencatatan hasil pemeriksaan, supaya
-- pertanyaan "data ini datang dari mana" tidak perlu diselidiki dua kali.

do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- pencatatan task di migrasi ini dilewati (no-op).';
    return;
  end if;

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'AUD-33', 'Arkeologi Asal-Usul Data PT ITM (hasil 3.1, sebelum pembersihan)', 'AUD', 'Audit Kualitas',
  'Pemeriksaan asal-usul seluruh data PT ITM sebelum pembersihan data: mana yang lahir dari skrip/migrasi, dan mana yang benar-benar dimasukkan lewat layar.',
  'Menentukan apa yang layak dipertahankan. Data yang lahir dari migrasi bisa dibangun ulang dengan menjalankan migrasinya; data yang diketik orang tidak bisa.',
  'bisa_menunggu', array['audit','arkeologi','pembersihan'], 'Claude Code', 'selesai', 'temuan_claude',
  E'CARA MEMERIKSANYA (tiga alat, masing-masing punya buta sendiri):\n' ||
  E'  1. POLA WAKTU created_at. Penyuntikan massal muncul sebagai banyak baris dalam DETIK YANG SAMA; pengetikan manusia berjarak menit.\n' ||
  E'  2. ISI BERKAS skrip & migrasi -- mencocokkan nama yang benar-benar ada di dalamnya.\n' ||
  E'  3. data_change_audit_log -- hanya berguna untuk 9 tabel dan hanya sejak 22 Agu.\n\n' ||
  E'HASIL:\n\n' ||
  E'a) 30 KARYAWAN -- ISI NYATA, CARA MASUK LEWAT SKRIP. Nama-namanya nama karyawan sungguhan, ' ||
  E'BUKAN nama fixture: scripts/seed-debug-employees.js hanya memuat 6 nama karangan (Budi Santoso, ' ||
  E'Siti Aminah, dst) yang TIDAK SATU PUN ada di database. Tidak ada migrasi mana pun yang menyisipkan ' ||
  E'employees. Polanya: 19 orang bergaji bulanan dalam 19 Agu 06:25-06:26, Darmini sendirian 09:02:09, ' ||
  E'10 orang harian 10:17-10:18 -- 1-2 baris per detik, terlalu cepat untuk diketik, jadi lewat skrip ' ||
  E'sekali-pakai yang memuat data sungguhan.\n\n' ||
  E'TEMUAN PENTING YANG MENGUBAH GAMBARAN: data payroll TIDAK selengkap yang diasumsikan. Dari 30 orang ' ||
  E'-- upah terisi 30, uang makan 19, kode karyawan pabrik 19, ikut BPJS Kesehatan 12, status PTKP HANYA 5, ' ||
  E'kategori TER HANYA 5. Jadi "30 karyawan beserta gaji, basis BPJS, tunjangan, PTKP, TER" sebenarnya ' ||
  E'lengkap hanya pada upahnya.\n\n' ||
  E'b) 8 ITEM, 6 BOM, 2 ROUTING, SO, PO KLIEN -- SELURUHNYA DARI MIGRASI. Semua tercipta dalam SATU DETIK ' ||
  E'(20 Agu 14:36:02), dan migrasi 20260827120000_mlvt_case_study_skeleton.sql memang menyisipkan persis ' ||
  E'item/BOM/routing/pelanggan itu. Bisa dibangun ulang kapan saja dengan menjalankan migrasinya.\n' ||
  E'KECUALI SATU: item PMGM-0001/ITM (PREMIX GUMMY), 23 Agu 09:07:44, dibuat pemilik produk lewat aplikasi.\n\n' ||
  E'c) PABRIK, PELANGGAN, SUPPLIER:\n' ||
  E'   - 2 pabrik (KL Bizhub, Ruko Dieng) 18 Agu 13:21:54 -- serentak, dari migrasi konsolidasi pabrik.\n' ||
  E'   - 1 pabrik (Puncak Dieng) 20 Agu 14:22:10 -- sendirian, 14 menit sebelum migrasi MLVT.\n' ||
  E'   - 1 pelanggan (PT. Sastro Utama Media Grup) 20 Agu 14:36:02 -- ikut migrasi MLVT.\n' ||
  E'   - 1 supplier (CV. Dose Supply Indonesia) 23 Agu 07:39:10 -- SATU-SATUNYA baris yang TERBUKTI ' ||
  E'     lewat aplikasi, karena jejak auditnya merekamnya (dan itu satu-satunya baris jejak audit PT ITM).\n\n' ||
  E'd) COMPANY B & PENGGUNA -- SELURUHNYA DARI SKRIP seed-debug-tenants.js. Ketujuh pengguna PT ITM ' ||
  E'berakhiran @debug.mrp; BELUM ADA satu pun akun karyawan sungguhan. PT ITM sendiri semula bernama ' ||
  E'"Company A" dan diganti namanya lewat halaman Perusahaan.\n\n' ||
  E'BATAS PEMERIKSAAN INI, wajib disebut supaya hasilnya tidak dipakai melebihi kekuatannya:\n' ||
  E'  - bom_lines, routings, routing_steps, sales_order_lines TIDAK punya kolom created_at sama sekali. ' ||
  E'    Asal-usulnya disimpulkan dari induknya, bukan dibuktikan sendiri.\n' ||
  E'  - Jejak audit hanya mencakup 9 dari 90 tabel dan hanya sejak 22 Agu 20:22. Apa pun sebelum itu ' ||
  E'    tidak meninggalkan bukti.\n' ||
  E'  - Jejak audit pun TIDAK MENYEBUT SIAPA orangnya: changed_by_auth_uid kosong dan changed_by_role ' ||
  E'    terisi "authenticator", karena aplikasi menulis lewat admin client. Jadi ia membuktikan "lewat ' ||
  E'    aplikasi", BUKAN "oleh siapa". Ini menambah pekerjaan AUD-07.\n' ||
  E'  - Pola waktu membedakan MASSAL dari TIDAK MASSAL. Ia tidak bisa membuktikan sebuah baris diketik ' ||
  E'    di layar -- hanya bahwa ia tidak lahir bersama rombongan.'
) on conflict (company_id, task_code) do nothing;

-- AUD-07 dilengkapi: jejak auditnya tidak menyebut siapa.
update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'TAMBAHAN 24 Agu 2026 (arkeologi 3.1): satu-satunya baris jejak audit PT ITM diperiksa isinya, dan ' ||
    E'ternyata `changed_by_auth_uid` KOSONG sementara `changed_by_role` terisi "authenticator". Sebabnya ' ||
    E'aplikasi menulis lewat admin client (service role), sehingga yang terekam adalah peran database, ' ||
    E'bukan orangnya.\n\n' ||
    E'Artinya jejak audit yang ada sekarang bisa menjawab "diubah lewat aplikasi atau bukan", TAPI TIDAK ' ||
    E'BISA menjawab "siapa yang mengubah" -- padahal pertanyaan kedua itulah yang dibutuhkan saat ada ' ||
    E'perselisihan. Perluasan AUD-07 karena itu mencakup DUA hal: menambah tabel yang dipantau, DAN ' ||
    E'menurunkan identitas pengguna aplikasi ke dalam jejaknya.'
where task_code = 'AUD-07';

end $$;
