# Audit Infrastruktur — Prasyarat Rebrand FABRIX (INF-01)

Dijalankan 22 Agu 2026, murni READ-ONLY (dibuktikan: `git diff` hanya menyentuh `docs/`, tidak ada satu project/DNS/env var/RLS/auth yang diubah). Sumber: `supabase projects/backups/functions list`, `vercel project inspect/env ls`, pemeriksaan publik bundle JS yang sudah live, `git log`/`git branch`, dan query baca (`select count`) ke kedua project Supabase lewat service-role key lokal. Tidak ada nilai secret (kunci/token/password) yang ditampilkan di dokumen ini — hanya NAMA variabel dan hasil perbandingan.

---

# PEMBARUAN 24 Agu 2026 — POTRET TERKINI & PENUTUPAN

Bagian di bawah ini **menggantikan** gambaran §1–§3 untuk keadaan hari ini. Isi asli 22 Agu **sengaja tidak dihapus** dan tetap tersimpan di bawah sebagai rekaman keadaan waktu itu — audit ini yang memicu seluruh rangkaian perbaikan infrastruktur seminggu terakhir, dan menghapus jejaknya akan membuat perbaikan-perbaikan itu terlihat muncul tanpa sebab.

Sama seperti audit aslinya: **murni READ-ONLY**, `git diff` hanya menyentuh `docs/`, dan **tidak ada satu pun nilai secret ditampilkan** — hanya nama variabel.

## 0. Koreksi angka: "63 karyawan" tidak pernah benar

Kolom *effect_description* task INF-01 menyebut *"63 karyawan+gaji+basis BPJS"*. **Jumlah sebenarnya 30**, dan sudah 30 sejak 22 Agu — dokumen audit asli sendiri menulis `employees=30`.

Asal-usulnya bisa ditelusuri: §1 dokumen ini memuat keterangan dalam kurung *"termasuk gaji & basis BPJS nyata 63 baris riwayat"*. Angka riwayat itu **tidak berdasar**: tidak ada tabel riwayat gaji sama sekali di skema (yang ada hanya `employee_cost_category_history`, dan isinya **nol baris**), dan **tidak ada satu pun tabel di seluruh database yang berisi 55–70 baris**. Angka 63 lalu berpindah ke ringkasan task sebagai jumlah *karyawan* — dua kekeliruan bertumpuk.

Deskripsi task diperbaiki. Dicatat di sini karena **angka yang salah di task akan terus beredar** setiap kali orang mengutip tasknya.

## I.1 Project Supabase — peran sebenarnya, dibuktikan isi tabel

| Project ref | Nama | Peran SEBENARNYA | employees | companies | lots | sales_orders |
|---|---|---|---|---|---|---|
| `kfvtrwuuqcjfkkuqizxt` | **FABRIX-APP** | **DATA NYATA PT ITM** | **30** | 2 | 0 | 1 |
| `nclkepwlsgmfbslgsajq` | staging | Kosong | 0 | 1 | 0 | 0 |
| `gzxrgbwhmjwiakcyjipd` | **fabrix-ci-test** | Sasaran CI & test lokal | 0 | 3 | 0 | 0 |

**Berubah besar sejak 22 Agu**: waktu itu hanya ada **dua** project dalam satu organisasi pribadi, dan test suite serta CI menulis langsung ke project berisi data nyata. Sekarang ada project ketiga khusus pengujian, dan project data nyata berada di organisasi **FABRIX** berpaket Pro.

Tiga companies di `fabrix-ci-test` (PT ITM, Company A, Company B) adalah kerangka penyelarasan skema, bukan data. **Nol company berpola `*TestCorp`** di ketiga project saat potret ini diambil.

## I.2 Vercel

