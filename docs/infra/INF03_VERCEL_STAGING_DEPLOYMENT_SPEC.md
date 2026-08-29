# INF-03 — SPESIFIKASI DEPLOYMENT STAGING KE VERCEL

**Tanggal:** 30 Agustus 2026 · **Status:** **SIAP DIPASANG** — menunggu tindakan pemilik produk
**INF-11:** **PASS** — basis data staging sudah ada dan isolasinya terbukti.
**Aturan mengikat:** **JANGAN menyentuh production.** Jangan membuat project Supabase baru.

---

## 1. Kandidat rilis

| Commit | Waktu | Isi | Masuk staging? |
|---|---|---|---|
| **`0db1524`** | 30 Agu 02.36 | 115 berkas · **kode + migrasi + test** Sales & CRM | **YA — inti kandidat** |
| **`d97b80b`** | 30 Agu 02.40 | 3 berkas · **dokumen** kesiapan | YA — nol dampak runtime |
| **`29ca347`** | 30 Agu 02.58 | 3 berkas · **skrip seed staging** + dokumen | YA — nol dampak runtime |

**SHA final yang direkomendasikan: `29ca347`** (ujung `main` hari ini).

**Dasar rekomendasinya — bukan jumlah commit:**
1. Hanya `0db1524` yang mengubah **runtime**; dua sisanya dokumen dan satu skrip yang
   **tidak pernah dijalankan aplikasi**.
2. Menyertakan ketiganya membuat yang ter-deploy **sama persis** dengan yang diuji —
   memisahkannya justru melahirkan versi yang belum pernah diuji utuh.
3. **Pohon kerja bersih**: nol perubahan setelah `29ca347`.

**Branch sumber:** `main` (lokal). **Yang harus di-deploy Vercel:** branch **`staging`**,
yang harus dimajukan ke `29ca347` lebih dulu — lihat §9.

---

## 2. Target

```
APLIKASI STAGING  →  SUPABASE STAGING (mrp-rebuild-test-2A)
APLIKASI PRODUCTION  →  SUPABASE PRODUCTION (FABRIX-APP)
```

**DILARANG**: aplikasi staging menunjuk Supabase production.

| | Production | Staging |
|---|---|---|
| Project Supabase | `FABRIX-APP` | **`mrp-rebuild-test-2A`** |
| Ref | `kfvtrwuuqcjfkkuqizxt` | **`nclkepwlsgmfbslgsajq`** |
| Project Vercel | `mrp-staging` (yang ada) | **`fabrix-uat`** (baru) |
| Branch | `main` | **`staging`** |

---

## 3. Audit variabel lingkungan

**Nilai rahasia tidak ditulis di sini.** Sumbernya disebut, isinya `[REDACTED]`.

### 3.1 Yang dibutuhkan runtime aplikasi

| NAME | PURPOSE | REQUIRED | STAGING VALUE SOURCE | PRODUCTION VALUE SOURCE | SECURITY CLASS | USED BY | VERIFICATION |
|---|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Menentukan **project mana** yang dipakai | **YA** | `.env.staging.local` → `https://nclkepwlsgmfbslgsajq.supabase.co` | `.env.local` (FABRIX-APP) | **publik** (ikut ke peramban) | `supabaseClient.ts`, `supabaseServer.ts`, 91 titik | buka berkas JS situs, cari ref project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Kunci publik untuk sesi pengguna | **YA** | `.env.staging.local` `[REDACTED]` | `.env.local` `[REDACTED]` | **publik** | idem | login berhasil |
| `SUPABASE_SERVICE_ROLE_KEY` | Kunci **admin** untuk jalur server | **YA** | `.env.staging.local` `[REDACTED]` | `.env.local` `[REDACTED]` | **RAHASIA — jangan pernah ke peramban** | `supabaseServer.ts`, route API | halaman yang butuh admin termuat |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Cadangan** bila ANON tidak diset | tidak | — | — | publik | `supabaseClient.ts` | — |

> **Hanya tiga variabel pertama yang menentukan basis data.** Tidak ada mekanisme lain —
> tidak ada berkas konfigurasi, tidak ada penentuan berdasarkan nama host. Itu **menyederhanakan
> pemisahan lingkungan**: salah satu dari tiga itu salah, dan aplikasinya menunjuk basis data
> yang salah.

### 3.2 Yang TIDAK dibutuhkan deployment

`DEBUG_*_PASSWORD` (hanya untuk test & skrip seed di mesin lokal/CI) ·
`ALLOW_TESTS_AGAINST_REAL_PROJECT` (pengaman test, **jangan pernah** diset di deployment mana pun) ·
`SEED_BASE_URL`, `RUKO_DIENG_STOCK_CSV` (skrip sekali pakai).

**Bila variabel `DEBUG_*` ikut dipasang di Vercel, ia tidak berbahaya bagi runtime — tetapi
tidak ada gunanya, dan kata sandi yang tidak perlu ada sebaiknya memang tidak ada.**

