# FABRIX UI REVISION MASTER PLAN

**27 Agustus 2026 · HEAD `c39c6bf` · branch `main`**
**Batch ini AUDIT + PERENCANAAN. Nol baris kode, nol CSS, nol API, nol basis data, nol migrasi.**

> Seluruh angka di dokumen ini berasal dari **repositori** atau dari **pengukuran di
> peramban**. Angka yang tidak terukur ditandai **UNKNOWN** dan **tidak dihitung sebagai
> selesai**. Di mana dua laporan berbeda, keduanya disebut beserta sebab selisihnya.

---

## 1. RINGKASAN EKSEKUTIF

FABRIX punya **39 halaman**. Seluruhnya bisa dibuka, seluruhnya punya komponen yang terbaca,
dan — ini yang paling mengubah rencana — **seluruhnya lulus uji responsif**.

Pengukuran 29 halaman shell di enam lebar wajib menghasilkan **174 pengukuran, 174 bersih**:
nol gulir menyamping, nol elemen melewati tepi kanan, nol melewati tepi kiri, nol halaman
gagal dibuka. Pekerjaan RSP-01, DS-14, DS-21, dan DS-22 sudah menutup kelas itu.

**Artinya prioritas berubah.** Yang tersisa bukan tata letak yang meluber, melainkan **lima
kelas cacat yang tak terlihat dari tangkapan layar**:

| Kelas | Terhitung | Inti masalahnya |
|---|---|---|
| Galat tidak menempel ke field-nya | **5 dari 154** kontrol berlabel memakai `invalidText` | Formulir gagal menyimpan tanpa menunjuk field mana yang salah |
| Keadaan yang tidak pernah dirender | 14 halaman | Gagal memuat terlihat persis seperti "belum ada data" |
| Elemen mentah non-Carbon | 22 catatan cacat | Perbaikan di komponen bersama tidak sampai ke sana |
| Teks berbahasa Inggris bocor ke layar | 11 catatan cacat | Pesan galat server diteruskan mentah |
| Primitif formulir Carbon nyaris tak dipakai | `Form` 0 · `Stack` 0 · `Grid` 0 · `FormGroup` 2 | Jarak dan pengelompokan tidak ikut bergerak saat token berubah |

**Dua halaman berstatus CRITICAL**, dan keduanya bukan soal tampilan:

- **`/hr`** — kartu "Hadir hari ini" **selalu menampilkan 0** untuk absensi yang dibuat
  sistem. Penyaringnya hanya mengenali huruf kecil, penulisnya menulis huruf besar. Angkanya
  rapi, datanya nyata, artinya salah.
- **`/purchasing`** — penyimpanan supplier yang **berhasil** ditampilkan sebagai kotak merah
  berjudul "Gagal", modalnya tidak ditutup, formulirnya dikosongkan. Ketiganya bersama
  mengundang pengisian ulang — dan tabel `suppliers` tidak punya kekangan unik pada nama,
  sehingga pengisian ulang benar-benar melahirkan supplier kedua.

**UI Revision Completion hari ini: 0%** (0 dari 22 halaman dalam lingkup memenuhi Definition
of Done). Angka itu **bukan** kemunduran — ia angka pertama yang pernah dihitung untuk
metrik ini, dan sengaja dipisahkan dari kelengkapan roadmap task (**35,2%**).

---

## 2. FASE SAAT INI

Yang sudah selesai sebelum batch ini: audit AS-IS, pengumpulan bukti, riset Carbon,
governance UX, arsitektur modal/form, bukti responsif & aksesibilitas, dan beberapa pilot
revisi (DS-05, DS-09, DS-17, DS-21, DS-22).

Batch ini menutup satu-satunya yang belum ada: **peta menyeluruh yang bisa dipakai memutuskan
urutan**. Tanpanya, pekerjaan berikutnya dipilih dari halaman yang kebetulan sedang dilihat.

---

## 3. AS-IS — CARA MENGUKUR

| Sumber | Yang dijawabnya |
|---|---|
| `find app -name page.tsx` | daftar rute yang benar-benar ada |
| Pembacaan setiap berkas komponen, **komentar dibuang lebih dulu** | komponen Carbon, modal, elemen mentah, keadaan |
| Playwright, 29 halaman × 6 lebar | gulir menyamping, elemen melewati kedua tepi, urutan judul, tombol tanpa nama |
| `src/features/navigasi/navConfig.ts` vs rute nyata | alamat karangan, rute tanpa menu |
| Paket di `node_modules` | nilai token, properti komponen, breakpoint |
| REST `build_tasks` | task yang sudah ada, status, urgensi |

**Komentar dibuang sebelum menghitung apa pun.** Di proyek ini, menghitung tanpa membuangnya
sudah salah tuduh tiga kali.

---

## 4. INVENTARIS HALAMAN

**39 rute · 39 komponen terbaca · 0 rute tanpa komponen.**

