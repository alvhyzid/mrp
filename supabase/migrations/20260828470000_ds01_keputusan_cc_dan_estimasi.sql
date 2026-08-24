-- DS-01 (25 Agu 2026) — keputusan D-2/D-3/D-4/D-6 + sisa DS-0 + estimasi tiga pilot.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'=== KEPUTUSAN PEMILIK PRODUK 25 Agu 2026 (D-2, D-3, D-4, D-6) ===\n\n' ||
    E'D-2 TEMA: Gray 10 (abu sangat terang), BUKAN White. Alasan dicatat: "untuk ERP yang ' ||
    E'dipandangi berjam-jam, kontras yang lebih lembut lebih nyaman." Mode gelap masuk backlog, ' ||
    E'bukan v1.\n' ||
    E'  Nilai token g10 yang sudah diverifikasi dari paket @carbon/themes (bukan ingatan):\n' ||
    E'    background #f4f4f4 | layer01 #ffffff | textPrimary #161616 | textSecondary #525252\n' ||
    E'    borderSubtle01 #e0e0e0 | interactive #0f62fe | supportError #da1e28 | 235 token total\n\n' ||
    E'D-4 MODE LANTAI PRODUKSI: 48px (ukuran lg Carbon) sebagai dasar. INI BUKAN DEVIASI -- ia ' ||
    E'ukuran sah di dalam Carbon yang melewati target sentuh 44px.\n' ||
    E'  PEMICU PENINJAUAN: bila kelak diuji operator sungguhan dengan sarung tangan dan 48px ' ||
    E'terasa kurang, ukurannya ditinjau ulang -- dan SAAT ITU baru menjadi deviasi yang perlu ' ||
    E'didokumentasikan lewat format §42. JANGAN diperbesar sebelum ada bukti dari lapangan.\n\n' ||
    E'D-6 BAHASA UI: Indonesia penuh, istilah dari Kamus. Sudah berjalan; sekarang resmi jadi ' ||
    E'bagian standar desain.\n\n' ||
    E'D-3 TIGA LAYAR PILOT (bukan dua, atas permintaan pemilik produk -- tambahkan layar yang ' ||
    E'banyak form-nya):\n' ||
    E'  (a) MASTER ITEM        -- menguji MIGRASI layar lama. Terukur: 1.101 baris, 4 modal,\n' ||
    E'      18 Input, 20 Select, 3 DataTable, 27 state.\n' ||
    E'  (b) SETELAN PERUSAHAAN -- menguji KELAHIRAN layar baru. 0 baris (belum ada), ~17 field.\n' ||
    E'      Nol pekerjaan migrasi, sekaligus menutup MST-26.\n' ||
    E'  (c) BUAT PO KLIEN      -- menguji FORM KOMPLEKS. Terukur: 749 baris, 4 modal, 11 Input,\n' ||
    E'      25 Select, 23 state. Tiga hal sulit yang tidak ada di dua lainnya: field bersyarat,\n' ||
    E'      baris berulang, proses bertahap.\n\n' ||
    E'=== LINGKUP PILOT (c), sekaligus menutup koreksi pemilik produk (CC.6) ===\n' ||
    E'  a. Header modal konsisten: Konteks + Aksi ("PO Klien" + "Buat PO Baru"). Jadi STANDAR ' ||
    E'     seluruh header modal.\n' ||
    E'  b. Urutan field: Nama pelanggan -> Jenis pelanggan -> Alamat penagihan -> Alamat ' ||
    E'     pengiriman (dengan centang "sama dengan alamat penagihan") -> Termin pembayaran.\n' ||
    E'  c. Termin pembayaran empat pilihan: Cash in Advance, Down Payment + Pelunasan, ' ||
    E'     Pembayaran Bertahap, Custom (memunculkan kolom isian bebas).\n' ||
    E'  d. Modal bertahap (ProgressIndicator Carbon) DISETUJUI untuk layar ini.\n' ||
    E'     PEMBEDAAN YANG WAJIB DICATAT supaya tidak terbaca sebagai inkonsistensi: PMB-11 ' ||
    E'     (supplier) memakai konfirmasi sederhana karena membuat supplier BUKAN proses ' ||
    E'     bertahap; membuat PO klien MEMANG bertahap. Bentuk mengikuti sifat pekerjaannya, ' ||
    E'     bukan diseragamkan demi kelihatan seragam.\n\n' ||
    E'=== CC.6.e — "Kontak lainnya ini maksudnya apa?" TERJAWAB ===\n' ||
    E'  Field `contact_info`. Diperiksa: DISIMPAN dan DITAMPILKAN, nol dipakai perhitungan.\n' ||
    E'  YANG MENENTUKAN: tabel customers SUDAH punya kolom khusus pic_name, pic_phone, pic_email.\n' ||
    E'  Jadi contact_info adalah sisa field teks bebas dari SEBELUM ketiga kolom PIC itu ada --\n' ||
    E'  ia berduplikasi dengan mereka. Isinya di database: 0 terisi.\n' ||
    E'  GOLONGAN C -- SEMBUNYIKAN. Bukan golongan B (helper text): menjelaskan field yang sudah\n' ||
    E'  digantikan tiga field lain hanya menyembunyikan masalahnya di balik kalimat yang enak\n' ||
    E'  dibaca. Bukan pula seperti Nomor BPOM yang nol perhitungan TAPI catatan kepatuhan --\n' ||
    E'  contact_info tidak mencatat apa pun yang belum dicatat pic_*.\n' ||
    E'  Berlaku juga untuk SUPPLIER: PurchasingPage menampilkan "Kontak Lain" dengan field yang\n' ||
    E'  sama, dan suppliers juga sudah punya pic_name/pic_phone/pic_email.\n\n' ||
    E'=== ESTIMASI (CC.5) — dan kenapa angkanya kasar ===\n' ||
    E'  Fondasi Carbon (pasang, tema g10, UI Shell, lapisan token) : 1-2 sesi\n' ||
    E'  Pilot (b) Setelan Perusahaan, lahir baru                   : 1 sesi\n' ||
    E'  Pilot (a) Master Item, migrasi 1.101 baris                 : 2-3 sesi\n' ||
    E'  Pilot (c) PO Klien, 749 baris + 4 koreksi + modal bertahap : 2-3 sesi\n' ||
    E'  TOTAL kasar: 6-9 sesi.\n\n' ||
    E'  DASAR ANGKANYA: jumlah baris, modal, dan field yang DIHITUNG dari berkasnya, bukan\n' ||
    E'  perasaan. Yang membuatnya tetap kasar: belum ada satu pun layar kita yang pernah\n' ||
    E'  dipindahkan ke Carbon, jadi belum ada kecepatan sungguhan untuk dijadikan patokan.\n' ||
    E'  Estimasi ini akan JAUH lebih dapat dipercaya setelah pilot pertama selesai.\n\n' ||
    E'  USULAN BILA TERLALU PANJANG (keputusan pemilik produk, JANGAN diputuskan sendiri):\n' ||
    E'  kerjakan (b) + (a) lebih dulu -- (b) memberi kemenangan cepat dan menutup MST-26 yang\n' ||
    E'  mendesak, (a) membuktikan migrasi layar padat. Lalu (c) menyusul di sesi berikutnya,\n' ||
    E'  DENGAN keuntungan: kecepatan sungguhan sudah terukur, dan CustomerProduct (CC.7) mungkin\n' ||
    E'  sudah beres sehingga (c) tidak perlu disentuh dua kali.\n\n' ||
    E'=== CC.7 — KAITAN YANG BUKAN PEKERJAAN CARBON, JANGAN DIKERJAKAN DI DS-1 ===\n' ||
    E'  Baris item di PO Klien sekarang menampilkan daftar item dari GUDANG -- artinya sistem\n' ||
    E'  menawarkan BAHAN BAKU untuk dijual ke klien. Yang benar: produk yang kita jual.\n' ||
    E'  Ini menyentuh CustomerProduct (kode produk milik pelanggan) yang sudah jadi task aktif.\n' ||
    E'  DIKERJAKAN SETELAH DS-1. Pilot Carbon menguji BENTUK, bukan mengubah ARTI data.\n' ||
    E'  TAPI DICATAT TEGAS: bila pilot (c) dikerjakan tanpa memperbaiki ini, layar hasilnya akan\n' ||
    E'  RAPI TAPI MASIH MENAWARKAN BARANG YANG SALAH.\n\n' ||
    E'=== SISA DS-0 SELESAI ===\n' ||
    E'  Nomor 1 (inventaris stack) : selesai. 38 halaman, 12 komponen bersama, 18.992 baris TSX,\n' ||
    E'    Radix + Tailwind 3.4 + lucide, dan IBM Plex Sans SUDAH terpasang lewat next/font.\n' ||
    E'  Nomor 3 (Design Debt Register) : docs/governance/design-debt.md\n' ||
    E'  Nomor 4 (pemetaan kanonik)     : docs/governance/pemetaan-komponen-carbon.md\n' ||
    E'  Nomor 5 (estimasi)             : di atas.'
where task_code = 'DS-01';

end $$;
