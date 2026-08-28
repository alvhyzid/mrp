# KELAS VALIDASI TINGKAT FIELD — AUDIT & PILOT (`DS-25`)

Standar yang lahir dari audit ini: `FABRIX_FIELD_VALIDATION_CLASS_STANDARD.md`
Handoff: `FABRIX_FIELD_VALIDATION_CLASS_HANDOFF.md`

---

## 1. BASELINE

| | |
|---|---|
| HEAD awal | `891e3cd` |
| Pohon kerja | bersih, kecuali `docs/00-GOVERNANCE/` (untracked, sudah ada sebelumnya) |
| Uji sebelum | 77 berkas · 499 lulus · 7 dilewati |
| Lint sebelum | 28 (16 error, 12 warning) |
| Typecheck | bersih |

## 2. EVIDENCE — DAN ANGKA YANG DIREKONSILIASI

| Yang diukur | Hasil |
|---|---|
| Kontrol form (9 jenis, sama dengan sapuan sebelumnya) | **237** di **26** halaman |
| Kontrol form (11 jenis, + `PasswordInput`/`Checkbox`/`RadioButton`) | **247** di **28** halaman |
| `invalidText` sebelum batch ini | **5** |
| `InlineNotification` di halaman | **110** |
| Pesan validasi dari server (4xx) | **368** kemunculan |
| Pesan validasi sisi klien | **68** kemunculan |
| Pesan **unik** seluruhnya | **225** |

Angka **237** dipertahankan sebagai angka resmi supaya sebanding dengan laporan sebelumnya;
**247** disebut karena daftar jenis kontrolnya berbeda, bukan karena ada yang berubah.

## 3. FALSE POSITIVE — DAN INI TEMUAN TERPENTINGNYA

> **455 dari 569 pesan validasi server (80%) MEMANG SEHARUSNYA di tingkat formulir.**
> Kelas ini bukan *"semuanya salah tempat"*.

Digolongkan dengan pertanyaan §1 standar — *"bisakah pengguna memperbaikinya dengan mengubah
satu isian yang terlihat?"*:

| Golongan | Jumlah | Contoh | Vonis |
|---|---|---|---|
| Izin / peran | 5 unik | *"Role Anda tidak punya izin membuat PO ke supplier."* | **PASS** — form-level benar |
| Sesi / login | 7 unik | *"Sesi Anda sudah tidak valid."* | **PASS** |
| Entitas tidak ditemukan | 13 unik | *"Work Order tidak ditemukan."* | **PASS** |
| Keadaan bisnis | 23 unik | *"PO ini sudah diterima penuh atau dibatalkan."* | **PASS** |
| Penjaga parameter rute | belasan | *"ID BOM tidak valid."* | **PASS** — tidak pernah dilihat pengguna lewat formulir |

**Menggantinya jadi `invalidText` akan MEMPERBURUK layar**: menandai sebuah isian untuk galat
yang tidak bisa diperbaiki dari isian itu membuat orang mengubah hal yang benar.

## 4. CACAT SEBENARNYA

**114 galat golongan A di 59 modul server** — pesan yang **sudah menyebut satu isian**, tetapi
tampil sebagai satu kalimat di tingkat formulir.

Metodenya disebut supaya angkanya tidak dikira presisi: penggolongan di atas memakai
**penyaring kata** (*"wajib dipilih"*, *"harus angka"*, *"tidak boleh negatif"*, …) dikurangi
kata yang menandai golongan B/C. Itu **batas atas**, bukan hitungan final — penggolongan yang
mengikat harus dilakukan per pesan dengan pertanyaan §1, dan itulah isi matriks rollout §9.

## 5. ROOT CAUSE

**Satu akar, dan bukan "halaman lupa memakai `invalidText`".**

> **Jawaban server tidak pernah menyebutkan FIELD-nya sebagai data.** Ia hanya mengirim
> kalimat. Halaman karena itu **tidak punya cara** menandai kontrol yang benar — bukan tidak
> mau, tidak bisa.

Akibat turunannya, dan inilah yang membuatnya kelas dan bukan kumpulan cacat lepas:

