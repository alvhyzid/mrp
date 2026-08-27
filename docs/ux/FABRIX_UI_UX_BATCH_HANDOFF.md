# FABRIX — HANDOFF BATCH UI/UX
## Dari bukti modal → pencatatan cacat → perbaikan

**27 Agustus 2026** · Commit: `ecdf10b` (implementasi) dan commit penutup batch ini.
**Tidak ada yang di-push.** Tidak ada `amend`, `squash`, maupun `rebase`.

---

## 1. RINGKASAN EKSEKUTIF

Gerbang bukti sebelumnya mengukur empat formulir terbesar dan menemukan **dua kerusakan
nyata**. Batch ini mencatat keduanya sebagai pekerjaan resmi, memperbaikinya, dan
membuktikan perbaikannya dengan mengukur ulang di peramban.

**Kerusakan pertama — penanda langkah keluar dari tepi layar di HP.**
Formulir panjang dipecah jadi beberapa langkah, dan di atasnya ada penanda "Langkah 1, 2,
3, 4". Di layar HP, penanda itu **lebih lebar daripada layarnya**, sehingga pengguna harus
menggeser layar ke samping untuk tahu sudah sampai langkah berapa. Sekarang penanda itu
**tersusun ke bawah** saat memang tidak muat, dan **tetap mendatar saat masih muat**.

**Kerusakan kedua — dan yang ini kebalikan dari dugaan semula.** Baris bahan pada formulir
BOM disusun jadi beberapa kolom mengikuti lebar **layar**. Tetapi formulir itu hidup di
dalam jendela yang justru **menyempit** saat layar melebar. Akibatnya, pada layar besar
tiap kolom jatuh jadi selebar **130 piksel** — sekitar selebar satu kata — dan keterangan
bantuannya pecah jadi lima baris. **Layar besar justru mendapat tampilan paling sempit.**
Sekarang jumlah kolomnya mengikuti **ruang yang benar-benar ada**, bukan lebar layar.

**Hasil terukur:**

| | Sebelum | Sesudah |
|---|---|---|
| Penanda langkah keluar tepi (4 formulir × 6 lebar) | 3 formulir bermasalah di 360px | **0 dari 24 pengukuran** |
| Kolom tersempit di formulir BOM | **129 px** (di layar 1312 px) | **273 px** |
| Gulir menyamping (36 pengukuran BOM) | ada | **0** |
| Galat di konsol peramban | — | **0** |
| Uji otomatis | 435 | **447** (+12, semuanya baru) |
| Masalah lint | 28 | **28** (nol tambahan) |

---

## 2. KEADAAN AWAL

| | |
|---|---|
| Commit awal | `712cd21` |
| Perubahan pohon kerja | `next-env.d.ts` (dibangkitkan `next dev`), `docs/00-GOVERNANCE/` (belum terlacak, 27 Agu 07:14), `FABRIX_MODAL_FORM_FINAL_EVIDENCE.md` (dari gerbang bukti sebelumnya) |
| Kondisi STOP | **Tidak ada.** Ketiganya teridentifikasi asalnya dan bukan perubahan tak terduga. |

`next-env.d.ts` kembali bersih dengan sendirinya setelah `npm run build`; ia **tidak ikut**
di-commit. `docs/00-GOVERNANCE/` **tidak ikut** — ia sudah ada sebelum batch ini.

---

## 3. PENCATATAN PEKERJAAN

Kode task **tidak ditebak**. Diambil lewat `node scripts/kode-task-berikutnya.js DS`
(menjawab `DS-21`) dan dijaga fungsi basis data `pastikan_kode_task_kosong` tepat sebelum
tiap penulisan — fungsi yang lahir justru karena menebak kode sudah gagal **empat dari
empat kali**.

| Kode | Judul | Urgensi | Status akhir |
|---|---|---|---|
| **DS-21** | Indikator langkah modal bertahap meluber horizontal di 360px | mendesak | selesai |
| **DS-22** | Baris komponen BOM: kolom mengikuti lebar layar, padahal hidup di dalam modal yang menyempit | mendesak | selesai |