- Organisasi **FABRIX** (`fabrixapp`) — **satu** project: `mrp-staging`, Next.js, Node 24.x, terhubung ke repo `alvhyzid/mrp`.
- **Nol domain terdaftar.** `fabrix.id` belum tersambung ke project mana pun.
- **Nol cron job.** Tidak ada Vercel Function terjadwal.
- Enam deployment terakhir **seluruhnya Production** — tidak ada satu pun deployment Preview, jadi konfigurasi environment Preview belum pernah benar-benar dijalankan.
- **Environment variable (nama saja, nilai tidak ditampilkan):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — masing-masing untuk **Production** dan **Preview (branch `staging`)**. Tidak ada untuk Development.

**TEMUAN BARU, dan ini yang paling serius di pembaruan ini:** dari enam variabel itu, **lima ditandai "Sensitive"** (nilainya tersembunyi bahkan dari CLI) sementara **`SUPABASE_SERVICE_ROLE_KEY` untuk Production ditandai "Non-sensitive"** dan **nilainya terbaca dari baris perintah**. Variabel itu dibuat **1 hari lalu** — jadi ia bukan sisa lama, melainkan hasil penyetelan ulang baru-baru ini yang kehilangan penanda rahasianya.

Kunci itu **melewati seluruh RLS**. Ia tidak terbuka ke pengunjung situs, tapi siapa pun yang punya akses baca ke project Vercel — atau sesi CLI yang bocor — bisa membacanya dan sejak itu memegang akses penuh ke seluruh data PT ITM.

## I.3 Adakah konfigurasi di mana staging menunjuk data nyata?

**Tidak bisa dijawab setegas 22 Agu, dan alasannya justru kabar baik.** Waktu itu jawabannya bisa dibuktikan dengan mengunduh bundle JavaScript situs dan mencari nama project di dalamnya. Hari ini teknik itu **tidak berlaku lagi**: sepuluh berkas JavaScript halaman login disisir, dan **tidak ada satu pun alamat Supabase di dalamnya** — seluruh akses database berjalan di sisi server. Itu properti keamanan yang lebih baik, sekaligus menutup satu-satunya jalur pemeriksaan tanpa kredensial.

Yang bisa dipastikan hari ini:
- Kedua environment (Production dan Preview) memakai **nama variabel yang sama**, jadi pembedanya semata-mata nilainya — dan lima dari enam nilai itu tersembunyi.
- **Belum ada satu pun deployment Preview**, jadi konfigurasi staging belum pernah benar-benar dipakai.
- Situs Production **tersambung ke data nyata** — itu memang keadaan yang dituju sejak INF-11, bukan kekeliruan.

**Yang TIDAK bisa dibuktikan dari sini**: apakah nilai Preview menunjuk project kosong atau data nyata. Memeriksanya butuh membuka nilai variabel, dan itu di luar batas audit ini.

## I.4 Pencadangan project data nyata

- **Cadangan harian bawaan Supabase: BERJALAN.** 8 titik pemulihan tersimpan, terlama 17 Agu, **terbaru 24 Agu 04:03 WIB**.
- **PITR (pemulihan titik-waktu): TIDAK aktif.**
- **Cadangan terjadwal GitHub Actions (`backup-db.yml`): berjalan**, cron harian 01:00 WIB, dua jalankan terjadwal terakhir (22 & 23 Agu) berhasil.

**Dua batasnya, keduanya nyata:**

1. **Kehilangan bisa sampai satu hari kerja.** Tanpa PITR, titik pemulihan terdekat dari kekeliruan siang hari adalah pukul 04:03 pagi itu. Ditawarkan sebagai keputusan biaya lewat **INF-24** — termasuk peringatan bahwa menyalakan PITR **menghentikan** cadangan harian; keduanya saling meniadakan.
2. **Foto dan tanda tangan TIDAK ikut tercadangkan** oleh mekanisme bawaan. Ini berhenti jadi teori pada 24 Agu: foto profil akun admin PT ITM tertimpa dan **hilang permanen** karena tidak ada salinannya di mana pun. Ekspor manual sudah diperluas untuk menyalin isi berkas Storage, tapi **masih manual** — dilacak di **INF-16**.

