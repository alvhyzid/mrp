# Konteks Proyek — Sistem MRP Multi-Tenant

## Tentang Proyek
Sistem MRP (Material Requirements Planning) berbasis SaaS multi-tenant untuk industri manufaktur — dirancang awal untuk PT. Indo Taste Manufacture (produsen functional gummy & minuman serbuk), dengan rencana dijual ke perusahaan manufaktur lain setelah terbukti solid.

## WAJIB Dibaca Dulu Sebelum Mulai Kerja
- `docs/rancangan-skema-database-mrp.md` — skema database lengkap (semua tabel, kolom, relasi)
- `docs/prioritas-fitur-mrpeasy-enterprise.md` — mana fitur masuk MVP (Tier 1), mana yang menyusul (Tier 2/3)

Baca KEDUA file ini secara penuh sebelum menulis kode apa pun. Semua keputusan desain di dalamnya sudah didiskusikan panjang dengan user dan mencerminkan proses bisnis riil — jangan diubah tanpa bertanya ke user dulu.

## Tech Stack (Final, Sudah Diputuskan)
- Frontend & Backend: Next.js 16 (App Router), React 19, TypeScript
- Runtime: Node.js 24 (LTS)
- Database: PostgreSQL 18, dihosting via Supabase (sekalian pakai Auth & Storage bawaan Supabase)
- Hosting aplikasi: Vercel
- Payment gateway (fase billing nanti, BUKAN untuk MVP): Xendit/Midtrans

## Prinsip Arsitektur — WAJIB Dipatuhi di Semua Kode
1. **Multi-tenant sejak baris pertama** — semua tabel utama punya `company_id`. Terapkan Row-Level Security (RLS) di Supabase/Postgres untuk isolasi data antar tenant, bukan cuma filter di kode aplikasi.
2. **Generik untuk manufaktur apa pun** — jangan hardcode logic khusus gummy/serbuk di kode. Semua spesifik-industri harus lewat data (Item type, BOM), bukan lewat if-else di kode.
3. **BOM dihitung per unit output**, bukan per batch — supaya scaling resep otomatis.
4. **Yield produksi itu variatif** — selalu catat `actual_output_qty`/`work_order_outputs` terpisah dari `planned_qty`. Jangan pernah asumsikan hasil produksi = rencana.
5. **Satu Work Order bisa menghasilkan multi-output** (produk jadi + sisa reprocessable/waste yang bisa dipakai lagi) — lihat tabel `work_order_outputs`.
6. **Lot/batch traceability wajib** — setiap pergerakan stok tercatat by lot, dengan jejak genealogy (lot ini dibuat dari lot apa saja). Ini requirement compliance BPOM/halal, tidak boleh disederhanakan.
7. **Konvensi penamaan primary key**: `nama_tabel_tunggal_id` (mis. tabel `employees` → primary key `employee_id`, BUKAN `id` generik). Ini WAJIB diikuti di semua tabel — sudah diterapkan konsisten di `docs/rancangan-skema-database-mrp.md`, ikuti persis seperti tertulis di sana.

## Prinsip Standar Akuntansi Biaya — WAJIB Dipatuhi di Seluruh Perhitungan Keuangan (ditetapkan 23 Agu 2026)
1. **Seluruh perhitungan keuangan dan biaya mengikuti STANDAR AKUNTANSI BIAYA yang lazim, bukan metode karangan sendiri.** Alasan: angkanya harus bisa dipertanggungjawabkan ke akuntan dan auditor tanpa diterjemahkan, dan berlaku universal untuk tenant lain (bukan cuma masuk akal untuk PT ITM).
2. **Istilah memakai istilah baku akuntansi** (Direct Cost, Indirect Cost, Overhead, Variance, dst), BUKAN istilah karangan. Di layar TETAP ditampilkan dalam Bahasa Indonesia lewat kamus istilah (`src/lib/glossary.ts`/Kamus) — baku di dalam kode/skema, manusiawi di layar.
3. **Bila standar membuka beberapa pilihan yang sama-sama sah** (metode penilaian persediaan, dasar pembebanan overhead, waktu pengakuan selisih, dst): JANGAN memilih sendiri dengan alasan "ini kan standar". Sodorkan pilihannya beserta konsekuensinya lewat `AskUserQuestion`, tunggu keputusan pemilik produk, catat pilihan yang diambil beserta alasannya di task terkait.
4. **Bila pemilik produk meminta penyimpangan dari standar: boleh, itu haknya.** Yang WAJIB: alasan dan detailnya dicatat di task terkait, supaya berbulan-bulan kemudian masih bisa dijelaskan kenapa angkanya berbeda dari standar baku.
5. **Setiap angka keuangan yang ditampilkan ke pengguna harus bisa menjawab "ini metode apa"** lewat panel Asal-Usul (`ProvenanceInfoButton`) atau Kamus istilah — bukan angka yang muncul tanpa jejak metodenya.

## Keputusan Biaya SDM — TIGA Golongan (final 23 Agu 2026, dipindahkan ke sini 24 Agu 2026)

> **KENAPA ADA DI SINI, bukan cuma di task MRG-11**: keputusan yang menentukan **ARTI ANGKA** punya umur simpan pendek bila hanya hidup di task — task bisa ditutup dan tenggelam di antara 234 baris, sementara berkas ini dibaca setiap sesi. Lihat aturan "Keputusan yang Menentukan Arti Angka" di bawah.

**TIGA GOLONGAN, bukan dua:**
1. **DIRECT COST** — menempel ke batch.
2. **MANUFACTURING OVERHEAD** — menempel ke produksi, **MASUK HPP**, dibagi ke batch bersama biaya direct.
3. **GENERAL & ADMINISTRATIVE** — **TIDAK masuk HPP sama sekali**, langsung jadi beban periode.

**Alasan tiga, bukan dua**: bila seluruh non-direct digabung jadi satu "indirect", gaji Direktur & General Manager ikut membebani HPP — keliru menurut standar akuntansi biaya, dan membuat produk terlihat lebih mahal dari kenyataan. Beban administrasi tidak pernah masuk biaya produk.

**Panduan pemisahan**: overhead pabrik mendukung **PRODUKSI**; beban administrasi mendukung **PERUSAHAAN**, bukan produksi.

**RUMUS FINAL per golongan:**
- Biaya **DIRECT** per batch = total biaya karyawan direct sebulan (gaji + tunjangan + BPJS pemberi kerja) **÷ jumlah batch sebulan**.
- Biaya **MANUFACTURING OVERHEAD** per batch = total biaya karyawan overhead pabrik sebulan **÷ jumlah batch sebulan**, masuk HPP bersama direct.
- Biaya **GENERAL & ADMINISTRATIVE** = **tidak dibagi ke batch sama sekali**.

**DASAR PEMBAGIAN: JUMLAH BATCH** (dikonfirmasi pemilik produk), berlaku untuk direct maupun overhead pabrik. Data untuk dasar lain (kuantitas hasil, jam mesin) tetap dikumpulkan lewat PRD-18 supaya bila kelak dasarnya diubah, datanya sudah ada.

**HARIAN vs BULANAN — dua angka terpisah, jangan tertukar:**
- **Harian** = pemantauan produktivitas, **TIDAK PERNAH** masuk HPP/Margin Watch, wajib berlabel "Produktivitas Harian — bukan biaya batch".
- **Bulanan** = yang masuk HPP/Margin Watch, ditandai "perkiraan" selama bulan berjalan.

**BERJALAN vs FINAL**: biaya batch berjalan **TIDAK DITIMPA** oleh perhitungan ulang akhir bulan — simpan **ketiganya** (berjalan, final, selisih). Selisih besar = masalah **KAPASITAS**, bukan biaya. Margin diakui saat **TERKIRIM**; pengiriman lintas bulan ikut **BULAN PRODUKSI**.

**WEWENANG: Finance menetapkan LANGSUNG**, tanpa alur usulan HRD. Penggolongan adalah **kebijakan akuntansi** (wilayah Finance), bukan fakta kepegawaian (wilayah HRD). HRD menyediakan fakta, Finance menerjemahkannya. Penggantinya bukan persetujuan melainkan **JEJAK WAJIB**: siapa menetapkan, kapan, dari apa ke apa, alasannya — append-only, bertanggal berlaku. HRD boleh **melihat**, tidak boleh mengubah.

**ATURAN KERAS**: karyawan DIRECT wajib jamnya tercatat di batch. **Bila tidak sanggup dicatat, JANGAN digolongkan direct.** Karyawan direct yang tidak muncul di labor log sebulan → peringatan, bukan blokir.

**WAJIB DIJELASKAN DI LAYAR** (bukan opsional):
- Biaya SDM per batch adalah **RATA-RATA per golongan**, bukan biaya batch itu sendiri — batch yang dikerjakan lebih lambat **tidak** terlihat lebih mahal. Efisiensi antar batch dilihat lewat **yield dan durasi tahap**, bukan biaya.
- **11 dari 19 karyawan direct dibayar harian**, jadi biaya direct naik-turun mengikuti jumlah hari produksi. Rumusnya tetap benar; angkanya memang lebih berfluktuasi antar bulan — wajar, bukan kesalahan hitung.

## Penggolongan 30 Karyawan Aktif PT ITM (final 23 Agu 2026)

**DIRECT (19)** — Operator Produksi bulanan: Aziz Maulana, Diana Ayu Agustin, Ezra Ariya Septiano, Maylani Suhesti, Mi'asih, Muhammad Alif Alhamad, Rumanik. Operator Produksi harian/PHL: Bilal, Diah, Lely, Mayang, Mina, Nanda, Nindi, Yunita, Zidan, Rohmat. **Team Leader: Angga Ade Mahendra, Sutipa Handayani** — direct karena **ikut produksi penuh** dan namanya muncul di "siapa mengerjakan". *Pemicu peninjauan: bila kelak bergeser ke mengatur/mengawasi, golongannya ditinjau ulang — bertanggal berlaku, tidak mengubah biaya batch lama.*

**MANUFACTURING OVERHEAD (5)** — Dina Melinda Cahya Purnama (Spv Produksi), Dimas Suryo Anantyo (Manager PPIC), Sandra Wedi Pradika (PPIC Jr. Spv), **Syaifulloh Alamsyah (Helper Gudang)** — menimbang kebutuhan **total beberapa batch sekaligus**, jamnya tidak bisa ditelusuri ke batch mana pun; penimbangan per batch dilakukan tim produksi yang sudah direct. **Darmini (Janitor)** — bekerja di pabrik **dan** kantor satu lokasi; untuk 1 orang tidak sepadan dipisah proporsional, dan arah konservatif dipilih sengaja: HPP sedikit **lebih tinggi** dari sebenarnya, bukan lebih rendah. *Pemicu peninjauan: bila jumlah petugas kebersihan atau lokasi bertambah.*

**GENERAL & ADMINISTRATIVE (6)** — Alvan Handyka Yudha (Direktur), Bayu Oktavian Wibowo (General Manager), Ruud Ayu Dewanti (HR Generalist), Mega Asmarani (Staf Purchasing), **Asni Damayati (FAT Spv)** — FAT = Finance, Accounting, Tax, **Adhiskaprillia Nur Anissa (RnD Staff)** — tidak terlibat langsung di batch MLVT.

**QC**: belum ada petugas QC tersendiri — tahap QC dikerjakan Spv Produksi yang merangkap. Karena Spv sudah Manufacturing Overhead, biayanya sudah tertangkap. Keterbatasan "pemeriksa = pelapor" dicatat di QMS-01 untuk audit BPOM/halal.

## Keputusan yang Menentukan ARTI ANGKA Wajib Masuk CLAUDE.md (ditetapkan 24 Agu 2026)

**Task menyimpan PEKERJAAN; CLAUDE.md menyimpan ATURAN.**

Keputusan yang menentukan **arti sebuah angka** — golongan biaya, rumus, dasar pembagian, kapan sesuatu diakui, apa yang masuk HPP dan apa yang tidak — **WAJIB masuk berkas ini**, bukan hanya ke task.

**Alasannya**: task bisa ditutup dan tenggelam di antara ratusan baris, sementara berkas ini dibaca setiap sesi. Aturan yang hanya hidup di task punya umur simpan pendek, dan begitu ia lupa, angkanya tetap keluar — hanya artinya yang berubah diam-diam.

Ditemukan lewat audit 24 Agu 2026: seluruh keputusan biaya SDM dan penggolongan 30 karyawan hanya tercatat di MRG-10/MRG-11, tidak di sini.

## Aturan Bukti: "Jumlah Baris Identik" TIDAK LAGI Sah (ditetapkan 23 Agu 2026)
Sejak situs production tersambung ke data nyata dan pemilik produk mulai MEMAKAI sistem, **jumlah baris memang berubah karena pemakaian yang sah**. Karena itu:

