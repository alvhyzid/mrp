-- FF.1/FF.2/FF.4/FF.5 — RSP-02 berubah bentuk, temuan modal Carbon, pertanyaan GDG-09.

-- RSP-02: dari DAFTAR PERBAIKAN jadi PENGAWAS.
update build_tasks
set name = 'Pengawas: overflow-hidden pada Wadah Tabel (Konfirmasi POD Didahulukan)',
    urgency = 'mendesak',
    detail_pekerjaan =
      E'BERUBAH BENTUK atas keputusan pemilik produk (24 Agu 2026): dari daftar perbaikan 8 halaman ' ||
      E'menjadi PENGAWAS OTOMATIS.\n\n' ||
      E'ALASANNYA TAJAM DAN PERLU DIINGAT: aturan "periksa contoh sekelas di berkas yang sama" ditulis ' ||
      E'di CLAUDE.md dan DILANGGAR HARI YANG SAMA oleh yang menulisnya. Aturan yang bergantung pada ' ||
      E'seseorang mengingatnya akan gagal — orang yang sedang fokus memperbaiki satu hal memang tidak ' ||
      E'melihat ke samping.\n\n' ||
      E'YANG DIBANGUN: pengawas yang GAGAL KERAS bila ada `overflow-hidden` pada wadah tabel di berkas ' ||
      E'mana pun, dengan DAFTAR PENGECUALIAN EKSPLISIT beserta alasan — sehingga menambah pengecualian ' ||
      E'adalah tindakan sadar, bukan jalan pintas. Pola ini sudah terbukti pada pengawas REVOKE, ' ||
      E'company_id hardcode, dan kebocoran istilah teknis. PAKAI POLANYA, jangan bangun dari nol. ' ||
      E'BUKTIKAN BISA MERAH.\n\n' ||
      E'Dengan pengawas ini, 8 halaman itu tertangkap otomatis DAN halaman ke-15 yang lahir bulan depan ' ||
      E'juga tertangkap.\n\n' ||
      E'URUTAN PERBAIKAN — KONFIRMASI POD DIDAHULUKAN. Alasan: satu-satunya layar yang dilihat PIHAK ' ||
      E'LUAR, dibuka kurir lewat QR yang SUDAH TERCETAK, dan layar sempit adalah kondisi NORMALNYA. ' ||
      E'Kolom yang terpotong di situ berarti kurir tidak bisa memastikan apa yang ia tanda tangani. ' ||
      E'Tujuh sisanya menyusul, boleh bertahap: SalesOrdersPage (3 tempat), WorkOrdersPage, BomsPage, ' ||
      E'RoutingsPage, ShipmentsPage, CustomerPurchaseOrdersPage, ProductionDashboardPage.',
    notes = coalesce(notes,'') || E'\n\n24 Agu 2026 — diubah jadi pengawas atas keputusan pemilik produk. Pelajarannya dicatat di HANDOFF: "aturan di CLAUDE.md TIDAK CUKUP untuk kelas cacat yang bisa disapu mesin".'
where task_code = 'RSP-02' and company_id = 1;

-- FF.5 — pertanyaan tambahan pada GDG-09.
update build_tasks
set detail_pekerjaan = detail_pekerjaan || E'\n\n' ||
      E'PERTANYAAN TAMBAHAN (24 Agu 2026): bila lot DITUTUP SENGAJA lalu stok opname menemukan ' ||
      E'barangnya masih ada — apa yang terjadi? Lot dibuka kembali, atau dibuat lot BARU?\n' ||
      E'Ini menentukan apakah "ditutup" berarti FINAL. Bila lot bisa dibuka kembali, penutupan hanyalah ' ||
      E'penyaringan tampilan dengan nama lain. Bila tidak bisa, barang yang ditemukan harus masuk ' ||
      E'sebagai lot baru — dan telusurnya ke penerimaan asli perlu dijaga agar tidak putus.'
where task_code = 'GDG-09' and company_id = 1;

-- FF.4 — temuan baru: cetakan modal Carbon baru dipakai 1 dari 13 berkas.
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, 'AUD-25',
  'Cetakan Modal Carbon Baru Dipakai 1 dari 13 Berkas — Utang Bentuk, Bukan Cacat',
  'AUD', 'Audit & Proses',
  'PMB-11 membangun cetakan modal Carbon (header berlabel, badan menggulir, footer lebar penuh, layar penuh di HP) sebagai kelas bersama. Sampai 24 Agu 2026, baru SATU berkas memakainya — modal Supplier itu sendiri.',
  'Dua belas berkas bermodal lain masih memakai bentuk lama. Pengguna menemui dua gaya modal yang berbeda di aplikasi yang sama, dan cetakan yang dibuat sebagai patokan belum jadi patokan.',
  'bisa_menunggu',
  array['Visual','ui']::text[],
  'Claude Code',
  'menunggu',
  'temuan_claude',
  E'BERKAS YANG BELUM (diperiksa 24 Agu 2026): DocumentsPage, HrDashboardPage, ' ||
  E'CustomerPurchaseOrdersPage, ItemsPage, ShipmentsPage, BomsPage, RoutingsPage, CustomersPage, ' ||
  E'WorkOrdersPage, PpicDashboardPage, TeamManagePage, ProductionDashboardPage.\n\n' ||
  E'KENAPA INI BUKAN PENGAWAS YANG GAGAL KERAS, dan ini pembeda penting dari RSP-02: modal lama ' ||
  E'TIDAK RUSAK, hanya belum mengikuti cetakan. RSP-02 menjaga cacat yang MENYEMBUNYIKAN DATA ' ||
  E'(kolom terpotong tanpa cara melihatnya); yang ini utang bentuk. Pengawas yang gagal keras akan ' ||
  E'memerahkan CI berminggu-minggu tanpa ada yang rusak — dan CI yang merah terus akan diabaikan, ' ||
  E'yang justru melemahkan seluruh pengawas lain.\n\n' ||
  E'USULAN: PENGHITUNG, bukan penghenti. Laporkan "N dari 13 berkas sudah memakai cetakan Carbon" ' ||
  E'tiap run, supaya angkanya terlihat bergerak dan tidak terlupakan, tanpa menghentikan siapa pun.\n\n' ||
  E'MIGRASINYA MEMANG SENGAJA BERTAHAP — lihat aturan di CLAUDE.md: memindahkan padding jadi bawaan ' ||
  E'komponen akan membuat SELURUH modal lama berpadding dobel sekaligus.',
  'Ditemukan lewat sapuan FF.4: "perbaikan mana lagi yang dilakukan di KOMPONEN BERSAMA, padahal ada tempat yang tidak memakai komponen itu?"'
where not exists (select 1 from build_tasks where task_code = 'AUD-25' and company_id = 1);
