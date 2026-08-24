-- SENSUS "BISAKAH SISTEM BERDIRI DARI NOL LEWAT LAYAR" (25 Agu 2026). Pencatatan murni.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'MST-24', 'Setelan Perusahaan Tidak Punya Satu Pun Jalur Tulis di Aplikasi', 'MST', 'Master Data',
  'Tabel company_settings berisi 17 setelan PT ITM — periode gajian, jam kerja standar, hari kerja per bulan, empat tarif BPJS pemberi kerja, batas atas & bawah dasar BPJS, metode biaya tenaga kerja, dasar pembebanan overhead, mata uang, penilaian sisa, kode perusahaan untuk nomor SO. TIDAK ADA satu pun kode di src/ atau app/ yang menulisnya. Halaman Perusahaan hanya bisa mengubah NAMA dan JENIS INDUSTRI.',
  'Seluruh perhitungan biaya SDM, HPP, dan margin membaca setelan ini. Tenant kedua yang mendaftar lewat layar akan punya perusahaan tanpa satu pun setelan — dan tidak ada layar untuk mengisinya. Angkanya tidak akan salah; ia tidak akan ada.',
  'mendesak', array['master-data','layar-hilang','biaya'], 'Claude Code + Pemilik Produk', 'menunggu', 'temuan_claude',
  E'DIPERIKSA 25 Agu 2026 lewat penyisiran seluruh src/ dan app/ untuk kata company_settings:\n' ||
  E'  - MEMBACA  : 6+ berkas server (getMarginWatch, recordLaborLog, getMonthlyOperatingProfit,\n' ||
  E'               processCustomerPurchaseOrder, getPlanningFeasibility, attendanceCalendarConfig)\n' ||
  E'  - MENULIS  : NOL. Tidak ada insert, upsert, maupun update di mana pun.\n\n' ||
  E'ASALNYA: scripts/seed-realcase-itm.js. Bukan migrasi -- jadi bahkan membangun ulang skema dari\n' ||
  E'nol pun TIDAK menghasilkan setelan ini.\n\n' ||
  E'KENAPA TIDAK PERNAH TERASA: PT ITM sudah punya ketujuh belasnya sejak skrip dijalankan. Ia baru\n' ||
  E'terasa pada perusahaan yang benar-benar baru.'
) on conflict (company_id, task_code) do nothing;

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'MST-25', 'Sensus: Mana yang Bisa dan Tidak Bisa Dikerjakan Lewat Layar', 'MST', 'Master Data',
  'Sensus 24 langkah mendirikan perusahaan dari nol sampai pengiriman, memeriksa endpoint mana yang menyediakan POST dan mana yang hanya GET.',
  'Menentukan apakah sistem ini benar-benar bisa dipakai tenant kedua, atau hanya bisa dipakai tenant yang datanya ditanam orang dalam lewat migrasi dan skrip.',
  'bisa_menunggu', array['sensus','multi-tenant'], 'Claude Code', 'selesai', 'temuan_claude',
  E'HASIL: dari 24 langkah, 19 BISA lewat layar, 5 TIDAK BISA.\n\n' ||
  E'YANG TIDAK BISA SAMA SEKALI:\n' ||
  E'  4. Pabrik / lokasi produksi   -> /api/production-plants GET saja (MST-22)\n' ||
  E'  5. Shift                      -> tidak ada endpoint sama sekali\n' ||
  E'  6. Work center / mesin        -> /api/work-centers GET saja (MST-23)\n' ||
  E'  3. Setelan perusahaan (17)    -> nol jalur tulis (MST-24)\n' ||
  E'  9. Daftar pilihan tenant      -> nol jalur tulis di aplikasi; hanya disentuh 3 migrasi\n\n' ||
  E'YANG BISA, TAPI PERLU DICATAT BENTUKNYA:\n' ||
  E'  8. Jenis dokumen -> lewat tombol "seed" (menanam daftar bawaan), BUKAN pembuatan bebas.\n' ||
  E' 16. KPI          -> sama, lewat tombol seed.\n' ||
  E'  7. Departemen & peran -> 16 peran DITULIS TETAP di src/lib/roles.ts. Tidak ada layar, dan\n' ||
  E'     memang bukan data tenant -- ia bagian rancangan sistem. Bukan lubang, tapi berarti tenant\n' ||
  E'     tidak bisa punya struktur peran sendiri.\n' ||
  E' 14. Routing -> langkahnya dibuat MENYATU lewat POST /api/routings. routing-steps GET saja\n' ||
  E'     BUKAN lubang.\n\n' ||
  E'YANG BISA SEPENUHNYA: perusahaan baru (POST /api/register, sekaligus membuat admin pertama),\n' ||
  E'undangan pengguna, item, supplier, pelanggan, harga acuan, BOM, karyawan, PO klien + tiga\n' ||
  E'persetujuan + proses jadi SO, PO supplier, penerimaan barang, Work Order, batch produksi &\n' ||
  E'catatan tahap, surat jalan, POD, dan margin.\n\n' ||
  E'ARTINYA: rantai TRANSAKSI (langkah 17-24) utuh seluruhnya. Yang bolong justru PENYIAPAN AWAL --\n' ||
  E'bagian yang di PT ITM sudah telanjur terisi sejak awal sehingga ketiadaannya tidak pernah terasa.'
) on conflict (company_id, task_code) do nothing;

end $$;