- **JANGAN** memakai "jumlah baris tabel X sama sebelum & sesudah" sebagai bukti bahwa CI, skrip, atau proses lain tidak menyentuh data nyata. Bukti itu sekarang bisa salah ke DUA arah: berubah padahal aman (pemilik produk memakai sistem), atau kebetulan sama padahal ada yang tertulis lalu terhapus.
- **YANG BENAR**: buktikan lewat **ADA atau TIDAKNYA baris BERPOLA FIXTURE** — nama company `*TestCorp`, email `@debug.mrp` yang baru, nomor dokumen berpola uji, dan sejenisnya. **Sebutkan polanya, bukan totalnya.**
- Contoh nyata yang melahirkan aturan ini (23 Agu 2026): setelah satu run CI, `items` di FABRIX-APP naik 8 → 9. Terlihat seperti CI menulis — ternyata item `PMGM-0001/ITM` (PREMIX GUMMY) dibuat pemilik produk lewat aplikasi, 2 menit SETELAH CI selesai. Yang membuktikan CI bersih bukan angkanya, melainkan **nol company `*TestCorp` baru**.

## ATURAN SEMENTARA — `main` = RILIS LANGSUNG ke Data Nyata (berlaku 23 Agu 2026, ada pemicu pencabutan)
Sejak 23 Agu 2026, situs production (`mrp-staging-zeta.vercel.app`) **tersambung ke data nyata PT ITM** (FABRIX-APP), dan Vercel masih men-deploy production dari branch `main` (percobaan mengubahnya ke `staging` gagal dari semua jalur — lihat `INF-11`, menunggu dukungan Vercel). Konsekuensinya, sampai pemicu di bawah terpenuhi:
1. **Setiap push ke `main` harus dianggap RILIS, bukan simpanan pekerjaan** — begitu terdorong, kode itu langsung dipakai orang di atas data sungguhan.
2. **Pekerjaan yang belum siap dipakai TIDAK di-push ke `main`.** Simpan di branch lain, atau tahan sampai selesai.
3. **Bila terpaksa mendorong sesuatu yang berisiko, kabari pemilik produk LEBIH DULU** — jangan mengandalkan dia menyadarinya sendiri dari situs yang tiba-tiba berubah.

**PEMICU PENCABUTAN aturan ini**: begitu setelan Vercel "Production Branch" berhasil diubah dari `main` ke `staging`. Setelah itu, `main` kembali jadi tempat kerja biasa dan bagian ini dihapus dari CLAUDE.md.

**ANJURAN (bukan aturan keras)**: tunggu CI selesai sebelum push berikutnya. Push tumpang tindih pernah membuat beberapa run CI berjalan bersamaan di atas satu database yang sama, dan fixture-nya bertabrakan (dua company bernama kembar dibuat berjarak 7 detik, 23 Agu 2026). Sejak CI punya project database sendiri risiko itu jauh berkurang, tapi menunggu tetap lebih rapi dan bikin penyebab kegagalan gampang dibaca.

**Catatan**: pengaman data tetap berlapis dan sudah terbukti — login aplikasi (16 peran) + RLS ber-`company_id` (diuji langsung: tenant uji melihat 0 dari 30 karyawan PT ITM). Aturan di atas soal **kualitas rilis**, bukan kebocoran data.