- **RC-1** — validator berhenti di galat pertama, jadi isian salah kedua baru ketahuan setelah simpan berikutnya.
- **RC-2** — galat pada baris berulang kehilangan nomor barisnya (*"salah satu baris"*), padahal validatornya tahu persis indeksnya; loop-nya membuangnya.
- **RC-3** — baris yang terisi separuh **dibuang diam-diam** oleh penyaring sebelum dikirim: pengguna mengisi item lalu lupa jumlahnya, barisnya hilang dari PO, dan tidak ada yang memberi tahu.
- **RC-4** — pemeriksaan sisi klien menggabungkan dua isian jadi satu kalimat (*"Supplier dan lokasi pabrik wajib dipilih."*).

Satu-satunya jalan keluar yang tidak melahirkan kelas cacat baru: **field dikirim sebagai
data**. Memetakan pesan ke field dengan mencocokkan teks adalah kelas **"kebetulan benar"**
yang sudah empat kali menggigit proyek ini — ia bekerja sampai seseorang memperbaiki satu
kalimat, lalu galatnya pindah diam-diam ke kontrol yang salah.

## 6. CARBON CROSS-CHECK

Diukur dari paket terpasang **dan** dari DOM yang benar-benar dirender. Ketujuh kontrol yang
dipakai repo ini menerima `invalid` + `invalidText` — **tidak ada yang perlu dibungkus**.

**TIGA mekanisme ARIA, bukan satu:**

| Kontrol | `aria-invalid` | Tautan pesan |
|---|---|---|
| `TextInput` · `PasswordInput` | `true` | `aria-errormessage` |
| `NumberInput` | `true` | `aria-describedby` |
| `Dropdown` · `ComboBox` | **tidak dipasang** | `aria-describedby` |

> **Koreksi terhadap dokumen standar versi pertama saya sendiri**: ia menyatakan `NumberInput`
> memakai `aria-errormessage` bersama `TextInput`. **Keliru** — hanya `TextInput`/
> `PasswordInput` yang lewat `getTextInputProps`. Kekeliruannya lahir dari **membaca satu
> berkas lalu menggeneralisasi**; yang menangkapnya adalah **menjalankan** dan membaca atribut
> dari modal sungguhan.

## 7. STANDAR FABRIX

Ditetapkan di `FABRIX_FIELD_VALIDATION_CLASS_STANDARD.md`. Intinya satu pertanyaan:
**"bisakah pengguna memperbaikinya dengan mengubah satu isian yang terlihat?"** — bisa →
field; tidak → formulir. Empat golongan (A field · B formulir · C bisnis/keadaan · D
berhasil), `field`/`line` dikirim **sebagai data**, dan mekanisme Carbon dipakai apa adanya.

**Yang TIDAK ditetapkan, dan sengaja**: field mana yang **wajib diisi secara bisnis** dan
kalimat penolakan apa yang dipakai. Register kanonik sudah memutuskan itu milik pemilik
produk (F-03: *"The mechanism is not [domain knowledge]"*), dan CLAUDE.md menyebut hal yang
sama.

## 8. PILOT — modal "Buat PO" di `/purchasing`

**Dipilih berdasarkan bukti, bukan urutan daftar.** Ia satu-satunya formulir yang memuat
**keempat golongan sekaligus** plus baris berulang:

| Pesan | Golongan | Sesudah |
|---|---|---|
| *"Role Anda tidak punya izin…"* | C | tetap `InlineNotification` |
| *"User belum terkait dengan perusahaan…"* | C | tetap `InlineNotification` |
| *"Minimal 1 baris item wajib diisi."* | **B** | tetap `InlineNotification` — penggunanya harus **menambah** baris |
| *"Supplier wajib dipilih."* | A | `invalidText` pada Dropdown supplier |
| *"Lokasi pabrik (alamat kirim) wajib dipilih."* | A | `invalidText` pada Dropdown pabrik |
| *"Item pada salah satu baris tidak valid."* | A + baris | `invalidText` pada Dropdown item **baris ke-N** |
| *"Jumlah pesan harus angka positif."* | A + baris | `invalidText` pada NumberInput **baris ke-N** |
| *"Harga satuan harus angka positif."* | A + baris | `invalidText` pada NumberInput **baris ke-N** |

## 9. YANG BERUBAH — dan yang SENGAJA tidak

**Berubah (3 berkas):**