## I.5 RLS ber-`company_id`

- **90 dari 90 tabel dasar punya RLS menyala. Nol tabel tanpa RLS.**
- **23 tabel tidak punya kolom `company_id`.** Isolasinya dijamin lewat **induknya**: `bom_lines` lewat `boms`, `sales_order_lines` lewat `sales_orders`, `routing_steps` lewat `routings`, dan seterusnya. Integritas kunci asing menjamin baris anak tidak mungkin bertahan bila induknya terhapus.

**Koreksi angka**: yang beredar sebagai "7 tabel tanpa `company_id`" berasal dari konteks lebih sempit (7 dari 18 tabel yang diperiksa saat membangun penghapusan Item, MST-16). Angka menyeluruhnya **23**.

**Celah yang diketahui**: jaminan lewat induk **runtuh bila penghapusan dilakukan dengan penegakan kunci asing dimatikan**. Itu bukan kekhawatiran teoretis — sudah terjadi, dan meninggalkan **562 baris yatim** di project data nyata (`AUD-31`).

## I.6 Kontrak eksternal

- **Alamat halaman POD (`/pod/<token>`): BELUM MENGIKAT hari ini.** PT ITM punya **nol pengiriman** dan **nol token POD hidup**. Kehati-hatian "jangan ubah URL POD" akan mengikat pada **surat jalan pertama yang tercetak**, karena sejak itu alamatnya beredar di kertas yang tidak ikut ter-deploy ulang.
- **Tanda tangan dokumen: nol baris.** Belum ada dokumen terbit yang membawa tanda tangan.
- **Magic link / email autentikasi: DIPERIKSA HARI INI, sebelumnya belum pernah.** Hasilnya:
  - `site_url` project masih **`http://localhost:3000`**.
  - **Daftar alamat yang diizinkan (`uri_allow_list`) KOSONG.**
  - **Tidak ada SMTP sendiri** — email keluar lewat pengirim bawaan Supabase, dengan batas **2 email per jam**.
  - Aplikasi **mengirim alamat tujuannya sendiri** (`redirectTo` ke `origin` peramban) pada lupa-kata-sandi dan konfirmasi pendaftaran. Jadi ini **bukan otomatis rusak**.

  **Yang belum dipastikan, dan sengaja tidak diklaim**: Supabase hanya mengizinkan alamat tujuan yang cocok dengan `site_url` atau daftar izin. Karena daftar izinnya kosong dan `site_url` menunjuk localhost, **ada kemungkinan alamat tujuan dari situs tayang ditolak dan dikembalikan ke localhost** — yang berarti tautan pemulihan kata sandi tidak bisa dibuka penerimanya. **Ini belum diuji**, dan mengujinya butuh membuka email sungguhan. Cara memastikannya sederhana: klik "lupa kata sandi" di situs tayang, lalu lihat tautan di emailnya menunjuk ke mana.
- **Pendaftaran mandiri terbuka**: halaman `/register` bisa dibuka siapa pun dari internet (HTTP 200) dan pendaftaran tidak dimatikan di tingkat Supabase. Orang asing yang mendaftar mendapat perusahaannya sendiri dan **tidak bisa melihat data PT ITM** (dijamin RLS), tapi ia tetap menambah tenant ke project yang sama.

## I.7 Git

- Branch: **`main`** dan **`staging`** (keduanya ada di lokal dan di remote).
- **Branch produksi Vercel masih `main`** — belum berhasil diubah ke `staging` (INF-18).
- **Aturan sementara yang berlaku**: setiap push ke `main` adalah **rilis langsung ke data nyata**, bukan simpanan pekerjaan. Pekerjaan yang belum siap dipakai tidak didorong ke `main`.
- **Migrasi**: berkas SQL berurut waktu di `supabase/migrations/`, diterapkan lewat `supabase db push`, dan project CI diselaraskan terpisah. Skema dibangun ulang dari nol setiap CI berjalan, sehingga migrasi yang hanya benar di database berjalan akan ketahuan.
- **Seed**: skrip di `scripts/seed-*.js`, seluruhnya untuk tenant uji.