| Ukuran | Angka | Catatan |
|---|---|---|
| Memakai kerangka bersama `KepalaHalaman` | **30 / 39** | 9 sisanya SAH: 6 halaman publik, POD kurir, halaman cetak surat jalan, dan root |
| Memakai `DataTable` Carbon | **16** | |
| Memakai kelas `.tabel-responsif` | **16** | |
| Modal Carbon di berkas halaman | **24** | tersebar di 15 halaman |
| Modal bertahap | **4** | BOM, PO Klien, Master Item, Karyawan |
| `window.confirm` tersisa | **4 halaman** | cocok dengan DS-06 |
| Warna heksadesimal ditulis tangan di berkas halaman | **0** | |
| Elemen mentah `<table>` / `<button>` / `<input>` di berkas halaman | 1 / 1 / 1 | |

**Sepuluh halaman terbesar** (baris): `/ppic` 1964 · `/items` 1611 · `/purchasing` 1408 ·
`/sales-orders` 1235 · `/work-orders` 1189 · `/customer-purchase-orders` 1120 ·
`/production` 1095 · `/boms` 1094 · `/shipments` 1077 · `/warehouse` 926.

### Navigasi — bersih

104 item navigasi: **28 aktif · 51 belum-ada · 15 sebagian · 7 diparkir · 2 internal ·
1 ditolak**.

- Item aktif yang alamatnya **tidak punya rute**: **0** — aturan navigasi nomor 2 dipatuhi.
- Rute yang **tidak punya item navigasi**: **8**, dan kedelapannya sah (root, 5 halaman auth
  publik, POD kurir, halaman cetak).

---

## 5. REKONSILIASI ANGKA 39

| | |
|---|---|
| ANGKA LAMA | **39 halaman** (DS-09, *"Penerapan Carbon ke SELURUH Halaman — 39 Halaman"*) |
| ANGKA BARU | **39 halaman** |
| SEBAB | Tidak ada perubahan jumlah. Diverifikasi ulang dari `find app -name page.tsx`, bukan disalin. |
| SUMBER | repositori pada HEAD `c39c6bf` |

**Kesamaan angka BUKAN bukti kesamaan himpunan**, jadi daftarnya diperiksa satu per satu.
Yang perlu disadari saat membaca "39": ia mencakup 6 halaman publik, 1 halaman cetak,
1 halaman kurir, dan 2 halaman internal (`/debug`, `/test-tenant`) — **10 halaman yang
kriterianya berbeda dari 29 halaman aplikasi**.

### Angka lain yang direkonsiliasi di batch ini

| Angka | Nilai lama | Nilai terukur | Sebab selisih |
|---|---|---|---|
| Modal di berkas halaman | 22 (DS-18, 26 Agu) | **24** | DS-17 menambah 2 modal siklus hidup ke BomsPage |
| Overlay seluruhnya | 26 (audit modal) | **26** | 24 modal Carbon **+ 2 `<Dialog>` shadcn** di `ConfirmAndSignModal` dan `provenance-info-button` |
| Elemen mentah | `<button>` 26 · `<input>` 27 · `<table>` 25 (`design-debt.md`, 25 Agu) | **11 · 5 · 4** | Register sudah kedaluwarsa dan **lebih buruk daripada kenyataan** — dan register yang melebih-lebihkan melatih orang mengabaikannya, sama seperti penjaga yang salah tuduh, hanya arahnya terbalik |

---

## 6. KLASIFIKASI HALAMAN

| Kategori | Jumlah | Halaman |
|---|---|---|
| **A · Dashboard** | 11 | `/dashboard` `/hr` `/ppic` `/production` `/warehouse` `/kpi` `/kpi/saya` `/operating-profit` `/ai-project` `/ai-readiness` `/process-mining` |
| **B · Data List / Tabel** | 11 | `/items` `/boms` `/customers` `/routing` `/work-orders` `/sales-orders` `/customer-purchase-orders` `/purchasing` `/documents` `/team` `/build-tasks` |
| **C · Detail** | 1 | `/shipments/[shipmentId]/surat-jalan` |
| **D · Formulir CRUD** | 2 | `/profile` `/register` |
| **E · Workflow / Transaksi** | 5 | `/attendance` `/shipments` `/pod/[token]` `/invite/accept` `/kamus` |
| **F · Konfigurasi** | 2 | `/company` `/company/setelan` |
| **G · Administratif** | 2 | `/debug` `/test-tenant` |
| **I · Lain** | 5 | `/` `/login` `/forgot-password` `/reset-password` `/whats-new` |

---

## 7. MATRIKS KUALITAS — HASIL

Dua belas dimensi dinilai per halaman. **300 cacat tercatat** di 39 halaman.

### 7.1 Responsif — LULUS MENYELURUH

**174 pengukuran (29 halaman shell × 6 lebar), 174 bersih.** Nol gulir menyamping, nol
elemen melewati tepi kanan maupun kiri, nol gagal dibuka.

Hanya tiga temuan, dan **ketiganya struktural, bukan responsif** — nilainya sama persis di
keenam lebar:

| Halaman | Temuan |
|---|---|
| `/purchasing` | urutan judul melompat h2 → h4 |
| `/profile` | 2 tombol tanpa nama terbaca |
| `/company` | 1 tombol tanpa nama terbaca |

