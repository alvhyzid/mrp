# SALES & CRM — KESIAPAN STAGING & UAT

**Tanggal:** 30 Agustus 2026 · **Kesimpulan:** **UAT READY = TIDAK**
**Sebab tunggal:** pekerjaannya **belum terdorong dan belum ter-deploy**, dan satu-satunya
jalur deploy yang ada **melepas langsung ke situs yang memakai DATA NYATA**.

> Lima hal ini **tidak sama**, dan dokumen ini memisahkannya satu per satu:
> **IMPLEMENTED ≠ COMMITTED ≠ PUSHED ≠ DEPLOYED ≠ UAT READY.**

## 1. Commit

| | |
|---|---|
| Commit terakhir Sales & CRM | **`0db1524`** — "feat(sales): jalur kanonik SO, penutupan order, pelepasan darurat, dan kontrak Finance" |
| Isi commit | **115 berkas · +17.810 baris** — seluruh pekerjaan sesi ini |
| Perubahan tersisa | **nol** — pohon kerja bersih setelah commit |

## 2. Branch

| | |
|---|---|
| Branch aktif | **`main`** |
| Posisi terhadap remote | **60 commit DI DEPAN `origin/main`** |
| Branch `staging` | **134 commit tertinggal** dari `main`; ia leluhur `main`, jadi bisa di-fast-forward |
| Branch sumber deployment | **`main`** — Vercel men-deploy **production** dari `main` (INF-11: percobaan mengubahnya ke `staging` gagal) |

## 3. Deployment

| | |
|---|---|
| Status | **BELUM TER-DEPLOY** |
| Alasan | 60 commit **belum pernah didorong** ke `origin/main` |
| Percobaan mendorong | **DITOLAK oleh pengaman izin** — butuh persetujuan eksplisit pemilik produk |

## 4. Commit yang berjalan di situs

| | |
|---|---|
| Situs | `mrp-staging-zeta.vercel.app` (project Vercel: `mrp-staging`) |
| Penanda deployment | `dpl_3QQgYwhSg5f2zqCSRwujxucazYDR` |
| SHA git-nya | **TIDAK DIKETAHUI** — Vercel tidak menyebut SHA di HTML, dan sesi ini tidak punya akses API Vercel |
| Yang PASTI | situs itu **tidak mungkin** memuat pekerjaan sesi ini, karena kodenya belum pernah meninggalkan mesin ini |
| Cocok dengan yang diharapkan | **TIDAK** |

## 5. TEMUAN PALING PENTING — "staging" itu memakai DATA NYATA

**FINDING** — Situs yang selama ini disebut *staging* adalah **deployment production Vercel**,
dan ia tersambung ke basis data **PT Indo Taste yang sungguhan**.

**AS-IS** — `mrp-staging-zeta.vercel.app` dibangun dari branch `main`.

**EVIDENCE** — berkas JavaScript yang benar-benar dikirim situs itu memuat
`https://kfvtrwuuqcjfkkuqizxt.supabase.co` — **project NYATA**, bukan project uji
(`nclkepwlsgmfbslgsajq`). Diambil lewat permintaan **GET biasa**, tanpa login.

**TO-BE** — UAT dijalankan di lingkungan yang datanya boleh dirusak.

**GAP** — belum ada deployment terpisah untuk uji.

**OWNERSHIP** — infrastruktur (INF-11, masih terbuka).

**IMPACT** — **UAT di situs itu berarti menekan tombol pada data PT Indo Taste yang sungguhan.**
Itu bertentangan dengan aturan batch ini sendiri (§8: jangan mengubah data nyata untuk UAT)
**dan** dengan aturan proyek (`main` = rilis langsung ke data nyata).

**RECOMMENDATION** — putuskan salah satu dari tiga pilihan di §12 sebelum mendorong apa pun.

**DECISION REQUIRED** — **YA**, dan ini satu-satunya penghambat kesiapan UAT.

## 6. Migrasi

| Project | Migrasi terpasang |
|---|---|
| **Nyata** (`kfvtrwuuqcjfkkuqizxt`) | **339 / 339** |
| **Uji** (`nclkepwlsgmfbslgsajq`) | **339 / 339** |
| **CI** (`gzxrgbwhmjwiakcyjipd`) | **339 / 339** |

**Skema sudah LEBIH MAJU daripada kode yang ter-deploy.** Diperiksa — dan **tidak merusak**:

- Seluruh tabel & kolom baru bersifat **tambahan**; nol kolom lama dihapus.
- `in_production` dicabut dari kekangan, dan **nol kode ter-deploy yang menulisnya**.
  Yang membacanya hanya satu saringan dashboard — saringan, bukan penulisan.
