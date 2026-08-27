# FABRIX — MODAL & FORM FINAL EVIDENCE

**STATUS: PROPOSED EVIDENCE**
**Bukan keputusan. Bukan standar. Bukan persetujuan.**
Dokumen ini hanya berisi ANGKA HASIL PENGUKURAN dan penunjukan sumbernya.
Keputusan apa pun yang diambil dari angka ini adalah wewenang pemilik produk.

| | |
|---|---|
| Tanggal pengukuran | 26–27 Agustus 2026 |
| Commit dasar | `712cd21` |
| Keadaan pohon kerja | bersih, kecuali `next-env.d.ts` (dibangkitkan `next dev`) dan `docs/00-GOVERNANCE/` yang belum terlacak — keduanya SUDAH ADA sebelum giliran ini |
| Tenant | `company.b@debug.mrp` (tenant uji). **Nol sentuhan ke PT ITM.** |
| Tinggi layar seluruh pengukuran | 800 px |
| Lebar yang diukur | 360 / 672 / 768 px |
| Baris data yang ditulis ke basis data | **NOL** — seluruh permintaan non-GET diblokir pengukur di lapisan jaringan (`503`), dan tidak satu pun tombol simpan akhir ditekan |

---

## 1. RINGKASAN SATU HALAMAN

Empat formulir terbesar diukur. **Tidak satu pun menyembunyikan tombol aksinya.** Kaki modal dan tombol utama terlihat di **seluruh 12 kombinasi form×lebar** yang berhasil diukur. Seluruh kontrol dapat dicapai lewat Tab, dan tombol utama menerima klik tetikus sungguhan.

Yang ditemukan bukan aksi yang tersembunyi, melainkan **dua hal lain**:

1. **Gulir menyamping di dalam modal pada lebar 360 px**, dengan **satu penyebab tunggal** yang sama di tiga formulir: indikator langkah Carbon (`cds--progress-step`). Besarnya berskala dengan jumlah langkah — 2 langkah = 0 px, 3 langkah = 42 px, 4 langkah = 170 px. Ini melanggar aturan responsive nomor 3 di CLAUDE.md.
2. **Isi modal jauh melampaui tinggi jendelanya**, dan pada langkah komponen BOM pertumbuhannya **tidak berbatas** — setiap komponen tambahan menambah 296–464 px tergantung lebar.

Tiga kegagalan yang dilaporkan pengukur versi pertama ternyata **cacat alat ukur, bukan cacat produk**. Ketiganya dibedah di §12 dan sudah diperbaiki sebelum angka di dokumen ini diambil.

---

## 2. APA YANG DIUKUR, DAN BAGAIMANA

Setiap pengukuran membaca DOM sungguhan di peramban, bukan kode sumber:

| Yang diukur | Cara membacanya |
|---|---|
| Tinggi wadah modal | `getBoundingClientRect().height` pada `.cds--modal-container` |
| Isi menggulir | `scrollHeight > clientHeight` pada `.cds--modal-content` |
| Kaki & tombol utama terlihat | kotak batasnya berada seluruhnya di dalam `innerHeight` |
| Gulir menyamping | `scrollWidth > clientWidth` pada isi modal |
| Pelaku luber | penyisiran setiap keturunan isi modal; yang tepi kanannya melewati `clientWidth` dicatat beserta kelasnya |
| Dapat dicapai Tab | tiap kontrol ditandai indeks **unik**, lalu Tab ditekan `2n+8` kali dan yang tersentuh dihitung |
| Menerima klik | peristiwa tetikus sungguhan (`mouse.move` → `down` → `up`) pada koordinat tombol; `mousedown`/`mouseup`/`click` dihitung, lalu `preventDefault` menahan akibatnya |

Klik programatik **tidak dipakai** — Carbon tidak menanggapinya (aturan CLAUDE.md yang sudah ada).

---

## 3. PO KLIEN — `/customer-purchase-orders`

Modal bertahap **4 langkah**. Langkah 1: 2 kontrol.

| Lebar | Tinggi modal | Isi | Menggulir | Kaki terlihat | Tombol utama | Gulir menyamping |
|---|---|---|---|---|---|---|
| 360 | 468 px | 330 / 330 | TIDAK | PASS | PASS ("Berikutnya") | **FAIL — 170 px** |
| 672 | 452 px | 314 / 314 | TIDAK | PASS | PASS | PASS |
| 768 | 452 px | 314 / 314 | TIDAK | PASS | PASS | PASS |