> **Metrik "target sentuh < 44px" SENGAJA TIDAK DIPAKAI menilai.** Angka mentahnya
> menyesatkan karena mencampur tiga hal: kontrol Carbon 40px (**deviasi yang sudah
> diterima** CLAUDE.md), elemen 1×1 khusus pembaca layar (**cacat pengukur** — penyaring
> `visually-hidden` tidak ikut diterapkan), dan elemen mentah non-Carbon (**temuan nyata**).
> Yang tersisa setelah dipilah tangan: 6 `<input>` mentah di `/purchasing`, 16 `<button>`
> mentah di `/ai-readiness`, dan 18 tombol bantuan 16×16 di `/company/setelan`.

### 7.2 Sepuluh halaman UNKNOWN untuk responsif

Enam halaman publik, `/pod/[token]`, halaman cetak, `/debug`, dan `/test-tenant` **tidak
diukur** di batch ini. Statusnya **UNKNOWN**, bukan lulus.

### 7.3 Lima kelas cacat lintas halaman

**(a) Galat form tidak menempel ke field-nya.** `labelText` 154 · `helperText` 57 ·
`warnText` 4 · **`invalidText` hanya 5**, tersebar di 4 berkas. Sebagai pembanding,
`InlineNotification` dipakai **123 kali di 37 berkas**. Akibatnya: bagi pengguna pembaca
layar, formulir yang gagal disimpan mengumumkan "ada yang salah" tanpa menyebut di mana.
Ini **bukan** pilihan Carbon yang sah — `invalid`/`invalidText` adalah jawaban Carbon untuk
kasus ini.

**(b) Keadaan yang tidak pernah dirender.** 14 halaman kehilangan setidaknya satu keadaan.
Pola paling berbahaya: fungsi pemuat menelan galat tanpa state galat, sehingga **gagal
memuat terlihat persis seperti "belum ada data"**.

**(c) Elemen mentah non-Carbon.** 22 catatan cacat. Yang terbesar: `provenance-info-button`
punya **17 pengimpor** dan seluruhnya jalur Radix/Tailwind — sementara `field-help.tsx`
(`FieldLabel`), yang CLAUDE.md butir 6 tunjuk sebagai komponen bantuan-klik resmi, punya
**0 pengimpor**. Aturan yang menunjuk berkas tak berpemakai akan dibaca sesi berikutnya
sebagai "sudah berlaku".

**(d) Teks Inggris bocor ke layar.** 11 catatan cacat. Pola berulang: pesan galat Supabase
diteruskan mentah (`error.message`) ke layar yang dibaca pemilik produk.

**(e) Primitif formulir Carbon nyaris tak dipakai.** `Form` 0 impor · `Stack` 0 · `Grid` 0 ·
`Column` 0 · `FluidForm` 0 · `ContainedList` 0 · `Loading` 0 · **`FormGroup` 2 pemakaian**.
Tujuh `<form>` mentah. Satu-satunya halaman formulir penuh yang sudah ada
(`/company/setelan`) memakai **nol** primitif formulir Carbon — pengelompokannya lewat
`<Tile>` + `<h2>`.

---

## 8. CARBON CROSS-CHECK

Versi terpasang: `@carbon/react` **1.114.0** · `@carbon/styles` **1.113.0** ·
`@carbon/layout` **11.57.0** · `@carbon/grid` **11.60.0**.
Breakpoint: **320 / 672 / 1056 / 1312 / 1584 px**.

### Yang Carbon JAWAB, dan sudah bisa dipakai tanpa bertanya

| Pertanyaan | Jawaban Carbon (dari paket) |
|---|---|
| Sel tabel yang bisa diisi | **TIDAK ADA.** `DataTable` tidak menyediakannya — jadi menambal tabel agar bisa disunting akan melahirkan jalur kedua |
| Galat form | `invalid` + `invalidText`, yang mengaitkan pesan ke kontrolnya |
| Keadaan memuat tabel | `DataTableSkeleton` |
| Jarak antar bagian formulir | token `$spacing-*` lewat `Stack` |

### Yang Carbon TIDAK jawab — keputusan pemilik produk

**KEPUTUSAN A — bentuk halaman formulir penuh.** Tiga jalur sama-sama sah:

| Jalur | Konsekuensi |
|---|---|
| `<Form>` + `<Stack>` + `<FormGroup legendText>` | Paling banyak menulis, paling tahan perubahan token, satu-satunya yang memberi *legend* yang dibacakan pembaca layar |
| `<FluidForm>` | Paling padat vertikal, cocok untuk halaman setelan panjang — **tetapi memindahkan tempat pesan galat muncul**, jadi mencampurnya dengan non-fluid menghasilkan dua bentuk galat di satu layar |
| `<form>` biasa + kontrol lepas | Yang dipakai FABRIX hari ini di 7 tempat. Paling ringan sekarang, paling mahal nanti — jaraknya tidak dari token, jadi tidak ikut bergerak |

**KEPUTUSAN B — bentuk baris berulang.** Karena `DataTable` menutup jalurnya, tersisa empat
bentuk; Carbon tidak menyatakan satu pun salah:

| Bentuk | Konsekuensi |
|---|---|
| Kartu bergrid, label **disembunyikan** (`hideLabel`) + judul kolom sekali di atas | Padat dan bisa dipindai seperti tabel; di layar sempit tidak ada penanda kolom sama sekali kecuali dipasangi `data-label` seperti `.tabel-responsif` |
| Kartu bergrid, label **diulang** tiap baris | **Yang dipakai FABRIX sekarang.** Selalu jelas, tapi tinggi baris berlipat |
| `<Table>` polos + kontrol di dalam sel | Terlihat paling seperti tabel, dan paling mudah dikira `DataTable` lalu ditambal — bentuk "dua jalur hidup" |
| `ContainedList` + penyuntingan lewat modal per baris | Paling aman menurut Carbon, paling lambat dipakai |

**Kedua keputusan menentukan bentuk SELURUH layar formulir berikutnya.** Karena itu keduanya
diserahkan ke pemilik produk, bukan diputuskan di dokumen ini.

---

## 9. IMPLEMENTASI RUJUKAN

| Rujukan | Kenapa baik | Yang bisa dipakai ulang | Yang TIDAK boleh disalin mentah |
|---|---|---|---|
| **Detail baris `/items` (DS-09)** | Setiap keputusan tata letaknya ditulis beserta **angka terukur** dan **alternatif yang ditolak** | Kisi 3/2/1 kolom, lapisan menetap, aksi merusak berjauhan | Titik perubahan **82rem** khusus untuk lebar sel di halaman itu — bukan angka universal |
| **Siklus hidup BOM (DS-17)** | Server yang memutuskan hapus-vs-arsip, bukan pengguna | Pola "satu tombol, server memutuskan, notifikasi melaporkan hasilnya" | Routing **menolak** pengarsipan saat ada batch berjalan; BOM tidak. Bedanya disengaja |
| **Penanda langkah (DS-21)** | Ambangnya **dihitung** dari jumlah langkah, bukan dipatok | `useMediaQuery` sebagai satu-satunya kait media query | Konstanta 128px terikat ke nilai Carbon — jangan disalin sebagai angka lepas |
| **Baris berulang (DS-22)** | Kolom mengikuti **lebar wadah**, bukan lebar layar | `repeat(auto-fit, minmax(min(15rem, 100%), 1fr))` | Lantai 15rem diturunkan dari lebar modal; halaman penuh jauh lebih lebar dan angkanya perlu dihitung ulang |
| **`KepalaHalaman`** | Satu pintu untuk remah roti + judul + pengantar | Langsung dipakai halaman baru mana pun | Halaman publik dan cetak memang **tidak** memakainya, dan itu benar |
| **`LayarPublik`** | Konsistensi tujuh layar publik **dijaga mesin** (`tests/layar_publik_carbon.test.ts`) | Pola "penjaga menegakkan cetakan" | — |

---

## 10. MATRIKS GAP PER HALAMAN

Severity **tidak** dinaikkan karena tampilan kurang rapi. CRITICAL hanya untuk: menghalangi
pemakaian, merusak integritas data, cacat responsif/aksesibilitas berat, atau alur kerja
inti yang gagal.

| Halaman | Jenis | Ukuran revisi | Severity | Prioritas | Cacat |
|---|---|---|---|---|---|
| `/hr` | A | MODERATE | **CRITICAL** | **P0** | 11 |
| `/purchasing` | B | MAJOR | **CRITICAL** | **P0** | 14 |
| `/ppic` | A | MAJOR | HIGH | P1 | 17 |
| `/customers` | B | MAJOR | HIGH | P1 | 16 |
| `/routing` | B | MAJOR | HIGH | P1 | 15 |
| `/production` | A | MODERATE | HIGH | P1 | 14 |
| `/work-orders` | B | MAJOR | HIGH | P1 | 13 |
| `/sales-orders` | B | MAJOR | HIGH | P1 | 11 |
| `/shipments` | E | MODERATE | HIGH | P1 | 11 |
| `/attendance` | E | MAJOR | HIGH | P2 | 10 |
| `/kpi/saya` | A | MODERATE | HIGH | P2 | 8 |
| `/documents` | B | MODERATE | HIGH | P2 | 7 |
| `/pod/[token]` | E | MODERATE | HIGH | P2 | 7 |
| `/team` | B | MODERATE | HIGH | P2 | 6 |
| `/debug` | G | MAJOR | HIGH | P3 | 5 |
| `/test-tenant` | G | MAJOR | HIGH | P3 | 6 |
| `/warehouse` | A | MODERATE | MEDIUM | P2 | 11 |
| `/boms` | B | MODERATE | MEDIUM | P1 | 11 |
| `/kpi` | A | MINOR | MEDIUM | P2 | 7 |
| `/operating-profit` | A | MINOR | MEDIUM | P2 | 7 |
| `/ai-project` | A | MODERATE | MEDIUM | P3 | 7 |
| `/build-tasks` | B | MODERATE | MEDIUM | P3 | 6 |
| `/kamus` | E | MODERATE | MEDIUM | P2 | 6 |
| `/login` | I | MINOR | MEDIUM | P2 | 6 |
| `/register` | D | MINOR | MEDIUM | P2 | 6 |
| `/surat-jalan` | C | MINOR | MEDIUM | P2 | 6 |
| `/company/setelan` | F | MODERATE | MEDIUM | P2 | 5 |
| `/ai-readiness` | A | MINOR | MEDIUM | P3 | 5 |
| `/reset-password` | I | MINOR | MEDIUM | P2 | 5 |
| `/company` | F | MINOR | MEDIUM | P2 | 4 |
| `/forgot-password` | I | MINOR | MEDIUM | P2 | 4 |
| `/whats-new` | I | MINOR | MEDIUM | P3 | 4 |
| `/invite/accept` | E | MINOR | MEDIUM | P2 | 3 |
| `/items` | B | MINOR | LOW | P3 | 8 |
| `/customer-purchase-orders` | B | MINOR | LOW | P3 | 6 |
| `/process-mining` | A | MINOR | LOW | P3 | 4 |
| `/profile` | D | MINOR | LOW | P3 | 4 |
| `/dashboard` | A | MINOR | LOW | P3 | 2 |
| `/` | I | MINOR | LOW | P3 | 2 |