1. `purchaseOrderValidation.ts` — hasilnya kini membawa `field` dan `line`. **Kalimat pesannya tidak diubah satu pun** (§6 butir 5: memindahkan dan menulis ulang sekaligus membuat tidak ada yang tahu mana yang memperbaiki apa).
2. `createPurchaseOrder.ts` — meneruskan `field`/`line`, menandai supplier dan pabrik, dan **mencari indeks baris** yang itemnya tidak sah alih-alih membiarkannya *"salah satu baris"*.
3. `PurchasingPage.tsx` — `poFieldError` sebagai **daftar** (§5.1 menuntut seluruh isian salah ditandai sekaligus), lima kontrol menerima `invalid`/`invalidText`, notifikasi formulir digerbang, dan galat dibersihkan saat isian diubah · baris dihapus · modal dibuka · sebelum kirim ulang.

**TIDAK berubah:** kalimat pesan · aturan bisnis · field `required` mana pun · skema · rute ·
navigasi · tema · 21 halaman form lain · komponen bersama.

## 10. UJI

`tests/validasi_field_purchase_order.test.ts` — **8 uji**, MERAH lebih dulu (5 gagal),
HIJAU sesudah. **Menguji perilaku, bukan jumlah `invalidText`.**

Tiga uji **hijau sejak awal**, dan itu disengaja: (a) masukan sah tidak menghasilkan galat,
(d) galat tingkat formulir **tetap** tidak menyebut field, (e) kalimat pesannya tidak berubah.
Ketiganya menjaga yang **sudah benar** — pertahanan false positive dalam bentuk uji.

**Setiap penjaga dibuktikan menggigit:**

| Mutasi | Yang berbunyi |
|---|---|
| `field` dicabut dari galat supplier | (b) |
| nomor baris dicabut | (c) |
| galat formulir **dipaksa** mengaku milik field | (d) |
| `invalidText` dicabut dari kontrol baris | (f) |
| gerbang notifikasi dicabut | (h) |

> **Dua penjaga saya sendiri dilonggarkan** sebelum dipakai: versi pertama menuntut
> `setPoFieldError(null)` dan mencocokkan syarat render sebagai teks persis — keduanya
> menguji **detail implementasi**, bukan perilaku, dan itu persis yang dilarang kelas ini.

## 11. BUKTI PERAMBAN

Tenant uji. Seluruh non-GET **diblokir atau dijawab fixture** → **nol baris tertulis**.

| Kasus | Hasil terukur |
|---|---|
| Kirim kosong | **dua** pesan field tampil sekaligus, ditautkan `aria-describedby` ke kontrolnya · **nol** notifikasi formulir |
| Baris terisi separuh | pesan pada **NumberInput baris 0**, `aria-invalid="true"` |
| Server menolak **dengan** `field` | pesan pada kontrol yang tepat, `aria-invalid="true"` |
| Server menolak **tanpa** `field` | **nol** field ditandai, notifikasi formulir muncul |

**Enam lebar** (360/672/768/1280/1440/1920): pesan field tampil di keenamnya, **nol
terpotong**, nol gulir menyamping, nol elemen melewati tepi kanan maupun kiri.

> **Catatan pengukur, dicatat supaya tidak dibaca terbalik**: penghitung "ditandai" pada
> ringkasan enam lebar menghitung `aria-invalid="true"`, dan Carbon **tidak memasangnya pada
> Dropdown** — jadi kolom itu menunjukkan 0 sementara **kedua pesannya benar-benar tampil dan
> tertaut**. Yang membuktikan bukan penghitung itu, melainkan `pesanTampil=2` di setiap lebar.

## 12. AKSESIBILITAS

| Yang diperiksa | Hasil |
|---|---|
| `aria-invalid` | `true` pada NumberInput; **tidak dipasang** Carbon pada Dropdown → **T-V1** |
| Tautan pesan | `aria-describedby`/`aria-errormessage` menunjuk id yang **ada dan tampak** |
| Hubungan label | tidak disentuh — `titleText`/`label` Carbon tetap |
| Mekanisme buatan sendiri | **nol** — nol `aria-*` ditulis tangan, dan penjaga (f) melarangnya |
| Fokus | **tidak dipindahkan** — §5.7 sengaja belum mewajibkannya |

## 13. KEAMANAN DATA

**Nol mutasi.** Non-GET diblokir; jawaban 400/403 disuntik sebagai fixture jawaban, bukan
dihasilkan basis data. **Nol fixture dibuat**, nol yang perlu dibersihkan. Basis data nyata
**tidak disentuh** selama pengujian.

## 14. MATRIKS ROLLOUT — DIUKUR, BELUM DIKERJAKAN