## Yang SUDAH tertangani sejak 22 Agu

| Temuan 22 Agu | Keadaan sekarang | Ditutup lewat |
|---|---|---|
| Project data nyata bernama "dev" di organisasi pribadi, tanpa cadangan | Dipindah ke organisasi **FABRIX Pro**, berganti nama **FABRIX-APP**, Project ID tidak berubah | RBD-04, INF-02 |
| "Cadangan mati total" | **KELIRU SEJAK AWAL** — cadangan harian sudah berjalan sejak 15 Agu. Audit memeriksa satu field (`pitr_enabled`) lalu menyimpulkan seluruh pencadangan mati | DD.1 |
| CI menulis ke project data nyata | Project **fabrix-ci-test** terpisah; terbukti **nol jejak fixture** di FABRIX-APP | INF-19 |
| Environment production menunjuk project kosong | Situs tayang **tersambung ke data nyata** | INF-11 |
| Vercel Hobby di akun pribadi | **Pro**, Team, bernama FABRIX | RBD-03/RBD-04 |
| Company fixture menumpuk di project data nyata | **Nol** company berpola `*TestCorp` | INF-06 |

## Yang BELUM — tidak disembunyikan

1. **Branch produksi Vercel masih `main`.** Setelan gagal disimpan berkali-kali dari semua jalur; menunggu tiket dukungan (**INF-18**).
2. **GitHub Organization belum dibuat sama sekali** (**RBD-03**). Repo masih di akun pribadi.
3. **Kepemilikan Vercel Team masih akun Google pribadi.**
4. **PITR tidak aktif** (**INF-24**), dan **foto/tanda tangan tidak ikut cadangan bawaan** (**INF-16**).
5. **Flag pelolos test terhadap data nyata masih ada** karena penggantinya belum siap (**SEC-13**).
6. **Kunci layanan Production di Vercel kehilangan penanda rahasia** — temuan baru pembaruan ini.
7. **`site_url` auth menunjuk localhost, daftar izin kosong** — akibatnya belum diuji.

## Tingkat risiko — DINILAI ULANG untuk keadaan hari ini

Penilaian 22 Agu **tidak disalin**. Sebagian yang dulu KRITIS sekarang rendah karena benar-benar sudah diperbaiki; yang baru muncul dinilai apa adanya.

| Temuan | 22 Agu | **Sekarang** | Kenapa berubah |
|---|---|---|---|
| Tidak ada cadangan otomatis | KRITIS | **RENDAH** | Cadangan harian berjalan + cadangan terjadwal GitHub Actions |
| Branch produksi Vercel `main` | TINGGI | **SEDANG** | Masih salah, tapi dampaknya dikelola aturan "push = rilis" |
| Tidak ada Vercel production | SEDANG | **SELESAI** | Situs tayang tersambung data nyata |
| Company fixture menumpuk | SEDANG | **SELESAI** | Nol sisa |
| Deployment publik tak tersambung data nyata | RENDAH | **tidak relevan** | Sekarang memang disengaja tersambung |
| **Kunci layanan Production tidak lagi rahasia** | — | **TINGGI** | Temuan baru |
| **PITR mati + Storage tak tercadangkan** | — | **TINGGI** | Kehilangan permanen sudah terjadi sekali |
| **`site_url` localhost, daftar izin kosong** | — | **SEDANG** | Akibatnya belum diuji |
| 562 baris yatim di data nyata | — | **SEDANG** | Angka laporan ikut menghitungnya (`AUD-31`) |
| Gerbang peran `/debug` & `/test-tenant` | RENDAH | **RENDAH** | Belum berubah |

### Tiga yang paling berisiko dibiarkan sekarang