## Aturan Komponen Form & Modal (ditetapkan 23 Agu 2026, dilengkapi saat PMB-11 tuntas)
1. **Ukuran field: MEDIUM Carbon = 40px** (`h-10`). Berlaku untuk `Input` dan `SelectTrigger` di `src/components/ui/`. Sebelumnya 32px (`h-8`) dan pemilik produk melaporkan modal terasa sempit/tidak lega. **Jangan menurunkannya lagi tanpa alasan tertulis.**
2. **Ketegangan yang disadari (bukan kelalaian)**: aturan responsive di bawah menetapkan target sentuh minimal **44px**, sedangkan Carbon medium **40px**. Selisih 4px ini diterima untuk sekarang — area sentuh efektif (label+field+helper) tetap di atas 44px. Bila kelak terbukti sulit ditekan di lantai produksi, naikkan ke `h-11` (44px); keputusan itu **belum** diambil karena belum ada keluhan nyata.
3. **Anatomi modal mengikuti Carbon Design System** ([rujukan](https://carbondesignsystem.com/components/modal/usage/)): **Header** (judul, label opsional, ikon tutup ×) · **Body** (isi & kontrol) · **Footer** (tombol aksi **lebar penuh**, pakai komponen `DialogFooter` di `src/components/ui/dialog.tsx`). Ikon × menutup **tanpa menyimpan**. Overlay menggelapkan halaman di belakangnya.
4. **Pembuatan data baru tidak langsung tersimpan** — tampilkan ringkasan draf lebih dulu, lalu konfirmasi.
5. **Placeholder tidak boleh memuat instruksi** — instruksi masuk helper text di bawah field.
6. **Penjelasan bantuan dibuka dengan KLIK, tidak pernah hanya dengan sentuhan kursor (hover)** (ditetapkan 24 Agu 2026). Penjelasan yang hanya muncul saat kursor lewat **tidak bisa dipakai sama sekali** di HP dan tablet — dan justru perangkat itulah yang dipakai di lantai produksi. Komponennya `FieldLabel` di `src/components/ui/field-help.tsx`: label + ikon tanya + panel penjelasan yang terbuka **di bawah label**, bukan melayang di atasnya (panel melayang gampang terpotong di dalam modal yang menggulir).
7. **Ringkasan konfirmasi hanya untuk data BARU, TIDAK untuk mengubah data lama** (disetujui pemilik produk, 24 Agu 2026). Alasannya: saat mengubah, pengguna sudah melihat nilai lama di formulir — ringkasan cuma menambah satu klik tanpa menambah kejelasan.
   **KEMUNGKINAN PENGECUALIAN, SENGAJA BELUM DIBANGUN**: perubahan yang berdampak ke **dokumen yang sudah terbit** (mis. alamat resmi atau NPWP supplier yang sudah tercetak di PO). Di situ ringkasan berguna karena menunjukkan **APA YANG BERUBAH**, bukan mengulang yang sudah terlihat. **Jangan dibangun sekarang** — tinjau kembali saat ada keluhan nyata.
8. **Padding modal dipindahkan BERTAHAP, jangan "dirapikan" sekaligus** (ditetapkan 24 Agu 2026). Anatomi Carbon dipakai lewat kelas bersama `carbonModalContent` / `carbonModalHeader` / `DialogBody` di `src/components/ui/dialog.tsx`, dan padding SENGAJA tidak dijadikan bawaan `DialogHeader`/`DialogFooter`.
   **Alasan, supaya sesi berikutnya tidak "membereskan" ini dan malah merusak**: modal lama masih memakai `DialogContent` yang ber-padding sendiri. Begitu padding dipindah jadi bawaan komponen, **seluruh modal lama akan berpadding dobel sekaligus** — puluhan layar rusak dalam satu perubahan yang niatnya merapikan. Modal yang sudah dipindah memakai ketiga kelas itu; yang belum tetap seperti semula sampai gilirannya tiba.
9. **Aksi merusak ditempatkan TERPISAH dan BERJAUHAN dari aksi biasa** (ditetapkan 24 Agu 2026). Tombol Hapus / Batalkan / Arsipkan **tidak boleh berdempetan** dengan Ubah / Simpan / Tambah. Alasannya bukan estetika: di layar sentuh jari jauh lebih besar daripada kursor mouse, dan aksi yang tidak bisa dibatalkan tidak boleh berjarak satu jari dari aksi sehari-hari. Contoh penerapannya di panel Detail Item (MST-16): `Ubah` di kiri, `Hapus` didorong ke kanan (`sm:ml-auto`), dengan seluruh lebar panel di antaranya.
10. **Keputusan hapus-vs-nonaktifkan DIHITUNG SERVER, bukan ditawarkan sebagai pilihan ke pengguna** (ditetapkan 24 Agu 2026; pola ini sudah dipakai lebih dulu di Supplier dan Routing, MST-16 mengikutinya). Pengguna **tidak bisa tahu dari layar** apakah sebuah bahan pernah masuk BOM tiga bulan lalu, pernah punya lot, atau pernah tercantum di dokumen pembelian — jadi menawarkan pilihan itu berarti meminta keputusan dari orang yang tidak punya informasinya.
    Yang benar: server memeriksa pemakaian, lalu **menghapus permanen bila belum dipakai** dan **menonaktifkan bila sudah dipakai**, sambil menjelaskan **di mana** item itu terpakai. Ketertelusuran lot adalah syarat kepatuhan BPOM/halal — memutus jejaknya bukan pilihan yang boleh diserahkan ke satu klik.
    Berlaku untuk layar berikutnya juga: **jangan menawarkan pilihan yang seharusnya dihitung.**

> Bagian ini ditulis lebih awal (sebelum `PMB-11` selesai) atas permintaan pemilik produk, karena aturan yang hanya hidup di percakapan terbukti hilang. Akan **dilengkapi**, bukan diganti, begitu modal Supplier tuntas jadi cetakan penuh.

## Aturan Integritas Data Lintas Domain (SD-1..SD-13) — dari §38 Arsitektur Sales (dicatat 24 Agu 2026)

Tiga belas aturan ini berasal dari `docs/FABRIX_Sales_Technical_Architecture_Fable5_v0_1.md` §38. Dicatat di sini **beserta STATUS masing-masing**, bukan disalin mentah — aturan tanpa status akan dikira sudah berlaku padahal belum.

**PERINGATAN PENTING soal cara membaca status di bawah.** Ada perbedaan besar antara *"terbukti berlaku"* dan *"tidak mungkin dilanggar karena hal yang dilarangnya belum ada"*. Keduanya sama-sama "tidak dilanggar hari ini", tapi yang kedua **tidak memberi jaminan apa pun untuk besok** — begitu fiturnya dibangun, aturannya langsung berlaku dan belum ada satu pun test yang menjaganya. Status di bawah membedakan keduanya secara eksplisit.

| Kode | Aturan (§38) | Status | Dasar |
|---|---|---|---|
| SD-1 | Sales Order terkonfirmasi tidak boleh mengubah riwayat Quotation | **BELUM RELEVAN** | Modul Quotation belum ada (SLS-02) |
| SD-2 | Sales Order tidak boleh mengubah BOM produksi | **BERLAKU & TERBUKTI** | `tests/production_batch_routing_bom_snapshot.test.ts` — batch berjalan memakai snapshot BOM/routing; mengedit master TIDAK mengubah angka batch yang sudah jalan |
| SD-3 | Sales tidak boleh membuat Work Order langsung | **KOSONG, BUKAN TERBUKTI** | **Tidak ada role `sales`** di `src/lib/roles.ts` (16 role, tak satu pun sales). Aturannya benar hari ini karena pelakunya belum ada — bukan karena dijaga |
| SD-4 | Sales tidak boleh membuat Purchase Order langsung | **KOSONG, BUKAN TERBUKTI** | Sama seperti SD-3 |
| SD-5 | Reservasi tidak boleh mengurangi stok fisik | **KOSONG, BUKAN TERBUKTI** | **Konsep reservasi/alokasi belum ada sama sekali** — nol kolom & nol tabel ber-nama `reserv*`/`alloc*` di seluruh skema |
| SD-6 | Qty terkirim tidak boleh ditulis ulang demi menampung retur | **BELUM RELEVAN** | Modul retur belum ada (SLS-05) |
| SD-7 | Retur wajib jadi transaksi terpisah | **BELUM RELEVAN** | Modul retur belum ada (SLS-05) |
| SD-8 | Komplain tidak boleh menulis ulang data pengiriman historis | **BELUM RELEVAN** | Modul komplain belum ada (SLS-05) |
| SD-9 | Forecast consumption wajib menjaga riwayat forecast | **TIDUR** | Forecast DITOLAK sebagai konsep (lihat SLS-90). Pemicu bangun: ada kontrak blanket berkomitmen volume |
| SD-10 | Perubahan komersial wajib mencatat siapa / kapan / alasan | **SEBAGIAN** | Sudah berlaku di kunci-ulang baseline finansial dan buka-kembali Work Order; **belum menyeluruh** untuk perubahan komersial lain |
| SD-11 | Konfigurasi pelanggan tidak boleh memutasi master produksi | **BELUM ADA → jadi task** | Aturan kandidat-BOM. Tercatat sebagai task tersendiri |
| SD-12 | Nilai komersial terkonfirmasi wajib berversi atau beku | **BELUM ADA → jadi task** | Harga di Sales Order **belum dibekukan**, padahal identitas mitra sudah (PMB-07a). Tercatat sebagai task tersendiri |
| SD-13 | Rujukan lintas domain yang kritis wajib tetap tertelusur | **BERLAKU & TERBUKTI** | `tests/shipments_physical_stage.test.ts` dan `tests/margin_v1_acceptance.test.ts` — jejak lot dari produksi sampai pengiriman |

**Yang harus dilakukan saat membangun fitur yang menyentuh aturan ber-status KOSONG atau BELUM RELEVAN**: aturannya menjadi hidup pada saat itu juga, dan **test penjaganya harus lahir bersama fiturnya** — jangan menunda, karena setelah fiturnya jalan tidak akan ada yang mengingatkan.

## Daftar Tugas — Modul ber-SUPER URGENT SENGAJA Terbuka Otomatis (ditetapkan 24 Agu 2026)

Aturan tampilan Daftar Tugas: **default seluruh modul TERTUTUP**, KECUALI modul yang memuat task SUPER URGENT yang belum selesai — modul itu **terbuka otomatis**.

**Pengecualian ini DISENGAJA, bukan cacat.** Menyembunyikan hal yang paling genting di balik baris yang harus diklik dulu melawan tujuan penandaan SUPER URGENT itu sendiri: gunanya justru supaya terlihat tanpa dicari.

**JANGAN "memperbaikinya" jadi seragam tertutup.** Keputusan D.2 tidak dicabut, dan sudah ditegaskan ulang oleh pemilik produk pada 24 Agu 2026 setelah melihat hasilnya. Modul yang cocok dengan saringan aktif juga tetap terbuka otomatis (F.2), dengan alasan sejenis: hasil saringan yang tersembunyi sama saja dengan saringan yang tidak bekerja.

## Status Mencatat KEPUTUSAN, Bukan Menyimpulkan dari Angka (ditetapkan 24 Agu 2026)

**Status yang berubah sendiri sebagai efek samping perhitungan akan berbohong begitu angkanya dikoreksi.**

Kasus yang melahirkan aturan ini: lot yang saldonya mencapai nol **tidak** otomatis berstatus `consumed`. Alasannya — lot bersaldo nol **masih bisa menerima penyesuaian**: stok opname bisa menemukan barangnya ternyata masih ada, atau ada koreksi pencatatan. Bila nol otomatis berarti `consumed`, koreksi itu harus **menghidupkan kembali** lot yang sudah ditutup, dan statusnya berbohong dua kali — sekali saat menutup terlalu cepat, sekali lagi saat dibuka kembali.

**Yang dilakukan sebagai gantinya**: saring **TAMPILANNYA**, bukan ubah statusnya. Daftar stok menampilkan lot bersaldo > 0 secara bawaan, dengan pilihan "tampilkan yang sudah habis". Nilai `consumed` tetap ada, disisakan untuk **penutupan yang DISENGAJA**.

## Saat Memperbaiki Satu Contoh dari Sebuah Kelas Cacat, Periksa Tetangganya (ditetapkan 24 Agu 2026)

**ATURAN**: saat memperbaiki satu contoh dari sebuah kelas cacat, **PERIKSA tabel dan berkas yang sama untuk contoh lain dari kelas itu, dan LAPORKAN temuannya** — meski tidak diperbaiki sekaligus.

Kasus yang melahirkannya: **PRD-12** lahir dari kelas "kolom tidak pernah diisi", menutup satu kolom (`work_orders.status`), dan meninggalkan **DUA kolom sekelas DI TABEL YANG SAMA** — `actual_start_at` dan `actual_completed_at` — yang terlihat jelas saat mengerjakannya.

Cara membaca kelasnya: pekerjaan yang benar bukan *"isi kolom status"*, melainkan *"Work Order mencatat perjalanannya"*. Pertanyaan yang membedakan keduanya: **"cacat ini contoh dari apa?"** — bukan "apa yang diminta task ini?"

## Prinsip Penamaan Field (ditetapkan 24 Agu 2026)

**Nama field menjawab APA YANG TERJADI KALAU SAYA ISI INI, bukan istilah bukunya.** Istilah yang dipindahkan dari literatur ERP berbahasa Inggris tanpa diterjemahkan ke bahasa orang pabrik adalah **cacat, bukan ketepatan**.

Contoh yang melahirkan aturan ini: **"Reorder Point"**. Dalam buku manajemen persediaan, "point" berarti **ambang**; dalam bahasa sehari-hari, "point" berarti titik atau lokasi. Konsepnya sederhana — sisa stok yang memicu pembelian — dan namanya yang membingungkan.

Perhatikan juga: **menerjemahkan saja tidak cukup.** "Titik Pemesanan Ulang" adalah terjemahan yang benar dan tetap tidak dimengerti siapa pun. Yang harus hilang bukan bahasa Inggrisnya, melainkan **penyembunyian cara kerjanya**.

**Uji yang sudah berlaku tetap berlaku**: bila label itu tidak akan pernah diucapkan orang di lantai produksi, label itu **belum selesai**.

## Rasa Bingung Pemilik Produk Adalah ALAT DETEKSI (ditetapkan 24 Agu 2026)

**Bila orang yang membangun bisnisnya sendiri tidak paham sebuah field untuk apa, kemungkinan besar memang tidak ada yang tahu — dan field itu perlu diperiksa KEBERADAANNYA, bukan dijelaskan.**

Terbukti tiga kali dalam satu hari, ketiganya lewat pemeriksaan kode, bukan dugaan:
- **Reorder Point** — hanya diteruskan `listStockSummary` ke tampilan, nol perhitungan.
- **Reorder Qty** — nol pemakai sama sekali.
- **Shelf Life** — `lots.expiry_date` selalu diketik manual; **tidak ada satu pun kode yang menghitungnya dari `shelf_life_days`**.

**BATAS YANG TEGAS: menambahkan ikon bantuan TIDAK menyelesaikan field golongan C.** Memberi penjelasan untuk field yang seharusnya tidak ada hanya menyembunyikan masalahnya di balik kalimat yang enak dibaca. Golongan C diselesaikan dengan **menyembunyikan atau menghapus**, bukan dengan menjelaskan.

**NUANSA YANG WAJIB DIPERIKSA sebelum menghapus**: "tidak dipakai perhitungan" TIDAK otomatis berarti "tidak berguna". Nomor Registrasi BPOM dan Kode Halal juga nol perhitungan, tapi keduanya **catatan kepatuhan** yang justru diminta pemilik produk. Golongan C hanya untuk field yang **tidak dipakai perhitungan DAN tidak punya kegunaan sebagai catatan**.

## Satu Istilah di Layar untuk Semua Departemen (ditetapkan 24 Agu 2026)

Label di layar **TIDAK boleh berbeda antar departemen**, sekalipun tiap departemen punya sebutan sendiri.

**Alasannya**: bila gudang melihat "sisa stok" dan finance melihat "saldo persediaan" untuk hal yang sama, begitu mereka rapat bersama **tidak ada yang tahu apakah sedang membicarakan hal yang sama**. Untuk sistem multi-tenant lebih buruk lagi — tiap tenant punya kombinasi sendiri, dan laporan lintas perusahaan jadi mustahil dibandingkan.

**Yang dilakukan**: sinonim per departemen **DICATAT di Kamus dan dipakai untuk PENCARIAN**, bukan untuk mengubah label. Satu tampilan, banyak pintu masuk — orang yang mencari "saldo persediaan" menemukan istilah yang dipakai sistem, beserta keterangan bahwa keduanya sama.

**BATAS**: JANGAN mengubah label apa pun berdasarkan Kamus sebelum jawabannya **DIKONFIRMASI**. Jawaban yang baru berstatus "dijawab" belum boleh mengubah layar.

## Aturan Status/Alert/Tombol Baru — Hanya Bersama Pemicunya (ditetapkan 24 Agu 2026)

**Status, alert, tombol, atau penanda baru HANYA ditambahkan bersama PEMICU dan AKIBATNYA. Menambahkan nilai enum yang tidak pernah dipicu kode mana pun adalah CACAT, bukan persiapan.**

Ini sudah terjadi **TIGA KALI** di proyek ini, dan tiap kali menghasilkan hal yang sama: sesuatu yang terlihat berfungsi di layar padahal tidak pernah hidup —

1. Tombol **Tunda/Batal** yang ada tapi tidak melakukan apa-apa.
2. **Status Work Order** yang terdaftar tapi tidak pernah dicapai.
3. Alert **low_stock** yang terdaftar dan ditampilkan tapi **tidak pernah dipicu kode mana pun** (baru akan dihidupkan lewat MST-19).

Ketiganya lebih buruk daripada tidak ada sama sekali: pengguna melihatnya, mengira sistem memantau sesuatu, dan berhenti memantau sendiri.

**Kasus yang sedang mengintai jadi kejadian KEEMPAT**: §5 arsitektur Sales mengusulkan 6 status pelanggan (ACTIVE, INACTIVE, BLOCKED, SUSPENDED, PROSPECT, ARCHIVED). **BLOCKED dan SUSPENDED TIDAK BOLEH ditambahkan** sampai ada kode yang benar-benar memicunya dan akibat yang benar-benar terjadi saat status itu aktif.

## Pengaman Lama Dicabut HANYA Setelah Penggantinya Terbukti Bekerja (ditetapkan 24 Agu 2026)

**Pengaman lama dicabut HANYA setelah penggantinya terbukti bekerja — bukan sebelum, bukan bersamaan.**

Alasannya bukan kehati-hatian umum, melainkan sifat khusus kegagalan yang dihasilkannya: **pengaman yang dicabut lebih dulu daripada penggantinya siap menghasilkan lubang yang TIDAK BERBUNYI.** Sesuatu berhenti dijaga, tidak ada yang gagal, tidak ada yang merah, dan tidak ada satu pun sinyal bahwa perlindungannya sudah hilang. Ia baru ketahuan saat hal yang dijaganya benar-benar terjadi.

Kasus yang melahirkannya: flag `ALLOW_TESTS_AGAINST_REAL_PROJECT` dipakai menjalankan pemeriksa integritas yang murni membaca data nyata. Penggantinya yang benar adalah kredensial baca-saja (SEC-13). Bila flag itu dicabut sebelum kredensial itu bekerja, **pemeriksa integritasnya mati diam-diam** — bukan gagal berisik.

Berlaku umum, bukan hanya untuk flag ini: aturan lama, pengawas lama, kolom lama, dan jalur lama tetap di tempatnya sampai penggantinya **dibuktikan** — bukan sampai penggantinya selesai ditulis.

## "Tidak Dirujuk" BUKAN Sinonim "Tidak Dibutuhkan" (ditetapkan 24 Agu 2026)

**Pembersihan yang benar bertolak dari BARIS INDUK yang diketahui, bukan dari mencari yang yatim.**

Menyapu berdasarkan ketiadaan rujukan terlihat cerdas dan sebenarnya berbahaya: ia ikut menghapus hal yang **belum sempat** dirujuk — unggahan yang gagal di tengah jalan, berkas yang barisnya sedang dibuat detik itu, data yang menunggu langkah berikutnya. Ketiadaan rujukan hanya membuktikan tidak ada yang menunjuknya **saat itu diperiksa**, bukan bahwa ia tidak dibutuhkan.

Lahir dari INF-23 (pendamping pembersihan berkas Storage): pilihan "hapus baris dulu, lalu sapu berkas yang tidak dirujuk siapa pun" ditolak justru karena alasan ini, dan diganti dengan "kumpulkan daftar berkas dari baris induknya SELAGI masih ada, baru hapus".

## Menjalankan Menemukan Apa yang Membaca Tidak Bisa (ditetapkan 24 Agu 2026)

**Typecheck bersih dan kode yang terbaca benar TIDAK membuktikan sebuah skrip bekerja. Yang membuktikan hanya menjalankannya terhadap keadaan yang sungguhan.**

Sudah terjadi berulang di proyek ini, dan tiap kali cacatnya tak terlihat dari membaca:
- **MST-16** — asumsi "semua tabel punya kolom `company_id`" lolos typecheck sempurna; yang menangkap adalah membuka layarnya (7 dari 18 tabel ternyata tidak punya).
- **INF-23** — dua cacat baru muncul saat skripnya dijalankan sungguhan: **nama perusahaan ternyata tidak unik** (dan versi pertama gagal dengan jargon Postgres alih-alih penjelasan), dan **"terhapus 1 dari 2" terbaca seperti kegagalan** padahal berkasnya memang sudah tidak ada.
- **INF-22** — urutan pembersihan Storage yang salah hanya terlihat setelah test-nya dijalankan; dari membaca kode, urutan itu tampak wajar.

Konsekuensinya untuk cara kerja: skrip atau alur yang akan menyentuh data sungguhan **wajib dijalankan lebih dulu terhadap fixture di tenant uji**, dengan keadaan yang menyerupai kenyataan — termasuk keadaan yang "seharusnya tidak terjadi", seperti nama kembar.

## Reset Penghitung Nomor: Aman SEKARANG, Tidak Akan Aman Lagi Nanti (ditetapkan 25 Agu 2026)

**Reset penghitung nomor aman dilakukan hari ini karena BELUM ADA satu pun dokumen yang terbit ke luar** — nol surat jalan, nol PO tercetak, nol dokumen di tangan siapa pun.

Begitu dokumen bernomor beredar di luar sistem — di tangan pelanggan, di tangan supplier, atau tertempel di kemasan untuk keperluan BPOM — **mengulang penghitung akan MELAHIRKAN NOMOR GANDA untuk dokumen yang berbeda**. Dan itu tidak bisa diperbaiki tanpa menarik dokumen yang sudah beredar.

**Reset setelah titik itu WAJIB lewat keputusan pemilik produk dengan alasan tertulis.**

**CARA KERJA NOMOR DI SISTEM INI, supaya tidak salah dicari** (diperiksa 25 Agu 2026): tidak ada penghitung tersimpan sama sekali — tidak ada sequence Postgres, tidak ada kolom di `company_settings`. Nomor **dihitung ulang setiap kali dokumen dibuat**, dari jumlah baris tahun berjalan. Jadi "mereset penghitung" sebenarnya berarti "menghapus barisnya"; tidak ada tombol reset yang terpisah.

**HANYA EMPAT dokumen yang bernomor**: SO, nomor batch produksi, dan nomor surat jalan (ketiganya dibangkitkan sistem), serta nomor PO klien (**diketik pengguna**, milik pelanggan — tidak pernah direset). PO ke supplier dan Work Order **tidak punya nomor sama sekali**.

**CACAT YANG SUDAH DIKETAHUI pada cara hitung ini**: karena nomor = jumlah baris + 1, menghapus satu dokumen di tengah tahun membuat nomor berikutnya menabrak nomor yang masih ada. Keempat kolom punya kekangan unik, jadi yang terjadi **bukan nomor ganda yang lolos, melainkan pembuatan dokumen yang GAGAL** tanpa penjelasan yang berguna bagi pengguna. Aman saat menghapus semuanya sekaligus; menggigit saat menghapus satu dari kumpulan yang masih hidup.

## Migrasi Hanya untuk Struktur dan Master Semua Tenant (ditetapkan 25 Agu 2026)

**Migrasi HANYA membangun STRUKTUR dan MASTER yang berlaku untuk SEMUA tenant.**

Data milik satu tenant — perusahaan, pabrik, shift, mesin, item, BOM, routing, karyawan, pelanggan, setelan perusahaan — **TIDAK BOLEH ada di migrasi**.

**Uji sederhananya**: bila sebuah baris memuat **nama, alamat, atau angka milik PT ITM**, ia salah tempat.

**Setiap fitur yang hanya bisa dijalankan lewat migrasi atau skrip adalah fitur yang BELUM SELESAI** — tenant kedua tidak punya siapa pun yang menulis migrasi untuk mereka.

## Kriteria Selesai Baru: Datanya Harus Bisa Lahir Lewat Layar (ditetapkan 25 Agu 2026)

**Sebuah modul BELUM SELESAI bila data yang dibutuhkannya hanya bisa lahir dari migrasi atau skrip.**

Ini kriteria tambahan, bukan pengganti: modul tetap harus benar, teruji, dan responsive. Yang ditambahkan adalah pertanyaan **"kalau tenant kedua memakainya besok, dari mana datanya datang?"** Bila jawabannya "seseorang menulis migrasi", modul itu belum selesai.

Alasannya bukan kerapian arsitektur. Sistem ini dijual sebagai SaaS; tenant kedua tidak punya akses ke repo, tidak punya siapa pun yang menulis SQL untuk mereka, dan tidak akan pernah tahu bahwa sebagian datanya seharusnya ada. Yang mereka lihat hanya layar yang tidak bisa diisi.

**Ditemukan lewat sensus 25 Agu 2026**: dari 24 langkah mendirikan perusahaan dari nol, beberapa langkah TIDAK punya jalur lewat layar sama sekali — termasuk pabrik, work center, shift, dan seluruh 17 setelan perusahaan (periode gajian, jam kerja standar, tarif BPJS, metode biaya). Ketiadaan itu tidak pernah terasa karena PT ITM sudah punya semuanya dari migrasi dan skrip.

## Dua Jalur Hidup untuk Hal yang Sama Adalah CACAT (ditetapkan 25 Agu 2026)

**Setelah komponen bersama ada, menulis elemen mentah untuk hal yang sama adalah CACAT, bukan pilihan.**

Diukur 25 Agu 2026 di 54 berkas TSX: **26 `<button>`, 27 `<input>`, 25 `<table>` ditulis mentah** — berdampingan dengan komponen bersama yang melakukan hal yang sama persis.

**Yang mentah TIDAK ikut berubah saat komponen bersama diperbaiki.** Itu mekanismenya, dan mekanisme itu sudah menggigit berkali-kali:
- RSP-01 memperbaiki komponen tabel bersama, dan **meninggalkan 8 halaman** yang menulis tabelnya sendiri.
- Aturan bantuan-klik ditulis, komponennya dibuat, dan **18 tempat masih memakai tooltip hover** karena mereka tidak lewat komponen itu.
- Palet warna disalin dengan benar ke 88 tempat, sementara variabel terpusatnya meleset — **dua sistem warna yang saling tidak cocok**.

Polanya selalu sama: perbaikan diterapkan di satu jalur, jalur kedua tidak ikut, dan hasilnya terlihat seperti perbaikan yang "sudah diterapkan" padahal separuh layar tidak berubah.

**Ini tidak bisa diselesaikan dengan disiplin — hanya dengan pengawas.** Aturan yang harus diingat setiap kali menulis JSX akan dilanggar, persis seperti sebelumnya. Pengawasnya dicatat sebagai bagian DS-2: gagal keras bila ada `<button>`/`<input>`/`<table>` mentah di berkas halaman, dengan daftar pengecualian eksplisit dan beralasan (mis. tabel cetak surat jalan).

## Carbon Sudah Menjawabnya — Buka Dokumentasinya, Jangan Bertanya atau Menebak (ditetapkan 25 Agu 2026)

**Carbon SUDAH menjawab pertanyaan gaya, ukuran, jarak, dan perilaku komponen. JANGAN menanyakan hal-hal itu ke pemilik produk, dan JANGAN memutuskannya sendiri — BUKA DOKUMENTASINYA.**

Yang boleh ditanyakan ke pemilik produk hanya hal yang **TIDAK dijawab Carbon**: aturan bisnis, istilah Bahasa Indonesia, urutan field menurut alur kerja pabrik, dan kebutuhan lantai produksi.

**Menanyakan hal yang sudah dijawab Carbon berarti membayar biaya adopsi tanpa mendapat manfaatnya.**

**Rujukan wajib dibuka SAAT sesi, bukan dari ingatan — versi komponen dan tokennya berubah.** Ini bukan kehati-hatian teoretis: pada 25 Agu 2026, spesifikasi yang dikutip menyebut token `$heading-03` untuk ukuran 28px. Diukur dengan **menjalankan Sass** terhadap paket yang benar-benar terpasang: `$heading-03` **ada**, tetapi nilainya **1,25rem (20px)** — ia alias dari `productive-heading-03`. Yang menghasilkan 28px adalah `productive-heading-04`.

> **KOREKSI 25 Agu 2026, dicatat karena catatannya sendiri sempat salah.** Versi pertama catatan ini menyatakan `heading-03` "tidak ada sama sekali". Itu **keliru** — ia ada. Kekeliruannya lahir dari mencari nama di daftar keluaran JavaScript (yang memakai gaya penulisan `heading03`) lalu menyimpulkan ketiadaannya di Sass. Yang membuktikan bukan mencari nama, melainkan **menjalankan `type-style` dan membaca ukuran yang keluar**. Jadi cacat aslinya bukan "nama berubah" melainkan **ukurannya berbeda dari yang dikira**, dan koreksi ini justru memperkuat aturannya: verifikasi lewat menjalankan, bukan lewat mencari.

Daftar halaman rujukan per jenis layar: `docs/governance/rujukan-carbon.md`.

**KELAS CACAT YANG SUDAH EMPAT KALI TERJADI di pilot pertama — "berhasil tanpa berlaku":**
1. Tema dikonfigurasi lewat cara yang terlihat benar; build lulus, token `:root` tetap putih.
2. Kelas `cds--type-productive-heading-04` dipakai untuk tipografi; **Carbon memancarkan NOL kelas utilitas tipografi**, jadi kelas itu tidak pernah berlaku dan heading jatuh ke bawaan peramban. Yang benar: mixin Sass `type-style`.
3. `<Tag>` dipakai menandai field "belum diisi"; Tag Carbon **memang berbentuk pil** — komponennya salah pilih, bukan Carbon yang ditimpa. Yang benar: `warn`/`warnText` bawaan kontrolnya.
4. Sudut membulat dinyatakan "sudah nol" setelah **membaca** `tailwind.config.ts`; nyatanya config hanya menimpa 3 dari 9 anak tangga `borderRadius`, dan kode memakai 4 anak tangga yang **tidak** ditimpa di 34 tempat. Yang benar: **menjalankan** Tailwind dan mengukur CSS yang dipancarkan.

Keempatnya lolos build, lolos typecheck, dan terlihat bekerja. **Satu-satunya yang menangkapnya adalah MENGUKUR hasil yang benar-benar keluar** — nilai token yang dipancarkan, kelas yang benar-benar ada di CSS, radius yang benar-benar berlaku.

### Memeriksa yang TERTULIS tidak bisa menemukan yang TIDAK tertulis (ditetapkan 25 Agu 2026)

Cacat nomor 4 di atas layak jadi aturannya sendiri, karena bentuknya paling licin: **pemeriksaannya benar, kesimpulannya yang kelewat luas.**

Membaca config dan mendapati setiap nilai di sana bernilai `0px` adalah pengamatan yang **akurat**. Yang keliru adalah melompat dari *"semua yang tertulis di sini nol"* ke *"semuanya nol"* — padahal kerangka bawaan (Tailwind, Carbon, pustaka apa pun) menyumbang nilai yang **tidak muncul di berkas mana pun di repo ini**.

**Aturannya**: sebelum menyatakan sebuah nilai "sudah benar di mana-mana", tanyakan **berapa banyak kemungkinan yang ada seluruhnya**, lalu bandingkan dengan berapa yang benar-benar diperiksa. Bila jumlahnya tidak diketahui, jawabannya belum boleh berbentuk "semuanya".

**Dan perbaikannya menimpa SELURUH anak tangga, bukan hanya yang dipakai hari ini** — anak tangga yang belum dipakai sekarang adalah lubang untuk besok, dan tidak akan ada yang mengingatkan.

## Pemilik Produk Adalah ALAT VERIFIKASI, Bukan Sekadar Penerima Hasil (ditetapkan 25 Agu 2026)

**Perbandingan visual BERDAMPINGAN adalah kemampuan yang hanya dimiliki pemilik produk — Claude Code tidak bisa melihat layar.**

Lahir dari cara halaman `/register` diperiksa: pemilik produk meletakkan tangkapan layar katalog Carbon resmi **di samping** layar kita, lalu melihat keduanya sekaligus. Yang ditemukan begitu: tombol melebar penuh dengan teks di tengah (Carbon menaruh teks di kiri), kartu berbingkai yang Carbon tidak berbingkai, dan penanda fokus yang berbeda tebal dan warnanya.

**Tidak satu pun tertangkap** oleh membaca kode, membaca dokumentasi, atau mengukur CSS keluaran — ketiga cara yang sudah dipakai dan dikira cukup. Mengukur CSS membuktikan sebuah nilai **sesuai niatnya**; ia tidak bisa membuktikan **niatnya sendiri salah**.

**ATURAN**: setiap layar yang dinyatakan selesai dimigrasikan **WAJIB dilaporkan beserta alamat halaman katalog Carbon yang sepadan**, supaya pemilik produk bisa membandingkan berdampingan. Daftarnya di `docs/governance/rujukan-carbon.md`. Menyerahkan layar tanpa alamat itu berarti menahan satu-satunya pemeriksaan yang terbukti menangkap kelas cacat ini.

Berlaku lebih luas dari Carbon: bila sebuah pemeriksaan hanya bisa dilakukan mata manusia, **rancang laporannya supaya pemeriksaan itu mudah dijalankan** — jangan melaporkan hanya kesimpulan yang bisa dicapai sendiri.

## FAKTA PROYEK — Sistem Diselesaikan Dulu, Baru Dipakai Pihak Luar (ditetapkan 25 Agu 2026)

**Pengguna satu-satunya untuk sementara adalah pemilik produk dan tim internal PT ITM.** Sistem dibangun sampai selesai lebih dahulu, baru diberikan ke pihak luar.

**Diperkuat angka dari audit navigasi 25 Agu 2026**: dari 16 peran yang dikenal sistem, hanya 7 yang punya akun, dan **ketujuhnya berakhiran `@debug.mrp`** — **nol akun manusia sungguhan**.

**KONSEKUENSI LANGSUNG:**
- **Navigasi cukup SATU MODE** — seluruh item ditampilkan, masing-masing dengan penanda status kejujurannya. **Mode publik TIDAK dibangun sekarang**; kelak ia hanya penyaringan dari navigasi yang sama, bukan sistem kedua.
- **PEMICU membangun mode publik**: sebelum tenant di luar PT ITM diberi akses.

**Aturan Fable "item parkir tidak muncul di navigasi publik" DIBATALKAN pemilik produk** dengan alasan yang sah: menyembunyikan sesuatu dari pengguna yang belum ada tidak menghasilkan apa-apa, sementara menampilkan seluruhnya memberi peta apa yang akan dikerjakan.

**SATU HAL TETAP**: item yang keputusannya **DITOLAK** (Sales Forecast) ditandai **"ditolak — keputusan tercatat"**, BUKAN "direncanakan". Menampilkan hal yang sudah ditolak sebagai rencana akan membuat seseorang mengira ia akan dibangun.

## Label Navigasi Bahasa Inggris, Isi Halaman Tetap Bahasa Indonesia (ditetapkan 25 Agu 2026)

**Ini mengubah aturan yang sudah ada, jadi batasnya ditulis tegas.**

**Label NAVIGASI memakai Bahasa Inggris** untuk sekarang, mengikuti penamaan workspace di dokumen Information Architecture.

**Label ISI HALAMAN — field, tombol, pesan, status, judul tabel — TETAP Bahasa Indonesia** dari Kamus.

Keduanya tidak bertentangan: **navigasi adalah nama modul; isi halaman adalah yang dibaca orang pabrik.**

**PEMICU PENINJAUAN**: sebelum ada pengguna di luar tim internal, atau bila ada anggota tim yang kesulitan membacanya.

> Catatan batas: aturan "SELURUH komunikasi ke pemilik produk WAJIB Bahasa Indonesia" **tidak tersentuh** oleh keputusan ini. Yang berubah hanya label navigasi di layar.

## Deviasi Resmi dari Carbon — LEBAR PENUH (ditetapkan 25 Agu 2026)

**Carbon menempatkan isi di dalam grid dengan batas lebar. FABRIX memakai LEBAR PENUH.**

**ALASAN**: ERP padat data. Tabel dengan banyak kolom membutuhkan seluruh lebar layar; membuang ruang di kiri dan kanan membuat kolom terpotong lebih cepat — dan **memotong kolom diam-diam sudah jadi cacat berulang di proyek ini** (RSP-01, RSP-02).

**Keputusan pemilik produk, 25 Agustus 2026.**

**YANG TETAP DARI CARBON meski lebarnya penuh — jangan ikut dilepas:**
1. Tinggi header dan navigasi samping sesuai spesifikasi Carbon.
2. Jarak dalam (padding) isi memakai **token**, bukan angka.
3. Perilaku navigasi samping di layar sempit: menjadi menu buka-tutup, dan **menutup sendiri setelah berpindah halaman** (aturan RSP-01).
4. **SkipToContent** — melompat ke isi utama, wajib untuk aksesibilitas.
5. Fokus keyboard terlihat, urutan Tab masuk akal.

**Lebar penuh hanya menyentuh LEBAR, bukan yang lain.** Sesi berikutnya: jangan "memperbaikinya" jadi bergrid.

## Data Berkala Wajib Punya Pemicu Berkala (ditetapkan 25 Agu 2026)

**Ini kelas yang lebih berbahaya daripada "menulis saat dibaca", dan perlu dibedakan darinya.**

Riwayat KPI hanya bertambah **bila ada yang kebetulan membuka halamannya**. Akibatnya grafik trennya merekam **KAPAN ORANG MEMBUKA HALAMAN**, bukan **bagaimana angkanya bergerak** — dua hal yang sangat berbeda, dan **tidak ada apa pun di layar yang memberi tahu bedanya**.

**Ini bukan cacat teknis melainkan ANGKA YANG BERBOHONG TANPA TERLIHAT BERBOHONG**: grafiknya rapi, sumbunya benar, datanya nyata, artinya salah. Tidak ada pesan galat, tidak ada test merah, tidak ada yang mengeluh.

**ATURAN**: data berkala — tren, riwayat, snapshot — **WAJIB punya pemicu yang berkala**: jadwal, atau tindakan sadar. **Data berkala yang lahir dari kunjungan halaman merekam kebiasaan menjelajah, bukan kenyataan.**

Penjaganya: `tests/membaca_tidak_menulis.test.ts`.

## "Kebetulan Benar" — Kelas Cacat Keempat (ditetapkan 25 Agu 2026)

**Bila sebuah hal ditulis berulang di banyak tempat dan kebenarannya bergantung pada penulisnya mengingat caranya, ia butuh SATU PINTU BERSAMA — bukan aturan.**

Kasus yang melahirkannya: **36 halaman menulis cara mengambil tanda pengenalnya masing-masing. 35 kebetulan benar, 1 tidak** — dan tidak ada satu tempat pun yang bisa diperiksa untuk mengetahuinya. Halaman yang ke-36 tidak bisa dibuka sama sekali selama berhari-hari.

**"Kebetulan benar" adalah bentuk yang paling sulit ditemukan, karena tidak ada yang mengeluh sampai yang berikutnya lahir.** Ia tidak muncul di test, tidak muncul di typecheck, dan tidak muncul di layar — sampai satu salinan meleset.

Ini **contoh keempat** dari kelas yang sama, setelah:
1. **88 warna heksadesimal** ditulis tangan di 54 berkas — nilainya benar, sistemnya dua.
2. **Tombol, input, dan tabel mentah** berdampingan dengan komponen bersama.
3. **Tooltip hover di 18 tempat** setelah aturan bantuan-klik ditulis dan komponennya dibuat.
4. **36 pengambil tanda pengenal**, 35 kebetulan benar.

**Yang membedakannya dari ketiga sebelumnya**: tiga yang pertama terlihat di layar begitu diperhatikan. Yang keempat **tidak terlihat sama sekali** — halaman yang salah tampak seperti halaman yang butuh login.

## Penjaga yang Salah Tuduh Diperketat, Bukan Dibiarkan (ditetapkan 25 Agu 2026)

**Penjaga yang salah tuduh melatih orang mengabaikan hasilnya.** Begitu sebuah pengawas dikenal sering keliru, orang berhenti membaca keluarannya — dan sejak saat itu ia tidak menjaga apa pun, sambil tetap terlihat menjaga.

Sudah terjadi dua kali dalam satu hari, keduanya langsung diperketat:
- Penjaga layar publik **menuduh halaman POD menulis `<input>` mentah**, padahal yang ditemukannya kata itu di dalam kalimat penjelasan. → komentar dibuang sebelum disisir.
- Penjaga jalur baca **menuduh tiga berkas menulis ke basis data**, padahal ketiganya memanggil `visiting.delete(...)` — Set JavaScript biasa di penelusuran BOM. → polanya mewajibkan rantai `.from('tabel')` mendahuluinya.

**Berlaku untuk seluruh pengawas di proyek ini**: pengawas yang keliru diperbaiki di giliran yang sama, bukan dicatat sebagai "nanti".

## URUTAN PEMERIKSAAN CARBON — MENGIKAT (ditetapkan 25 Agu 2026)

Empat sumber, dipakai **berurutan**, dan masing-masing menjawab pertanyaan yang berbeda:

1. **`carbondesignsystem.com/patterns`** — **kapan** dan **kenapa**. Pola menentukan komponen, bukan sebaliknya.
2. **Usage komponen** — **konteks pemakaian**: kapan komponen itu dipakai, dan kapan TIDAK.
3. **`react.carbondesignsystem.com` (Storybook)** — **bagaimana**: properti apa yang ada, nilai bawaannya, perilakunya.
4. **Paket di `node_modules`** — **nama token dan nilai sebenarnya**.

**Nomor 4 SELALU MENANG bila bertentangan.** Dokumentasi bisa mendahului atau tertinggal dari versi paket.

**Kenapa nomor 3 ditambahkan, dan ini bukan kelengkapan formalitas**: kesalahan `persistent` pada pencarian tabel lahir persis karena propertinya tidak pernah diperiksa di Storybook. Properti itu **mematikan perilaku bawaan** Carbon — pencarian yang seharusnya melipat jadi selalu terbuka — dan halaman Usage tidak menyebutnya sama sekali. Halaman Usage menjawab *"pakai pencarian di toolbar"*; hanya Storybook yang menjawab *"dan begini properti-propertinya"*.

## Properti KOSONG Tidak Sama dengan Properti TIDAK ADA (ditetapkan 25 Agu 2026)

`titleText=""` pada komponen Carbon **tetap merender elemen labelnya** — hanya isinya yang kosong. Diukur: kotak saringan terdorong **16px lebih rendah** daripada kontrol di sebelahnya, dan terlihat melenceng dari toolbar.

Yang benar: `titleText="Tipe"` **+ `hideLabel`** — labelnya tetap dibacakan pembaca layar, hanya disembunyikan secara visual. Membuang labelnya sama sekali akan membuat kontrol itu **tidak punya nama** bagi yang tidak melihat layar.

**Waspadai di komponen lain**: string kosong sering diperlakukan sebagai "ada, tapi kosong", bukan "tidak ada".

## Periksa Apa yang SUDAH Dibawa Komponen Sebelum Menambahkan yang Serupa (ditetapkan 25 Agu 2026)

Judul ganda di Master Item lahir karena judul halaman ditambahkan **tanpa mencabut judul bawaan `DataTable`**. Anatomi DataTable Carbon memang memuat "Title and description" — jadi "Daftar item" muncul dua kali, berjarak beberapa sentimeter, dan pembacanya mengira ada dua hal berbeda.

**ATURAN**: saat memakai komponen Carbon, periksa dulu **apa yang sudah dibawanya** sebelum menambahkan yang serupa di sekitarnya. Komponen Carbon sering membawa lebih banyak daripada yang terlihat dari namanya.

## Menguji Komponen Carbon WAJIB dengan Klik Nyata (ditetapkan 25 Agu 2026)

**Klik programatik (`element.click()`) tidak memicu Carbon sama sekali.**

Pengujian pertama saringan Master Item memberi **hasil palsu**: seluruh interaksi dilaporkan "tidak berpengaruh" padahal komponennya baik-baik saja — yang tidak bekerja adalah cara mengujinya. Yang benar: kirim peristiwa tetikus sungguhan ke koordinat elemennya.

Ini kelas yang sama dengan **test yang lulus tanpa menguji apa pun**: keduanya menghasilkan laporan yang terlihat meyakinkan dan tidak mengandung informasi.

## Komentar yang Menyebut Risiko WAJIB Menyebut Batasnya (ditetapkan 25 Agu 2026)

**Menyebut satu risiko tanpa menyebut apa yang TIDAK dicakupnya memberi rasa aman yang tidak berdasar — dan rasa aman yang keliru menghentikan pemeriksaan yang seharusnya terjadi.**

Kasus yang melahirkannya: kode unggah foto profil punya komentar yang menyadari bahwa mengganti PNG dengan JPG meninggalkan berkas yatim. Benar. Yang **tidak** disebutnya: mengganti PNG dengan PNG **menghapus yang lama tanpa jejak** — dan begitulah foto pemilik produk hilang permanen.

**Setengah sadar lebih berbahaya daripada tidak sadar**: komentarnya membuat pembaca berikutnya mengira masalahnya sudah dipikirkan, lalu melanjutkan. **Kode tanpa komentar justru lebih mungkin diperiksa ulang.**

**Bentuk kalimat yang dituju**: *"ini menangani A; ini TIDAK menangani B."*

## Peringatan Disusun Menurut KEPUTUSAN, Bukan Menurut Perhitungan (ditetapkan 25 Agu 2026)

**Satu keputusan, satu peringatan. Sebab-sebabnya disebutkan DI DALAMNYA.**

Alasannya, dan ini yang akan dirujuk untuk peringatan lain:

> Orang gudang tidak bertanya *"apakah stok di bawah ambang persen"* atau *"apakah kebutuhan melebihi sisa"*. Ia bertanya **satu hal**: bahan ini perlu dipesan atau tidak.
>
> Dan yang paling berharga: **dua sebab yang BERTENTANGAN jadi terlihat.** Bila stok cukup menurut persen tapi kurang menurut jadwal produksi, itu **informasi terpenting di layar** — dan dua peringatan terpisah justru menyembunyikannya.

Dua peringatan untuk satu bahan memaksa orang menerjemahkan **dua jawaban jadi satu keputusan**, dan begitu keduanya pernah tidak sepakat, ia berhenti mempercayai keduanya.

**Yang WAJIB ada di peringatan gabungan:**
1. **Seluruh sebab yang menyala**, bukan yang pertama saja.
2. **Sebab yang TIDAK menyala pun disebut bila membantu keputusan** — mis. *"sisa 8%, tapi masih cukup untuk produksi terjadwal"*. Itu keterangan yang **mencegah pembelian tergesa-gesa**.
3. **Sebab yang bertentangan ditampilkan menonjol** — itu yang paling perlu dilihat manusia.
4. Keadaan yang **artinya berbeda** tidak dicampur — mis. "belum pernah dibeli" bukan "stok habis".

## Isian yang Satu Hal Wajib Punya SATU Label (ditetapkan 25 Agu 2026)

**Dua field bisa BERDAMPINGAN dan tetap tidak terbaca sebagai satu isian, bila masing-masing punya label sendiri. Bukan jaraknya yang memisahkan, melainkan LABELNYA.**

Kasus yang melahirkannya: pemilik produk meminta "kolom angka di sebelah dropdown satuan" untuk masa simpan — dan itu **persis** yang sudah ada di layar. Diukur: keduanya berdampingan di baris yang sama. Yang membuatnya tidak dikenali adalah dua label terpisah: **"Shelf life"** dan **"Satuan shelf life"** terbaca sebagai **dua hal**; satu kelompok berlabel **"Masa simpan"** terbaca sebagai **satu**.

**ATURAN**: isian yang secara makna satu hal WAJIB punya **satu label**, bukan label per bagian.

## Field yang Saling Membatalkan Wajib Berdekatan dan Hubungannya Terlihat (ditetapkan 25 Agu 2026)

**Bila mengisi satu field membuat field lain tidak berlaku, keduanya WAJIB berdekatan dan hubungan itu WAJIB terlihat — bukan hanya diketahui kode.**

Kasus yang melahirkannya: "Stok minimum (persen)" berada di kolom **ketiga**, "Stok minimum (angka mutlak)" di kolom **pertama baris berikutnya**. Yang satu **membatalkan** yang lain, dan orang bisa mengisi salah satunya **tanpa pernah melihat yang lain**.

Ini lebih berat daripada kelas label di atas: yang itu membuat orang tidak menemukan isiannya; yang ini membuat orang **mengisi sesuatu yang diam-diam tidak berlaku**.

## Teks Panjang di Migrasi Ditulis Tanpa Bergantung Pemisah (ditetapkan 25 Agu 2026)

**Teks yang memuat karakter pemisah pernyataan bisa merusak migrasi tanpa gejala yang jelas.**

Sebuah migrasi gagal **tiga kali** berturut-turut, dan galatnya menunjuk ke akhir berkas — bukan ke penyebabnya. Sebab sebenarnya: **tiga kutip berturut-turut** (`'''`) di dalam sebuah string menutupnya lebih awal, sehingga sisa migrasi terbaca sebagai potongan yang tidak lengkap.

**ATURAN**: teks panjang di dalam migrasi — terutama yang memuat kutip, titik koma, atau tanda dolar — ditulis lewat `concat_ws(chr(10), '…', '…')`, bukan lewat rangkaian `E'…' || E'…'`. Itu menghilangkan **seluruh kelasnya**, bukan satu kejadiannya.

**TAMBAHAN 25 Agu 2026, setelah kelas KEDUA muncul di hari yang sama.** `insert ... values (` yang isinya panjang gampang ditutup dengan **satu** kurung padahal butuh **dua** — satu untuk `concat_ws`, satu untuk `values`. Postgres menjawabnya dengan `unexpected end of function definition at end of input` sambil menunjuk **baris terakhir berkas**, yaitu tempat yang sama sekali salah. Ini terjadi **dua kali dalam satu giliran kerja**, dan kedua kalinya menghabiskan waktu jauh lebih banyak daripada seharusnya.

Penjaganya sekarang ada: `tests/migrasi_kurung_seimbang.test.ts` menghitung kurung di luar string dan komentar, lalu menyebut **baris tempat kurungnya dibuka**. Jangan mengandalkan pesan Postgres untuk kelas cacat ini — ia menunjuk ujung berkas.

## FOKUS SATU TASK — Temuan Lain DICATAT, Bukan Dikerjakan (ditetapkan 25 Agu 2026)

**Saat mengerjakan sebuah task, temuan yang TIDAK BERHUBUNGAN dengan task itu DICATAT SEBAGAI TASK — bukan dikerjakan saat itu juga. Lebih baik daftar tugas bertambah panjang dan diselesaikan satu per satu, daripada satu pekerjaan tidak pernah selesai karena terus berbelok ke pekerjaan lain.**

**BUKTI YANG MELAHIRKANNYA, dicatat apa adanya**: 25 Agustus, pekerjaan dimulai siang dengan menerapkan Carbon Design ke seluruh halaman. Sampai malam, yang dikerjakan adalah fitur peringatan stok bahan, permintaan pembelian, dan Tasks & Approvals — **tidak satu pun berhubungan dengan Carbon**.

> **Tidak ada satu pun langkah yang salah secara sendiri-sendiri. Yang salah adalah tidak ada yang menghitung berapa jauh sudah berbelok.**

**INI MENGIKAT ARSITEK JUGA, bukan hanya Claude Code.** Sebagian besar pergeseran hari itu justru lahir dari sisi arsitek: laporan koreksi UI dijawab dengan blok perintah fitur baru yang lengkap, alih-alih menyuruh temuannya dicatat. **Bila Claude Code melaporkan temuan di luar konteks task berjalan, jawabannya adalah "catat sebagai task"** — bukan blok perintah membangunnya. Blok perintah disusun saat task itu tiba gilirannya.

### Yang TETAP dikerjakan saat itu juga — empat pengecualian, dan hanya empat

Batasnya ditulis tegas karena aturan ini berbahaya bila diterapkan buta:

1. **MENGHALANGI task berjalan.** Bila pekerjaan tidak bisa dilanjutkan tanpa memperbaikinya, itu **bagian dari task**, bukan temuan.
2. **KEBOCORAN DATA atau KEHILANGAN DATA.** Isolasi antar tenant, data yang bisa terhapus permanen, kredensial yang terbuka.
3. **RUSAK OLEH PEKERJAAN INI SENDIRI.** Bila sebuah halaman rusak karena yang baru dikerjakan, itu tanggung jawab task berjalan.
4. **SATU BARIS ATAU KURANG, dan jelas benar.** Mencatatnya sebagai task lebih mahal daripada memperbaikinya.

Selain empat itu: **CATAT, jangan kerjakan.**

### Cara mencatatnya — supaya tidak jadi alasan menghindar

1. Cukup detail sehingga bisa dikerjakan **tanpa mengulang penyelidikan**. Sertakan bukti yang sudah ditemukan.
2. Sebutkan asalnya: *"ditemukan saat mengerjakan [task]"*.
3. **Urgensi yang jujur.** Temuan yang dicatat sebagai "Bisa Menunggu" padahal berbahaya **sama saja dengan tidak dicatat**.
4. Bila temuannya menyentuh task berjalan tapi bisa ditunda, sebutkan kaitannya **di kedua task**.

### Pergeseran DILAPORKAN, tidak diam-diam

Setiap laporan menyebutkan: **"task yang dikerjakan: X. Temuan yang dicatat dan TIDAK dikerjakan: [daftar]."** Bila daftar itu panjang, **itu sendiri informasi** — pekerjaan yang sedang dikerjakan mungkin menyentuh bagian sistem yang banyak masalahnya.

**BUTIR WAJIB DI SETIAP LAPORAN**: *"Apakah giliran ini tetap pada task yang direncanakan? Bila tidak, kenapa, dan apakah alasannya masuk salah satu dari empat pengecualian di atas?"* Inilah yang menghitung berapa jauh sudah berbelok — hal yang selama ini tidak ada.

### Prinsip yang menjelaskan kenapa aturan ini perlu

> **Setiap belokan terasa masuk akal saat diambil. Yang tidak terasa adalah JUMLAHNYA. Sepuluh belokan yang masing-masing masuk akal tetap menghasilkan hari yang tidak menyelesaikan apa pun.**

## DS-RULES — Gerbang Rencana Carbon Sebelum Membangun Layar (ditetapkan 25 Agu 2026)

Ditetapkan atas permintaan eksplisit pemilik produk setelah gelombang layar publik selesai. **Berlaku untuk SETIAP layar internal yang dibangun atau dimigrasikan sejak sekarang, tanpa kecuali.**

### A. GERBANG: rencana dulu, kode kemudian

**A.1 — Sebelum menulis SATU BARIS KODE untuk sebuah layar, serahkan RENCANA CARBON layar itu dan BERHENTI.** Kode baru boleh ditulis setelah rencananya dilaporkan.

**Alasannya, dan ini yang membuatnya gerbang dan bukan anjuran**: aturan yang bergantung pada ingatan sudah terbukti gagal berkali-kali di proyek ini — aturan bantuan-klik dilanggar di 18 tempat, komponen tabel bersama meninggalkan 8 halaman, palet warna melahirkan dua sistem yang tidak cocok. Yang bekerja bukan disiplin, melainkan **gerbang yang menghasilkan keluaran**: rencana yang tidak ada berarti pekerjaan yang belum boleh mulai, dan ketiadaannya terlihat.

**A.2 — Rencana Carbon WAJIB memuat tujuh hal:**
1. **POLA (Pattern)** mana yang berlaku, beserta alamat halaman rujukannya.
2. **DAFTAR KOMPONEN** satu per satu, beserta **ALASAN** pemilihannya — kenapa komponen ITU, bukan yang mirip.
3. **VARIAN** tiap komponen (ukuran, jenis, mode) beserta alasannya.
4. **TATA LETAK**: kolom grid, breakpoint, dan perilaku di layar sempit.
5. **SPESIFIKASI**: token jarak dan tipografi — **nama tokennya, bukan angka px**.
6. **KEADAAN** yang ditangani: kosong, memuat, galat, berhasil, tanpa izin.
7. **ALAMAT KATALOG CARBON** yang sepadan, untuk perbandingan berdampingan setelah jadi.

**A.3 — Rencana dicetak DI CHAT**, bukan hanya disimpan di berkas.

### B. POLA (Patterns) — rujukan wajib, bukan pilihan

**B.1 — POLA MENENTUKAN KOMPONEN, BUKAN SEBALIKNYA.** Carbon menyediakan pola: solusi praktik terbaik untuk **bagaimana pengguna mencapai tujuannya** — gabungan komponen beserta urutan dan alurnya, bukan sekadar daftar komponen. **Buka halaman polanya SEBELUM memilih komponen.** Daftar pola beserta alamatnya di `docs/governance/rujukan-carbon.md`.

**B.2 — Bila sebuah layar tidak punya pola yang cocok, KATAKAN BEGITU di rencana**, dan sebutkan pola terdekat yang dipakai sebagai acuan. **Jangan diam-diam merancang sendiri.**

### C. Komponen — periksa KONTEKS PEMAKAIAN, bukan sekadar bentuknya

**C.1 — Buka tab *Usage* LEBIH DULU**, sebelum *Style* dan *Code*. Di situ dijelaskan kapan komponen dipakai dan kapan **tidak**. Kesalahan `Tag` di pilot pertama lahir persis dari sini: komponennya benar-benar Carbon, bentuknya benar, **konteks pemakaiannya yang salah** — Tag untuk menggolongkan dan menyaring, bukan untuk status field.

**C.2 — MODAL: pilih variannya sesuai SIFAT PEKERJAAN**, jangan satu bentuk untuk semua. Pasif (hanya memberi tahu) · Transaksional (satu keputusan, satu aksi) · Bertahap (pekerjaan berlangkah dengan konfirmasi di ujung) · Berbahaya (tindakan merusak). **Sebutkan di rencana varian mana dan kenapa.**

**C.3 — TABEL: periksa kemampuan bawaan DataTable sebelum memakai** — ukuran baris, pengurutan, penyaringan, baris yang bisa dimekarkan, pemilihan banyak baris beserta aksi massalnya, pembagian halaman, kolom yang bisa disembunyikan, keadaan kosong, keadaan memuat. **JANGAN memakai tabel polos lalu menambal kemampuannya sendiri** — itu melahirkan dua jalur hidup untuk hal yang sama. **Sebutkan di rencana kemampuan mana yang dipakai dan mana yang tidak, beserta alasannya.**

**C.4 — HEADER DAN NAVIGASI: pakai UI Shell Carbon, jangan merakit sendiri.** Karena ini menyentuh SELURUH layar sekaligus, rencananya **disodorkan ke pemilik produk sebelum dikerjakan** — bukan diputuskan sendiri.

**C.5 — TATA LETAK: buka panduan grid Carbon sebelum menyusun kolom.** Breakpoint Carbon sudah ditetapkan: **320 / 672 / 1056 / 1312 / 1584 px**. Jangan menyusun kolom dari selera.

### D. Spesifikasi — token, bukan angka

**D.1 — Seluruh ukuran, jarak, warna, dan tipografi memakai TOKEN Carbon. Nol angka px ditulis langsung, nol nilai warna ditulis langsung.** Alasannya bukan kerapian: 88 warna yang ditulis langsung di 54 berkas adalah sebab langsung dari rasa "dibuat orang berbeda" yang dikeluhkan pemilik produk.

**D.2 — Nama token diverifikasi dari PAKET YANG TERPASANG di `node_modules`, bukan dari dokumentasi saja.** Dokumentasi bisa mendahului atau tertinggal dari versi paket. **Dokumentasi untuk memahami MAKSUDNYA; paket untuk memastikan NAMANYA dan NILAINYA.**
> Dan verifikasinya dengan **MENJALANKAN**, bukan mencari nama. Terbukti dua kali pada token yang sama: spesifikasi menyebut `$heading-03` = 28px (salah — nilainya 20px), lalu catatan koreksinya sendiri menyatakan token itu tidak ada (juga salah — ia ada). Mencari nama gagal dua arah; menjalankan `type-style` dan membaca ukurannya tidak.

**D.3 — Setelah selesai, UKUR DARI CSS HASIL BUILD, bukan dari kode sumber.** Empat kejadian "berhasil tanpa berlaku" seluruhnya lolos build dan lolos typecheck; yang menangkapnya hanya mengukur hasil yang benar-benar keluar.

### E. Yang boleh dan tidak boleh ditanyakan ke pemilik produk

**E.1 — JANGAN menanyakan hal yang SUDAH DIJAWAB Carbon**: ukuran, jarak, warna, bentuk komponen, perilaku bawaan, tipografi. Buka dokumentasinya. Menanyakan hal yang sudah dijawab berarti **membayar biaya adopsi tanpa mendapat manfaatnya**.

**E.2 — YANG BOLEH ditanyakan hanya yang TIDAK dijawab Carbon**: aturan bisnis, istilah Bahasa Indonesia, urutan field menurut alur kerja pabrik, kebutuhan lantai produksi, dan hak akses.

**E.3 — JANGAN memutuskan sendiri hal yang dijawab Carbon dengan alasan "sepertinya lebih baik".** Bila Carbon dinilai keliru untuk kasus ini, itu **DEVIASI** — didokumentasikan sebagai domain pattern dengan alasan tertulis, **bukan improvisasi diam-diam**.

## Aturan Navigasi & Route — MENGIKAT (ditetapkan 25 Agu 2026)

Diambil dari `docs/FABRIX_UX_Application_Shell_Navigation_Architecture_v1_0.md` (§5, §27, §32, §33–§36, §45). Dicatat **sebagai aturan, bukan sebagai task**, karena berlaku ke seluruh pekerjaan navigasi — bukan ke satu pekerjaan tertentu.

1. **Status navigasi DATA-DRIVEN.** Penanda status tiap item navigasi diisi **dari hasil audit**, dan **DILARANG diketik dari ingatan**. Sumbernya `docs/ar0-inventaris-as-is.md` dan `docs/nav-matriks-status-dan-konflik.md`. Status yang ditebak akan berbohong tanpa ada yang tahu.

2. **Alamat halaman DILARANG dikarang.** Setiap item navigasi yang bertanda aktif **wajib punya route yang benar-benar ada**. Bila belum ada, itemnya ditandai belum aktif — bukan diberi alamat yang terdengar masuk akal.

3. **Fitur yang SUDAH terbangun tapi tidak punya rumah di navigasi WAJIB diinventarisasi.** Fitur yang tidak punya menu akan hilang dari ingatan semua orang, dan kelak dibangun ulang oleh seseorang yang tidak tahu ia sudah ada.

4. **Route yang sudah ada dan berfungsi DIPERTAHANKAN.** **DILARANG membuat sistem route paralel.** Bila sebuah alamat perlu berubah, perubahannya lewat **pengalihan**, bukan dengan meninggalkan yang lama mati.

5. **STOP-DOCUMENT-ESCALATE bila route bertabrakan.** Bila dua hal memperebutkan satu alamat: **berhenti**, catat tabrakannya, dan tanyakan ke pemilik produk. **DILARANG membuat route duplikat diam-diam** — yang kalah akan mati tanpa gejala.

6. **DILARANG membuat halaman kosong supaya sitemap terlihat lengkap.** Halaman kosong yang bisa dibuka lebih buruk daripada menu yang jujur bertanda "belum ada": yang pertama membuat orang mengira fiturnya rusak, yang kedua membuat orang tahu ia belum dibangun.

## Pola Unggah Gambar — BERLAKU untuk SELURUH Unggahan Berikutnya (ditetapkan 25 Agu 2026)

Ditetapkan pemilik produk setelah alur foto profil selesai, dan **berlaku maju untuk semua proses unggah**, bukan hanya foto profil dan tanda tangan.

1. **GAMBARNYA SENDIRI adalah tombolnya.** Diklik → jendela pilih berkas terbuka. Tidak ada tombol "Pilih berkas" terpisah di bawahnya.
2. **Bawaannya IKON Carbon**, bukan inisial huruf dan bukan tulisan "belum ada". Inisial terlihat seperti data padahal cuma tebakan dari nama.
3. **Begitu dipilih, gambarnya langsung berubah jadi PRATINJAU**, dengan keterangan menetap **"— belum tersimpan"**. Belum ada apa pun yang terkirim ke server.
4. **Tombol simpan ada DI LUAR kartu**, dan menutup seluruh perubahan di kartu itu sekaligus. Ia **mati** selama belum ada yang berubah.
5. **Konfirmasi lewat MODAL** (varian transaksional), karena di situ memang ada keputusan yang harus diambil.
6. **Hasilnya lewat NOTIFIKASI, BUKAN MODAL** — berhasil maupun gagal. Tempatnya **kanan atas, tepat di bawah header**, lewat komponen bersama `AreaNotifikasi` (`src/components/ui/notifikasi.tsx`). **Jangan menempatkannya sendiri per halaman.**

   **Yang Carbon tetapkan dan yang TIDAK** — diukur dari paket terpasang, bukan dari ingatan:
   - **Ditetapkan Carbon**: lebar toast 288px (352px di breakpoint `max`), anatomi, warna, ikon.
   - **TIDAK ditetapkan Carbon**: **posisi** (`_toast-notification.scss` punya nol aturan `position`) dan **durasi** (`timeout` bawaan `0` = tidak pernah hilang sendiri). Keduanya **keputusan kita**, dan keduanya hidup di satu berkas itu.

7. **Pesan BERHASIL hilang sendiri setelah 5 detik; pesan GAGAL TIDAK pernah hilang sendiri.** Alasannya panduan Carbon: *"jangan pakai toast untuk informasi yang harus diingat pengguna sambil bekerja"*. Yang berhasil boleh lewat begitu saja — perubahannya sudah terlihat di layar. Yang gagal memuat hal yang harus **ditindaklanjuti**, dan pesan yang menghilang sebelum dibaca sama dengan pesan yang tidak pernah muncul.
8. **Gambar yang gagal dimuat jatuh ke ikon bawaan**, bukan gambar patah.
9. **Nama berkas UNIK**, `upsert: false`, dan **berkas lama TIDAK dihapus** saat unggahan baru. Pembersihannya urusan INF-23.
10. **Berlaku juga aturan unggah yang sudah ada**: titik unggah BARU wajib lewat `uploadFileWithMetadata` di `src/lib/fileUpload.ts`.

**Bedanya modal dan notifikasi, supaya tidak tertukar lagi**: **modal untuk MEMUTUSKAN, notifikasi untuk MEMBERI TAHU.** Modal untuk pesan berhasil menghentikan pekerjaan dan harus ditutup dulu padahal tidak ada keputusan yang perlu diambil.

> **Asal aturan butir 6**, dicatat karena ia contoh bagus cara kerja yang dituju: Claude Code membangun modal berhasil sesuai permintaan, **lalu menyebutkan bahwa Carbon menganjurkan sebaliknya** dan mencatatnya sebagai deviasi atas keputusan pemilik produk. Pemilik produk membacanya dan mencabut permintaannya sendiri: *"ikuti saran carbon, saya yg salah"*. Yang membuat itu mungkin bukan Claude Code menolak, melainkan Claude Code **mengerjakan sambil menyebut harganya**.

## Dilarang Membangun Sistem Identitas/Peran/Persetujuan PARALEL (ditetapkan 25 Agu 2026)

Dari §32 dokumen arsitektur peran, dan dicatat **sebagai aturan yang berlaku SEKARANG** — bukan sebagai bagian task `SEC-18` yang masih menunggu giliran.

**Bila yang sudah ada bisa diperluas dengan aman, DILARANG membuat sistem identitas, peran, izin, atau persetujuan yang kedua.** Urutan keputusannya:

| Keadaan yang sudah ada | Yang dilakukan |
|---|---|
| Sudah memenuhi kebutuhan | **PERTAHANKAN** |
| Memenuhi sebagian | **PERLUAS** yang ada |
| Butuh perombakan skema | **PINDAHKAN — dokumentasikan DULU** |
| Sudah usang | **CABUT — dokumentasikan DULU** |
| Tidak jelas | **KEPUTUSAN PEMILIK PRODUK**, jangan ditebak |

**Kenapa ini aturan dan bukan anjuran**: sistem izin kedua tidak pernah mengumumkan dirinya. Ia terlihat seperti fitur baru yang rapi, sementara yang lama tetap berjalan — dan sejak saat itu **tidak ada satu tempat pun yang bisa menjawab "siapa boleh apa"**. Ini bentuk terburuk dari kelas "dua jalur hidup", karena yang dijaganya adalah hak akses.

**Konflik pemisahan tugas dideteksi SAAT PENUGASAN peran, bukan setelahnya** (§17). Menemukan bahwa satu orang memeriksa pekerjaannya sendiri lewat laporan bulanan berarti temuannya datang setelah dokumennya terbit. **Penimpaan boleh, tapi WAJIB beralasan dan tercatat** — sama seperti seluruh penimpaan lain di sistem ini.

> Prinsip keamanan §30 lainnya — least privilege, deny by default, isolasi tenant, auditability — **tidak ditulis ulang di sini**, karena isolasi tenant ber-`company_id` sudah jadi prinsip arsitektur nomor 1 di berkas ini, dan sisanya melekat pada RLS yang sudah berjalan. Menuliskannya dua kali akan melahirkan dua daftar prinsip keamanan yang bisa menyimpang.

## Huruf Kapital Hanya di Awal Kalimat (ditetapkan 25 Agu 2026)

**Judul dan label ditulis dengan kapital hanya di awal kalimat, bukan tiap kata.** Nama diri tetap kapital (nama hari, nama orang, akronim seperti BPJS).

Benar: "Setelan perhitungan", "Periode & kalender kerja", "Jam kerja Senin–Jumat".
Salah: "Setelan Perhitungan", "Periode & Kalender Kerja".

Berlaku untuk **seluruh layar**, bukan hanya yang baru. Layar lama dibereskan lewat aturan pramuka: yang disentuh, dirapikan sekalian.

## Aturan Responsive — WAJIB di Semua Halaman (ditetapkan 23 Agu 2026)
1. **Seluruh halaman WAJIB responsive terhadap semua ukuran layar** — HP, tablet, laptop, monitor lebar. TIDAK ada layar HP terpisah: satu kode, satu halaman, susunannya menyesuaikan lebar layar.
2. **Responsive BUKAN tampilan yang sama diperkecil.** Tabel 8 kolom yang diperkecil sampai muat di HP tetap tidak terbaca — yang benar, susunannya BERUBAH BENTUK saat layar menyempit (informasinya sama, penyajiannya berbeda). Pola yang dipakai: tabel banyak kolom → kartu bertumpuk di layar sempit (satu baris = satu kartu, kolom tersusun ke bawah); navigasi samping → menu buka-tutup; modal lebar → layar penuh di HP; field form → satu kolom penuh di layar sempit; kolom tidak penting boleh disembunyikan di layar sempit TAPI harus tetap bisa dibuka, jangan hilang tanpa jalan melihatnya.
3. **Tidak boleh ada gulir menyamping (horizontal scroll) di lebar mana pun.**
4. **Ukuran sentuh minimal 44×44 px** untuk seluruh elemen interaktif (tombol, checkbox+labelnya, field form) — tombol seukuran kursor mouse tidak bisa ditekan jari, apalagi jari bersarung tangan di lantai produksi.
5. **Uji di ENAM lebar setiap ada perubahan tampilan**: **360 / 672 / 768 / 1280 / 1440 / 1920 px** — dengan bukti visual (screenshot) di keenamnya, bukan disimpulkan dari kode.
   **Kenapa enam dan bukan empat (ditetapkan 26 Agu 2026)**: keempat lebar lama adalah lebar yang **lazim dipakai orang**, dan tidak satu pun menyentuh **TITIK PERUBAHAN** susunan. **672px** adalah batas Carbon tempat baris tabel membalik jadi kartu — cacat susunan paling mungkin muncul persis di batas itu, dan diukur 26 Agu 2026 memang di situlah kolom "Status" mulai terpotong di `/items`. **1440px** mengisi jarak antara 1312 dan 1584 milik Carbon, yaitu lebar laptop yang paling banyak dipakai.
   **ATURAN UMUMNYA, yang berlaku juga bila kelak breakpoint-nya berubah**: daftar lebar wajib harus mencakup **titik perubahan**, bukan hanya lebar yang lazim. Lebar yang tidak pernah menyentuh batas tidak akan pernah menemukan cacat batas.
6. **Bukti visual WAJIB memeriksa elemen yang keluar dari KEDUA TEPI, bukan hanya gulir menyamping** (ditetapkan 26 Agu 2026, lihat `DS-14`).
   **Kenapa ini aturan tersendiri dan bukan bagian butir 3**: `scrollWidth > clientWidth` hanya menangkap **SATU ARAH**. Yang meluber ke **kanan** menghasilkan gulir dan berbunyi. Yang terpotong ke **kiri** dipotong diam-diam oleh induknya — halamannya **tidak menggulir sama sekali**, jadi ukuran lama menjawab **"lulus"** untuk halaman yang kehilangan kontrolnya di tepi kiri. Terukur di `/items` 360px: kotak saringan "Tipe" berada di **−47 sampai −19**, yaitu **hilang seluruhnya**, sementara ukuran lama melaporkan halaman itu bersih.
   **Akibat yang harus disadari**: setiap halaman yang pernah dinyatakan lulus uji lebar **belum diperiksa untuk arah ini** — termasuk seluruh halaman yang dikerjakan sebelum 26 Agu 2026.
   **Yang diperiksa: tiga hal terpisah** — (a) gulir menyamping, (b) elemen yang melewati tepi kanan, (c) elemen yang melewati tepi kiri.
   **Yang TIDAK boleh dihitung sebagai cacat**, karena pengawas yang salah tuduh melatih orang mengabaikannya: elemen yang disembunyikan dengan **teknik baku "terbaca pembaca layar saja"** — `.cds--visually-hidden`, `.sr-only`, leluhur berukuran ≤ 1px ber-`overflow` tersembunyi, atau leluhur ber-`clip`/`clip-path`. Yang menandai "sengaja disembunyikan" adalah **TEKNIKNYA, bukan posisinya**: `.tabel-responsif thead` memakai kotak 1×1 px, jadi judul kolomnya punya geometri lebar padahal nol piksel tampak. Versi pertama pengukur ini menuduhnya, dan diperketat di giliran yang sama.
7. **Berlaku surut ke seluruh halaman yang sudah ada**, dikerjakan bertahap sebagai pekerjaan tersendiri (task tercatat) — jangan diselipkan diam-diam sampai setengah-setengah di satu halaman.
8. Prioritas pengerjaan (halaman mana lebih dulu) adalah soal URUTAN, bukan soal mana yang boleh dilewati — semua halaman pada akhirnya wajib patuh aturan ini.

## Struktur Folder — WAJIB Dipatuhi di Semua Kode
1. **`app/` hanya wrapper routing.** File di `app/**/page.tsx` dan `app/api/**/route.ts` tidak boleh berisi logic bisnis — isinya cuma routing Next.js (path, layout, re-export) yang memanggil kode dari `src/features/<domain>/`. Contoh yang benar: `app/login/page.tsx` cuma berisi `export { default } from '@/features/auth/pages/LoginPage';`.
2. **Logic bisnis hidup di `src/features/<domain>/`**, dikelompokkan per domain (mis. `auth`, `team`, `mrp`), bukan per tipe file. Di dalam tiap domain: `pages/` untuk komponen halaman, `server/` untuk logic sisi server (query Supabase, validasi, dsb).
3. **Tiap folder feature WAJIB punya `index.ts`** sebagai satu-satunya pintu resmi (public API) ke domain itu — file lain di luar `src/features/<domain>/` harus import lewat `index.ts`-nya, bukan menjangkau langsung ke file di dalam `pages/` atau `server/`.
4. **Domain baru = folder feature baru.** Sebelum menambah domain baru di `src/features/`, cek dulu apakah sudah ada domain yang cocok — jangan bikin domain baru untuk sesuatu yang harusnya masuk domain yang sudah ada.
5. **Komponen UI generik (design system) hidup di `src/components/ui/`**, bukan di `src/features/`. Ini komponen presentasional murni dari shadcn/ui (Button, Input, Select, Badge, Card, Table, dst) — tidak mengandung logic bisnis, dipakai lintas domain. Statusnya sejajar dengan `src/lib/` (infrastruktur bersama), bukan sebuah "feature". Konfigurasi ada di `components.json` di root repo.

> **Catatan status saat ini:** Aturan #1 sudah konsisten diikuti untuk `app/**/page.tsx`. Untuk `app/api/**/route.ts`, route `register`, `invitations`, dan `invitations/accept` sudah dirapikan (logic pindah ke `features/auth/server/` dan `features/team/server/`, route cuma parsing request + panggil fungsi + return response). Route `login`, `me`, `profile`, dan `users` masih berisi logic bisnis penuh langsung di file route — belum dirapikan, jangan tambah route API baru dengan pola lama itu.

## Aturan Unggah Berkas — WAJIB untuk Titik Unggah BARU
Semua titik unggah file BARU yang dibuat mulai 25 Agu 2026 WAJIB memanggil `uploadFileWithMetadata` di `src/lib/fileUpload.ts` (bukan memanggil `adminClient.storage.from(...).upload()` langsung) — fungsi ini menghitung checksum SHA-256 dan menyiapkan metadata minimum (uploader, entitas terkait, mime type, checksum, ukuran) di setiap unggahan, supaya backfill registry dokumen terpusat (rencana "Master Dokumen", digerbang sampai SAS001 & SAS005 terkirim) nanti kecil. Titik unggah LAMA (`uploadAvatar`, `uploadSignature`, `uploadCompanyLogo`, `confirmDelivery`, `processShipmentDispatch`) TIDAK diretrofit — aturan ini hanya berlaku maju, bukan proyek migrasi kode lama.

## Aturan Verifikasi Manual — WAJIB, Ditemukan Lewat Insiden Nyata (Sesi 0/0B/0C, diperbaiki Sesi 5, 21 Agu 2026)
- **Verifikasi visual di browser TETAP WAJIB untuk setiap perubahan yang terlihat pengguna.** Test otomatis TIDAK menggantikannya — 201 test hijau pada Sesi 0C tidak menangkap bahwa membuka halaman menulis baris (test suite waktu itu belum menguji skenario itu). Sebelum melapor "selesai" ke user untuk perubahan UI apa pun, buka fitur itu sungguhan di browser.
- Verifikasi visual itu **HANYA memakai tenant uji** (`company.b@debug.mrp` atau fixture perusahaan baru yang dibuat & dihapus sendiri oleh sesi kerja) — **TIDAK PERNAH memakai akun PT ITM** (`company.a@debug.mrp`, data company_id=1), **sekalipun tindakannya terasa "hanya melihat"**. Alasan: investigasi Sesi 0/0B/0C menemukan `getMarginWatch.ts`/`getPlanningFeasibility.ts` mengunci baseline finansial secara *lazy* pada panggilan pertama — tombol yang terlihat seperti "Cek Kelayakan"/"Margin Watch" (murni tampilan) ternyata menulis data permanen ke tenant sungguhan begitu diklik untuk verifikasi. Kelas kerentanan ini (aksi yang terlihat read-only tapi menulis di baliknya) bisa ada di fitur lain yang belum ditemukan — jadi aturan ini berlaku untuk SEMUA verifikasi manual, bukan cuma dua fitur yang sudah diperbaiki.
- Sisa data yang tercipta di tenant uji selama verifikasi **WAJIB dibersihkan setelah selesai**, dan pembersihannya **dilaporkan** ke user (baris/entitas apa yang dihapus) — ini pelajaran yang sudah berulang, jangan tinggalkan sampah fixture tanpa laporan.

## Aturan Dokumen Temuan/Audit/Rencana — WAJIB, Ditemukan Lewat Insiden Nyata (AUD-04/H.4, AA.1-AA.2, 22 Agu 2026)
- **Setiap dokumen audit/temuan/rencana yang dihasilkan (di `docs/` maupun di laporan sesi) WAJIB langsung diikuti pencatatan task di Daftar Tugas Pembangunan untuk TIAP temuan yang memerlukan tindakan, di giliran kerja yang sama** — bukan "nanti", bukan "kalau sempat". Ditemukan lewat insiden nyata: `docs/audit-lubang-ui.md` sudah BENAR mengidentifikasi halaman Pelanggan tidak ada sejak audit PERTAMA (Sesi 5) dan tetap benar di audit ULANG (Sesi 7) — tapi temuan yang 100% akurat itu tidak pernah otomatis/manual dipromosikan jadi task, dan baru dibangun jauh belakangan setelah pemilik produk memintanya sendiri secara langsung. Investigasi lanjutan (AA.1) menemukan pola yang sama berulang di dokumen lain: temuan benar, tapi tidak pernah jadi pekerjaan yang bisa dilacak.
- **Dokumen yang temuannya tidak jadi task SAMA DENGAN dokumen yang tidak pernah ditulis.** Nilai sebuah audit bukan pada seberapa akurat isinya, tapi pada seberapa besar kemungkinan temuannya benar-benar berubah jadi pekerjaan.
- **Setiap laporan sesi ke pemilik produk WAJIB menyebutkan**: berapa temuan/rekomendasi lahir di sesi itu, dan berapa di antaranya sudah jadi task tercatat (bukan cuma disebut di teks laporan).

## Cara Kerja dengan User
User adalah **pemilik/praktisi bisnis manufaktur yang sangat paham proses produksi**, tapi **tidak memahami coding sama sekali**. Karena itu:
- Kalau melapor progres ke user, gunakan bahasa non-teknis — jelaskan dari sisi "apa yang sekarang bisa dilakukan sistem", bukan istilah teknis
- Jangan asumsikan user bisa membaca kode, error message, atau debug sendiri
- Selalu jalankan & test perubahan sebelum bilang "selesai"
- Untuk keputusan desain/arsitektur besar yang belum ada di dua dokumen referensi, TANYA dulu ke user — jangan asumsi sendiri
- User berkomunikasi dalam Bahasa Indonesia
- **ATURAN KERAS (ditemukan lewat insiden nyata — sudah 3x laporan terkirim dalam Bahasa Inggris): SELURUH komunikasi ke pemilik produk WAJIB 100% Bahasa Indonesia, TANPA KECUALI** — laporan sesi, ringkasan, pertanyaan konfirmasi, pesan status, dan teks apa pun yang dibaca langsung oleh pemilik produk di chat. Laporan dalam bahasa yang tidak dibaca pemilik produk sama dengan laporan yang tidak terkirim. Ini berbeda dari komentar kode/pesan commit (boleh tetap mengikuti konvensi proyek yang sudah ada) — aturan ini khusus untuk teks yang ditujukan ke pemilik produk.

## Otonomi Keputusan Teknis vs Keputusan Bisnis (ditetapkan 21 Agu 2026, saat membangun Daftar Tugas Pembangunan)
Supaya kerja tidak berhenti untuk hal-hal kecil, tapi keputusan yang benar-benar penting tetap ditanyakan:
- **Claude Code BOLEH memutuskan sendiri hal TEKNIS** tanpa bertanya dulu — contoh: nama kolom, struktur tabel, pendekatan validasi, pilihan library, bentuk endpoint API. Syaratnya: keputusan itu **dicatat di laporan sesi & HANDOFF.md** supaya bisa dikoreksi belakangan kalau ternyata kurang tepat.
- **Yang WAJIB SELALU ditanyakan ke user dulu, TIDAK BOLEH ditebak sendiri**: aturan bisnis (business rules), angka bisnis (yield, harga, standar crew, kapasitas), kebijakan hak akses (siapa boleh apa), dan apa pun yang mengubah ARTI/MAKNA data (misalnya: apakah suatu status dihitung "selesai" atau tidak, apakah suatu field wajib diisi atau opsional secara bisnis).
- Intinya: bebas berkreasi di "bagaimana cara membangunnya", tapi berhenti dan tanya dulu untuk "apa yang seharusnya terjadi secara bisnis".

## Tugas Pertama — Fase 3 Roadmap: Fondasi SaaS
Jangan lompat ke modul MRP (Item, BOM, Work Order, dst) sebelum fondasi ini solid dan sudah dicoba jalan:

1. Inisialisasi project Next.js 16 (TypeScript, App Router, Tailwind CSS)
2. Setup koneksi ke Supabase (user akan berikan Project URL & API Key project Supabase yang sudah dibuat)
3. Buat migration database untuk tabel `companies`, `users`, `subscription_plans` sesuai `docs/rancangan-skema-database-mrp.md`
4. Setup Supabase Auth untuk login/registrasi user
5. Terapkan Row-Level Security dasar berbasis `company_id`
6. Buat halaman login & dashboard kosong sederhana untuk verifikasi semua nyambung dengan benar
7. Inisialisasi Git repository, buat repo baru di GitHub user, push kode

Setelah fondasi ini jalan dan user sudah lihat hasilnya (bisa login, lihat dashboard kosong), baru lanjut ke modul MRP inti sesuai roadmap.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
