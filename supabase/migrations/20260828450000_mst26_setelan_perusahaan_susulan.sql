-- SUSULAN: task setelan perusahaan (25 Agu 2026).
--
-- KENAPA MIGRASI TERPISAH. Percobaan pertama memakai kode MST-24 — yang ternyata SUDAH
-- DIPAKAI task lain ("Jenis Dokumen Lainnya lewat PLT-05"), dan `on conflict do nothing`
-- menelan penyisipannya TANPA SUARA. Migrasi hijau, task tidak ada.
--
-- Ini kejadian KEDUA dari bentuk yang sama dalam dua hari (yang pertama: AUD-29). Yang
-- menangkapnya bukan migrasi melainkan pemeriksaan hasil sesudahnya. Aturannya sudah
-- dicatat dan terbukti berguna: sesudah menambah task lewat migrasi, PERIKSA barisnya
-- benar-benar ada — jangan berhenti di "migrasi berhasil".
--
-- Pelajaran tambahan yang lahir hari ini: PERIKSA KODE KOSONG LEBIH DULU. Menebak kode
-- berikutnya dari ingatan adalah cara paling murah untuk bertabrakan.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'MST-26', 'Setelan Perusahaan Tidak Punya Satu Pun Jalur Tulis di Aplikasi', 'MST', 'Master Data',
  'Tabel company_settings berisi 17 setelan PT ITM — periode gajian, jam kerja standar per hari & Sabtu, hari kerja per bulan, jam standar per bulan, empat tarif BPJS pemberi kerja, batas atas & bawah dasar BPJS, metode biaya tenaga kerja, dasar pembebanan overhead, baseline overhead bulanan, mata uang, penilaian sisa, dan kode perusahaan untuk nomor SO. TIDAK ADA satu pun kode di src/ atau app/ yang menulisnya. Halaman Perusahaan hanya bisa mengubah NAMA dan JENIS INDUSTRI.',
  'Seluruh perhitungan biaya SDM, HPP, dan margin membaca setelan ini. Perusahaan baru yang mendaftar lewat layar akan berdiri tanpa satu pun setelan, dan tidak ada layar untuk mengisinya. Angkanya tidak akan salah — ia tidak akan ada.',
  'mendesak', array['master-data','layar-hilang','biaya','multi-tenant'], 'Claude Code + Pemilik Produk', 'menunggu', 'temuan_claude',
  E'DIPERIKSA 25 Agu 2026 lewat penyisiran seluruh src/ dan app/ untuk kata company_settings:\n' ||
  E'  MEMBACA : 6+ berkas server (getMarginWatch, recordLaborLog, getMonthlyOperatingProfit,\n' ||
  E'            processCustomerPurchaseOrder, getPlanningFeasibility, attendanceCalendarConfig)\n' ||
  E'  MENULIS : NOL. Tidak ada insert, upsert, maupun update di mana pun.\n\n' ||
  E'ASALNYA scripts/seed-realcase-itm.js — BUKAN migrasi. Konsekuensinya lebih tajam dari yang\n' ||
  E'terlihat: membangun ulang skema dari nol pun TIDAK menghasilkan setelan ini, jadi ia tidak\n' ||
  E'akan muncul di CI maupun di project baru mana pun.\n\n' ||
  E'KENAPA TIDAK PERNAH TERASA: PT ITM sudah punya ketujuh belasnya sejak skrip itu dijalankan.\n' ||
  E'Kelas cacat ini hanya kelihatan dari perusahaan yang benar-benar baru — dan sampai hari ini\n' ||
  E'belum pernah ada.\n\n' ||
  E'KAITAN DENGAN ATURAN BARU (CLAUDE.md 25 Agu 2026): ini contoh langsung dari "modul belum\n' ||
  E'selesai bila datanya hanya bisa lahir dari migrasi atau skrip". Perhitungan biaya SDM sudah\n' ||
  E'benar dan teruji, tapi tenant kedua tidak punya cara menyalakannya.'
) on conflict (company_id, task_code) do nothing;

end $$;