**1. Kunci layanan Production di Vercel tidak lagi ditandai rahasia.**
Kunci ini melewati seluruh RLS — ia satu-satunya hal yang, bila jatuh ke tangan lain, membuat seluruh lapisan isolasi tenant tidak berarti. Lima variabel lain tetap tersembunyi, jadi ini bukan kebijakan yang berubah melainkan **satu variabel yang kehilangan penandanya saat disetel ulang kemarin**. Memperbaikinya murah: hapus dan tambahkan ulang dengan penanda Sensitive. Menundanya tidak menghasilkan gejala apa pun sampai terlambat.

**2. Foto dan tanda tangan tidak tercakup cadangan otomatis.**
Ini satu-satunya risiko dalam daftar yang **sudah menimbulkan kerugian permanen** — foto profil akun admin PT ITM hilang dan tidak bisa dikembalikan dari mana pun. Yang menyelamatkan tanda tangan tulisan tangan hanya kebetulan pola penamaan berkas. Ekspornya sudah ada tapi manual, dan **ekspor yang bergantung pada ingatan akan gagal suatu saat**.

**3. Pemulihan titik-waktu tidak aktif, tepat saat sistem mulai dipakai sungguhan.**
Selama sistem hanya diisi lewat migrasi, kehilangan setengah hari kerja berarti menjalankan ulang migrasi. Begitu produksi harian, penerimaan barang, dan absensi benar-benar dicatat orang, angka yang hilang itu **tidak ada di tempat lain** — tidak ada skrip yang bisa mengembalikannya. Risikonya naik seiring pemakaian, bukan seiring waktu.

*Yang sengaja TIDAK dimasukkan ke tiga besar*: branch produksi `main` (nyata, tapi sudah dikelola aturan tertulis dan tidak memburuk sendiri) dan `site_url` localhost (akibatnya belum diuji — memasukkannya ke tiga besar berarti menilai sesuatu yang belum dipastikan).

---

## 1. Kondisi Sekarang

**Organisasi & project Supabase** — 1 organisasi (`alvhyzid`), 2 project, SATU-SATUNYA sumber kebenaran untuk keduanya:

| Project ref | Nama tampilan | Dibuat | Peran SEBENARNYA (dibuktikan isi tabel) |
|---|---|---|---|
| `kfvtrwuuqcjfkkuqizxt` | "alvhyz-MRP" (disebut "dev") | 10 Agu 2026 | **BERISI SELURUH DATA NYATA PT ITM** — dipakai `.env.local`, dipakai SELURUH sesi kerja Claude Code sejauh ini |
| `nclkepwlsgmfbslgsajq` | "mrp-rebuild-test-2A" (disebut "staging") | 16 Agu 2026 | Kosong/data uji saja |

Bukti isi project `kfvtrwuuqcjfkkuqizxt` (dugaan pemilik produk **TERBUKTI BENAR**):
- `companies` = 9 baris — HANYA 1 yang tenant nyata (`company_id=1`, "PT ITM"). **8 baris sisanya adalah company fixture test yang seharusnya sudah dibersihkan** (`PlantConsolidationTestCorp`, `BaselineLockSeparationTestCorp`, `MarginWatchTestCorp`, `Sesi0BRoleTestCorp`, `BuildTasksTestCorp`, `AttendanceW1TestCorp`, `RoutingBomSnapshotTestCorp`, plus `Company B` yang memang tenant uji resmi/permanen) — temuan baru, lihat §2.
- `users`=11, `employees`=30 (termasuk gaji & basis BPJS nyata 63 baris riwayat — employees=30 adalah jumlah karyawan aktif, bukan riwayat penuh), `sales_orders`=2 (termasuk SO MLVT), `items`=15, `work_orders`=2, `purchase_orders`=1, `customers`=4, `suppliers`=1, `build_tasks`=102.
- `lots`=0, `shipments`=0, `production_batches`=0 saat ini (bukan berarti kosong secara historis — kemungkinan besar konsumsi/pengiriman sebelumnya sudah tuntas siklusnya atau memang belum ada transaksi baru sejak fixture terakhir dibersihkan; tidak diselidiki lebih lanjut, di luar lingkup audit infrastruktur ini).