| | |
|---|---|
| Modul server dengan pesan 4xx | **135** |
| Modul dengan galat golongan A | **59** |
| Galat golongan A (batas atas) | **114** |
| Galat golongan B/C — **PASS, tidak diubah** | **455** |
| Modul yang sudah mengirim `field` | **1** (pilot) |

**Sepuluh kandidat terbesar** (A = golongan A, BC = tetap tingkat formulir):

| Modul | A | BC |
|---|---|---|
| `customerDeliveryAddresses.ts` | 9 | 13 |
| `createProductionDisruption.ts` | 5 | 2 |
| `createShipmentWithSignature.ts` | 5 | 8 |
| `recordWorkOrderStepProgress.ts` | 5 | 7 |
| `recordOpeningBalance.ts` | 4 | 4 |
| `recordStockAdjustment.ts` | 4 | 4 |
| `recordWorkOrderOutput.ts` | 4 | 5 |
| `uploadDocument.ts` | 3 | 5 |
| `createProductionBatch.ts` | 3 | 5 |
| `deleteOrArchiveCustomer.ts` | 3 | 11 |

**Risiko rollout, disebut apa adanya**: polanya terbukti **dapat diulang** — server menambah
`field`, halaman memetakannya — tetapi **tidak setiap modul punya formulir yang sepadan**.
`deleteOrArchiveCustomer` misalnya dipicu dari sebuah tombol, bukan formulir; galatnya
mungkin tetap benar di tingkat formulir. **Penggolongan per pesan wajib dilakukan sebelum
tiap modul disentuh**, dan itu sebabnya batch ini berhenti di satu pilot.

## 14b. T-V4 — PENJAGA KONTRAK PEMETAAN FIELD

### Masalah

Pilot memperkenalkan kesepakatan **nama string** yang menyeberangi batas jaringan, dan batas
itu tidak punya penjaga. Bentuk kegagalannya paling sulit ditemukan di seluruh kelas ini:
nama salah ketik → nol kontrol cocok → **notifikasi formulir ikut digerbang mati** karena
"sudah ada galat field" → **pengguna tidak melihat apa pun** → test tetap hijau.

Diverifikasi langsung: sebelum T-V4, jawaban `{ error, field: 'quantitty' }` menghasilkan
**nol pesan di layar**.

### Akar

`string` lolos TypeScript, dan jawaban server adalah data **runtime** yang tidak diperiksa
siapa pun.

### Kontrak sekarang — dua lapis

| Lapis | Isi |
|---|---|
| **Kompilasi** | `FIELD_PO` (3 nama) + `FIELD_PO_BARIS` (3 nama) → tipe `FieldPo`; hasil validator dan pembangun `galatFieldPo()` memakainya |
| **Runtime** | `petakanGalatServerPo(body, jumlahBaris)` — satu pintu; halaman dilarang membaca `body.field` |

`line` = **indeks berbasis nol**, hanya bermakna untuk field baris.

### Lubang lapis kompilasi yang ditemukan — dan ditutup

> Mutasi pertama (`field: 'quantitty'` di validator) **berbunyi** di typecheck.
> Mutasi kedua (`field: 'supplier'` di `createPurchaseOrder`) **TIDAK berbunyi sama sekali.**

Sebabnya `ApiResult.body` bertipe `Record<string, unknown>`, jadi union-nya tidak berlaku di
sana. **Ditemukan lewat menjalankan mutasi, bukan lewat membaca** — dan kalau tidak diuji, ia
akan tercatat sebagai "sudah dijaga saat kompilasi" padahal separuhnya tidak.

Ditutup dengan pembangun bertipe `galatFieldPo(error, field, line?)`; mutasi yang sama kini
menghasilkan `TS2345`.

### Kasus tidak sah → naik ke tingkat formulir dengan kalimat ASLINYA

| Kasus | Hasil |
|---|---|
| `field` tidak dikenal (`does_not_exist`, `quantity`, `quantitty`, `''`, `SUPPLIER_ID`) | formulir |
| Field baris, `line` di luar jangkauan (`2`, `7`, `-1`, `99` pada 2 baris) | formulir |
| Field baris tanpa `line` sah (`undefined`, `null`, `'0'`, `1.5`, `NaN`) | formulir |
| Tanpa `field` sama sekali | formulir |

### Kasus sah → dipetakan

