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

> Bagian ini ditulis lebih awal (sebelum `PMB-11` selesai) atas permintaan pemilik produk, karena aturan yang hanya hidup di percakapan terbukti hilang. Akan **dilengkapi**, bukan diganti, begitu modal Supplier tuntas jadi cetakan penuh.

## Aturan Responsive — WAJIB di Semua Halaman (ditetapkan 23 Agu 2026)
1. **Seluruh halaman WAJIB responsive terhadap semua ukuran layar** — HP, tablet, laptop, monitor lebar. TIDAK ada layar HP terpisah: satu kode, satu halaman, susunannya menyesuaikan lebar layar.
2. **Responsive BUKAN tampilan yang sama diperkecil.** Tabel 8 kolom yang diperkecil sampai muat di HP tetap tidak terbaca — yang benar, susunannya BERUBAH BENTUK saat layar menyempit (informasinya sama, penyajiannya berbeda). Pola yang dipakai: tabel banyak kolom → kartu bertumpuk di layar sempit (satu baris = satu kartu, kolom tersusun ke bawah); navigasi samping → menu buka-tutup; modal lebar → layar penuh di HP; field form → satu kolom penuh di layar sempit; kolom tidak penting boleh disembunyikan di layar sempit TAPI harus tetap bisa dibuka, jangan hilang tanpa jalan melihatnya.
3. **Tidak boleh ada gulir menyamping (horizontal scroll) di lebar mana pun.**
4. **Ukuran sentuh minimal 44×44 px** untuk seluruh elemen interaktif (tombol, checkbox+labelnya, field form) — tombol seukuran kursor mouse tidak bisa ditekan jari, apalagi jari bersarung tangan di lantai produksi.
5. **Uji di EMPAT lebar setiap ada perubahan tampilan**: 360, 768, 1280, 1920 px — dengan bukti visual (screenshot) di keempatnya, bukan disimpulkan dari kode.
6. **Berlaku surut ke seluruh halaman yang sudah ada**, dikerjakan bertahap sebagai pekerjaan tersendiri (task tercatat) — jangan diselipkan diam-diam sampai setengah-setengah di satu halaman.
7. Prioritas pengerjaan (halaman mana lebih dulu) adalah soal URUTAN, bukan soal mana yang boleh dilewati — semua halaman pada akhirnya wajib patuh aturan ini.

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