**Vercel** — 1 organisasi (`AMS`/`ams-3670`), **HANYA 1 project: `mrp-staging`**, terhubung ke repo GitHub `alvhyzid/mrp`, Next.js/Node 24.x, tanpa custom domain (0 domain terdaftar — `fabrix.id` **belum** disambungkan ke project mana pun, sesuai batas yang diminta). Tidak ada cron job Vercel terpasang.

**Environment variable** (nama saja, TANPA nilai) — persis 3 variabel diset per environment: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` — ketiganya ditandai "Sensitive" (nilai tersembunyi bahkan dari CLI). Diset untuk environment **Production** dan **Preview (branch `staging`)** — tidak ada untuk **Development**.

**Edge Function** — `custom-access-token` ACTIVE di KEDUA project, dengan hash kode identik (`724c2ab...`) — dua project benar-benar menjalankan kode yang sama, bukan versi berbeda yang menyimpang diam-diam.

**Storage bucket** (project data nyata) — 5 publik (`company-logos`, `user-avatars`, `user-signatures`, `shipment-dispatch-photos`, `delivery-confirmation-photos`), 1 privat (`documents`) — sesuai catatan HANDOFF soal MD-1.

**Git** — 2 branch: `main` (dipakai SELURUH kerja harian sesi ini) dan `staging` (dibuat Sesi 2B, jarang disentuh). Migrasi adalah SATU-SATUNYA sumber kebenaran skema — dibuktikan tiap push lewat CI (`ci.yml`, job rebuild-from-migrations, `pg_dump` sungguhan via Docker di runner GitHub Actions). Backup terpisah (`backup-db.yml`, lihat §2) — trigger MANUAL saja (`workflow_dispatch`), BUKAN terjadwal.

**Kontrak eksternal (I.6)** — pola URL yang HARUS tetap hidup lewat pindah domain apa pun:
- `/pod/[token]` (halaman) + `/api/pod/[token]` (baca) + `/api/pod/[token]/confirm` (submit tanda tangan) — akses PUBLIK murni lewat `pod_token` acak, TANPA login sama sekali. **Tidak ada contoh token nyata untuk disertakan** — `shipments`=0 di project data nyata saat ini, belum ada Surat Jalan yang benar-benar dicetak/dibagikan ke pihak luar. Begitu ADA, tokennya jadi kontrak permanen (QR fisik tidak bisa ditarik ulang).
- Magic link/undangan auth: mengandalkan `site_url`+`uri_allow_list` per project Supabase (didokumentasikan HANDOFF Sesi 2B, tidak diverifikasi ulang nilainya sesi ini karena bukan nilai publik).
- Alamat pengirim email: dikonfigurasi di pengaturan Auth/SMTP tiap project Supabase (dashboard), tidak ada di `supabase/config.toml` repo ini (file itu HANYA untuk container lokal, tidak dipakai — lihat §2).

## 2. Masalah Ditemukan

1. **[KRITIS] TIDAK ADA backup OTOMATIS untuk project berisi data nyata.** `supabase backups list --project-ref kfvtrwuuqcjfkkuqizxt` → `pitr_enabled: false`, `backups: []` (PITR asli Supabase mati total, 0 snapshot). ADA mekanisme alternatif (`backup-db.yml`, pg_dump sungguhan terverifikasi berisi data) tapi trigger-nya **HANYA MANUAL** (`workflow_dispatch`, bukan `schedule`) — riwayat run: 4 kali total, 2 gagal (18 Agu, sebelum diperbaiki), 2 berhasil (18 & 20 Agu). **Backup terakhir yang berhasil adalah 2 hari lalu** dan retensi artifact HANYA 7 hari — tidak ada satu pun backup yang mencakup SEMUA perubahan sejak itu (termasuk seluruh pekerjaan Daftar Tugas Pembangunan hari ini). Tanpa seseorang rutin mengklik "Run workflow", jendela pemulihan bisa kosong kapan saja.
2. **[TINGGI] "Production Branch" Vercel project `mrp-staging` ternyata `main`, BUKAN `staging`.** Dibuktikan lewat Vercel Management API (`link.productionBranch: "main"`) dan alias deployment (`mrp-staging-git-main-ams-3670.vercel.app` menunjuk ke deployment bertarget `production`). Ini BERBEDA dari niat yang tercatat di HANDOFF Sesi 2B ("terhubung ke branch git staging, bukan main"). Akibatnya: **setiap `git push origin main` sepanjang sesi ini (Sesi 6, 7, Alur 1, Daftar Tugas Pembangunan, dst) otomatis membuat deployment publik baru** ke `https://mrp-staging-zeta.vercel.app`.
3. **[RENDAH, mitigasi sudah ada] Untungnya deployment publik itu TERBUKTI TIDAK terhubung ke data nyata.** Diverifikasi EMPIRIS (bukan dugaan): mengunduh bundle JS yang benar-benar live di `https://mrp-staging-zeta.vercel.app` dan menemukan string `nclkepwlsgmfbslgsajq.supabase.co` (project staging/kosong) — BUKAN `kfvtrwuuqcjfkkuqizxt` (data nyata). Jadi meski #2 di atas adalah salah konfigurasi nyata, dampaknya SAAT INI nihil untuk kebocoran data — tapi ini kebetulan baik, bukan karena ada pengaman yang disengaja mencegahnya.
4. **[SEDANG] Tidak ada Vercel project "production" sama sekali.** Selama ini aplikasi dengan data nyata PT ITM hanya pernah dijalankan lewat `npm run dev` di komputer lokal — tidak pernah dideploy publik. Ini konsisten dengan dugaan awal pemilik produk ("project 'dev' diperlakukan sebagai tempat coba-coba") — bedanya, karena tidak pernah live publik, risiko paparannya adalah AKSES API Supabase langsung (selalu bisa dijangkau lewat internet lewat URL projectnya, terlepas dari ada/tidaknya frontend Vercel), bukan lewat halaman web.
5. **[SEDANG, temuan baru di luar lingkup I.1-I.9 tapi muncul dari bukti jumlah baris] 7 dari 9 baris `companies` di project data nyata adalah fixture test yang seharusnya sudah dibersihkan** oleh `afterAll` masing-masing test suite (`PlantConsolidationTestCorp`, `BaselineLockSeparationTestCorp`, `MarginWatchTestCorp`, `Sesi0BRoleTestCorp`, `BuildTasksTestCorp`, `AttendanceW1TestCorp`, `RoutingBomSnapshotTestCorp`). Helper `cleanupCompanyCascade` (`tests/testCompanyCleanup.ts`) SUDAH diperbaiki 26 Agu 2026 supaya delete `companies` SELALU dicoba di akhir — baris-baris ini kemungkinan sisa dari SEBELUM perbaikan itu, atau dari test run yang gagal di tengah sebelum sempat cleanup. **BELUM diselidiki akar penyebabnya** (di luar lingkup audit infrastruktur) — direkomendasikan jadi task terpisah, BUKAN diperbaiki di sini.
6. **[RENDAH] Multi-tenant RLS** — dilaporkan apa adanya sesuai instruksi (TIDAK dirancang ulang): invarian `company_id` sudah diterapkan konsisten sejak Fase 3 (87 RLS policy terverifikasi lewat rebuild-from-migrations, HANDOFF Sesi 2A). Celah YANG SUDAH DIKETAHUI dan belum diputuskan pemilik produk: halaman `/debug` dan `/test-tenant` bisa dibuka staf biasa mana pun tanpa gerbang peran sama sekali (ditemukan & sebagian diperbaiki Sesi 6 — RLS membatasi baris per company, tapi TIDAK ADA gerbang peran di kedua halaman itu sendiri).