| Kasus | Hasil |
|---|---|
| `supplier_id` tanpa `line` | ditandai di Dropdown supplier |
| `qty_ordered` + `line: 0` dan `line: terakhir` | ditandai di baris itu |
| Field non-baris **membawa** `line` | ditandai; `line` diabaikan (keputusan sadar, §4b) |

### Uji

**Sembilan penjaga baru** (total berkas ini **17**), MERAH lebih dulu (7 gagal karena
fungsinya belum ada), HIJAU sesudah. Setiap lapis dibuktikan menggigit:

| Mutasi | Yang berbunyi |
|---|---|
| nama salah ketik di validator | **typecheck** `TS2322` |
| nama salah ketik di `createPurchaseOrder` | **typecheck** `TS2345` (setelah lubang ditutup) |
| pemeriksaan nama runtime dicabut | uji (i) |
| pemeriksaan jangkauan baris dicabut | uji (j) |
| halaman membaca `body.field` sendiri | uji (o) |
| pintu perubahan berhenti mencabut tanda | uji (p) |
| server menyusun body mentah lagi | uji (q) |

### Bukti peramban

Delapan kasus di `/purchasing`, semuanya lewat jawaban yang disuntik — **nol baris tertulis**:

| Kasus | Hasil terukur |
|---|---|
| **D** field tak dikenal | 0 tanda field · **1 notifikasi formulir dengan kalimat aslinya** |
| **E** `line` di luar jangkauan | 0 tanda field · 1 notifikasi formulir |
| **C** baris spesifik (`line: 1`) | ditandai di **`po-qty-1`** — baris kedua, bukan pertama |
| **F** diperbaiki | tanda hilang, nol sisa |
| **B** banyak field | **`po-supplier` dan `po-lokasi` ditandai bersamaan** |
| **G** baris dihapus | nol tanda yatim |
| **H** urutan baris diubah | **TIDAK ADA** kemampuannya di formulir ini — nol tombol pengubah urutan. Dilaporkan sebagai tidak berlaku, bukan sebagai lulus |

**Enam lebar** pada kasus D (yang paling mungkin menyembunyikan galat): notifikasi tampil di
keenamnya, **tidak menutupi tombol simpan**, nol gulir menyamping, nol elemen melewati tepi.

### Aksesibilitas

Tanda dan pesannya dipasang Carbon sendiri; **nol `aria-*` ditulis tangan**. Saat galat
dicabut, elemen pesannya hilang bersama tautannya — diverifikasi pada kasus F (nol pesan
tersisa di DOM).

## 14c. T-V5 — KONTRAK BERSAMA, PILOT #2

### PEMBLOKIR PADA KANDIDAT YANG DITUNJUK — dilaporkan, bukan diakali

Brief menunjuk **`customerDeliveryAddresses.ts`**. Audit Phase 0 menemukan modul itu
**tidak bisa dipakai sebagai pilot**, dan sebabnya menentukan:

> **Nol pemanggil UI.** Diverifikasi tiga cara: pencarian di seluruh berkas TSX
> (`0` kecocokan untuk `/api/customer-delivery-addresses`), sensus route yatim DS-25 yang
> lebih dulu menandainya, dan **komentar modul itu sendiri**: *"LAPISAN DATA & SERVER SAJA —
> layarnya MENUNGGU cetakan UX …, belum ada halaman yang memanggil fungsi-fungsi ini."*

Tanpa layar, Phase 4 (UI), Phase 5 (peramban, enam lebar), dan Phase 6 (aksesibilitas)
**tidak bisa dijalankan sama sekali** — dan misi batch ini justru membuktikan bahwa galat
**sampai ke kontrol yang dilihat pengguna**. Sembilan galatnya seluruhnya masuk kategori
*"field tanpa kontrol UI"*, yaitu kasus D di Phase 1 yang justru harus **gagal**.

`recordOpeningBalance.ts` (4 golongan A) ditemukan bermasalah sama: **nol pemanggil UI**.

### Pengganti, dipilih dengan pengukuran

| Modul | Golongan A | Pemakai UI | Modal? | Baris berulang? |
|---|---|---|---|---|
| `customerDeliveryAddresses` | 5 | **NOL** | — | — |
| `recordOpeningBalance` | 4 | **NOL** | — | — |
| **`recordStockAdjustment`** | **4→6** | `WarehouseDashboardPage` | **tidak** | **tidak** |
| `recordWorkOrderStepProgress` | 4 | 2 halaman | ya | ya |
| `createProductionBatch` | 3 | 3 halaman | ya | ya |