**Kolom "Existing Task" dan "Dependency" ada di bagian 12 dan 13** — dipisah supaya tabel
ini tetap terbaca.

---

## 11. UKURAN REVISI

| Ukuran | Jumlah | |
|---|---|---|
| NO CHANGE | **0** | Setiap halaman punya sekurang-kurangnya satu cacat tercatat |
| MINOR | **17** | jarak, tipografi, hierarki tombol, teks |
| MODERATE | **13** | penataan ulang tata letak, perbaikan tabel/formulir, penanganan keadaan |
| MAJOR | **9** | UX alur kerja, perubahan tata letak besar |
| ARCHITECTURAL | **0** | lihat catatan di bawah |

> **Kenapa ARCHITECTURAL nol, padahal BOM sudah diputuskan pindah ke halaman penuh.**
> Penilai menilai **halaman apa adanya hari ini**; `/boms` sebagai halaman daftar memang
> MODERATE. Yang architectural bukan halamannya, melainkan **alur BUAT BOM** yang hidup di
> dalam modal. Keputusan itu tercatat di `FABRIX_MODAL_FORM_GOVERNANCE_DECISION.md`
> (DECISION 6) dan **belum** tercermin di matriks ini. Selisih ini disebut apa adanya, bukan
> diperhalus.

---

## 12. REKONSILIASI TASK

**324 task di registri · 114 selesai. 84 task menyentuh UI/UX, 51 di antaranya masih terbuka.**

| Klasifikasi | Contoh |
|---|---|
| **EXISTING TASK** | DS-06 (4 halaman ber-`window.confirm`) · DS-20 (elemen mentah) · AUD-06 (tata letak modal) · AUD-25 (cetakan modal baru dipakai 1 dari 13) · RSP-02 (pengawas overflow tabel) · KRM-05 (target sentuh POD) · MST-09 (pabrik/work center) |
| **DECISION REQUIRED** | DS-09 (`menunggu_persetujuan`) · DS-18 (`menunggu_persetujuan` — modal mana jadi halaman penuh) |
| **DITUNDA SADAR — jangan dibangun** | FND-05 (simpan sementara formulir panjang). Pemicunya tegas: *"ada formulir yang TERBUKTI tidak bisa diselesaikan satu duduk. Dugaan BUKAN pemicu."* |
| **NEW TASK REQUIRED — PROPOSED, belum dibuat** | lihat daftar di bawah |
| **NOT A TASK** | temuan yang sudah tercakup task lain |

### PROPOSED TASK — **belum dibuat**, menunggu izin

Batch ini **tidak membuat task baru** sesuai Phase 10. Yang berikut diusulkan:

| # | Usulan | Kenapa |
|---|---|---|
| **PT-1** | `/hr` — kartu "Hadir hari ini" selalu 0 | **P0.** Angka utama dashboard HRD berbohong tanpa gejala |
| **PT-2** | `/purchasing` — berhasil ditampilkan sebagai "Gagal", mengundang supplier ganda | **P0.** Master data yang mengalir ke PO, harga acuan, dan lead time |
| **PT-3** | Galat form tidak menempel ke field — 5 dari 154 kontrol | Lintas halaman; menyentuh aksesibilitas seluruh formulir |
| **PT-4** | Keadaan yang tidak dirender — gagal memuat terlihat seperti "belum ada data" | 14 halaman |
| **PT-5** | Panel Asal-Usul di jalur non-Carbon, 17 pengimpor; `FieldLabel` nol pengimpor | Aturan CLAUDE.md menunjuk berkas tak berpemakai |
| **PT-6** | Pesan galat server bocor dalam Bahasa Inggris | Melanggar aturan keras proyek |
| **PT-7** | `design-debt.md` kedaluwarsa (26/27/25 → 11/5/4) | Register yang melebih-lebihkan melatih orang mengabaikannya |
| **PT-8** | Media query ditulis sebagai angka rem di 27 titik, bukan lewat mixin Carbon | Kelas "kebetulan benar" keenam |

---