## 3. Tingkat Risiko

| # | Temuan | Tingkat |
|---|---|---|
| 1 | Tidak ada backup OTOMATIS untuk data nyata (hanya manual, retensi 7 hari) | **KRITIS** |
| 2 | Production Branch Vercel salah (`main`, seharusnya `staging`) | **TINGGI** |
| 4 | Tidak ada Vercel project production sama sekali — data nyata hanya jalan lokal | **SEDANG** |
| 5 | 7 baris company fixture test menumpuk di project data nyata | **SEDANG** |
| 3 | Deployment publik saat ini kebetulan tidak tersambung ke data nyata | RENDAH (mitigasi kebetulan, bukan by design) |
| 6 | Celah gerbang peran /debug /test-tenant (sudah diketahui dari Sesi 6) | RENDAH (sudah tercatat, menunggu keputusan) |

## 4. Arsitektur Target (rekomendasi, BUKAN keputusan final — menunggu gerbang §6)

Mengikuti coretan awal C.1-C.4 dari task INF-02 (data TIDAK dipindah):
- Project `kfvtrwuuqcjfkkuqizxt` (isi nyata) → **diperlakukan sebagai Production apa adanya**, cukup ganti nama tampilan, ref/URL/kunci TETAP.
- Project baru **Dev** dibangun kosong dari migrasi (murah, `rebuild-from-migrations` sudah terbukti).
- Project `nclkepwlsgmfbslgsajq` tetap sebagai **Staging**.
- Vercel: perbaiki Production Branch project `mrp-staging` supaya kembali ke `staging` (bukan `main`) SEBELUM ada project Vercel Production baru dibuat menunjuk ke project data nyata — urutan ini mencegah kejadian #2/#3 berulang dengan target yang justru data nyata.
- Backup: pindah `backup-db.yml` dari `workflow_dispatch` saja menjadi TERJADWAL (`schedule`, mis. harian) DI ATAS mode manual yang sudah ada, dan pertimbangkan menaikkan retensi artifact di atas 7 hari atau menyalin ke penyimpanan yang tidak auto-hapus.