Tab @672: **PASS (11/11)** · Klik utama @672: **PASS** (`mousedown 1 / mouseup 1 / click 1`)

**Langkah 2–4: NOT RUN.** Validasi menahan perpindahan langkah, dan pengisian otomatis tidak memuaskannya. Angka untuk langkah 2–4 **tidak ada di dokumen ini** — bukan diperkirakan.

---

## 4. BOM — `/boms`

Modal bertahap **2 langkah**.

### 4.1 Langkah 1 — Induk & hasil (7 kontrol)

| Lebar | Tinggi modal | Isi | Kelebihan | Kaki | Tombol utama | Kontrol terakhir | Gulir menyamping |
|---|---|---|---|---|---|---|---|
| 360 | 800 px | 746 / 660 | **+86 px** | PASS | PASS | PASS | PASS |
| 672 | 720 px | 714 / 580 | **+134 px** | PASS | PASS | PASS | PASS |
| 768 | 720 px | 714 / 580 | **+134 px** | PASS | PASS | PASS | PASS |

Tab: **PASS (14/14)** di ketiga lebar · Klik utama: **PASS** di ketiga lebar

### 4.2 Langkah 2 — Komponen, BARIS BERULANG

Formulir **selalu lahir dengan 1 baris**. Keadaan "0 komponen" **tidak dapat dicapai lewat layar** — jadi kasus itu **NOT RUN karena tidak ada**, bukan karena tidak diuji.

| Lebar | Komponen | Isi / jendela | Kelebihan | Kaki | Tombol utama | Kontrol terakhir terlihat | Kontrol | Tombol hapus baris |
|---|---|---|---|---|---|---|---|---|
| 768 | 1 | 468 / 468 | — | PASS | PASS | PASS | 4 | 1 |
| 768 | 2 | 788 / 580 | +208 px | PASS | PASS | PASS | 8 | 2 |
| 768 | 3 | 1084 / 580 | +504 px | PASS | PASS | **FAIL** | 12 | 3 |
| 768 | 4 | 1380 / 580 | +800 px | PASS | PASS | **FAIL** | 16 | 4 |
| 672 | 1 | 484 / 484 | — | PASS | PASS | PASS | 4 | 1 |
| 672 | 2 | 820 / 580 | +240 px | PASS | PASS | PASS | 8 | 2 |
| 672 | 3 | 1132 / 580 | +552 px | PASS | PASS | **FAIL** | 12 | 3 |
| 672 | 4 | 1444 / 580 | +864 px | PASS | PASS | **FAIL** | 16 | 4 |
| 360 | 1 | 704 / 660 | +44 px | PASS | PASS | PASS | 4 | 1 |
| 360 | 2 | 1168 / 660 | +508 px | PASS | PASS | **FAIL** | 8 | 2 |
| 360 | 3 | 1632 / 660 | +972 px | PASS | PASS | **FAIL** | 12 | 3 |
| 360 | 4 | 2096 / 660 | +1436 px | PASS | PASS | **FAIL** | 16 | 4 |

**Pertumbuhan per komponen, terukur:** 768 px → **+296…+312 px**/baris · 672 px → **+312…+336 px**/baris · 360 px → **+464 px**/baris.

**Tidak ada batas.** Tidak ditemukan pembagian halaman, pelipatan, maupun pembatasan jumlah baris pada langkah ini.

Arti angka 360/4-komponen secara langsung: isi setinggi **2096 px** di dalam jendela **660 px** = **3,2 layar penuh** yang harus digulir untuk satu BOM berisi empat bahan.

**Yang TETAP benar dan penting**: kaki modal dan tombol "Buat BOM" **terlihat di seluruh 12 baris di atas**. Carbon memakukan kaki modal, sehingga bertambahnya baris **tidak pernah** menyembunyikan tombol simpan.

---

## 5. MASTER ITEM — `/items`

Modal bertahap **3 langkah**. Ketiga langkah terukur penuh.

| Lebar | Langkah | Isi / jendela | Kelebihan | Kaki | Tombol utama | Kontrol terakhir | Kontrol | Gulir menyamping |
|---|---|---|---|---|---|---|---|---|
| 360 | 1 | 711 / 660 | +51 px | PASS | PASS ("Berikutnya") | PASS | 5 | **FAIL — 42 px** |
| 360 | 2 | 848 / 660 | +188 px | PASS | PASS ("Berikutnya") | PASS | 3 | **FAIL — 42 px** |
| 360 | 3 | 732 / 660 | +72 px | PASS | PASS ("Tambah item") | PASS | 5 | **FAIL — 42 px** |
| 672 | 1 | 711 / 580 | +131 px | PASS | PASS | PASS | 5 | PASS |
| 768 | 1 | 711 / 580 | +131 px | PASS | PASS | PASS | 5 | PASS |