- Tanda tangan fungsi yang dipakai kode lama **tidak berubah**.

**Nol migrasi dijalankan untuk keperluan pembuktian.** Nol data nyata disentuh.

## 7. Verifikasi runtime

**TIDAK DILAKUKAN di situs**, dan tidak bisa dilakukan: kodenya belum ada di sana.

Yang **sudah** diverifikasi, dan di mana:

| Lapisan | Bukti | Di mana |
|---|---|---|
| Fungsi basis data | 155 pemeriksaan Sales | **project UJI** |
| Aturan bisnis & wewenang | 10 uji mutasi menggigit | **project UJI** |
| Tampilan | 6 lebar × keadaan, tiga arah tepi | **localhost**, seluruh tulisan diblokir |
| Route API | menolak tanpa login (401) | **localhost** |

> **Yang TIDAK terbukti, dan disebut apa adanya**: mutasi lewat HTTP di situs. Verifikasi
> peramban **sengaja memblokir seluruh permintaan non-GET**, jadi yang terbukti adalah
> **fungsi basis datanya**, bukan jalur HTTP-nya dari ujung ke ujung.

## 8. Regresi

**SOURCE TEST COUNT: 715 · PASSED: 708 · SKIPPED: 7 · FAILED: 0 · TOTAL: 715**
715 = 708 + 7 + 0 ✓ · 92 berkas · 1.691 detik · dijalankan **30 Agu 2026 pukul 02.13**,
bukan hasil lama.

## 9. Keamanan

Diverifikasi di project uji, **bukan** di situs:
anonim `42501` · perusahaan lain ditolak · peran tanpa wewenang ditolak · departemen lain
ditolak · **Company Admin ditolak** untuk pelepasan darurat · **General Manager diizinkan** ·
alasan wajib · penahanan asli utuh.

## 10. Keamanan data

Nol perusahaan fixture tersisa di kedua project · nol pengguna fixture · nol Sales Order nyata
berubah (tetap **0**) · nol PO klien nyata berubah (tetap **1**) · nol peran pengguna nyata
berpindah · nol data persediaan disentuh.

## 11. Matriks status

| Kapabilitas | Implemented | Tested | Committed | Pushed | Deployed | Staging Verified | UAT Ready |
|---|---|---|---|---|---|---|---|
| Pelanggan + alamat kirim | YES | YES | YES | **NO** | **NO** | **NO** | **NO** |
| PO klien: tahan / lepas / batal | YES | YES | YES | **NO** | **NO** | **NO** | **NO** |
| Pelepasan darurat (GM saja) | YES | YES | YES | **NO** | **NO** | **NO** | **NO** |
| Peran Sales | YES | YES | YES | **NO** | **NO** | **NO** | **NO** |
| Jalur kanonik PO → Sales Order | YES | YES | YES | **NO** | **NO** | **NO** | **NO** |
| Permintaan pembatalan | YES | YES | YES | **NO** | **NO** | **NO** | **NO** |
| Penutupan SO (produksi) | YES | YES | YES | **NO** | **NO** | **NO** | **NO** |
| Penutupan SO (stok/buffer) | YES | YES | YES | **NO** | **NO** | **NO** | **NO** |
| Termin & kewajiban pembayaran | YES | YES | YES | **NO** | **NO** | **NO** | **NO** |
| Jejak keputusan | YES | YES | YES | **NO** | **NO** | **NO** | **NO** |
| Migrasi basis data | YES | YES | YES | **NO** | **YA (DB)** | — | — |

**Nol YES diberikan tanpa bukti.** Kolom *Deployed* untuk migrasi berbeda karena migrasi
diterapkan langsung ke basis data, bukan lewat deployment aplikasi.

## 12. KEPUTUSAN ARCHITECTURE GUARDIAN — 30 Agustus 2026

**A DITOLAK · C DITOLAK · B DISETUJUI.** UAT di basis data PT Indo Taste **tidak
diperbolehkan**. Penanda `UJI-` **bukan batas keamanan**; pemisahan branch **bukan** pemisahan
lingkungan.

**Yang sudah dikerjakan sesudah keputusan itu** (rincian: `docs/infrastruktur/INF-11_STAGING_ENVIRONMENT_ISOLATION.md`):