**`recordStockAdjustment` dipilih justru karena BERBEDA dari pilot pertama**, bukan karena
mirip: bukan modal, **nol baris berulang**, dan punya **field bersyarat** (`notes` hanya wajib
saat alasannya "Lainnya"). Kalau satu kontrak melayani dua bentuk yang berbeda tanpa cabang
khusus, ia terbukti sebagai pola. Kalau butuh cabang khusus, ia belum terbukti.

### Golongan A bertambah 4 → 6, dan ini diverifikasi bukan diduga

Dua pesan yang tampak "keadaan bisnis" ternyata **golongan A**:

- *"Lot tidak ditemukan di perusahaan Anda."*
- *"Lot ini berstatus tidak tersedia (bukan available) — tidak bisa disesuaikan."*

Sebabnya diukur di `listLots.ts:47`: daftar lot yang ditawarkan berisi status **`available`
DAN `expired`**. Jadi daftar pilihan **memang memuat lot yang akan ditolak**, dan penggunanya
bisa memperbaikinya dengan memilih lot lain — persis definisi golongan A.

### Abstraksi yang dipilih: **pabrik kontrak**, bukan kelas dasar dan bukan salinan

`src/lib/kontrakGalatField.ts` — satu fungsi `buatKontrakGalatField(atas, baris)` yang
mengembalikan dua fungsi bertipe: `galatField()` dan `petakan()`.

| Kriteria | Hasil |
|---|---|
| Aman saat kompilasi | ya — nama di luar registri ditolak `TS2345` |
| Aman saat berjalan | ya — nama tak dikenal dan `line` tak sah naik ke tingkat formulir |
| Butuh `any` | **nol** |
| Butuh type assertion | **nol** di kode produksi |
| Kerangka baru | tidak — satu fungsi, dua tipe, ±40 baris efektif |

**Alternatif yang ditolak, beserta alasannya:**

- **Dua implementasi kecil terpisah** — persis kelas "dua jalur hidup" yang sedang diberantas: perbaikan diterapkan di satu salinan, salinan kedua tidak ikut, dan tidak ada yang mengeluh sampai salah satunya meleset.
- **Satu registri global berisi semua nama field seluruh modul** — nama akan bertabrakan antar modul (`notes` ada di banyak formulir dengan arti berbeda), dan galat satu modul bisa "dikenali" oleh registri modul lain.
- **Skema runtime (Zod dsb.)** — menambah kebergantungan untuk memeriksa enam nama string; ongkosnya lebih besar daripada masalahnya.

### Yang SENGAJA tidak digeneralisasi

Registri nama, kalimat pesan, penentuan golongan A/B/C, dan pengikatan ke kontrol tetap
**milik modul masing-masing**. Menggeneralisasikannya berarti kontrak harus tahu ada modul
tertentu — dan penjaga (i) menolak itu secara eksplisit.

### Uji

**Dua belas penjaga baru** (`tests/kontrak_galat_field_bersama.test.ts`), MERAH lebih dulu
(modulnya belum ada), HIJAU sesudah. Enam mutasi dibuktikan menggigit:

| Mutasi | Yang berbunyi |
|---|---|
| registri memuat nama tanpa kontrol di layar | (d) |
| kontrak bersama diberi cabang khusus modul | (i) |
| modul menyalin logika pemetaannya sendiri | (a) (g) (j) |
| pencabutan bersyarat dicabut | (l) |
| gerbang notifikasi dicabut | (f) |

> Satu mutasi saya **tidak sah** dan itu dicatat: cabang khusus disisipkan sebagai
> **komentar**, dan penjaga memang membuang komentar sebelum menyisir. Diulang sebagai kode
> sungguhan, dan barulah ia berbunyi.

**Pilot #1 tetap 17/17 hijau tanpa satu uji pun disunting** meski mekanismenya dipindahkan ke
pabrik bersama — itulah bukti bahwa pemindahannya tidak mengubah perilaku.

### Bukti peramban — delapan kasus, enam lebar