Tab: **PASS (16/16)** · Klik utama: **PASS** di ketiga lebar

---

## 6. KARYAWAN — `/hr`

Modal bertahap **3 langkah**. Langkah 1: 6 kontrol.

| Lebar | Tinggi modal | Isi / jendela | Kelebihan | Kaki | Tombol utama | Kontrol terakhir | Gulir menyamping |
|---|---|---|---|---|---|---|---|
| 360 | — | 780 / 660 | +120 px | PASS | PASS | PASS | **FAIL — 42 px** |
| 672 | 720 px | 769 / 580 | +189 px | PASS | PASS | PASS | PASS |
| 768 | 720 px | 769 / 580 | +189 px | PASS | PASS | PASS | PASS |

Tab @672 & @768: **PASS (15/15)** · Klik utama: **PASS**

**Langkah 2–3: NOT RUN** — validasi menahan perpindahan langkah.

**Catatan cara mencapai modalnya di 360 px** (bukan cacat modal, tapi fakta halaman): tombol "Tambah karyawan" berada di **y = 887 px** sedangkan jendela setinggi 800 px — **di bawah lipatan**. Halaman harus digulir dulu sebelum tombolnya bisa ditekan.

---

## 7. TEMUAN 1 — GULIR MENYAMPING @360 PX, SATU PENYEBAB TUNGGAL

Penyisiran keturunan isi modal menunjuk **elemen yang sama** di tiga formulir berbeda:

```
cds--progress-step  /  cds--progress-step-button  /  cds--progress-optional
```

Yaitu **indikator langkah Carbon**. Lebarnya tidak menyusut mengikuti lebar modal.

| Formulir | Jumlah langkah | Luber ke kanan @360 | @672 | @768 |
|---|---|---|---|---|
| BOM | 2 | **0 px** | 0 | 0 |
| Master Item | 3 | **42 px** | 0 | 0 |
| Karyawan | 3 | **42 px** | 0 | 0 |
| PO Klien | 4 | **170 px** | 0 | 0 |

Angkanya **berskala rapi dengan jumlah langkah**, dan **hanya muncul di 360 px**. Dua formulir yang sama-sama 3 langkah menghasilkan angka yang sama persis (42 px) — bukan kebetulan, melainkan satu sebab yang sama.

**Status terhadap aturan CLAUDE.md nomor 3** ("Tidak boleh ada gulir menyamping di lebar mana pun"): **FAIL untuk 3 dari 4 formulir di lebar 360 px.**

**TIDAK diperbaiki di giliran ini** — perintah kerja melarang mengubah komponen dan CSS. Dicatat sebagai temuan.

---

## 8. TEMUAN 2 — ISI SELALU MELAMPAUI JENDELA, TAPI AKSINYA TIDAK PERNAH HILANG

Dari 12 kombinasi form×lebar yang terukur, **9 menggulir vertikal**. Tiga yang tidak: PO Klien di ketiga lebar — langkah 1-nya hanya memuat 2 kontrol.

Dan pada **seluruh 26 baris pengukuran di dokumen ini**, tanpa kecuali:

- kaki modal **terlihat** — PASS
- tombol utama **terlihat** — PASS
- tombol utama **menerima klik tetikus sungguhan** — PASS di setiap pengujian klik yang dijalankan

**Pertanyaan pokok gerbang ini — "apakah ada aksi yang tersembunyi?" — jawabannya PASS.** Yang tersembunyi adalah **isi**, bukan **aksi**, dan isinya dapat dicapai dengan menggulir.

---

## 9. PERBANDINGAN DENGAN AMBANG CARBON

Carbon menyatakan pada halaman pola formulir:

> *"Use a dialog form when dealing with less than five inputs."*
> *"Use a side panel form when dealing with more than five inputs."*
> *"Dedicated page — For more complex, lengthier or multistep requests for user input."*

Dan pada halaman modal:

> *"If your modal has too much scrolling because of a maximum height limitation, consider using the next modal size up. If the large modal height is still not enough space then a full page might be needed instead."*

Jumlah kontrol per langkah yang **terukur** di FABRIX:

| Formulir | Langkah | Kontrol | Terhadap ambang "kurang dari 5" |
|---|---|---|---|
| PO Klien | 1 | 2 | di bawah ambang |
| Master Item | 1 | 5 | **tepat di ambang** |
| Master Item | 2 | 3 | di bawah ambang |
| Master Item | 3 | 5 | **tepat di ambang** |
| Karyawan | 1 | 6 | **di atas ambang** |
| BOM | 1 | 7 | **di atas ambang** |
| BOM | 2 (1 komponen) | 4 | di bawah ambang |
| BOM | 2 (4 komponen) | 16 | **jauh di atas ambang** |

**Ini disodorkan sebagai perbandingan angka, bukan sebagai vonis.** Ambang Carbon dihitung per formulir dialog; FABRIX memecah isinya jadi langkah-langkah, dan Carbon sendiri menyediakan varian bertahap. Apakah ambang itu berlaku per-langkah atau per-formulir **tidak dijawab dokumentasi Carbon**, dan **tidak diputuskan di sini**.

Yang **tidak ambigu** adalah kalimat kedua: modal yang isinya terlalu banyak menggulir sebaiknya naik ukuran, dan bila ukuran besar pun tidak cukup, pindah ke halaman. Angka di §4.2 (isi 2096 px di jendela 660 px) adalah masukan langsung untuk pertimbangan itu.

---

## 10. HASIL PER KRITERIA GERBANG

| Kriteria | PO Klien | BOM | Master Item | Karyawan |
|---|---|---|---|---|
| Modal terbuka di 360/672/768 | PASS | PASS | PASS | PASS |
| Kaki modal terlihat | PASS | PASS | PASS | PASS |
| Tombol utama terlihat | PASS | PASS | PASS | PASS |
| Tombol utama menerima klik | PASS | PASS | PASS | PASS |
| Seluruh kontrol dicapai Tab | PASS (11/11) | PASS (14/14) | PASS (16/16) | PASS (15/15) |
| Tanpa gulir menyamping | **FAIL @360** | PASS | **FAIL @360** | **FAIL @360** |
| Kontrol terakhir terlihat tanpa menggulir | PASS | **FAIL** ≥3 komponen | PASS | PASS |
| Seluruh langkah terukur | **NOT RUN** (2–4) | PASS | PASS | **NOT RUN** (2–3) |

---

## 11. YANG TIDAK DIUKUR, DAN KENAPA

| Tidak diukur | Sebab |
|---|---|
| PO Klien langkah 2–4 | Validasi menahan perpindahan langkah; pengisian otomatis tidak memuaskannya. **NOT RUN.** |
| Karyawan langkah 2–3 | Sama seperti di atas. **NOT RUN.** |
| BOM dengan 0 komponen | Keadaan itu **tidak dapat dicapai lewat layar** — formulir selalu lahir dengan 1 baris. |
| BOM lebih dari 4 komponen | Dihentikan di 4; pertumbuhannya sudah linear dan terukur, penambahan berikutnya tidak menambah informasi baru. |
| Perilaku menyimpan | Dilarang perintah kerja. Seluruh non-GET diblokir, tombol simpan akhir **tidak pernah** ditekan. |
| Lebar 1280 / 1440 / 1920 | Di luar lingkup gerbang ini, yang menetapkan 768/672/360. |

---

## 12. TIGA CACAT ALAT UKUR YANG DITEMUKAN DAN DIPERBAIKI

Wajib dicatat: **ketiganya menghasilkan KEGAGALAN PALSU** — laporan yang terlihat meyakinkan dan isinya salah. Seluruh angka di dokumen ini diambil **setelah** ketiganya diperbaiki.

**Cacat 1 — pemilih tombol menangkap tombol tersembunyi di dalam modal.**
Pemicu diklik lewat `getByRole('button').first()`. Di PO Klien ada **dua** tombol bernama "Buat PO klien": pemicu di toolbar, dan tombol aksi langkah terakhir di dalam modal. `ComposedModal` Carbon tetap merender anaknya saat tertutup (`visibility: hidden`), sehingga tombol kedua ikut terjaring. Yang diklik adalah tombol tersembunyi, modalnya tidak pernah terbuka, dan **seluruh angka PO Klien versi pertama tidak sah**.
*Perbaikan:* pemicu dicari hanya di antara tombol yang **bukan** keturunan `.cds--modal`, lalu diklik lewat koordinat sungguhan.
*Bukti:* setelah perbaikan, `is-visible: true` dan `visibility/opacity: visible/1`.