## 13. GRAF KETERGANTUNGAN

Yang **TERBUKTI** dari repositori:

```
Carbon terpasang + tema g10                     [TERBUKTI — DS-01 selesai]
        ↓
KepalaHalaman + LayarPublik + shell             [TERBUKTI — 30/39 memakainya]
        ↓
Kelas cacat lintas halaman (PT-3 … PT-8)        [TERBUKTI — terukur di 39 halaman]
        ↓
KEPUTUSAN A (bentuk halaman formulir)           [BELUM — milik pemilik produk]
        ↓
KEPUTUSAN B (bentuk baris berulang)             [BELUM — milik pemilik produk]
        ↓
BOM buat → halaman penuh                        [TERBUKTI bergantung: DS-17, DS-21, DS-22 selesai]
        ↓
PO Klien → halaman penuh                        [UNVERIFIED — belum diukur ulang setelah DS-21/22]
```

**UNVERIFIED, dan disebut supaya tidak dikira terbukti**: urutan `Work Order → Production`
dan ketergantungan `PO Klien` pada pola BOM. Keduanya masuk akal, tidak satu pun terbukti
dari kode.

**Ketergantungan terbesar bukan antar halaman, melainkan KEPUTUSAN A dan B.** Selama
keduanya belum diambil, setiap layar formulir yang dikerjakan berisiko harus dikerjakan
ulang.

---

## 14. METRIK KELENGKAPAN UI

**Dipisahkan tegas dari kelengkapan roadmap task.**

| | Angka |
|---|---|
| TOTAL HALAMAN | **39** |
| NO CHANGE REQUIRED | **0** |
| ALREADY COMPLIANT (memenuhi Definition of Done) | **0** |
| MINOR REVISION | 17 |
| MODERATE REVISION | 13 |
| MAJOR REVISION | 9 |
| ARCHITECTURAL REVISION | 0 *(lihat catatan bagian 11)* |
| **UI REVISION REQUIRED** (penyebut) | **22** |
| **UI REVISION COMPLETE** | **0** |

### Formula

```
UI Revision Completion = halaman yang memenuhi Definition of Done
                         ────────────────────────────────────────
                         halaman dalam lingkup revisi

                       = 0 / 22 = 0%
```

**Penyebut 22, bukan 39, dan alasannya berbasis bukti**: 17 halaman hanya bermasalah MINOR
dengan severity MEDIUM/LOW. Halaman itu tetap punya cacat tercatat, tetapi tidak
membutuhkan batch revisi tersendiri — perbaikannya ikut menumpang saat kelas cacat lintas
halaman (PT-3 … PT-8) dikerjakan. Lingkup revisi = **MODERATE ke atas, ATAU severity
HIGH/CRITICAL**.

**Kenapa pembilangnya 0, dan ini bukan hukuman**: Definition of Done di bagian 17 menuntut
antara lain bukti responsif enam lebar, seluruh keadaan tertangani, penjaga regresi, dan
status task terekonsiliasi. **Tidak satu pun dari 22 halaman memenuhi seluruhnya hari ini.**
Halaman yang paling dekat adalah `/items` dan `/boms` — keduanya sudah punya bukti responsif
dan penjaga regresi, tetapi masih kehilangan keadaan dan galat-menempel-field.

**UNKNOWN tidak dihitung selesai.** Sepuluh halaman (publik, POD, cetak, internal) belum
diukur responsifnya sama sekali.

### Perbandingan dua metrik — jangan tertukar

| Metrik | Nilai | Menjawab apa |
|---|---|---|
| **Kelengkapan roadmap task** | **35,2%** (114 dari 324) | berapa banyak pekerjaan yang tercatat sudah ditutup |
| **UI Revision Completion** | **0%** (0 dari 22) | berapa banyak halaman yang benar-benar memenuhi standar UI |

---

## 15. GELOMBANG PRIORITAS

**P0 ditarik ke depan tanpa memandang gelombang.**

### WAVE 0 — FONDASI / LINTAS-HALAMAN
- **Isi**: KEPUTUSAN A dan B (bagian 8), lalu PT-3 (galat menempel field), PT-4 (keadaan),
  PT-5 (jalur non-Carbon), PT-6 (teks Inggris)
- **Task**: DS-20, AUD-25, DS-06 sebagian
- **Ketergantungan**: tidak ada — ini akarnya
- **Risiko**: menyentuh banyak berkas sekaligus; wajib bertahap dengan penjaga
- **Kriteria terima**: `invalidText` dipakai di seluruh formulir wajib; nol pemuat yang
  menelan galat; nol teks Inggris di layar

### WAVE 0b — P0, PARALEL DENGAN WAVE 0
- **Isi**: PT-1 (`/hr` angka berbohong), PT-2 (`/purchasing` supplier ganda)
- **Kenapa tidak menunggu**: keduanya menyentuh **arti angka** dan **integritas master data**,
  bukan tampilan
- **Kriteria terima**: kartu "Hadir hari ini" cocok dengan jumlah baris absensi hari itu;
  penyimpanan berhasil menutup modal dan tidak pernah berjudul "Gagal"