- Basis data staging **sudah ada dan ber-skema identik** — 339 migrasi, 97 tabel, 6 bucket.
- **Isolasi terbukti** lewat uji negatif dua arah (401 di kedua arah, dengan kontrol positif).
- **Data UAT sintetis + 6 pengguna** siap, lewat satu perintah yang bisa diulang.
- Commit `0db1524` dan `d97b80b` **tidak didorong** — sesuai keputusan.

**Penghambat tersisa: satu.** Deployment aplikasi yang menunjuk staging — butuh Vercel, dan
sesi ini **tidak punya tokennya**. Dicatat sebagai **INF-03**.

## 12b. Tiga pilihan yang SUDAH TIDAK BERLAKU (dipertahankan sebagai jejak)

| Pilihan | Yang terjadi | Risiko |
|---|---|---|
| **A. Dorong ke `main`** | Situs langsung memuat kode baru | UAT berjalan di **data nyata PT Indo Taste**; setiap PO/SO uji yang Anda buat adalah baris sungguhan |
| **B. Pisahkan lingkungan uji lebih dulu** (INF-11) | UAT aman, data boleh dirusak | Butuh keputusan biaya/infrastruktur; UAT tertunda |
| **C. Dorong ke `main`, UAT dengan disiplin fixture** | Situs terbarui; UAT memakai pelanggan/PO bertanda uji yang dihapus sesudahnya | Lebih aman dari A, **tetapi tetap di basis data yang sama** |

~~**Saya tidak memilihkan.** Ketiganya menyangkut data sungguhan perusahaan Anda.~~
→ **Architecture Guardian memilih B.** A dan C ditolak.

## 13. Daftar periksa UAT

Siap dipakai **begitu kode ter-deploy**. Tanda ⚠️ = membuat/mengubah data.

> **Dijalankan di mana**: begitu deployment staging ada, seluruh daftar ini dijalankan di
> **UAT Manufaktur Nusantara** — perusahaan sintetis di basis data staging. Masuk memakai
> `gm@uat.fabrix`, `finance@uat.fabrix`, `ppic@uat.fabrix`, `sales@uat.fabrix`,
> `admin@uat.fabrix`, atau `gudang@uat.fabrix`.
>
> **Data yang sudah disiapkan**: `UAT-PO-001` (baru, untuk alur persetujuan) · `UAT-PO-002`
> (ditahan Finance, untuk pelepasan darurat) · SO `101` (siap ditutup dari produksi) · SO `102`
> (siap ditutup dari stok) · SO `103` (kurang kirim 200, tidak boleh bisa ditutup).
>
> **Tanda ⚠️ di bawah kini berarti "mengubah data STAGING"** — bukan data nyata. Aman.

### [ ] 1. Pelanggan
Buka **Customers** → buka satu pelanggan.
**Harapan**: daftar tampil, detail terbuka, daftar alamat kirim terlihat.
**Perhatikan**: kolom "Termin pembayaran" masih teks bebas — itu **catatan**, bukan penjadwal.
**Aman?** ✅ membaca saja.

### [ ] 2. Alamat kirim pelanggan ⚠️
Di detail pelanggan → **Tambah alamat**.
**Harapan**: alamat tersimpan dan muncul di pemilih saat membuat pengiriman.
**Perhatikan**: alamat yang sudah tercetak di surat jalan **tidak ikut berubah**.
**Aman?** ⚠️ membuat baris baru — pakai nama berawalan `UJI-`.

### [ ] 3. PO klien ⚠️
Buka **Customer PO** → buat PO baru.
**Harapan**: PO lahir berstatus **Baru**, dan butuh **tiga persetujuan departemen**.
**Perhatikan**: "Status bayar" akan selalu tertulis *menunggu* — **itu memang belum punya
sumber**, bukan berarti pelanggan belum bayar (PJL-17, diparkir sampai Finance ada).
**Aman?** ⚠️ pakai nomor PO berawalan `UJI-`.

### [ ] 4. Tahan PO ⚠️
Di detail PO berstatus Baru → **Tahan PO ini** → pilih kategori alasan.
**Harapan**: status jadi **Ditahan**; riwayat menyebut nama, departemen, dan alasan Anda.
**Perhatikan**: kategori "Lainnya" **mewajibkan catatan**.
**Aman?** ⚠️ mengubah status PO uji Anda sendiri.

### [ ] 5. Pelepasan darurat ⚠️
Masuk sebagai **General Manager** → buka PO yang ditahan **departemen lain** → **Lepas darurat**.
**Harapan**: tombolnya hanya muncul untuk GM; modal berwarna bahaya; **penahanan asli
ditampilkan** (siapa, departemen, kapan, alasan); alasan wajib bercatatan; riwayat menyebut
*"Dilepas darurat"* + dasar wewenang + departemen yang dilampaui.
**Perhatikan**: masuk sebagai **Company Admin** → tombolnya **tidak boleh muncul**, dan bila
dipaksa lewat API pun **ditolak**. Penahanan asli **tidak boleh hilang**.
**Aman?** ⚠️ mengubah status PO uji.