**Cacat 2 — kunci dedup Tab bertabrakan.**
Kontrol ditandai dengan gabungan `id` + kelas. Kontrol tanpa `id` berbagi kunci yang sama, sehingga penghitungnya selalu berhenti di **13** berapa pun jumlah kontrol sebenarnya — dan melaporkan **FAIL** untuk keempat formulir.
*Perbaikan:* tiap kontrol ditandai indeks **unik**.
*Bukti:* setelah perbaikan hasilnya 11/11, 14/14, 15/15, 16/16 — semuanya **PASS**, dan angkanya berbeda-beda sesuai jumlah kontrol yang sesungguhnya.

**Cacat 3 — klik koordinat di luar jendela.**
Tombol "Tambah karyawan" di 360 px berada di **y = 887** sedangkan jendela setinggi **800**. Klik pada koordinat itu tidak mengenai apa pun, dan pengukur melaporkan **"modal tidak terbuka"** untuk modal yang sebenarnya sehat.
*Perbaikan:* elemen digulir ke tampilan lebih dulu.
*Bukti:* setelah digulir, modalnya terbuka dan seluruh angkanya terukur (§6).

> Ketiganya contoh dari kelas yang sudah dikenal di proyek ini: **alat ukur yang melapor terbalik**. Aturan CLAUDE.md "penjaga yang salah tuduh diperketat, bukan dibiarkan" diterapkan di giliran yang sama.

---

## 13. BUKTI YANG DAPAT DIPERIKSA ULANG

| Berkas | Isi |
|---|---|
| `ev/hasil2.json` | 34 baris — sapuan pertama setelah cacat 1 & 2 diperbaiki |
| `ev/hasil3.json` | pelaku luber per elemen, dengan kelas dan jarak lubernya |
| `ev/hasil4.json` | Master Item tiga langkah + diagnosis tombol Karyawan |
| `ev/hasil5.json` | posisi tombol Karyawan @360 (`atas: 887`, `tinggiLayar: 800`) |
| `ev/hasil6.json` | 12 baris seri komponen BOM |

Berkas-berkas ini berada di direktori kerja sementara sesi, **tidak dimasukkan ke repo** — perintah kerja melarang menambah berkas selain dokumen ini.

---

## 14. YANG TIDAK DILAKUKAN DI GILIRAN INI

Sesuai larangan eksplisit perintah kerja:

- Tidak memindahkan satu pun modal
- Tidak membuat halaman baru
- Tidak membuat SidePanel
- Tidak mengubah komponen, CSS, API, maupun basis data
- Tidak membuat migrasi
- Tidak mengubah `build_tasks`
- Tidak mengerjakan DS-06, DS-10, maupun DS-20
- Tidak membuat commit, tidak `amend`, tidak `squash`, tidak `rebase`, tidak `push`

---

## 15. PERTANYAAN YANG DIJAWAB ANGKA INI — DAN YANG TIDAK

**Dijawab:**
- Apakah ada aksi yang tersembunyi di keempat formulir terbesar pada 360/672/768? → **Tidak.** Kaki dan tombol utama terlihat di seluruh 26 baris pengukuran.
- Apakah seluruh kontrol dapat dicapai keyboard? → **Ya**, keempatnya PASS penuh.
- Apakah ada gulir menyamping? → **Ya, di 360 px**, pada 3 dari 4 formulir, dengan **satu penyebab tunggal** yang sudah diidentifikasi sampai nama kelasnya.
- Seberapa besar isi modal dibanding jendelanya? → terukur, §4–§6.
- Apakah baris berulang BOM punya batas? → **Tidak ada batas yang ditemukan**; pertumbuhannya linear, 296–464 px per baris.

**TIDAK dijawab, dan tidak boleh disimpulkan dari dokumen ini:**
- Apakah formulir-formulir ini **seharusnya** tetap berupa modal.
- Apakah ambang "kurang dari lima kontrol" berlaku per langkah atau per formulir.
- Apakah gulir sebanyak itu **mengganggu** orang yang memakainya — itu memerlukan pengamatan pengguna sungguhan di lantai produksi, bukan pengukuran DOM.

---

# LAMPIRAN — IMPLEMENTATION FOLLOW-UP

**Ditambahkan 27 Agustus 2026.**
**Status dokumen TIDAK berubah: tetap PROPOSED EVIDENCE.** Bagian ini menambahkan hasil
perbaikan; ia tidak mengubah status dokumen menjadi kanonik, dan tidak ada persetujuan
governance yang mengizinkan perubahan status itu.