**Tidak ada task duplikat dibuat.** Enam kandidat pemilik diperiksa satu per satu
(`DS-18`, `AUD-06`, `AUD-25`, `RSP-01`, `RSP-02`, `PMB-08`) dan tidak satu pun memiliki
kedua cacat ini: DS-18 mengurus **ukuran modal dan jumlah kolom form**, RSP-01 sudah
selesai dan mengurus **tabel di halaman**, RSP-02 adalah **pengawas** untuk wadah tabel.

Kedua task diberi tag `Visual` **dengan sengaja**: sistem menurunkan label "aman dikerjakan
paralel" dari **ketiadaan** tag itu, jadi task tanpa tag akan berbohong tentang dirinya
sendiri.

---

## 4. DEFECT-A → DS-21

### Masalahnya

Di layar selebar HP (360 px), penanda langkah lebih lebar daripada isi jendelanya:

| Formulir | Jumlah langkah | Kelebihan lebar |
|---|---|---|
| BOM | 2 | 0 px |
| Master Item | 3 | 42 px |
| Karyawan | 3 | 42 px |
| PO Klien | 4 | **170 px** |

### Penyebabnya

Carbon memasang **lebar minimum 128 piksel untuk setiap langkah**. Penanda boleh melebar,
tetapi **tidak boleh menyempit** di bawah angka itu. Jadi empat langkah membutuhkan minimal
512 piksel, sementara isi jendela di HP hanya 358 piksel.

Perhitungannya cocok **persis** dengan ketiga angka yang terukur — bukan kebetulan, bukan
korelasi:

```
2 langkah:  16 + 256 = 272  muat di 358  ->    0 px
3 langkah:  16 + 384 = 400  lewat        ->   42 px
4 langkah:  16 + 512 = 528  lewat        ->  170 px
```

**Sumbernya satu tempat**, bukan empat: seluruh formulir bertahap memakai komponen bersama
yang sama. Diperbaiki sekali, keempatnya ikut.

### Perbaikannya

Carbon sendiri menyediakan jawabannya: mode **tersusun ke bawah**, yang mencabut lebar
minimum itu sepenuhnya. Kami memakainya — bukan menimpa Carbon.

Ambang peralihannya **dihitung dari jumlah langkah**, bukan satu angka tetap:
**274 px** untuk 2 langkah, **402 px** untuk 3, **530 px** untuk 4.

> **Kenapa dihitung, dan ini perubahan arah yang lahir dari mengukur.** Versi pertama
> memakai satu ambang tetap untuk semua formulir. Ia memperbaiki ketiga formulir yang
> rusak — **tetapi merugikan formulir yang tidak rusak**. BOM hanya punya dua langkah dan
> penandanya muat nyaman di HP, namun tetap dipaksa tersusun ke bawah dan memakan **88
> piksel tambahan di layar terkecil**, untuk masalah yang tidak ia punya. Aturan proyek
> menjawabnya langsung: jangan menetapkan sesuatu yang seharusnya dihitung.

### Tiga jalan yang ditolak, dan alasannya

1. **Memotong penandanya** — pengguna jadi tidak tahu berapa langkah tersisa. Mengganti
   satu masalah dengan masalah yang lebih sulit dilihat.
2. **Sekadar mematikan pembagian rata** — lebar minimumnya hanya turun dari 128 ke 112
   piksel. Itu menyembuhkan formulir 3 langkah **tetapi meninggalkan PO Klien tetap keluar
   106 piksel**. Menyembuhkan dua, meninggalkan satu.
3. **Memaksa penandanya menyempit sambil tetap mendatar** — empat langkah jadi sekitar 85
   piksel masing-masing dan tulisannya terpotong. Catatan di komponennya sendiri sudah
   memperingatkan bahwa penanda langkah yang terpotong tidak memberi tahu apa pun.

### Sebelum → sesudah

| Formulir | @360 sebelum | @360 sesudah | Tinggi penanda |
|---|---|---|---|
| PO Klien | keluar **170 px** | **0 px**, tersusun ke bawah | 28 → 232 px |
| Master Item | keluar **42 px** | **0 px**, tersusun ke bawah | 28 → 174 px |
| Karyawan | keluar **42 px** | **0 px**, tersusun ke bawah | 28 → 174 px |
| BOM | 0 px | **0 px**, tetap mendatar | 28 → **28 px** |