### [ ] 6. Peran Sales
Buka **Team & Invitations** → lihat pilihan peran.
**Harapan**: `sales` ada sebagai peran tersendiri.
**Perhatikan**: **jangan** mengubah peran orang sungguhan. Nol pengguna nyata berperan Sales
hari ini, dan itu memang disengaja.
**Aman?** ✅ selama tidak menyimpan perubahan peran.

### [ ] 7. Sales Order ⚠️
Setujui PO uji dengan **tiga akun berbeda** (finance, ppic, manager) → proses jadi Sales Order.
**Harapan**: satu PO menghasilkan **satu** Sales Order; menekan dua kali tidak menggandakan.
**Perhatikan**: statusnya **Dikonfirmasi** — status "Sedang produksi" **sudah tidak ada lagi**
(AD-03). Kemajuan produksi muncul sebagai keterangan terpisah, bukan status order.
**Aman?** ⚠️ membuat Sales Order uji.

### [ ] 8. Permintaan pembatalan ⚠️
Di detail Sales Order → **Ajukan pembatalan**.
**Harapan**: status order **tidak berubah**; muncul "Menunggu keputusan". Manager/GM
menyetujui atau menolak. **Pemohon tidak bisa memutus permintaannya sendiri.**
**Aman?** ⚠️ pada Sales Order uji.

### [ ] 9. Penutupan order — jalur produksi ⚠️
Sales Order → buat Work Order → selesaikan produksi → kirim **100%** → **Konfirmasi pemenuhan**
(PPIC) → **Tutup Sales Order** (Manager/GM).
**Harapan**: panel menampilkan *Produksi x/x · Pengiriman x/x · Dipenuhi dari: produksi
sendiri · Pemenuhan: Lengkap*; order menjadi **Selesai**.
**Perhatikan**: kirim sebagian → **tidak bisa ditutup**, dan layar menyebut **berapa yang
kurang**.
**Aman?** ⚠️ menyentuh produksi & pengiriman uji.

### [ ] 10. Penutupan order — jalur stok/buffer ⚠️
Sales Order **tanpa Work Order** → kirim dari stok yang sudah ada → konfirmasi → tutup.
**Harapan**: **bisa ditutup**; panel menyebut *Dipenuhi dari: **stok yang sudah ada***.
**Perhatikan**: inilah keputusan PJL-16 Anda — Work Order **bukan** syarat.
**Aman?** ⚠️ memakai stok uji, bukan stok nyata.

### [ ] 11. Pembayaran tidak menghalangi penutupan
Pada order yang sudah ditutup, periksa jadwal pembayarannya.
**Harapan**: order **Selesai** meski pembayaran belum lunas.
**Perhatikan**: panel jadwal menyebut sendiri bahwa FABRIX **belum mencatat penerimaan
pembayaran** — tidak ada kolom "terbayar"/"sisa", dan itu **disengaja**.
**Aman?** ✅ membaca saja.

### [ ] 12. Termin & kewajiban pembayaran
Buka Sales Order → panel **Jadwal pembayaran**.
**Harapan**: tahap, kapan ditagihkan, porsi, dan nilai rupiah; totalnya **sama persis** dengan
nilai order.
**Perhatikan**: **belum ada layar untuk membuat termin** (PJL-13) — jadwal hanya muncul bila
terminnya sudah dipasang lewat basis data.
**Aman?** ✅ membaca saja.

### [ ] 13. Keamanan
Masuk sebagai peran berbeda-beda dan periksa tombol yang **tidak** muncul.
**Harapan**: Sales tidak bisa membuat Work Order/pengiriman; hanya GM yang punya pelepasan
darurat; hanya PPIC yang mengonfirmasi pemenuhan; hanya pimpinan yang menutup order.
**Aman?** ✅ selama hanya melihat.

### [ ] 14. Tampilan di berbagai layar
Buka halaman Sales di HP dan di monitor lebar.
**Harapan**: tidak ada geseran ke samping, tidak ada tombol terpotong, modal muat penuh.
**Aman?** ✅.

### [ ] 15. Pesan kesalahan
Tekan simpan tanpa memilih kategori alasan.
**Harapan**: pesannya **menempel di kotak yang salah**, bukan di dasar modal.
**Aman?** ✅.