Dua cacat produk yang lahir dari dokumen ini sudah didaftarkan lewat mekanisme kanonik dan
diperbaiki. Registrasi dan perbaikannya dijelaskan di bawah, lengkap dengan angka sebelum
dan sesudah.

| | |
|---|---|
| DEFECT-A | **DS-21** — indikator langkah meluber horizontal di 360px |
| DEFECT-B | **DS-22** — kolom baris komponen BOM mengikuti lebar layar, bukan lebar wadah |
| Migrasi registrasi | `supabase/migrations/20260901100000_ds21_ds22_dua_defect_modal.sql` |
| Kode diperoleh dari | `node scripts/kode-task-berikutnya.js DS`, dijaga `pastikan_kode_task_kosong` |

---

## L.1 DEFECT-A → DS-21

### Bukti asli (dari bagian 7 dokumen ini)

Di 360px, indikator langkah meluber melewati tepi kanan isi modal:

| Formulir | Langkah | Luber @360 | @672 | @768 |
|---|---|---|---|---|
| BOM | 2 | 0 px | 0 | 0 |
| Master Item | 3 | 42 px | 0 | 0 |
| Karyawan | 3 | 42 px | 0 | 0 |
| PO Klien | 4 | 170 px | 0 | 0 |

### Akar penyebab

Satu deklarasi milik Carbon, dibaca dari paket terpasang:

```
@carbon/styles/scss/components/progress-indicator/_progress-indicator.scss
.cds--progress--space-equal .cds--progress-step { flex-grow: 1; min-inline-size: 8rem; }
```

`8rem` = **128 px lantai per langkah**. `spaceEqually` memberi `flex-grow`, tetapi lantai itu
menahannya sehingga langkahnya tidak bisa menyusut.

Aritmetikanya mereproduksi ketiga angka terhadap lebar isi modal 358 px:

```
N=2 -> 16 + 256 = 272 <= 358 -> luber   0 px
N=3 -> 16 + 384 = 400  > 358 -> luber  42 px
N=4 -> 16 + 512 = 528  > 358 -> luber 170 px
```

**Sumbernya SATU**: `src/components/ui/modal-bertahap.tsx`, fungsi `PenandaLangkah` — satu-satunya
tempat di seluruh repo yang merender `ProgressIndicator` Carbon. Consumer-nya tepat empat, dan
keempatnya adalah formulir yang diukur di atas. Diperbaiki di satu tempat, bukan empat.

### Perbaikan

Memakai varian `vertical` milik Carbon, yang mencabut lantai itu
(`min-inline-size: initial`), pada lebar tempat penanda **terhitung tidak muat**.

Ambangnya **dihitung dari jumlah langkah**, bukan satu angka tetap:
`jumlah langkah × 128 px + 18 px` → **274 / 402 / 530 px** untuk 2 / 3 / 4 langkah.

> **Kenapa dihitung, dan bukan satu ambang untuk semua.** Versi pertama memakai satu ambang
> tetap (breakpoint `md` Carbon, 672 px). Diukur, ia memperbaiki ketiga formulir yang meluber
> **tetapi mengenakan ongkos pada formulir yang tidak pernah meluber**: BOM hanya punya dua
> langkah dan penandanya muat nyaman di 360 px, namun tetap dipaksa menurun — 28 px menjadi
> 116 px. Delapan puluh delapan piksel terbuang di layar terkecil, untuk cacat yang tidak ia
> punya. Aturan proyek menjawabnya: jangan menetapkan sesuatu yang seharusnya dihitung.

### Tiga jalan yang ditolak, beserta alasan terukurnya

1. **`overflow: hidden`** — menyembunyikan berapa langkah tersisa. Mengganti satu cacat dengan
   cacat yang lebih sulit dilihat.
2. **Mencabut `spaceEqually` saja** — lantainya hanya turun 8rem → 7rem (112 px):
   `N=3 → 352 ≤ 358` sembuh, tetapi `N=4 → 464 > 358` **masih meluber 106 px**. Menyembuhkan dua
   formulir dan meninggalkan satu.
3. **Menimpa lantainya jadi nol dan tetap mendatar** — 4 langkah jadi ±85 px masing-masing dan
   labelnya terpotong. Berkas komponennya sendiri sudah mencatat bahwa penanda langkah yang
   terpotong tidak memberi tahu apa pun.

### Penjaga regresi

`tests/ds21_penanda_langkah_responsif.test.ts` — 6 uji.

