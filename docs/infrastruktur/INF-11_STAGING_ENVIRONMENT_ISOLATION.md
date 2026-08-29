# INF-11 — PEMISAHAN LINGKUNGAN STAGING

**Tanggal:** 30 Agustus 2026 · **Keputusan Architecture Guardian:** **B disetujui** —
pisahkan lingkungan uji lebih dulu. **A dan C ditolak.**
**Aturan yang mengikat:** UAT di basis data PT Indo Taste **tidak diperbolehkan**.
Penanda `UJI-` **bukan batas keamanan**. Pemisahan branch **bukan** pemisahan lingkungan.

---

# BAGIAN 1 — AUDIT

## 1.1 Git

| Hal | Keadaan terukur |
|---|---|
| Remote | `origin` → `https://github.com/alvhyzid/mrp.git` |
| Branch aktif | `main` |
| Posisi | **61 commit di depan `origin/main`** (setelah commit dokumen kesiapan) |
| Branch `staging` | ada di lokal & remote, **134 commit tertinggal**, dan **leluhur** `main` (bisa fast-forward) |
| Commit kandidat rilis | **`0db1524`** dan **`d97b80b`** — **dipertahankan, tidak didorong** |

## 1.2 Vercel

| Hal | Keadaan terukur |
|---|---|
| Project | `mrp-staging` (`prj_t1E1zPcltRGjvZv4HjN6lKgX520O`), org `team_z72NiuSE2CKl5TQjwFusWgSU` |
| Branch produksi | **`main`** |
| Alamat | `mrp-staging-zeta.vercel.app` |
| Basis data yang dipakainya | **`kfvtrwuuqcjfkkuqizxt` = PRODUCTION** — dibaca dari berkas JavaScript yang dikirim situsnya sendiri |
| **Akses API Vercel dari sesi ini** | **TIDAK ADA** — nol token Vercel di Keychain maupun di lingkungan shell |

> **Konsekuensi yang menentukan bentuk rencana ini**: seluruh langkah yang menyentuh **Vercel**
> — membuat project kedua, mengatur variabel lingkungan, mengubah branch produksi —
> **tidak bisa dikerjakan dari sini**. Ia butuh tindakan pemilik produk di dasbor Vercel,
> atau sebuah token yang diberikan secara sadar.

## 1.3 Project Supabase — TIGA, bukan dua

| Ref | Nama | Peran hari ini | Migrasi | Tabel | Company | users | auth.users |
|---|---|---|---|---|---|---|---|
| `kfvtrwuuqcjfkkuqizxt` | **FABRIX-APP** | **PRODUCTION** (data nyata) | 339 | 97 | 2 | 8 | 8 |
| `nclkepwlsgmfbslgsajq` | **mrp-rebuild-test-2A** | dipakai test lokal — **kandidat STAGING** | 339 | 97 | **15** | **0** | **36** |
| `gzxrgbwhmjwiakcyjipd` | **fabrix-ci-test** | dipakai CI GitHub Actions | 339 | 97 | 3 | 8 | 8 |

> **Catatan penting**: catatan INF-11 lama menyebut batas **2 project** di paket gratis sebagai
> penghalang. **Itu tidak lagi berlaku** — organisasi ini punya **tiga project aktif**, dan
> yang kedua sudah ber-skema identik dengan production. **Basis data staging tidak perlu
> dibuat; ia sudah ada.**

## 1.4 Skema, storage, autentikasi, integrasi

| Hal | Production | Staging | Sama? |
|---|---|---|---|
| Migrasi | 339 | 339 | **YA** |
| Tabel | 97 | 97 | **YA** |
| Bucket storage | 6 | 6 (nama identik) | **YA** |
| Edge function `custom-access-token` | ada | ada | **YA** |

**Integrasi luar yang bisa menimbulkan efek nyata**: **nol**. Tidak ada payment gateway,
tidak ada pengiriman surel keluar, tidak ada webhook — disisir di repositori.

## 1.5 Kredensial

`.env.local` → **production**. `.env.staging.local` → **staging**. Keduanya terpisah,
dan test lokal memakai `.env.staging.local` lewat `scratchpad/jalankan-suite.sh`.

## 1.6 Bukti isolasi — DIUJI, bukan diperiksa dari variabel