Pada 672 / 768 / 1280 / 1440 / 1920 px keempatnya tetap mendatar dan tetap bersih.

**Ongkosnya disebut apa adanya**: pada tiga formulir yang memang rusak, penanda memakan
88–204 piksel lebih tinggi di HP. Gulir menyamping — yang dilarang keras aturan proyek —
ditukar dengan gulir ke bawah, yang normal dan sudah ditandai Carbon lewat efek memudar di
bagian bawah jendela.

### Penjaganya

`tests/ds21_penanda_langkah_responsif.test.ts` — 6 uji.

Yang terpenting: satu uji **mengikat angka 128 piksel di kode kami ke angka yang
benar-benar ada di dalam paket Carbon**. Bila Carbon kelak mengubahnya, perhitungan ambang
kami ikut meleset dan kerusakannya kembali — dan uji inilah yang akan berbunyi.

---

## 5. DEFECT-B → DS-22

### Masalahnya

Formulir BOM punya baris bahan yang bisa ditambah sebanyak yang dibutuhkan. Tinggi
isinya tumbuh terus: di HP, 704 → 1168 → 1632 → 2096 piksel untuk 1 → 4 bahan.

### Penyebabnya — dan analisis pertama SALAH soal ini

Analisis pertama menyimpulkan masalahnya "formulirnya mekar di layar kecil", dan menyatakan
layar besar **kemungkinan tidak bermasalah**. Pemeriksaan tandingan membuktikan itu keliru,
dan yang terlewat justru bagian terburuknya.

Jumlah kolom mengikuti lebar **layar**. Tetapi jendela modal Carbon justru **menyempit**
saat layar melebar — dari 84% layar, ke 60%, lalu ke 48%. Dua perubahan berlawanan arah
bertemu di **satu piksel**:

| Lebar layar | Lebar jendela | Kolom | Lebar tiap kolom | Keterangan bantuan |
|---|---|---|---|---|
| 1055 px | 886 px | 2 | **402 px** | 2 baris |
| **1056 px** | 634 px | 4 | **130 px** | **5 baris** |
| 1312 px | 630 px | 4 | **129 px** | 5 baris |

**Kolom paling sempit di seluruh rentang justru ada di layar paling besar.**

### Perbaikannya

Kedua aturan berbasis lebar layar **dicabut**. Diganti satu aturan yang membaca **ruang
yang benar-benar tersedia** dan memasang lebar minimum 240 piksel per kolom — angka yang
dipilih dari pengukuran: 130 piksel terbukti merusak, dan 240 piksel masih memuat dua kolom
di jendela tersempit yang punya lebih dari satu kolom.

### Tiga jalan yang ditolak

1. **Melipat baris jadi ringkasan** — Carbon melarangnya langsung di panduan formulirnya:
   *"jangan sembunyikan informasi di dalam accordion atau tab."*
2. **Menyimpan keadaan buka-tutup per baris** — baris dikenali dari **posisinya**, bukan
   identitasnya. Menghapus baris tengah akan membuat baris yang tadinya terbuka menampilkan
   isi baris lain.
3. **Membaca lebar wadah dengan ambang lama** — akan membuat layar 1312 px jatuh ke satu
   kolom dan tingginya naik **76%**.

### Yang sudah dilakukan Carbon dan sengaja tidak dibangun ulang

Isi jendela yang terpotong **sudah ditandai**: bagian bawahnya memudar secara otomatis
begitu isinya lebih panjang daripada jendelanya, lengkap dengan penanda untuk pembaca
layar. Anggapan bahwa "tidak ada apa pun yang memberi tahu daftarnya masih berlanjut"
terbantah oleh paket yang terpasang.

### Sebelum → sesudah

| Lebar layar | Lebar tiap kolom sebelum → sesudah |
|---|---|
| 1055 px | 402 → 262 px |
| **1056 px** | **130 → 275 px** |
| 1280 px | 164 → **342 px** |
| **1312 px** | **129 → 273 px** |
| 1440 px | 144 → **304 px** |
| 1920 px | 202 → **274 px** |