Yang paling penting di antaranya: **uji (a2) mengikat konstanta 128 px di kode ke nilai yang
benar-benar dipancarkan paket Carbon terpasang.** Bila Carbon mengubah `min-inline-size`, ambang
yang dihitung ikut meleset dan luberannya kembali persis seperti sebelumnya — tanpa satu pun
test lain yang berbunyi. Uji ini yang berbunyi.

### Sebelum → sesudah (diukur di peramban, enam lebar × empat formulir = 24 pengukuran)

| Formulir | @360 sebelum | @360 sesudah | Tinggi penanda @360 |
|---|---|---|---|
| PO Klien | luber **170 px** | **0 px**, menurun | 28 → 232 px |
| Master Item | luber **42 px** | **0 px**, menurun | 28 → 174 px |
| Karyawan | luber **42 px** | **0 px**, menurun | 28 → 174 px |
| BOM | 0 px | **0 px**, tetap mendatar | 28 → **28 px** (tanpa ongkos) |

Pada 672 / 768 / 1280 / 1440 / 1920 px keempatnya tetap mendatar dan tetap nol luber — tidak ada
yang rusak oleh perbaikan ini.

**Hasil menyeluruh: 24 pengukuran, 0 masih meluber, 0 galat konsol, seluruh langkah tampak di
setiap lebar.**

**Ongkos yang dilaporkan apa adanya**: pada tiga formulir yang memang meluber, penanda tumbuh
88–204 px secara vertikal di 360 px. Gulir menyamping — yang dilarang keras aturan proyek —
ditukar dengan gulir menurun, yang normal dan sudah ditandai Carbon lewat gradien pudar di
bagian bawah isi modal.

---

## L.2 DEFECT-B → DS-22

### Bukti asli (dari bagian 4.2 dokumen ini)

Tinggi isi modal pada langkah Komponen tumbuh linier tanpa batas: di 360 px, 704 → 1168 → 1632 →
2096 px untuk 1 → 4 komponen.

### Akar penyebab — dan ini BUKAN yang terlihat pertama kali

Analisis pertama menyimpulkan masalahnya "form mekar di layar kecil". Pemeriksaan tandingan
membuktikan itu **melewatkan bagian terburuknya**.

Jumlah kolom ditentukan lebar **LAYAR** (`md` 672 px → 2 kolom, `lg` 1056 px → 4 kolom), padahal
baris ini hidup **di dalam modal**, dan modal Carbon justru **MENYEMPIT** saat layar melebar
(`_modal.scss`: 84% → 60% mulai 1056 px → 48% mulai 1312 px).

Dua perubahan berlawanan arah bertemu di **satu piksel viewport**:

| Viewport | Lebar wadah | Kolom | Lebar per kontrol | Baris keterangan bantuan |
|---|---|---|---|---|
| 1055 px | 886 px | 2 | **402 px** | 2 |
| **1056 px** | 634 px | 4 | **130 px** | **5** |
| 1312 px | 630 px | 4 | **129 px** | 5 |

**Kolom tersempit di seluruh rentang justru ada di DESKTOP, bukan di ponsel.**

### Perbaikan

```scss
grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr));
```

Kedua breakpoint lebar layar **dicabut**. `auto-fit` membaca lebar wadahnya sendiri, sehingga
jumlah kolom tidak bisa lagi bertentangan dengan lebar modal.

`min(15rem, 100%)` — bukan `15rem` saja — karena `minmax(15rem, 1fr)` **meluber** begitu wadahnya
lebih sempit dari 15rem: kolomnya menolak menyusut di bawah lantainya sendiri. Itu persis kelas
cacat yang diperbaiki DEFECT-A. Pembungkus `min()` membuat aturan ini tidak bisa melahirkan gulir
menyamping baru.

15rem = 240 px dipilih dari angka terukur: 130 px adalah lebar yang terbukti merusak, dan 240 px
masih memuat dua kolom di wadah tersempit yang punya lebih dari satu kolom (498 px).

### Tiga jalan yang ditolak, beserta alasannya

1. **Accordion / melipat baris** — Carbon melarangnya langsung di halaman pola formulir:
   *"Do not hide information in accordions or tabs."*
2. **Keadaan buka-tutup per baris** — barisnya di-`key` dengan **index** dan `removeLine`
   menyaring berdasarkan index. Menghapus baris tengah menggeser identitas seluruh baris
   sesudahnya, sehingga keadaan lipatan akan mengikuti **posisi**, bukan barisnya.