### WAVE 1 — MANUFAKTUR INTI
- **Halaman**: `/boms` (pilot) · `/work-orders` · `/routing` · `/production` · `/ppic` · `/warehouse`
- **Task**: DS-18 (butuh persetujuan), MST-09
- **Ketergantungan**: KEPUTUSAN A dan B
- **Risiko**: `/ppic` 1964 baris dan 17 cacat — paling besar di seluruh sistem

### WAVE 2 — OPERASIONAL
- **Halaman**: `/sales-orders` · `/customer-purchase-orders` · `/shipments` · `/customers` · `/items` · `/documents` · `/pod/[token]`
- **Task**: PMB-08, KRM-05
- **Ketergantungan**: pola dari Wave 1

### WAVE 3 — ADMINISTRATIF
- **Halaman**: `/attendance` · `/kpi` · `/kpi/saya` · `/operating-profit` · `/team` · `/company` · `/company/setelan` · `/profile` · `/build-tasks`

### WAVE 4 — POLES / AKSESIBILITAS / KONSISTENSI
- **Halaman**: 6 halaman publik · `/whats-new` · `/kamus` · `/ai-project` · `/ai-readiness` · `/process-mining` · `/debug` · `/test-tenant` · halaman cetak
- **Isi**: pengukuran responsif untuk 10 halaman yang masih UNKNOWN

---

## 16. REKOMENDASI PILOT

**Pilot: `/boms`, alur BUAT BOM → halaman penuh.**

Diverifikasi dari bukti, bukan dipilih otomatis:

| Kriteria | Bukti |
|---|---|
| Keputusan arsitektur sudah ada | `FABRIX_MODAL_FORM_GOVERNANCE_DECISION.md` DECISION 6 |
| Ketergantungannya sudah selesai | DS-17 selesai · DS-21 selesai · DS-22 selesai |
| Punya baris berulang | ya — satu-satunya yang tinggi isinya tumbuh tanpa batas |
| Bukti responsif sudah ada | 36 pengukuran di 9 lebar |
| Bisa melahirkan pola yang dipakai ulang | ya — menjawab KEPUTUSAN A dan B sekaligus |
| Risiko terhadap alur kerja pabrik | rendah — BOM dibuat sesekali, bukan tiap hari |

**Yang TIDAK dipilih, beserta alasannya:**
- `/purchasing` — severity tertinggi, tetapi pekerjaannya **memperbaiki cacat**, bukan
  **menetapkan pola**. Harus dikerjakan sebagai P0 terpisah.
- `/items` — sudah jadi rujukan yang disetujui; memakainya sebagai pilot tidak menghasilkan
  pola baru.
- `/ppic` — 17 cacat dan 1964 baris; terlalu besar untuk pilot pertama.

**PRASYARAT PILOT**: KEPUTUSAN A dan B harus diambil lebih dulu. Mengerjakan BOM tanpa
keduanya berarti menetapkan pola untuk seluruh sistem lewat satu halaman, tanpa keputusan.

**Catatan yang ditemukan saat audit dan wajib dibaca sebelum pilot dimulai**: modal yang sama
dipakai untuk **BUAT dan UBAH** (`startCreate` dan `startEdit` membuka `isFormModalOpen` yang
sama). Memindahkan hanya "buat" akan melahirkan dua jalur hidup untuk formulir yang sama.
Jalan keluarnya: mengangkat formulirnya jadi komponen bersama yang dipakai halaman baru
**dan** modal ubah — satu formulir, dua wadah.

---

## 17. DEFINITION OF DONE

Sebuah halaman dinyatakan selesai direvisi bila **seluruh** butir berikut terpenuhi:

| # | Butir |
|---|---|
| 1 | AS-IS dikonfirmasi dari kode, bukan dari dokumentasi |
| 2 | TO-BE ditetapkan sebelum kode ditulis (gerbang DS-RULES A.1) |
| 3 | Komponen Carbon dipetakan beserta alasan pemilihannya |
| 4 | Responsif terbukti di **360 / 672 / 768 / 1280 / 1440 / 1920** |
| 5 | Nol gulir menyamping, nol elemen melewati tepi **kanan maupun kiri** |
| 6 | Aksesibilitas: keyboard, fokus terlihat, urutan Tab, nama terbaca, galat terkait field |
| 7 | Keadaan **memuat** dirender |
| 8 | Keadaan **kosong** dirender, beserta jalan keluarnya |
| 9 | Keadaan **galat** dirender dan **berbeda** dari keadaan kosong |
| 10 | Keadaan **berhasil** dirender |
| 11 | Keadaan **tanpa izin** dirender |
| 12 | Alur CRUD diperiksa ujung ke ujung |
| 13 | Penjaga regresi ada, dan **dibuktikan MERAH lebih dulu** |
| 14 | Bukti terekam dan dapat diperiksa ulang |
| 15 | Pohon kerja bersih; nol berkas yang bukan milik batch |
| 16 | Status task terekonsiliasi lewat mekanisme kanonik |
| 17 | Alamat katalog Carbon yang sepadan dilaporkan, untuk perbandingan berdampingan |

---

## 18. TEMUAN GOVERNANCE