| Percobaan | Hasil |
|---|---|
| service-role **staging** → **MEMBACA** production | **DITOLAK 401** |
| service-role **staging** → **MENULIS** production | **DITOLAK 401** |
| anon **staging** → production | **DITOLAK 401** |
| service-role **production** → staging | **DITOLAK 401** |
| **kontrol positif** — staging → staging | **BERHASIL 200** |

**Kesimpulan: TERBUKTI TERISOLASI.** Kontrol positif ada supaya uji yang menolak semuanya
tidak bisa menyamar sebagai uji yang benar. Diperiksa sesudahnya: production tetap **2 company**,
**nol** baris berpola `ISOLATION-TEST`.

## 1.7 Riwayat migrasi

Ketiganya mencatat **339 versi** di `supabase_migrations.schema_migrations`, dan seluruhnya
lahir dari berkas yang sama di `supabase/migrations/`. Riwayatnya **dapat dilacak** dan sama.

---

# BAGIAN 2 — JURANG YANG SEBENARNYA

Setelah audit, jurang INF-11 **jauh lebih sempit** daripada dugaan awal, dan bentuknya berbeda:

| Yang dikira kurang | Kenyataan |
|---|---|
| Basis data staging belum ada | **SUDAH ADA**, skemanya identik |
| Batas paket gratis 2 project | **TIDAK BERLAKU** — ada 3 project aktif |
| Isolasi belum terbukti | **SUDAH TERBUKTI** lewat uji negatif dua arah |

| Yang benar-benar kurang | Sifat |
|---|---|
| **Deployment aplikasi yang menunjuk staging** | **Vercel** — tidak bisa dikerjakan dari sesi ini |
| **Pengguna aplikasi di staging** | `users` = **0 baris** padahal `auth.users` = 36 → **tidak ada yang bisa login** |
| **Data UAT yang masuk akal** | 15 company sisa fixture, bukan data yang bisa dipakai orang menguji |
| **Kemampuan reset/reseed** | belum ada satu perintah untuk mengembalikan staging ke keadaan bersih |

---

# BAGIAN 3 — RENCANA IMPLEMENTASI

## 3.1 Yang DIKERJAKAN dari sesi ini (aman, nol sentuhan production)

1. **Bersihkan sisa fixture** di staging — 15 company sisa uji dan auth user yatim.
2. **Seed data UAT sintetis** yang jelas bertanda UAT, memakai mekanisme kanonik.
3. **Buat pengguna aplikasi staging** untuk tiap peran yang dibutuhkan UAT.
4. **Satu perintah reset/reseed** supaya staging bisa dikembalikan kapan saja.
5. **Uji isolasi negatif** dijadikan skrip yang bisa dijalankan ulang.

## 3.2 Yang TIDAK BISA dikerjakan dari sesi ini

| Langkah | Kenapa | Siapa |
|---|---|---|
| Membuat/menyetel project Vercel kedua | **nol token Vercel** | pemilik produk di dasbor |
| Mengatur variabel lingkungan deployment | idem | pemilik produk |
| Mengarahkan deployment ke basis data staging | idem | pemilik produk |
| Mengubah branch produksi | idem (dan pernah gagal) | pemilik produk / dukungan Vercel |

**Bentuk yang disarankan** (keputusan tetap milik pemilik produk):

> Buat **project Vercel KEDUA** — misalnya `fabrix-uat` — yang membangun dari branch
> **`staging`**, dengan variabel lingkungan menunjuk `nclkepwlsgmfbslgsajq`.
> Project yang sekarang (`mrp-staging`) **dibiarkan apa adanya** sebagai production.
>
> **Kenapa project kedua, bukan mengubah yang ada**: mengubah yang ada berarti menyentuh
> satu-satunya alamat yang hari ini dipakai memantau data sungguhan. Project kedua
> menambah, tidak mengambil — dan bila salah, tidak ada yang hilang.

## 3.3 Urutan setelah Vercel siap

```
Local → push branch `staging` → CI/Test → Deploy staging → Smoke test → E2E → UAT → sign-off → rilis production
```

**Bukan**: `Local → main → data production → UAT`.

---

# BAGIAN 4 — KRITERIA TERIMA (12 butir)

