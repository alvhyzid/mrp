-- Pencatatan murni (TIDAK ADA pekerjaan kode di migrasi ini):
-- 1) 3 task baru soal Master Pelanggan (cabut form tambah client dari modal
--    PO, riwayat order & performa pelanggan, QA-02 database sekali pakai);
-- 2) lengkapi AUD-06 (Tata Letak Modal) dengan aturan ukuran komponen (medium
--    40px, konsisten lintas komponen, satu sumber ukuran) + aturan placeholder
--    tidak boleh memuat instruksi penting.

-- II.1 (22 Agu 2026) -- ditambal pola aman: cari company_id lewat nama,
-- no-op kalau company belum ada (rebuild dari nol), sama seperti migrasi
-- build_tasks yang lebih tua (20260827340000 dst). Sebelumnya company_id
-- ditulis literal `1` tanpa pengaman -- akar penyebab CI merah, lihat
-- migrasi 20260827605000/HANDOFF.md.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- seed build_tasks (migrasi ini) dilewati (no-op).';
    return;
  end if;

insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes)
values
(
  v_company_id, 'PMB-08', 'Cabut Form Tambah Client dari Modal Buat PO', 'PMB', 'Pembelian',
  'Modal "Buat PO client baru" saat ini memuat form mini untuk membuat client baru dengan hanya 3 isian: nama client, perusahaan, kontak.',
  'Data pelanggan yang lengkap butuh alamat penagihan, NPWP, termin pembayaran, PIC (nama/telepon/email), dan alamat tujuan kirim. Pelanggan yang lahir dari form mini ini akan selamanya kekurangan semuanya, dan tidak ada yang akan kembali melengkapinya. Dalam setahun, separuh master pelanggan berisi data setengah jadi — baru ketahuan saat PO atau surat jalan dicetak tanpa NPWP. Ini kelas masalah yang sama dengan yang sudah ditolak pada supplier: membuat master data sebagai EFEK SAMPING dari mengerjakan hal lain. Master data lahir HANYA dari tindakan sadar di halamannya sendiri.',
  'mendesak', array['Visual','Fungsi'], 'Claude Code', 'menunggu', '/customer-purchase-orders', 'pemilik_produk',
  E'LINGKUP:\n'
  '- Cabut form mini (nama client / perusahaan / kontak / Simpan) dan tombol "+ Baru" dari modal Buat PO Client.\n'
  '- Ganti dengan tautan ke halaman Pelanggan (SUDAH ADA, hasil Alur 1 — JANGAN bangun baru). Bunyi kira-kira: "Client belum ada? Tambahkan di halaman Pelanggan".\n'
  '- Di modal PO, client HANYA dipilih dari daftar, tidak bisa diketik bebas. Client yang diarsipkan tidak muncul di pilihan.\n'
  '- HAK AKSES MASTER PELANGGAN (keputusan pemilik produk): yang boleh MEMBUAT, MENGUBAH, dan MENGARSIPKAN pelanggan hanya Direktur, General Manager, dan Finance. Ditegakkan di SERVER/RLS, bukan dengan menyembunyikan tombol. Peran lain tetap bisa MELIHAT daftar dan MEMILIH saat membuat PO. Alasan: master pelanggan menyangkut NPWP dan termin pembayaran — komitmen keuangan perusahaan.\n'
  '- Bila peran yang TIDAK berwenang membuka halaman Pelanggan: tombol tambah tidak muncul DAN ada keterangan jelas siapa yang harus dihubungi ("Hanya Direktur, General Manager, atau Finance yang dapat menambahkan pelanggan"). Tanpa keterangan itu, admin penjualan akan mengira sistemnya rusak, bukan mengira dirinya tidak berwenang — dan itu berakhir dengan meminjam akun orang lain.\n'
  '- PERIKSA POLA YANG SAMA DI TEMPAT LAIN sebelum mengerjakan apa pun: adakah modal/form lain yang membuat master data sebagai jalan pintas (supplier di modal PO Supplier, item di modal BOM/Routing, karyawan di modal mana pun)? Laporkan temuannya. JANGAN langsung cabut semua — sebagian mungkin punya alasan. Cabut hanya yang polanya sama dengan kasus ini.\n\n'
  'KEPUTUSAN FINAL (catat supaya tidak dibuka ulang): alur pengajuan+persetujuan pelanggan baru TIDAK dibangun. Pemilik produk menyatakan klien benar-benar baru hanya beberapa kali setahun, jadi alur itu akan dipakai 3-4 kali per tahun — tidak sebanding dengan pekerjaannya, dan alur yang jarang dipakai cenderung salah karena tidak pernah teruji. PEMICU PENINJAUAN ULANG (bukan task baru): bila klien baru menjadi lebih sering dari sekali sebulan, rancangan pengajuan+persetujuan ditinjau ulang.\n\n'
  'BUKTI:\n'
  '(a) modal Buat PO Client tidak lagi punya jalur membuat client;\n'
  '(b) kirim permintaan pembuatan client lewat endpoint PO langsung -> ditolak server, bukan sekadar tombol dihilangkan;\n'
  '(c) peran tanpa wewenang mencoba membuat pelanggan lewat API -> ditolak server;\n'
  '(d) client yang diarsipkan tidak muncul di pilihan modal PO.',
  E'PEMETAAN PERAN BELUM PASTI — JANGAN DITEBAK SAAT MENGERJAKAN. Sistem punya 16 peran (lihat src/lib/roles.ts), TIDAK ADA yang bernama persis "Direktur". Peran yang ada: company_admin (label "Admin Perusahaan"), general_manager, admin_staff, production_manager, production_staff, ppic_manager, ppic_staff, finance_manager, finance_staff, purchasing_manager, purchasing_staff, warehouse_manager, warehouse_staff, hr_manager, hr_staff, viewer.\n'
  'Usulan pemetaan (BELUM disetujui pemilik produk, konsisten dengan konstanta FINANCIAL_DATA_ROLES yang sudah ada di roles.ts): "Direktur" -> company_admin, "General Manager" -> general_manager (sudah persis ada), "Finance" -> finance_manager SAJA (finance_staff TIDAK termasuk, mengikuti pola FINANCIAL_DATA_ROLES yang sudah membedakan manager vs staff finance). Perlu konfirmasi pemilik produk sebelum dikerjakan.'
),
(
  v_company_id, 'PMB-09', 'Halaman Pelanggan: Riwayat Order & Performa', 'PMB', 'Pembelian',
  'Halaman Pelanggan sekarang baru berisi data mitra (identitas, alamat, PIC, dll). Belum ada riwayat order per pelanggan, harga terakhir per produk, atau ringkasan performa.',
  'Ini pintu masuk alami untuk fitur "Duplikat sebagai order baru" (sudah tercatat sebagai PJL-05) — keluhan harian pemilik produk soal mengetik ulang produk tiap repeat order. Tanpa riwayat order yang menggantung di satu pelanggan, tidak ada yang bisa diduplikat.',
  'bisa_menunggu', array['Visual','Fungsi'], 'Claude Code', 'menunggu', '/customers', 'pemilik_produk',
  E'LINGKUP: tambahkan ke halaman Pelanggan riwayat order per pelanggan, harga terakhir per produk, dan ringkasan performa (frekuensi order, nilai).\n'
  'BATAS: field performa yang datanya belum ada (mis. ketepatan bayar) JANGAN dikarang — tampilkan hanya yang datanya benar-benar ada.\n'
  'TERKAIT: pintu masuk untuk PJL-05 (Cegah Duplikat Order) — kerjakan/rancang dengan mempertimbangkan kebutuhan PJL-05 di kemudian hari.',
  null
),
(
  v_company_id, 'QA-02', 'Database Sekali Pakai untuk Test', 'AUD', 'Audit Kualitas',
  'Alih-alih membersihkan data uji setelah test selesai, buat database kosong dari migrasi, jalankan test, lalu buang seluruhnya. Tidak ada yang perlu dibersihkan karena tidak ada yang tersisa.',
  'Menghapus SELURUH kelas masalah sisa data uji — empat kejadian dalam beberapa hari (7 perusahaan bekas test, sisa saat suite dijalankan 2x, fixture PMB-07a, fixture PMB-07b). Juga menghapus risiko test menyentuh data nyata, karena databasenya memang bukan yang itu. Modal yang sudah ada: rebuild-from-migrations sudah terbukti jalan di CI tiap push. Yang kurang tinggal menyambungkannya ke test lokal.',
  'bisa_menunggu', array['Integrasi','Data'], 'Claude Code', 'ditunda_sadar', null, 'pemilik_produk',
  'LINGKUP: database test dibuat kosong dari migrasi (rebuild-from-migrations — mekanisme yang sama yang sudah terbukti jalan di CI tiap push), test dijalankan di atasnya, lalu database itu dibuang seluruhnya setelah selesai. Tidak ada langkah pembersihan manual/otomatis sama sekali karena tidak ada yang tersisa untuk dibersihkan. Yang perlu disambungkan: mekanisme rebuild-from-migrations CI ke alur test lokal.',
  E'"aman paralel" (Integrasi/Data, BUKAN Visual/Teks-Bahasa) DITETAPKAN EKSPLISIT oleh pemilik produk di pesan pencatatan task ini — sengaja dicatat di sini karena penanda otomatis berbasis tag TIDAK akan menyimpulkan ini sendiri (pola sama dengan catatan INF-01/INF-02 22 Agu 2026).\n'
  'KLARIFIKASI biaya waktu QA-01 (dicatat supaya tidak disalahpahami sebagai "pembersihan sisa data test butuh 2 hari"): pemilik produk menyampaikan penanganan sisa data uji terasa memakan ~2 hari. Sebagian besar waktu itu sebenarnya untuk MENYELIDIKI TIGA ANOMALI DATA (baris KPI hilang, baseline lahir sendiri, angka berubah tanpa pelaku), bukan pembersihan itu sendiri. Penyebab penyelidikan berlarut adalah TIDAK ADANYA AUDIT TRAIL — itu sebabnya AUD-07 sudah dinaikkan Mendesak.'
);