Tinggi tiap baris juga turun: 464 → 448 px di HP, 312 → 296 px di 672 px, 296 → 280 px di
768 px.

**Yang TIDAK berubah, dan disebut supaya tidak dikira sudah selesai**: isi jendela **tetap
memanjang** mengikuti jumlah bahan. Itu melekat pada formulir yang barisnya bisa ditambah,
sudah ditandai Carbon, dan **tidak menyembunyikan satu pun tombol**. Yang diperbaiki adalah
kolom yang bertentangan dengan lebar wadahnya — bukan panjang formulirnya.

### Penjaganya

`tests/ds22_baris_komponen_bom.test.ts` — 6 uji, termasuk larangan kembalinya aturan
berbasis lebar layar dan penjagaan agar tombol tambah/hapus bahan tidak ikut tercabut oleh
perbaikan tampilan.

---

## 6. KESESUAIAN DENGAN CARBON

Seluruh angka dibaca dari **paket yang benar-benar terpasang** (`@carbon/react` 1.114.0,
`@carbon/styles` 1.113.0, `@carbon/layout` 11.57.0), bukan dari dokumentasi atau ingatan.

| Bukti Carbon | Keputusan FABRIX |
|---|---|
| Lebar minimum 128 px per langkah pada mode bagi-rata | Sumber kerusakan; dipakai sebagai dasar perhitungan ambang |
| Mode tersusun ke bawah mencabut lebar minimum itu | Dipakai apa adanya — bukan ditimpa |
| Komponen Carbon mematikan bagi-rata sendiri saat tersusun ke bawah | Ditulis bersyarat juga di kode kami, supaya yang terbaca sama dengan yang berlaku |
| Jendela modal menyempit 84% → 60% → 48% | Dasar pencabutan aturan berbasis lebar layar |
| *"Jangan sembunyikan informasi di accordion atau tab"* | Solusi melipat baris ditolak |
| Isi terpotong sudah ditandai memudar otomatis | Tidak dibangun ulang |

**Alamat katalog untuk perbandingan berdampingan** — pemeriksaan yang hanya bisa dilakukan
mata manusia:

- Penanda langkah: `https://carbondesignsystem.com/components/progress-indicator/usage/`
- Modal: `https://carbondesignsystem.com/components/modal/usage/`
- Pola formulir: `https://carbondesignsystem.com/patterns/forms-pattern/`

**Satu penyimpangan disebut terbuka**: Carbon tidak menyediakan aturan responsif bawaan
untuk penanda langkah — berkas gayanya **nol media query**. Ambang peralihan kami adalah
keputusan FABRIX, tetapi **diturunkan dari angka Carbon sendiri**, bukan dari selera.

---

## 7. PEMERIKSAAN RESPONSIF

**DS-21** — 4 formulir × 6 lebar (360 / 672 / 768 / 1280 / 1440 / 1920) = **24 pengukuran**.
Hasil: 0 keluar tepi, 0 gulir menyamping halaman, 0 galat konsol, seluruh langkah tampak.

**DS-22** — 9 lebar × 1–4 bahan = **36 pengukuran**. Lebarnya sengaja memuat **titik
perubahan 1055 dan 1056 px** serta **1312 px** — bukan hanya lebar yang lazim dipakai
orang, karena lebar yang tidak pernah menyentuh batas tidak akan pernah menemukan cacat
batas. Di situlah kerusakan ini hidup, dan lebar-lebar lazim melewatkannya.

Hasil: 0 gulir menyamping, **0 elemen melewati tepi kanan maupun kiri** (diperiksa dua
arah, sesuai aturan DS-14), 0 kolom di bawah 200 px, 0 galat konsol. Kaki jendela, tombol
utama, tombol tambah bahan, dan seluruh tombol hapus baris terlihat dan dapat diklik di
**setiap** kombinasi.

---

## 8. PEMERIKSAAN AKSESIBILITAS

Diukur dengan penekanan tombol keyboard sungguhan, 4 formulir × 2 lebar:

| Yang diperiksa | Hasil |
|---|---|
| Setiap langkah punya nama terbaca pembaca layar | **PASS** |
| Setiap langkah dapat difokus keyboard | **PASS** |
| Fokus tidak lolos keluar jendela (Tab 40×) | **PASS** — 0 lolos |
| Fokus tidak lolos mundur (Shift+Tab 15×) | **PASS** — 0 lolos |
| Fokus terlihat | **PASS** — 40/40 |
| ESC menutup jendela | **PASS** |
| Perilaku sama antara tersusun-ke-bawah dan mendatar | **PASS** |

**Dua catatan yang BUKAN akibat batch ini** dan sengaja tidak diperbaiki di sini: langkah
yang sedang aktif tidak ditandai `aria-current`, dan wadah modal Carbon tidak punya label
tersendiri. Keduanya sudah begitu sebelum perbaikan dan tidak berubah karenanya.

---

## 9. PEMERIKSAAN KEMUNDURAN

| Gerbang | Hasil |
|---|---|
| Typecheck | **bersih** |
| Lint | **28 masalah — sama persis dengan baseline.** Dibuktikan dengan menyimpan sementara perubahan batch ini lalu mengukur ulang: 28 tanpa batch ini, 28 dengan batch ini. |
| Suite penuh | **71 berkas, 447 lulus, 7 dilewati, 0 gagal** (baseline 69 berkas / 435 uji; batch ini menambah 2 berkas / 12 uji) |
| Build produksi | **lulus** — seluruh rute ter-prerender, termasuk keempat halaman bermodal bertahap |
| Penjaga kurung migrasi | **lulus** |

**Catatan lint yang layak disebut**: versi pertama kait media query memakai `useState` +
`useEffect` dan **menambah satu masalah lint baru**. Peringatannya benar, bukan kebisingan.
Diganti ke `useSyncExternalStore` — API yang memang React sediakan untuk berlangganan
sumber di luar React — dan hitungan lint kembali ke baseline.

### Bukti MERAH → HIJAU

Setiap penjaga dibuktikan **berbunyi lebih dulu**:

| Penjaga | MERAH | HIJAU |
|---|---|---|
| DS-21 (a) ambang dihitung | gagal — nol kata `vertical` | lulus |
| DS-21 (a2) angka 128 px terikat ke Carbon | gagal saat kode diubah jadi 120 px | lulus |
| DS-21 (b) bagi-rata bersyarat | gagal saat dipatok mati **dan** saat kondisinya terpisah | lulus |
| DS-21 (d) kait hanya di satu tempat | gagal saat kait disalin ke halaman | lulus |
| DS-21 (e) aman di server | gagal — berkasnya belum ada | lulus |
| DS-22 (a)(b)(c) kolom ikut wadah | gagal — masih memakai aturan lebar layar | lulus |

---

## 10. PERUBAHAN DI DAFTAR TUGAS

| Task | Sebelum | Sesudah |
|---|---|---|
| DS-21 | belum ada | dibuat → **selesai** |
| DS-22 | belum ada | dibuat → **selesai** |

**Nol task lain tersentuh** — dibuktikan dengan menghitung task yang tanggal selesainya
berubah dalam tiga menit terakhir di ketiga basis data: **0**. Tidak ada urgensi task lain
yang diubah, tidak ada task lain yang ditutup.

Total task: **322 → 324** di basis data sungguhan.

---

## 11. GIT

| | |
|---|---|
| Commit awal | `712cd21` |
| Commit implementasi | `ecdf10b` |
| Commit penutup | commit kedua batch ini (migrasi status + handoff ini) |
| Push | **TIDAK** |
| Amend / squash / rebase | **TIDAK** |

Diperiksa sebelum commit: `git diff --check` bersih, dan `docs/00-GOVERNANCE/` serta
`next-env.d.ts` **dipastikan tidak ikut**.

---

## 12. BERKAS YANG BERUBAH

