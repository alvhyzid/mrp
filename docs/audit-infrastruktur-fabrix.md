# Audit Infrastruktur — Prasyarat Rebrand FABRIX (INF-01)

Dijalankan 22 Agu 2026, murni READ-ONLY (dibuktikan: `git diff` hanya menyentuh `docs/`, tidak ada satu project/DNS/env var/RLS/auth yang diubah). Sumber: `supabase projects/backups/functions list`, `vercel project inspect/env ls`, pemeriksaan publik bundle JS yang sudah live, `git log`/`git branch`, dan query baca (`select count`) ke kedua project Supabase lewat service-role key lokal. Tidak ada nilai secret (kunci/token/password) yang ditampilkan di dokumen ini — hanya NAMA variabel dan hasil perbandingan.

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