end $$;

update public.build_tasks
set ditunda_pemicu = 'PEMICU (jangan dibangun sebelum ini terjadi): bila dalam dua minggu ke depan masih ada SATU kejadian lagi soal sisa data uji. Alasan: perbaikan QA-01 mungkin sudah cukup; membangun ini butuh setengah sampai satu hari dan belum tentu impas bila masalahnya sudah mati.'
where task_code = 'QA-02';

update public.build_tasks
set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nLENGKAPI 22 Agu 2026 — aturan ukuran & placeholder (Y.1-Y.5):\n\n'
  'Y.1 UKURAN KOMPONEN FORM DI MODAL: seluruh komponen form dalam modal memakai ukuran MEDIUM (40px / 2.5rem) — keputusan pemilik produk, sejalan dengan Carbon Design System ("when in doubt, use the medium size", https://carbondesignsystem.com/components/text-input/usage/).\n\n'
  'Y.2 KONSISTEN LINTAS KOMPONEN, bukan hanya text input. Berlaku untuk: text input, dropdown/select, date picker, number input, dan tombol di dalam modal yang sama — tinggi field harus konsisten saat dipasangkan bersama (Carbon). Text input 40px berdampingan dengan dropdown 32px membuat form terlihat rusak justru karena setengah diperbaiki. ARKEOLOGI DULU: laporkan ukuran yang dipakai tiap komponen form hari ini — apakah sudah seragam, atau campur. Jangan asumsikan.\n\n'
  'Y.3 SATU SUMBER UKURAN, bukan disebar per komponen. Tetapkan di satu tempat (konstanta/varian komponen bersama) supaya modal berikutnya otomatis benar tanpa perlu diingat. Kalau ditulis ulang per modal, dalam dua bulan akan ada tiga ukuran berbeda di tiga modal.\n\n'
  'Y.4 PLACEHOLDER TIDAK BOLEH MEMUAT INFORMASI PENTING. Carbon menyatakan placeholder bukan pengganti label dan tidak boleh memuat informasi krusial, karena hilang begitu pengguna mulai mengetik. Kasus nyata dilaporkan pemilik produk di modal "Buat Routing baru": placeholder "kosongkan ka..." (terpotong) berisi INSTRUKSI — dan instruksi itu lenyap tepat saat pengguna mulai mengisi. Perbaikan: pindahkan seluruh instruksi semacam itu ke helper text di bawah field. Placeholder hanya boleh berisi CONTOH isian singkat, dan hanya bila benar-benar perlu. Sapu seluruh modal: laporkan berapa placeholder yang memuat instruksi, pindahkan semuanya ke helper text.\n\n'
  'Y.5 BERLAKU SURUT ke seluruh modal yang sudah ada — termasuk modal Supplier & Pelanggan hasil Alur 1 dan modal Buat Routing. Satu cetakan, seluruh sistem.\n\n'
  'BUKTI TAMBAHAN:\n'
  '(e) ukur tinggi nyata seluruh komponen form di minimal 5 modal -> buktikan semuanya 40px;\n'
  '(f) buktikan tidak ada placeholder tersisa yang memuat instruksi — sebutkan yang dipindahkan ke helper text, satu per satu.'
where task_code = 'AUD-06';