| Berkas | Peran |
|---|---|
| `src/lib/useMediaQuery.ts` | **baru** — satu-satunya kait media query di aplikasi |
| `src/components/ui/modal-bertahap.tsx` | penanda langkah menghitung ambangnya sendiri |
| `app/(shell)/boms/boms.scss` | kolom baris bahan mengikuti lebar wadah |
| `tests/ds21_penanda_langkah_responsif.test.ts` | **baru** — 6 penjaga |
| `tests/ds22_baris_komponen_bom.test.ts` | **baru** — 6 penjaga |
| `supabase/migrations/20260901100000_...` | **baru** — pencatatan DS-21 & DS-22 |
| `supabase/migrations/20260901110000_...` | **baru** — penutupan DS-21 & DS-22 |
| `docs/ux/FABRIX_MODAL_FORM_FINAL_EVIDENCE.md` | ditambahi lampiran hasil perbaikan |
| `docs/ux/FABRIX_UI_UX_BATCH_HANDOFF.md` | **baru** — dokumen ini |

---

## 13. BERKAS YANG SENGAJA TIDAK DIUBAH

- Keempat halaman formulir (`BomsPage`, `CustomerPurchaseOrdersPage`, `ItemsPage`,
  `HrDashboardPage`) — perbaikan DS-21 hidup di komponen bersamanya, jadi **nol baris**
  perlu berubah di halaman mana pun.
- Tujuh tempat lain yang punya pola baris berulang sekelas DS-22 (lihat bagian 14).
- `docs/00-GOVERNANCE/` — sudah ada sebelum batch ini.
- Seluruh modal lain, kaki modal global, tema Carbon, dan navigasi.
- `DS-03`, `DS-06`, `DS-09`, `DS-14`, `DS-17`, `DS-19`, `DS-20`, `AUD-42`, `AUD-47`,
  `AUD-48`, `MST-09` — **tidak ada satu pun yang disentuh.**

---

## 14. TEMUAN YANG DICATAT DAN **TIDAK** DIKERJAKAN

Ini bagian yang paling perlu dibaca, karena tiga di antaranya lebih besar daripada
pekerjaan batch ini sendiri.

### T-1 — **PENTING**: migrasi baru diam-diam tidak berlaku di basis data sungguhan

Saat menerapkan pencatatan task, migrasinya melaporkan **berhasil** dan **tidak menulis
satu baris pun** ke basis data sungguhan.

Sebabnya: pola yang dipakai **118 migrasi** mencari perusahaan bernama `'PT ITM'`. Di basis
data sungguhan, perusahaannya bernama **`'PT Indo Taste Manufacture'`** — ia diganti nama
setelah migrasi-migrasi lama itu berjalan. Pencariannya gagal, migrasinya berhenti diam-diam.

**Akibatnya untuk ke depan: setiap migrasi baru yang memakai pola itu akan melaporkan
berhasil dan tidak melakukan apa-apa di basis data sungguhan.** Tidak ada yang berbunyi.

Migrasi batch ini sudah diperbaiki sendiri (mencari perusahaan pemilik registri task, dan
**melempar galat** alih-alih diam bila pencariannya gagal padahal ada perusahaan). **Yang
118 lainnya belum.**

**Ini belum jadi task** — perintah kerja batch ini menetapkan **tepat dua** pendaftaran.
Rekomendasi: jadikan task di batch berikutnya, dan pertimbangkan pengawas yang gagal keras.

### T-2 — Tujuh tempat lain punya pola baris berulang sekelas DS-22

| Berkas gaya | Halaman |
|---|---|
| `routing.scss:90` | `RoutingsPage.tsx:770` — **paling parah: 642 px per baris di HP** |
| `production.scss:94` | `ProductionDashboardPage.tsx:686` |
| `production.scss:58` | `ProductionDashboardPage.tsx:617` |
| `customer-po.scss:166` | `CustomerPurchaseOrdersPage.tsx:1048` |
| `purchasing.scss:90` | `PurchasingPage.tsx:1356` |
| `warehouse.scss:33` | `WarehouseDashboardPage.tsx:707` |
| `shipments.scss:89` | `ShipmentsPage.tsx:889` |

Bentuk lain yang sekelas: `ppic.scss:47` + `PpicDashboardPage.tsx:1218`.
Daftar ini tersimpan di dalam DS-22 supaya tidak hilang.

### T-3 — `DS-21` disebut perintah kerja sebagai task yang tidak boleh diubah, padahal belum ada

