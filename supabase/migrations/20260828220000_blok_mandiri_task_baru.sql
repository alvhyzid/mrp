-- Blok kerja mandiri 24 Agu 2026 — pencatatan task (Bagian 7 + A.2 + B.4 + C.2 + C.4).

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, d.kode, d.nama, d.mk, d.mn, d.deskripsi, d.efek, d.urgensi, d.tags, d.pic,
  'menunggu', 'temuan_claude', d.detail, d.catatan
from (values
(
  'PRD-20',
  'Work Order Tidak Pernah Mencatat KAPAN Ia Mulai dan Selesai',
  'PRD', 'Produksi',
  array['Data','Fungsi']::text[], 'Claude Code', 'penting',
  'Kolom work_orders.actual_start_at dan actual_completed_at ada di tabel tetapi tidak pernah diisi kode mana pun.',
  'Sistem tahu sebuah Work Order sedang berjalan, tapi TIDAK TAHU SEJAK KAPAN. Tidak ada dasar mengukur ketepatan waktu produksi, dan tidak ada bahan mentah untuk standar durasi K8 — padahal K8 seharusnya belajar dari durasi nyata.',
  E'BUKTI (diperiksa langsung di kode 24 Agu 2026):\n' ||
  E'  - startProductionBatch.ts:70 menulis status ''in_progress'' TANPA actual_start_at.\n' ||
  E'  - setWorkOrderStatus.ts:55 menulis status + alasan TANPA actual_completed_at.\n\n' ||
  E'ASALNYA PRD-12, dan PRD-12 SENGAJA TIDAK DIBUKA ULANG (keputusan pemilik produk 24 Agu 2026): ' ||
  E'menutup dan membuka task berulang membuat riwayatnya sulit dibaca, dan PRD-12 secara harfiah ' ||
  E'menyelesaikan yang dijanjikan judulnya ("Kolom Status Tidak Pernah Diperbarui").\n\n' ||
  E'YANG PERLU DIPIKIRKAN SAAT MENGERJAKAN: pekerjaan yang benar bukan "isi dua kolom", melainkan ' ||
  E'"Work Order mencatat perjalanannya". Periksa apakah ada titik waktu lain yang juga hilang ' ||
  E'(mis. kapan dijeda, kapan dilanjutkan) sebelum menganggapnya selesai.',
  'Lahir dari aturan CLAUDE.md "Saat Memperbaiki Satu Contoh dari Sebuah Kelas Cacat, Periksa Tetangganya" — aturan itu sendiri lahir dari kasus ini.'
),
(
  'GDG-08',
  'Karantina Lot Tidak Punya Pemicu: NOL Tabel QC/Mutu di Seluruh Skema — MENUNGGU JAWABAN',
  'GDG', 'Gudang',
  array['Data']::text[], 'Pemilik Produk', 'penting',
  'Status lot ''quarantine'' terdaftar tetapi tidak pernah bisa tercapai. Penyebabnya lebih dalam dari aturan yang belum diputuskan: tidak ada apa pun di sistem yang bisa MENGHASILKAN keputusan karantina.',
  'Tidak ada cara menahan bahan yang bermasalah. Untuk pabrik ber-NIE BPOM dan bersertifikat halal, tidak adanya mekanisme karantina berarti bahan yang meragukan tetap terpakai produksi.',
  E'TEMUAN (24 Agu 2026): diperiksa seluruh skema untuk tabel apa pun bernama QC, mutu, NCR, atau ' ||
  E'inspeksi. Hasilnya NOL. Hasil uji QC yang gagal tidak tercatat di mana pun.\n\n' ||
  E'DUA PERTANYAAN BERLAPIS untuk pemilik produk, yang kedua LEBIH MENDASAR:\n' ||
  E'  (1) Siapa yang boleh MENAHAN bahan di karantina, dan siapa yang MENGELUARKANNYA? Hari ini QC ' ||
  E'dirangkap SPV Produksi — bila orang yang menahan dan yang melepas sama, karantinanya kehilangan arti.\n' ||
  E'  (2) Di mana hasil uji QC dicatat HARI INI? Di kertas, di Excel, atau tidak dicatat sama sekali?\n\n' ||
  E'JANGAN BANGUN SEBELUM (2) DIJAWAB. Tanpa itu karantina hanya bisa manual — dan karantina manual ' ||
  E'tanpa aturan pengeluaran menjadi LUBANG TEMPAT BAHAN MENGENDAP SELAMANYA.\n\n' ||
  E'KAITAN: QMS-01 (pemisahan pemeriksa dan pelapor pada tahap QC) menyentuh keterbatasan yang sama ' ||
  E'dari sisi berbeda — di sana soal siapa yang MELAPORKAN, di sini soal siapa yang MEMUTUSKAN.',
  'Ditemukan saat menyisir status lot yang tidak pernah tercapai (blok 10 temuan terverifikasi).'
),
(
  'GDG-09',
  'Lot Bersaldo Nol Tetap Berstatus Tersedia — Saring Tampilannya, Jangan Ubah Statusnya',
  'GDG', 'Gudang',
  array['Data','ui']::text[], 'Claude Code', 'bisa_menunggu',
  'recordWorkOrderConsumption mengurangi quantity_on_hand sampai nol tetapi tidak pernah menyentuh status lot. Tidak ada kode yang menulis ''consumed''.',
  'Daftar stok memanjang tanpa batas oleh lot bersaldo nol yang mengaku masih tersedia, dan laporan "lot aktif" jadi tidak bisa dipercaya.',
  E'KEPUTUSAN PEMILIK PRODUK (24 Agu 2026) — usulan arsitek DITERIMA: JANGAN jadikan ''consumed'' ' ||
  E'status otomatis saat saldo nol.\n\n' ||
  E'ALASAN: lot bersaldo nol MASIH BISA menerima penyesuaian — stok opname bisa menemukan barangnya ' ||
  E'ternyata masih ada, atau ada koreksi pencatatan. Bila nol otomatis berarti consumed, koreksi itu ' ||
  E'harus MENGHIDUPKAN KEMBALI lot yang sudah ditutup, dan statusnya berbohong dua kali.\n\n' ||
  E'YANG DIKERJAKAN: SARING TAMPILANNYA. Daftar stok menampilkan lot bersaldo > 0 secara bawaan, ' ||
  E'dengan pilihan "tampilkan yang sudah habis".\n\n' ||
  E'''consumed'' TETAP ADA sebagai nilai, dipakai untuk PENUTUPAN YANG DISENGAJA.\n' ||
  E'PERTANYAAN YANG BELUM DIJAWAB, jangan ditebak saat mengerjakan: siapa yang boleh menutup lot ' ||
  E'secara sengaja, dan apa alasan yang sah untuk menutupnya?',
  'Prinsipnya sudah naik jadi aturan umum di CLAUDE.md: "Status mencatat KEPUTUSAN, bukan menyimpulkan dari angka."'
),
(
  'RSP-02',
  '8 Halaman Bertabel Sendiri Masih Memotong Kolom Diam-diam (overflow-hidden)',
  'MST', 'Master Data',
  array['responsive','ui']::text[], 'Claude Code', 'penting',
  'RSP-01 mengganti overflow-hidden jadi overflow-x-auto di komponen tabel BERSAMA. Tetapi 14 halaman punya tabel sendiri, dan 8 di antaranya masih memakai overflow-hidden.',
  'Kolom yang tidak muat HILANG tanpa ada cara melihatnya — kelas cacat yang paling berbahaya karena tidak tampak sebagai kerusakan.',
  E'HALAMAN YANG MASIH overflow-hidden (diperiksa 24 Agu 2026): SalesOrdersPage (3 tempat), ' ||
  E'WorkOrdersPage, BomsPage, RoutingsPage, ShipmentsPage, CustomerPurchaseOrdersPage, ' ||
  E'ProductionDashboardPage, PodConfirmationPage.\n' ||
  E'Yang sudah aman: DebugPage, TestTenantPage, DocumentsPage, PurchasingPage, PpicDashboardPage. ' ||
  E'BuildTasksPage campuran (satu tabel sudah, satu belum).\n\n' ||
  E'PRIORITAS: PodConfirmationPage lebih dulu. Itu halaman yang dibuka KURIR LEWAT HP dari QR yang ' ||
  E'dicetak — layar sempit adalah kondisi NORMALNYA, bukan pengecualian.\n\n' ||
  E'CATATAN CARA MENGUKUR (aturan M.5/M.6): daftar ini hasil PENYISIRAN KODE. Ia membuktikan ' ||
  E'overflow-hidden ADA di sana, TIDAK membuktikan setiap halaman itu pasti meluber — pembuktian ' ||
  E'sesungguhnya butuh pengukuran di peramban pada 360/768/1280/1920. Perlakukan daftar ini sebagai ' ||
  E'daftar YANG PERLU DIPERIKSA, bukan daftar yang sudah terbukti rusak.',
  'Ditemukan lewat sapuan C.4 yang diminta pemilik produk: "ambil 5 task terakhir yang menutup cacat, periksa apakah ada contoh sekelas yang tertinggal". RSP-01 adalah salah satunya — dan pelakunya pekerjaan kemarin.'
)
) as d(kode, nama, mk, mn, tags, pic, urgensi, deskripsi, efek, detail, catatan)
where not exists (select 1 from build_tasks b where b.task_code = d.kode and b.company_id = 1);