## 5. Rencana Migrasi (berurutan, mengikuti urutan yang sudah ditetapkan pemilik produk)

1. **(Belum di sini) Perbaiki backup otomatis dulu** — ini prasyarat mutlak sebelum INF-02 boleh mulai (STOP CONDITION §6), disarankan juga dikerjakan SEBELUM RBD-03/RBD-04 supaya jendela tanpa-backup tidak makin lama.
2. RBD-03 — buat Vercel Team + GitHub Organization + Supabase Organization baru.
3. RBD-04 — transfer kepemilikan (1 repo, 1 project Vercel, 2 project Supabase) ke organisasi baru itu.
4. INF-02 — perapian environment (rename project data nyata jadi Production, buat Dev baru kosong, perbaiki Production Branch Vercel, verifikasi ulang backup jalan di organisasi baru).
5. Cara mundur di tiap langkah: langkah 2-3 tidak mengubah project ref/kunci APA PUN (hanya kepemilikan) → mundur = transfer balik. Langkah 4 (rename/Dev baru) tidak menyentuh project berisi data nyata sama sekali → mundur = hapus Dev baru, kembalikan nama.
6. Yang TIDAK disentuh sepanjang rencana ini: struktur RLS/company_id (sudah benar, §2 poin 6), skema tabel manapun, kode aplikasi.

## 6. Gerbang Persetujuan

**Task ini (INF-01) TIDAK ditutup sendiri oleh Claude Code** — dicatat sebagai Menunggu Persetujuan (E.2/E.3), karena STOP CONDITION di §2 poin 1 (backup tidak otomatis) dan poin 2 (Production Branch salah) menuntut keputusan pemilik produk sebelum RBD-03/RBD-04/INF-02 lanjut. Lihat detail lengkap "apa yang perlu diperiksa / di mana / bila disetujui / bila ditolak" di halaman Daftar Tugas Pembangunan, task **INF-01**.