Perintah kerja mencantumkan `DS-21` di daftar "jangan diubah". Diperiksa: **kode itu tidak
ada di basis data**, dan justru merupakan kode kosong berikutnya menurut skrip kanonik.
Karena perintah kerja juga melarang membuat kode secara manual, kode itu dipakai sesuai
jawaban skrip. **Bila yang dimaksud sebenarnya task lain, beri tahu — mudah diganti.**

### T-4 — Folder governance baru bertentangan dengan basis data

`docs/00-GOVERNANCE/FABRIX_BUILD_LIFECYCLE.md` menetapkan status task berbahasa Inggris
(`PROPOSED → APPROVED → READY → IN_PROGRESS → VERIFYING → DONE`). Basis data memakai
kosakata Bahasa Indonesia yang berbeda (`menunggu`, `sedang_dikerjakan`,
`menunggu_persetujuan`, `selesai`, `ditunda_sadar`, `dibatalkan`), ditegakkan oleh kekangan
basis data.

Folder itu bertanda **"Proposed Canonical Governance"** dan belum terlacak git, jadi batch
ini memakai kosakata basis data dan **melaporkan pertentangannya** alih-alih diam-diam
menyatukannya. Perlu keputusan pemilik produk.

### T-5 — Dua catatan aksesibilitas yang sudah ada sebelumnya

Langkah aktif tidak ditandai `aria-current`, dan wadah modal Carbon tidak punya label
tersendiri. Bukan akibat batch ini.

---

## 15. REKOMENDASI BATCH BERIKUTNYA

Urut menurut besar risikonya, bukan menurut mudahnya:

1. **T-1 — migrasi yang diam-diam tidak berlaku.** Ini yang paling berbahaya di daftar:
   pekerjaan bisa terlihat selesai padahal tidak pernah sampai ke basis data sungguhan.
2. **T-2 — RoutingsPage**, cacat yang sama dengan DS-22 dan terukur lebih parah. Perbaikannya
   sudah terbukti, tinggal diterapkan.
3. **T-4 — pertentangan kosakata governance.** Butuh keputusan, bukan kode.
4. **DS-18** masih menunggu persetujuan pemilik produk untuk satu hal yang tidak dijawab
   Carbon: modal mana yang layak jadi halaman penuh. Bukti dari batch ini memberi angka baru
   untuk keputusan itu.

---

## 16. BATAS BERHENTI YANG TEGAS

Batch ini **berhenti di sini**. Dua cacat yang diminta sudah dicatat, diperbaiki, diuji,
diukur, dan ditutup. Tidak ada pekerjaan lain yang diambil.

Satu hal **diperbaiki di luar rencana**, dan alasannya disebut terbuka: perbaikan DEFECT-A
versi pertama **menyebabkan kemunduran** pada BOM di HP (88 piksel terbuang untuk masalah
yang tidak ia punya). Perintah kerja mewajibkan kemunduran yang lahir dari batch ini
diperbaiki sebelum berhenti — dan itulah yang melahirkan ambang terhitung.

Selain itu: **nol modal dipindahkan, nol halaman baru, nol SidePanel, nol perubahan tema
atau navigasi, nol pengerjaan DS-06 / DS-20 / AUD-42 / MST-09.**

---

## ROADMAP SNAPSHOT

Dihitung dari basis data **sungguhan pada 27 Agustus 2026** — bukan disalin dari dokumen
lama.

| | Jumlah |
|---|---|
| **Total task** | **324** |
| Selesai | **114** |
| Menunggu | 166 |
| Ditunda sadar | 34 |
| Menunggu persetujuan | 6 |
| Sedang dikerjakan | 1 |
| Dibatalkan | 3 |

| Urgensi | Jumlah |
|---|---|
| Penting | 112 |
| Tidak mendesak | 83 |
| Bisa menunggu | 82 |
| Mendesak | 38 |
| Super urgent | 9 |

**Penyelesaian: 35,2%** terhadap seluruh 324 task · **35,5%** bila 3 task yang dibatalkan
dikeluarkan dari penyebut.

**Super urgent yang belum selesai: 2** — `INF-05` dan `INF-18`.
