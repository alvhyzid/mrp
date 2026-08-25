-- DS-05 (25 Agu 2026) — Master Item dimigrasikan ke Carbon.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  if not exists (select 1 from build_tasks where task_code = 'DS-05') then
    insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
      effect_description, urgency, status, origin, pic, detail_pekerjaan, notes,
      approval_location, approval_review_steps, approval_example_case, approval_if_approved, approval_if_rejected)
    values (v_company_id, 'DS-05',
      'Migrasi Carbon: Master Item',
      'DS', 'Design System',
      'Halaman Daftar Item dipindahkan ke komponen Carbon: DataTable, ComposedModal, Modal danger, FileUploader, Tag, Toggletip.',
      'Layar master paling sering disentuh, dan yang pertama memakai DataTable Carbon — cetakan untuk 12 layar data berikutnya.',
      'mendesak', 'menunggu_persetujuan', 'pemilik_produk', 'Claude Code',
      E'Sudah dikerjakan. Sisa: pemeriksaan pemilik produk.',
      E'=== YANG DIPAKAI DARI DataTable CARBON, dan yang TIDAK ===\n' ||
      E'DIPAKAI  : pengurutan, baris mekar, toolbar + pencarian, pembagian halaman, skeleton.\n' ||
      E'TIDAK    : pemilihan banyak baris + aksi massal -- SENGAJA. Satu-satunya aksi massal\n' ||
      E'           yang masuk akal di sini adalah menghapus, dan menghapus banyak item\n' ||
      E'           sekaligus justru yang paling ingin dihindari. MST-16 bahkan sudah\n' ||
      E'           mengeluarkan tombol hapus dari baris tabel karena terlalu mudah tertekan.\n\n' ||
      E'=== TAG DI SINI BENAR, KEBALIKAN DARI KESALAHAN PILOT PERTAMA ===\n' ||
      E'Tipe item (Bahan Baku/Kemasan/WIP/Barang Jadi) dan status aktif adalah PENGGOLONGAN:\n' ||
      E'jumlahnya tetap, tidak berubah saat orang mengetik, dan memang dipakai memilah daftar.\n' ||
      E'Di pilot pertama Tag dipakai untuk STATUS FIELD ("belum diisi") -- itu yang salah.\n' ||
      E'Uji pembedanya dicatat di rujukan-carbon.md: "apakah masuk akal MENYARING daftar\n' ||
      E'berdasarkan ini?" Ya -> Tag. Tidak -> status, dijawab kontrolnya sendiri.\n\n' ||
      E'=== MODAL: TRANSAKSIONAL, BUKAN BERTAHAP ===\n' ||
      E'19 field memang banyak, TAPI keputusannya SATU: simpan item. Modal bertahap dipakai\n' ||
      E'bila langkahnya berurutan dan saling bergantung -- di sini tidak; orang bisa mengisi\n' ||
      E'dari mana saja dan menyimpan kapan saja.\n\n' ||
      E'=== window.confirm DIGANTI MODAL DANGER ===\n' ||
      E'Dua di halaman ini. PENYISIRAN (permintaan 3.1b): masih ada ENAM di tempat lain --\n' ||
      E'  RoutingsPage (1), SalesOrdersPage (2), CustomersPage (1), PurchasingPage (2).\n' ||
      E'DILAPORKAN, TIDAK diperbaiki sekaligus: keenamnya ikut saat halamannya dimigrasikan,\n' ||
      E'supaya perubahannya bisa diperiksa bersama layarnya. Dicatat sebagai DS-06.\n\n' ||
      E'=== YANG SENGAJA TIDAK DISENTUH ===\n' ||
      E'MST-16 (Ubah/Tambah Pemasok/Hapus di dalam Detail) UTUH, termasuk hapus yang didorong\n' ||
      E'ke kanan menjauh dari Ubah.\n' ||
      E'MST-21 (Reorder Point & Reorder Qty) DIBIARKAN persis seperti sekarang -- tidak\n' ||
      E'disembunyikan, tidak diberi penjelasan baru, tidak diganti namanya.\n\n' ||
      E'=== DUA CACAT YANG DITEMUKAN SAAT MENGERJAKAN ===\n' ||
      E'1. TOMBOL DI DALAM TOMBOL. Tombol Asal-Usul di judul kolom "Biaya standar" berada di\n' ||
      E'   dalam TableHeader yang bisa diurut -- dan header yang bisa diurut ADALAH sebuah\n' ||
      E'   <button>. HTML tidak sah; peramban boleh merapikannya sesuka hati, dan tombol\n' ||
      E'   Asal-Usulnya bisa berhenti bisa ditekan tanpa ada yang tahu. Kolom itu sekarang\n' ||
      E'   tidak bisa diurut. Ditemukan dari galat hydration di konsol.\n' ||
      E'2. KARTU BERTUMPUK SALING MENINDIH di 360px. Versi pertama hanya mengubah <tr> dan\n' ||
      E'   <td> jadi block; selama <tbody> masih table-row-group, peramban tetap menatanya\n' ||
      E'   sebagai baris tabel. Yang menemukan bukan pengukuran -- "nol gulir menyamping"\n' ||
      E'   tetap HIJAU padahal barisnya tumpang tindih -- melainkan MELIHAT tangkapan layarnya.\n\n' ||
      E'=== DEVIASI RESMI: TABEL JADI KARTU DI LAYAR SEMPIT ===\n' ||
      E'Carbon menggulir menyamping; aturan proyek melarangnya di lebar mana pun. Di bawah\n' ||
      E'42rem tiap baris jadi satu kartu, nama kolomnya dibawa lewat data-label. Informasinya\n' ||
      E'SAMA, penyajiannya berubah bentuk. Dicatat di items.scss supaya tidak "diperbaiki".\n\n' ||
      E'=== BUKTI ===\n' ||
      E'  702 komponen Carbon di halaman, NOL elemen mentah, konsol BERSIH.\n' ||
      E'  1440px & 360px: nol gulir menyamping; di 360px baris jadi kartu dan TIDAK menindih\n' ||
      E'  (diukur: 3 baris berurutan rapi).\n' ||
      E'  Detail: 14 baris informasi, tombol Ubah + Hapus, bagian Dokumen + Supplier.\n' ||
      E'  Modal hapus: terbuka, ber-varian danger, menyebut nama item.\n' ||
      E'  Modal isian: 15 field terlihat, 8 penjelasan klik, 6 pola konversi.\n' ||
      E'  Halaman ini juga PINDAH ke authedFetch bersama -- daftar AUD-37 menyusut 36 -> 35.',
      'Buka Items dari menu kiri (Product & Engineering -> Items). Lalu ulangi di HP.',
      E'1. Perhatikan TABEL: judul kolom bisa diklik untuk mengurut, kecuali "Biaya standar"\n' ||
      E'   (di situ ada ikon Asal-Usul yang harus tetap bisa ditekan).\n' ||
      E'2. Klik tanda panah di kiri baris -> panel Detail terbuka DI BAWAH barisnya.\n' ||
      E'3. Di dalam Detail: tombol Ubah di kiri, Hapus DIDORONG JAUH ke kanan. Itu disengaja.\n' ||
      E'4. Tekan Hapus -> muncul kotak MERAH yang menyebut nama itemnya. Tekan Batal.\n' ||
      E'5. Tekan "Tambah item" -> formulir terbuka. Klik ikon (i) di sebelah label field:\n' ||
      E'   penjelasannya muncul saat DIKLIK, bukan saat kursor lewat.\n' ||
      E'6. DI HP: tabelnya BERUBAH BENTUK jadi kartu bertumpuk, bukan menggulir ke samping.',
      'Tambah satu item baru lewat tombol "Tambah item", lalu buka Detail-nya dan tekan Ubah.',
      'DS-05 ditutup, lanjut ke layar berikutnya dengan gerbang rencana lebih dulu.',
      E'Sebutkan bagian mana yang keliru. Bila yang mengganggu adalah tabel yang jadi kartu di\n' ||
      E'HP, itu DEVIASI YANG DISENGAJA -- sebutkan bila Anda lebih suka gulir menyamping.');
  end if;

  if not exists (select 1 from build_tasks where task_code = 'DS-06') then
    insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
      effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
    values (v_company_id, 'DS-06',
      'Enam window.confirm Tersisa di Empat Halaman',
      'DS', 'Design System',
      'window.confirm masih dipakai di Routing (1), Sales Order (2), Pelanggan (1), Purchasing (2).',
      'Kotak konfirmasi bawaan peramban memblokir seluruh jendela, tidak bisa menandai bahwa aksinya merusak, dan tidak bisa memuat penekanan apa pun.',
      'penting', 'menunggu', 'temuan_claude', 'Claude Code',
      E'Ganti Modal danger Carbon SAAT halaman masing-masing dimigrasikan -- bukan sebagai\n' ||
      E'penyisiran tersendiri. Alasannya: perubahannya baru bisa diperiksa bersama layarnya.',
      E'Disisir 25 Agu 2026 saat mengerjakan DS-05. Dua di Master Item sudah diganti; enam\n' ||
      E'sisanya dilaporkan tanpa disentuh, sesuai permintaan pemilik produk.');
  end if;
end $$;