3. **Container query dengan ambang yang sama (672/1056)** — lebar dalam baris di viewport 1056 px
   dan 1312 px keduanya **di bawah 672 px**, jadi desktop akan jatuh ke satu kolom dan tingginya
   naik dari 254 px ke 446 px per baris: **76% lebih buruk**.

### Yang sudah dilakukan Carbon dan sengaja TIDAK dibangun ulang

Isi modal yang terpotong **sudah ditandai**. `_modal.scss` memberi `.cds--modal-scroll-content`
sebuah `mask-image` gradien yang memudarkan bagian bawah, dan `ComposedModal.js` menyalakannya
sendiri saat `scrollHeight > clientHeight`, sekaligus menambahkan `role="region"` dan `tabIndex`
untuk pembaca layar. Pernyataan bahwa "tidak ada apa pun yang memberi tahu daftarnya masih
berlanjut" **terbantah oleh paket terpasang**.

### Penjaga regresi

`tests/ds22_baris_komponen_bom.test.ts` — 6 uji, termasuk larangan kembalinya breakpoint lebar
layar, kewajiban pembungkus `min(..., 100%)`, dan penjagaan agar tombol hapus baris tetap
terpisah serta fungsi tambah/hapus komponen tidak ikut tercabut oleh perbaikan tata letak.

### Sebelum → sesudah (36 pengukuran: sembilan lebar × 1–4 komponen)

| Viewport | Kolom sebelum → sesudah | Lebar/kontrol sebelum → sesudah | Tinggi baris |
|---|---|---|---|
| 360 | 1 → 1 | 294 → **292 px** | 464 → **448 px** |
| 672 | 2 → 2 | 241 → **240 px** | 312 → **296 px** |
| 768 | 2 → 2 | 282 → **281 px** | 296 → **280 px** |
| 1055 | 2 → 3 | 402 → **262 px** | — → 296 px |
| **1056** | 4 → 2 | **130 → 275 px** | — → 280 px |
| 1280 | 4 → 2 | 164 → **342 px** | — → 280 px |
| **1312** | 4 → 2 | **129 → 273 px** | — → 280 px |
| 1440 | 4 → 2 | 144 → **304 px** | — → 280 px |
| 1920 | 4 → 3 | 202 → **274 px** | — → 280 px |

**Tebing 1055 → 1056 hilang**: sebelumnya 402 px jatuh ke 130 px dalam satu piksel; sekarang
262 px ke 275 px.

**Hasil menyeluruh: 36 pengukuran, 0 gulir menyamping, 0 elemen melewati tepi kanan maupun kiri,
0 kontrol di bawah 200 px** (sebelumnya 129–130 px pada dua lebar), 0 galat konsol. Kaki modal,
tombol utama, tombol tambah komponen, dan seluruh tombol hapus baris terlihat dan dapat diklik di
setiap kombinasi.

**Yang TIDAK berubah, dan disebut supaya tidak dikira sudah selesai**: isi modal **tetap tumbuh
linier** mengikuti jumlah komponen — di 360 px, empat komponen tetap menghasilkan ±2.184 px isi.
Pertumbuhan itu melekat pada formulir berulang, ditandai Carbon lewat gradien pudar, dan tidak
menyembunyikan satu pun aksi. Yang diperbaiki adalah **kolom yang bertentangan dengan lebar
wadahnya**, bukan panjang formulirnya.

---

## L.3 Aksesibilitas sesudah perbaikan

Diukur dengan penekanan tombol keyboard sungguhan, empat formulir × dua lebar (360 dan 1440):

| Yang diperiksa | Hasil |
|---|---|
| Setiap langkah punya nama terbaca | **PASS** — 0 langkah tanpa nama |
| Setiap langkah dapat difokus keyboard | **PASS** — 4/4, 3/3, 3/3, 2/2 |
| Perangkap fokus modal (Tab 40×) | **PASS** — 0 lolos ke luar modal |
| Perangkap fokus mundur (Shift+Tab 15×) | **PASS** — 0 lolos |
| Fokus terlihat | **PASS** — 40/40 |
| ESC menutup modal | **PASS** — seluruhnya |
| Perilaku identik vertikal vs mendatar | **PASS** |

**Dua catatan yang BUKAN akibat batch ini** dan sengaja tidak diperbaiki di sini: tidak ada
`aria-current` pada langkah yang sedang aktif, dan wadah modal Carbon ber-`role="presentation"`
tanpa `aria-label`. Keduanya sudah begitu sebelum perbaikan dan tidak berubah karenanya.