### [ ] 16. Riwayat keputusan
Buka detail PO/Sales Order yang pernah ditahan atau dibatalkan.
**Harapan**: tiap baris menyebut siapa, departemen, kapan, alasan, dan catatan; baris lama yang
tidak punya pelaku ditandai apa adanya — **bukan** diisi tebakan.
**Aman?** ✅ membaca saja.

### [ ] 17. Jejak audit
Buka **Audit Log**.
**Harapan**: perubahan tercatat; keputusan darurat menyebut dasar wewenangnya.
**Aman?** ✅ membaca saja.

## 14. Keterbatasan yang diketahui

1. **Belum ada layar untuk membuat termin pembayaran** (PJL-13).
2. **"Status bayar" PO klien tidak punya sumber** (PJL-17) — diparkir, sesuai keputusan.
3. **Harga jual tidak berversi dan tidak punya master** (PJL-18).
4. **Gerbang pembayaran belum ada** (PJL-15) — menunggu Finance.
5. **Inti manufaktur belum pernah dipakai** di data nyata: nol BOM, Work Order, batch, lot,
   pengiriman. Butir 9 dan 10 daftar UAT **membutuhkan data itu dibuat lebih dulu**.
6. **Mutasi lewat HTTP belum terbukti** dari ujung ke ujung — lihat §7.


---

## 15. TANDA GAGAL untuk tiap butir UAT

Daftar di §13 menyebut **apa yang seharusnya terjadi**. Bagian ini menyebut **apa yang berarti
implementasinya salah** — supaya Anda tidak perlu menebak apakah sesuatu "memang begitu".

| # | Butir | **TANDA GAGAL — kalau ini yang terjadi, laporkan** |
|---|---|---|
| 1 | Pelanggan | Daftar kosong padahal data UAT ada · detail tidak terbuka · daftar alamat tidak muncul |
| 2 | Alamat kirim | Alamat tersimpan tapi **tidak muncul** di pemilih pengiriman · alamat lama ikut berubah di surat jalan yang sudah terbit |
| 3 | PO klien | PO bisa langsung diproses **tanpa** tiga persetujuan · "Status bayar" menampilkan angka yang tampak sungguhan |
| 4 | Tahan PO | Bisa menahan **tanpa memilih alasan** · riwayat tidak menyebut nama & departemen Anda · kategori "Lainnya" diterima tanpa catatan |
| 5 | Pelepasan darurat | Tombol muncul untuk **Company Admin** · penahanan asli **hilang** atau berubah jadi seolah Finance yang melepas · bisa melepas **tanpa alasan** · GM tidak melihat penahanan aslinya |
| 6 | Peran Sales | `sales` tidak ada di daftar peran · peran orang sungguhan berubah sendiri |
| 7 | Sales Order | Satu PO menghasilkan **dua** Sales Order · status "Sedang produksi" masih muncul · menekan proses dua kali menggandakan |
| 8 | Permintaan pembatalan | Mengajukan **langsung** mengubah status order · pemohon **bisa** menyetujui permintaannya sendiri |
| 9 | Penutupan (produksi) | Order **bisa** ditutup padahal kirim baru sebagian · layar tidak menyebut **berapa** yang kurang · bisa ditutup tanpa konfirmasi PPIC |
| 10 | Penutupan (stok) | Order **ditolak** hanya karena tidak punya Work Order · panel tidak menyebut "stok yang sudah ada" |
| 11 | Pembayaran vs penutupan | Order **ditolak** ditutup karena belum lunas · muncul kolom "terbayar"/"sisa" yang isinya angka |
| 12 | Termin & kewajiban | Jumlah kewajiban **tidak sama** dengan nilai order · muncul status pembayaran yang tampak sungguhan |
| 13 | Keamanan | Sales bisa membuat Work Order/pengiriman · peran lain bisa menutup order · tombol darurat muncul untuk selain GM |
| 14 | Tampilan | Halaman bisa digeser ke samping · tombol terpotong · modal tidak muat di HP |
| 15 | Pesan kesalahan | Pesan muncul di dasar modal, **bukan** menempel di kotak yang salah |
| 16 | Riwayat keputusan | Baris tanpa pelaku diisi **tebakan nama** · alasan tidak tercatat |
| 17 | Jejak audit | Keputusan darurat **tidak** menyebut dasar wewenangnya |

**Aturan umum yang berlaku ke semua butir**: bila layar menampilkan **angka keuangan yang
terlihat sungguhan** padahal FABRIX belum mencatat pembayaran, itu **selalu** tanda gagal.