**Tidak satu pun diperbaiki di batch ini.**

| Kode | Temuan |
|---|---|
| **G-1** | `docs/00-GOVERNANCE/` menetapkan kosakata status task berbahasa Inggris (`PROPOSED → … → DONE`) yang bertentangan dengan kekangan basis data (`menunggu`, `selesai`, …). Folder bertanda "Proposed", belum terlacak git. Konstitusinya sendiri memerintahkan: *"If two canonical sources conflict, STOP and create an ADR/decision request."* |
| **G-2** | `docs/governance/design-debt.md` kedaluwarsa: elemen mentah tercatat 26/27/25, terukur **11/5/4** |
| **G-3** | CLAUDE.md butir 6 menunjuk `FieldLabel` sebagai komponen bantuan-klik resmi; komponen itu punya **0 pengimpor** |
| **G-4** | 2 overlay masih di jalur shadcn/Radix (`ConfirmAndSignModal`, `provenance-info-button`) — jalur kedua di samping Carbon |
| **G-5** | 27 media query menulis nilai breakpoint sebagai angka rem, bukan lewat mixin Carbon. Ke-27-nya benar hari ini — kelas "kebetulan benar" keenam |
| **G-6** | `invalidText` 5 pemakaian vs `InlineNotification` 123 — mekanisme galat Carbon praktis tidak dipakai |
| **G-7** | DS-09 dan DS-18 berstatus `menunggu_persetujuan`; keduanya memblokir pekerjaan formulir berikutnya |
| **G-8** | **T-1** — migrasi memakai **nama perusahaan yang dapat berubah** sebagai penanda pencarian. Nama perusahaan pernah diubah lewat Company Settings, sehingga pencarian berbasis nama dapat menjadi usang. **Tidak diperbaiki, tidak dibuatkan migrasi, tidak dibuatkan task di batch ini.** |

---

## 19. KEPUTUSAN YANG DIBUTUHKAN

| # | Keputusan | Siapa | Memblokir |
|---|---|---|---|
| **D-A** | Bentuk halaman formulir penuh: `Form`+`Stack`+`FormGroup`, `FluidForm`, atau `<form>` biasa | Pemilik produk | seluruh Wave 1–3 |
| **D-B** | Bentuk baris berulang: kartu label-tersembunyi, kartu label-diulang, tabel polos, atau `ContainedList` | Pemilik produk | BOM, Routing, PO Klien, Purchasing |
| **D-C** | Apakah 8 PROPOSED TASK didaftarkan | Pemilik produk | penjadwalan Wave 0 |
| **D-D** | G-1: kosakata status mana yang kanonik | Pemilik produk | konsistensi dokumentasi |
| **D-E** | DS-09 dan DS-18 — persetujuan yang tertunda | Pemilik produk | Wave 1 |

---

## 20. DI LUAR LINGKUP

Tidak disentuh di batch ini, dan disebut supaya tidak dikira terlewat: implementasi UI apa
pun · BOM full page · PO Klien · Master Item · Karyawan · SidePanel · DS-06 · DS-20 ·
AUD-42 · MST-09 · perbaikan T-1 · pembuatan task baru · perubahan basis data · migrasi.

---

## 21. BATCH BERIKUTNYA YANG DIREKOMENDASIKAN

1. **Ambil KEPUTUSAN A dan B.** Keduanya memblokir lebih banyak pekerjaan daripada cacat mana pun.
2. **Kerjakan P0 secara paralel**: `/hr` dan `/purchasing`. Keduanya menyentuh arti angka dan
   integritas master data.
3. **Baru kemudian** pilot BOM.

---

## 22. INDEKS BUKTI

| Bukti | Isi |
|---|---|
| `FABRIX_MODAL_FORM_FINAL_EVIDENCE.md` | 26 pengukuran modal + lampiran hasil DS-21/DS-22 |
| `FABRIX_MODAL_FORM_GOVERNANCE_DECISION.md` | DECISION 1–6, termasuk BOM → halaman penuh |
| `FABRIX_UI_UX_BATCH_HANDOFF.md` | batch DS-21/DS-22 |
| `FABRIX_UX_01_ASIS_APPLICATION_SHELL_AUDIT.md` | audit kerangka & navigasi |
| Pengukuran responsif batch ini | 174 pengukuran, 29 halaman × 6 lebar |
| Inventaris terukur batch ini | 39 rute, per halaman: Carbon, modal, elemen mentah, keadaan |
| Matriks kualitas batch ini | 39 halaman × 12 dimensi, 300 cacat tercatat |

> Berkas kerja pengukuran berada di direktori sementara sesi dan **tidak** dimasukkan ke
> repo — batch ini hanya menambah dokumen.

---

## 23. BASELINE GIT

| | |
|---|---|
| HEAD sebelum batch | `c39c6bf` |
| Branch | `main` (ahead 22, **belum di-push**) |
| Berkas berubah sebelum batch | tidak ada |
| Berkas belum terlacak sebelum batch | `docs/00-GOVERNANCE/` — **bukan milik batch ini, tidak ikut di-commit** |
| Perubahan sumber oleh batch ini | **nol** |