| Kasus | Hasil terukur |
|---|---|
| Banyak galat field | **tiga** ditandai bersamaan (`gudang-lot`, `gudang-delta`, `gudang-alasan`), nol notifikasi |
| Diperbaiki | seluruh tanda hilang |
| **Field bersyarat** | "Lainnya" tanpa catatan → ditandai di `gudang-catatan` |
| **Alasan diganti** | tanda pada catatan **lenyap** — kewajibannya hilang, tandanya ikut |
| Galat field dari server | ditandai di `gudang-lot` |
| **Field tak dikenal** | 0 tanda · **1 notifikasi dengan kalimat aslinya** |
| Galat bisnis | notifikasi, nol tanda |
| Berhasil | notifikasi berhasil, tanda bersih |

**Enam lebar** (360–1920): tiga pesan tampil di keenamnya, **nol terpotong**, nol gulir
menyamping, nol elemen melewati tepi.

**Field tanpa kontrol UI** tidak bisa diuji di peramban — registri dan layar kini cocok. Ia
dijaga secara statis oleh uji (d), dan itu disebut apa adanya, bukan diklaim sebagai lulus.

### Aksesibilitas

`gudang-delta` (NumberInput) dan `gudang-catatan` (TextInput): `aria-invalid="true"` +
tautan ke id pesannya. Dropdown tidak memancarkan `aria-invalid` — **keterbatasan Carbon yang
sudah tercatat sebagai T-V1**, bukan regresi batch ini; pesannya tetap tertaut dan terbaca.
**Nol `aria-*` ditulis tangan.**

### Perbandingan Pilot #1 vs Pilot #2

| Perkara | PO (`/purchasing`) | Penyesuaian stok (`/warehouse`) | Bersama? |
|---|---|---|---|
| Tipe hasil | `GalatFieldTerpetakan<F>` | sama | **YA** |
| Registri field | `FIELD_PO` + `FIELD_PO_BARIS` | `FIELD_PENYESUAIAN`, baris **kosong** | tidak — milik modul |
| Pemeta runtime | `kontrak.petakan` | `kontrak.petakan` | **YA** |
| Pembangun jawaban | `kontrak.galatField` | `kontrak.galatField` | **YA** |
| Field tak dikenal | naik ke formulir | naik ke formulir | **YA** |
| Galat bisnis | tetap formulir | tetap formulir | **YA** |
| Dukungan `line` | dipakai (baris item) | **tidak dipakai** — daftar baris kosong | **YA**, tanpa cabang khusus |
| Pengikatan UI | `galatPo(field, line?)` | `galatPenyesuaian(field)` | tidak — bentuk formulirnya beda |
| Pintu perubahan | `ubahFieldPo` + `updatePoLine` | `ubahFieldPenyesuaian` (+ aturan bersyarat) | tidak — kondisinya milik modul |
| Aksesibilitas | mekanisme Carbon | mekanisme Carbon | **YA** |

**Yang terbukti bersama**: tipe hasil, pemeta, pembangun, dan keempat aturan keputusan.
**Yang terbukti TIDAK layak digeneralisasi**: registri, pengikatan UI, dan aturan pencabutan
bersyarat — ketiganya bergantung pada bentuk formulir, dan memaksakannya jadi satu akan
menambah cabang, bukan mengurangi.

## 15. TEMUAN TERTUNDA

| Kode | Temuan | Urgensi jujur |
|---|---|---|
| **T-V1** | `Dropdown`/`ComboBox` Carbon **tidak memancarkan `aria-invalid`** — pesannya dibacakan lewat `aria-describedby`, tetapi kontrolnya tidak ditandai invalid secara programatis. Menyentuh setiap Dropdown di aplikasi | **Penting** — tambalan sebagian melahirkan dua perilaku |
| **T-V2** | Validator berhenti di galat **pertama**; §5.1 menuntut seluruhnya ditandai. Sisi klien sudah memenuhi (dua field sekaligus), sisi server belum | **Penting** |
| **T-V3** | 58 modul server lain masih mengirim galat golongan A tanpa `field` | **Penting** — inti rollout |
| ~~**T-V4**~~ | **SELESAI** — kontrak dua lapis + satu pintu pemetaan; lihat §14b | — |
| **T-V5** | Fokus tidak berpindah ke field yang ditolak (§5.7) | **Bisa menunggu** — butuh keputusan aksesibilitas |

## 16. LANGKAH BERIKUTNYA

Lihat handoff. Ringkasnya: **jangan** melanjutkan ke 58 modul sekaligus; golongkan per pesan
lebih dulu, dan tutup **T-V4** sebelum modul kedua — penjaga nama field harus ada sebelum
kesepakatan string itu dipakai di banyak tempat.