---

## 4. Verifikasi target basis data

**Cara runtime menentukan basis data** (dibaca dari kode, bukan diduga):

```
src/lib/supabaseClient.ts : NEXT_PUBLIC_SUPABASE_URL + (ANON_KEY ?? PUBLISHABLE_KEY)
src/lib/supabaseServer.ts : URL + ANON_KEY untuk klien pengguna
                            URL + SERVICE_ROLE_KEY untuk klien admin
```

**Cara membuktikannya sesudah deploy — tanpa menulis apa pun:**

1. Buka alamat staging, lihat **berkas JavaScript**-nya, cari `*.supabase.co`.
   **Harus** `nclkepwlsgmfbslgsajq`. **Kalau muncul `kfvtrwuuqcjfkkuqizxt` — HENTIKAN**,
   variabelnya salah dan aplikasi staging sedang menunjuk data nyata.
2. Login dengan `gm@uat.fabrix` — akun ini **hanya ada di staging**. Kalau login berhasil,
   basis datanya benar. Kalau ditolak, ia menunjuk basis data lain.
3. Buka daftar pelanggan: **harus** muncul "PT Pelanggan Aktif UAT", **tidak boleh** muncul
   pelanggan PT Indo Taste.

Ketiganya **membaca saja**.

### 3.3 TEMUAN YANG MENENTUKAN CARA MEMASANGNYA

**`NEXT_PUBLIC_SUPABASE_URL` DITANAM KE DALAM BUNDEL SAAT BUILD, bukan dibaca saat berjalan.**

**Bukti**: build kandidat rilis dijalankan di mesin ini, lalu berkas hasilnya disisir —
`https://kfvtrwuuqcjfkkuqizxt.supabase.co` (**production**) ada di dalamnya, karena Next.js
memuat `.env.local` yang memang menunjuk production. Nilai itu **melekat di berkas JavaScript**,
bukan diambil ulang saat halaman dibuka.

**Konsekuensinya untuk Vercel, dan ini yang paling mudah salah:**

1. Ketiga variabel **wajib sudah terpasang SEBELUM build pertama** project `fabrix-uat`.
   Menambahkannya setelah build **tidak mengubah** situs sampai **di-build ulang**.
2. Bila alamat staging ternyata menunjuk basis data nyata, **jangan menebak** — ganti
   variabelnya lalu **Redeploy**, dan periksa lagi berkas JavaScript-nya.
3. Karena itulah cara verifikasi §4 nomor 1 dipilih: ia membaca **hasil build yang benar-benar
   dikirim**, bukan setelan yang tertulis di dasbor.

---

## 5. Isolasi production

Sudah dibuktikan di INF-11 (401 dua arah, dengan kontrol positif). Yang **belum** bisa
dibuktikan sampai deployment ada: **perilaku aplikasi** yang berjalan di staging.

**Penjaga yang harus tercantum di deployment**: variabel lingkungan staging **hanya** untuk
project `fabrix-uat`. Project `mrp-staging` (production) **tidak disentuh sama sekali**.

---

## 6. Langkah di dasbor Vercel

> Seluruh langkah di bawah dilakukan **pemilik produk**. Sesi Claude Code **tidak punya token
> Vercel**, jadi tidak satu pun bisa dikerjakan dari sini.

**1. Buat project baru** — *Add New → Project* → pilih repositori **`alvhyzid/mrp`**.
**Beri nama `fabrix-uat`.** **JANGAN** mengubah project `mrp-staging` yang sudah ada.

**2. Branch produksi project baru**: **`staging`** (Settings → Git → Production Branch).

**3. Build & install**: biarkan bawaan Next.js —
`Framework Preset: Next.js` · `Build Command: npm run build` · `Install Command: npm install` ·
`Output: (bawaan)`. Repositori ini **tidak** punya `vercel.json`, jadi nol penyesuaian khusus.

**4. Variabel lingkungan** (Settings → Environment Variables), **ketiganya**:

| Name | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://nclkepwlsgmfbslgsajq.supabase.co` | **Production + Preview** *(project fabrix-uat)* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ambil dari `.env.staging.local` | **Production + Preview** |
| `SUPABASE_SERVICE_ROLE_KEY` | ambil dari `.env.staging.local` | **Production + Preview** |

> **Kenapa "Production" di project UAT tidak berbahaya**: "Production" di Vercel hanya berarti
> *deployment utama dari branch utama project itu*. Karena project ini `fabrix-uat` dan branch
> utamanya `staging`, "production"-nya adalah **situs UAT** — bukan situs PT Indo Taste.

**5. Deploy** — otomatis begitu branch `staging` menerima commit.

**6. Alamat** — Vercel memberi `fabrix-uat*.vercel.app`. Catat alamatnya dan kirimkan ke saya.

**7. Yang TIDAK dilakukan**: jangan menghubungkan domain kustom, jangan menyalin variabel dari
project lama, jangan mengubah apa pun di `mrp-staging`.

