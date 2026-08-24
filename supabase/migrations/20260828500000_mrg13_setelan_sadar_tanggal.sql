-- MRG-13 (25 Agu 2026) — susulan, karena MRG-12 ternyata sudah dipakai.
--
-- BENTROK KODE KETIGA KALINYA dalam dua hari (AUD-29, MST-24, kini MRG-12), dan ketiganya
-- ditelan `on conflict do nothing` tanpa suara. Ketiganya tertangkap hanya karena hasilnya
-- diperiksa sesudahnya.
--
-- Aturannya sudah dicatat dan terbukti berguna, tapi jelas belum cukup: PERIKSA KODE KOSONG
-- LEBIH DULU, sebelum menulis migrasinya. Menebak dari ingatan gagal tiga kali dari tiga
-- percobaan.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'MRG-13', 'Perhitungan Biaya Belum Membaca Setelan Sesuai Tanggal Transaksi', 'MRG', 'Margin & Biaya',
  'Jejak setelan perusahaan sekarang menyimpan tanggal berlaku setiap perubahan (MST-26). Tapi keenam pembaca setelan — margin, biaya tenaga kerja, laba operasional, kelayakan jadwal, kalender absensi, pemrosesan PO — masih membaca nilai YANG BERLAKU SEKARANG.',
  'Menaikkan tarif BPJS hari ini akan mengubah biaya batch BULAN LALU, karena perhitungannya memakai tarif terbaru untuk semua periode. Angka yang sudah dilaporkan berubah sendiri tanpa ada yang menyentuhnya.',
  'penting', array['biaya','tanggal-berlaku','margin'], 'Claude Code + Pemilik Produk', 'menunggu', 'temuan_claude',
  E'BAHANNYA SUDAH ADA, tinggal dipakai: company_settings_history menyimpan setting_key, ' ||
  E'new_value, dan effective_from, dengan indeks (company_id, setting_key, effective_from desc).\n\n' ||
  E'YANG PERLU DIBANGUN: satu fungsi pencari "nilai setelan X yang berlaku pada tanggal T", lalu ' ||
  E'keenam pembaca memakainya dengan tanggal transaksi yang relevan -- bukan hari ini.\n\n' ||
  E'YANG PERLU DIPUTUSKAN PEMILIK PRODUK, jangan ditebak: untuk batch yang biayanya sudah DIKUNCI ' ||
  E'final, apakah perubahan tarif berlaku surut sama sekali? CLAUDE.md sudah menetapkan biaya ' ||
  E'batch berjalan TIDAK DITIMPA perhitungan ulang -- aturan itu mungkin sudah menjawabnya, tapi ' ||
  E'perlu ditegaskan sebelum kode ditulis.\n\n' ||
  E'KAITAN: tanpa ini, tanggal berlaku di MST-26 tercatat rapi tapi tidak mengubah apa pun. Itu ' ||
  E'bentuk "terdaftar tapi tidak pernah hidup" yang sudah berkali-kali jadi cacat di proyek ini.'
) on conflict (company_id, task_code) do nothing;

-- CC.7 / DD.7 — kaitan dicatat di KEDUA task supaya tidak hilang di salah satunya.
update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'KAITAN DENGAN PILOT CARBON (DD.7, 25 Agu 2026): baris item di layar PO Klien sekarang ' ||
    E'menampilkan daftar item dari GUDANG — artinya sistem menawarkan BAHAN BAKU untuk dijual ke ' ||
    E'klien. Yang benar: produk yang kita jual.\n\n' ||
    E'Pilot Carbon (c) untuk layar PO Klien SENGAJA DITUNDA sampai ini beres. Alasannya tegas: ' ||
    E'"bila pilot (c) dikerjakan tanpa memperbaikinya, layar hasilnya akan RAPI TAPI MASIH ' ||
    E'MENAWARKAN BARANG YANG SALAH — kerapian yang menyesatkan."\n\n' ||
    E'Karena (c) ditunda, task ini punya waktu untuk dikerjakan lebih dulu.'
where task_code ilike '%customer%product%' or name ilike '%CustomerProduct%' or name ilike '%kode produk%pelanggan%';

end $$;