| # | Kriteria | Keadaan |
|---|---|---|
| 1 | Staging punya project/basis data terpisah | **TERPENUHI** — `nclkepwlsgmfbslgsajq` |
| 2 | Staging tidak menunjuk basis data production | **TERPENUHI** |
| 3 | Kredensial staging tidak bisa menulis production | **TERPENUHI & TERUJI** (401 dua arah) |
| 4 | Sumber deployment staging jelas | **BELUM** — butuh Vercel |
| 5 | Variabel lingkungan staging benar | **BELUM** — butuh Vercel |
| 6 | Batas storage/auth/integrasi diperiksa | **TERPENUHI** — bucket & fungsi identik, nol integrasi luar |
| 7 | Migrasi staging lengkap | **TERPENUHI** — 339/339 |
| 8 | Data UAT sintetis tersedia | **DIKERJAKAN giliran ini** |
| 9 | Staging bisa di-reset/reseed | **DIKERJAKAN giliran ini** |
| 10 | Uji negatif membuktikan isolasi | **TERPENUHI & TERUJI** |
| 11 | Commit kandidat bisa di-deploy ke staging | **BELUM** — butuh butir 4 & 5 |
| 12 | Daftar UAT bisa dijalankan tanpa data nyata | **BELUM** — butuh butir 11 |

**Delapan dari dua belas terpenuhi.** Empat sisanya **seluruhnya** bergantung pada satu hal:
akses Vercel.

---

# BAGIAN 5 — HASIL PELAKSANAAN (30 Agustus 2026)

## 5.1 Yang dikerjakan

**`scripts/staging-uat-reset.js`** — satu perintah untuk mengembalikan staging ke keadaan
bersih dan siap diuji orang:

```
node scripts/staging-uat-reset.js
```

**Pengaman yang tidak bisa dilewati**: skrip **menolak berjalan** bila URL yang terbaca bukan
project staging. Ref-nya **ditulis keras**, dan **tidak ada flag** untuk melewatinya — karena
skrip ini menghapus data, dan "pastikan environment-nya benar" adalah kalimat yang bergantung
pada orang mengingatnya.

## 5.2 Isi data UAT

| Hal | Isi |
|---|---|
| Perusahaan | **UAT Manufaktur Nusantara** — jelas bukan PT Indo Taste |
| Pengguna | 6, satu per peran: `gm@` · `admin@` · `finance@` · `ppic@` · `sales@` · `gudang@` **`uat.fabrix`** |
| Pelanggan | 2 (aktif & nonaktif) + 2 alamat kirim |
| Master | 1 item (`UAT-GUMMY-01`) + 1 BOM aktif |
| PO klien | `UAT-PO-001` **baru** · `UAT-PO-002` **ditahan Finance** · `UAT-PO-003` **batal** |
| Sales Order | 3 keadaan penutupan (lihat 5.3) |
| Pembayaran | termin 60/40 + kewajiban Rp15.000.000 & Rp10.000.000 |

## 5.3 Verifikasi — dari sudut pandang PENGGUNA yang login, bukan admin

| Sales Order | Layak ditutup? | Sumber | Bukti |
|---|---|---|---|
| `101/8-UAT/2026` | **YA** | **produksi** | 1/1 Work Order · 10.000/10.000 terkirim |
| `102/8-UAT/2026` | **YA** | **stok** | **0 Work Order** — membuktikan PJL-16 di data staging |
| `103/8-UAT/2026` | **TIDAK** | produksi | *"Masih ada 200 dari 10000 yang belum dikirim."* |

`UAT-PO-002` tertahan **departemen finance** — sehingga pelepasan darurat oleh **General
Manager** benar-benar bisa diuji (ia harus melampaui departemen **lain**, bukan departemennya
sendiri).

## 5.4 Yang TIDAK bisa diseeding, dan kenapa itu bukan kelalaian

**Quotation · Sample · Complaint · RMA** — **tabelnya belum ada**. Keputusan bisnisnya sudah
ditutup (DEC-S02/S03/S07), implementasinya belum. Membuat tabel bayangan hanya supaya daftar UAT
terlihat penuh akan melahirkan **kapabilitas palsu**.

## 5.5 Sisa penghalang — satu, dan hanya satu

**Deployment aplikasi yang menunjuk staging.** Butuh Vercel; **nol token tersedia** di sesi ini.

Begitu itu ada, empat kriteria terakhir (4, 5, 11, 12) terpenuhi sekaligus, dan UAT bisa
dijalankan penuh **tanpa menyentuh satu baris pun data PT Indo Taste**.