## 6b. Preview vs Production di project UAT

| Lingkungan | Branch | Basis data |
|---|---|---|
| **Production** (project `fabrix-uat`) | `staging` | **Supabase staging** |
| **Preview** (project `fabrix-uat`) | branch lain | **Supabase staging** |
| **Production** (project `mrp-staging`) | `main` | Supabase production — **tidak disentuh** |

## 6c. Prosedur mundur (rollback)

Situs UAT rusak → Vercel → project `fabrix-uat` → **Deployments** → pilih deployment sebelumnya
→ **Promote to Production**. **Nol dampak** ke situs PT Indo Taste, karena keduanya project
terpisah. Ini justru alasan utama memakai project kedua, bukan mengubah yang ada.

---

## 7. Pemeriksaan sebelum deployment

| # | Pemeriksaan | Hasil |
|---|---|---|
| 1 | Commit kandidat teridentifikasi | **PASS** — `29ca347` |
| 2 | Branch teridentifikasi | **PASS** — sumber `main`, target `staging` |
| 3 | Pohon kerja dipahami | **PASS** — bersih, nol perubahan tertinggal |
| 4 | Konfigurasi build diperiksa | **PASS** — `next build`, nol `vercel.json` |
| 5 | Variabel lingkungan teridentifikasi | **PASS** — tiga, seluruhnya terdokumentasi |
| 6 | Target basis data staging teridentifikasi | **PASS** — `nclkepwlsgmfbslgsajq` |
| 7 | Kredensial production dikecualikan | **PASS** — nilai staging dari berkas terpisah |
| 8 | Basis data production dikecualikan | **PASS** |
| 9 | Supabase staging diverifikasi | **PASS** — 339 migrasi, 97 tabel, data UAT siap |
| 10 | Keadaan migrasi dipahami | **PASS** — ketiga project 339/339 |
| 11 | Konfigurasi autentikasi dipahami | **PASS** — edge function `custom-access-token` ada di staging |
| 12 | Spesifikasi deployment siap | **PASS** — dokumen ini |

---

## 8. Matriks kesiapan UAT

| Gate | Status | Bukti |
|---|---|---|
| Project Vercel | **BLOCKED** | butuh tindakan pemilik produk; nol token di sesi ini |
| Branch benar | **BLOCKED** | `origin/staging` masih tertinggal; dorongan ditolak pengaman |
| Commit benar | **PASS** | `29ca347`, pohon kerja bersih |
| Build | **PASS** | `npm run build` kode keluar **0**, 170 baris rute, nol galat |
| Variabel lingkungan | **PASS (spesifikasi)** | tabel §3 |
| Supabase staging | **PASS** | 339 migrasi · 97 tabel · data UAT |
| Isolasi production | **PASS** | uji negatif dua arah 401 + kontrol positif |
| Autentikasi | **NOT VERIFIED** | butuh deployment |
| Pengguna UAT | **PASS** | 6 pengguna `@uat.fabrix` di staging |
| Navigasi Sales | **NOT VERIFIED** | butuh deployment |
| Pelanggan · PO klien · Sales Order | **NOT VERIFIED** | butuh deployment |
| Tahan PO · Pelepasan darurat · Pembatalan | **NOT VERIFIED** di situs; **PASS** di basis data | 16 pemeriksaan + 3 mutasi |
| Penutupan SO (produksi & stok) | **NOT VERIFIED** di situs; **PASS** di basis data | 25 pemeriksaan + 2 mutasi |
| Keamanan | **PASS** di basis data; **NOT VERIFIED** di situs | matriks peran |
| Peramban | **PASS** di localhost; **NOT VERIFIED** di situs | 6 lebar, dua tepi |
| Regresi | **PASS** | 92 berkas · 708 lulus · 0 gagal · 715 = 715 |
| Daftar UAT | **PASS (tersedia)** | `SALES_CRM_STAGING_UAT_READINESS.md` |

**UAT READY = TIDAK**, dan penyebabnya dua baris pertama.

---

## 9. Yang harus dilakukan pemilik produk

**Langkah 1 — majukan branch `staging`.** Branch `staging` di GitHub masih tertinggal jauh, dan
Vercel membangun dari sana. Perintahnya (dari folder proyek):

```
git push origin main:staging
```

Ini **fast-forward** (`origin/staging` adalah leluhur `main`), jadi **nol riwayat ditulis
ulang**. **Ia tidak menyentuh `main`** — situs PT Indo Taste tidak berubah.

> Saya tidak bisa menjalankannya sendiri: pengaman izin sesi ini menolak seluruh `git push`.

**Langkah 2 — buat project Vercel `fabrix-uat`** sesuai §6.

**Langkah 3 — kirimkan alamat stagingnya.** Sesudah itu saya jalankan verifikasi deployment,
smoke test, keamanan, dan pemeriksaan awal UAT — **seluruhnya membaca saja lebih dulu**.
