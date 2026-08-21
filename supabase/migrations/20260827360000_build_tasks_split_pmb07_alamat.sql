-- Halaman Daftar Tugas Pembangunan -- koreksi pemilik produk 22 Agu 2026:
-- PMB-07 (H.3, "Pembekuan Identitas Mitra di Dokumen Lain") KELIRU menyamakan
-- alamat IDENTITAS mitra dengan alamat TUJUAN KIRIM. Klien sering minta kirim
-- ke alamat berbeda-beda (distributor mereka) -- memaksa alamat PO berubah
-- tiap kali permintaan kirim berbeda adalah rancangan salah. PMB-07 DIBATALKAN
-- (bukan dihapus -- riwayat tetap ada) dan dipecah jadi 3 task baru dengan
-- lingkup yang benar. Pertanyaan terbuka soal pemecahan pengiriman (PMB-07b)
-- SUDAH DIJAWAB pemilik produk pada pesan susulan yang sama -- dicatat
-- langsung dalam bentuk final, tanpa status "pertanyaan terbuka" sementara.
do $$
declare
  v_company_id integer;
  v_pmb07_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi pemecahan PMB-07 dilewati (no-op).';
    return;
  end if;

  select build_task_id into v_pmb07_id from build_tasks where company_id = v_company_id and task_code = 'PMB-07';
  if v_pmb07_id is not null then
    update build_tasks
    set status = 'dibatalkan',
        notes = coalesce(notes || ' ', '') || 'DIBATALKAN 22 Agu 2026 -- rancangan asal KELIRU menyamakan alamat identitas mitra dengan alamat tujuan kirim (koreksi pemilik produk: klien sering kirim ke alamat berbeda-beda/distributor, alamat PO tidak boleh dipaksa ikut berubah). Dipecah jadi PMB-07a (identitas dokumen terbit), PMB-07b (alamat tujuan kirim sebagai daftar), PMB-07c (gudang penerima PO Supplier). Riwayat ini TIDAK ditimpa.'
    where build_task_id = v_pmb07_id;
  else
    raise notice 'PMB-07 tidak ditemukan -- lewati pembatalan (kemungkinan belum di-seed).';
  end if;

  -- PMB-07a -- Pembekuan Identitas Mitra di Dokumen Terbit
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'PMB-07a', 'Pembekuan Identitas Mitra di Dokumen Terbit (nama, alamat resmi, NPWP)',
    'PMB', 'Pembelian',
    'Membekukan identitas mitra (nama, alamat resmi badan usaha, NPWP) yang tercetak di dokumen terbit -- PO Supplier, PO Klien, dan Sales Order -- mengikuti pola snapshot yang sudah terbukti di Surat Jalan (Alur 1).',
    'Tanpa ini, dokumen yang sudah terbit ke pihak luar (PO Supplier/Klien, SO) masih ikut berubah kalau data master mitra diedit belakangan -- sama kelas masalah yang sudah diperbaiki di Surat Jalan.',
    'mendesak', ARRAY['Database','Fungsi']::text[], 'Claude Code', 'menunggu', null, 'temuan_claude',
    'PECAH dari PMB-07 (dibatalkan 22 Agu 2026) atas koreksi pemilik produk: identitas (nama/alamat resmi badan usaha/NPWP) dipisahkan dari alamat tujuan kirim (PMB-07b) karena sifat berubahnya beda -- identitas jarang berubah, alamat tujuan kirim sering beda per pengiriman. LINGKUP KHUSUS identitas: bekukan nama+alamat resmi+NPWP mitra persis saat dokumen (PO Supplier/PO Klien/Sales Order) terbit -- pola SAMA PERSIS snapshot Surat Jalan Alur 1 (kolom snapshot ditambah di masing-masing tabel dokumen, diisi saat baris dibuat, pembacaan dokumen mengutamakan snapshot dengan fallback ke join hidup untuk dokumen lama bersnapshot NULL). Cek 3 dokumen: PO Supplier, PO Klien, Sales Order.',
    'Aman dikerjakan paralel (tidak bertag Visual/Teks-Bahasa).'
  )
  on conflict (company_id, task_code) do nothing;

  -- PMB-07b -- Alamat Tujuan Kirim sebagai Daftar (bukan satu kolom)
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'PMB-07b', 'Alamat Tujuan Kirim Pelanggan sebagai Daftar, Bukan Satu Kolom',
    'PMB', 'Pembelian',
    'Pelanggan bisa punya BANYAK alamat tujuan kirim tersimpan (mis. distributor Surabaya, distributor Makassar, gudang pusat) -- dipilih satu per satu saat membuat pengiriman, bukan diwarisi otomatis dari satu alamat tetap di master pelanggan.',
    'Tanpa ini, sistem memaksa satu alamat tetap per pelanggan padahal klien sering minta kirim ke alamat berbeda-beda (distributor mereka) -- rancangan lama salah, seolah alamat PO harus ikut berubah tiap kali permintaan kirim berbeda.',
    'mendesak', ARRAY['Database','Fungsi']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
    E'PECAH dari PMB-07 (dibatalkan 22 Agu 2026). Aman dikerjakan paralel HANYA untuk lapisan data & server -- layarnya (UI pemilihan alamat) MENUNGGU cetakan UX dari koreksi pemilik produk di Alur 1, jangan dibangun duluan.\n\nLINGKUP INTI:\n- Satu pelanggan boleh punya BANYAK alamat tujuan kirim tersimpan, masing-masing dengan nama panggilan, alamat, PIC, dan telepon penerima.\n- Saat membuat pengiriman, alamat tujuan DIPILIH dari daftar itu -- atau diketik sebagai alamat sekali pakai untuk kasus tidak berulang.\n- Alamat tujuan TIDAK diwarisi otomatis dari master pelanggan dan TIDAK dianggap tetap -- ia milik pengiriman, bukan milik pelanggan.\n- Surat jalan membekukan alamat tujuan YANG DIPILIH saat itu (pola sama snapshot Alur 1). Bila alamat tersimpan itu kemudian diubah, surat jalan lama TIDAK ikut berubah.\n- Alamat kirim yang sudah dipakai pengiriman tidak boleh dihapus permanen -- diarsipkan, mengikuti pola hapus/arsip yang sudah ada (Routing/Supplier/Customer).\n- Prinsip: alamat yang sering dipakai diketik SEKALI lalu dipilih berulang -- tidak ada pengetikan ulang tiap PO.\n\nPERTANYAAN TERBUKA SUDAH DIJAWAB pemilik produk 22 Agu 2026: bila satu pesanan dipecah ke beberapa tujuan (mis. 1.000 box Surabaya + 1.500 box Makassar) -> itu DUA (atau lebih) PENGIRIMAN TERPISAH, masing-masing dengan surat jalan, tanda tangan penerima, dan QR bukti terima SENDIRI -- BUKAN satu surat jalan dengan dua alamat. Keputusan ini mengikuti rekomendasi arsitek (bukti penerimaan lebih jelas: satu tanda tangan = satu pengiriman = satu bukti sampai) dan selaras dengan sistem yang ada (1 Sales Order sudah bisa >1 pengiriman).\n\nLINGKUP TAMBAHAN (b.1-b.5):\nb.1 -- Satu Sales Order boleh punya beberapa pengiriman, masing-masing ke alamat tujuan yang BERBEDA dan dipilih sendiri-sendiri.\nb.2 -- ARKEOLOGI DULU, LAPORKAN SEBELUM MEMBANGUN: baca kode blokir over-shipment yang SUDAH ADA sekarang -- apakah menghitung PER PENGIRIMAN atau KUMULATIF seluruh pengiriman dalam satu Sales Order Line? Tunjukkan kodenya persis, JANGAN simpulkan dari nama fungsi saja. Bila ternyata hanya per-pengiriman: PERBAIKI jadi kumulatif per baris Sales Order -- ini yang menahan pengiriman melebihi jumlah dipesan ketika satu pesanan dipecah ke banyak tujuan.\nb.3 -- Tampilkan sisa yang belum terkirim per baris Sales Order (dipesan, sudah terkirim, sisa). Ini juga PRASYARAT task PJL-03 ("Tombol Selesai/Batal Sales Order") -- pesanan hanya layak ditutup bila sisanya nol atau ditutup sadar dengan alasan.\nb.4 -- Tiap pengiriman menyimpan alamat tujuan yang dipilih SAAT ITU (beku). Mengubah alamat tersimpan di kemudian hari TIDAK mengubah surat jalan yang sudah terbit.\nb.5 -- Tiap pengiriman punya token POD sendiri. Pastikan tidak ada satu token dipakai dua pengiriman -- penerima Surabaya tidak boleh bisa membuka bukti terima milik Makassar.\n\nBUKTI WAJIB sebelum task ini dianggap selesai:\n(a) Pesanan 2.500 box dipecah: kirim 1.000 ke alamat A, lalu 1.500 ke alamat B -> buktikan sisa berubah 2.500->1.500->0, dan dua surat jalan terbit dengan alamat masing-masing yang benar.\n(b) Coba kirim 1.000 lagi setelah sisa nol -> HARUS DITOLAK, pesan menyebut jumlah yang sudah terkirim. Buktikan penolakan terjadi di server/database, bukan hanya tombol disembunyikan.\n(c) Ubah alamat tersimpan A setelah surat jalan A terbit -> buktikan surat jalan A TIDAK berubah, sementara pengiriman BARU ke alamat A memakai alamat baru.\n(d) Buka halaman POD milik pengiriman A memakai token pengiriman B -> HARUS ditolak.',
    'Status "pertanyaan terbuka" DIHAPUS 22 Agu 2026 -- sudah dijawab pemilik produk, boleh dibangun penuh (lapisan data & server; layar tetap menunggu cetakan UX).'
  )
  on conflict (company_id, task_code) do nothing;

  -- PMB-07c -- Gudang Penerima pada PO Supplier
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'PMB-07c', 'Gudang/Pabrik Penerima pada PO Supplier',
    'PMB', 'Pembelian',
    'PO Supplier harus menyebut gudang/pabrik MANA yang menerima barang (mis. KL Bizhub untuk lini serbuk, Ruko Dieng untuk gummy).',
    'Tanpa ini, sopir supplier menebak tujuan kirim dan barang bisa mendarat di pabrik yang salah.',
    'penting', ARRAY['Database','Fungsi']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
    'PECAH dari PMB-07 (dibatalkan 22 Agu 2026). BEDA dari PMB-07b: di sisi supplier TIDAK ADA persoalan multi-alamat, karena arah barang terbalik -- barang datang KE gudang kita, bukan ke alamat supplier. Alamat supplier di PO Supplier murni identitas (cakupan PMB-07a). Tambahkan kolom gudang/pabrik tujuan (referensi ke production_plants) di PO Supplier, WAJIB diisi saat PO dibuat, dicetak jelas di dokumen PO supaya sopir tidak menebak.',
    'Aman dikerjakan paralel (tidak bertag Visual/Teks-Bahasa).'
  )
  on conflict (company_id, task_code) do nothing;

end $$;
