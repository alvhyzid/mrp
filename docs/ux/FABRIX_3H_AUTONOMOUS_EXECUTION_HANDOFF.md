<!--
  HANDOFF UTAMA — jendela kerja mandiri, 27 Agustus 2026.
  Dokumen ini SATU-SATUNYA sumber untuk melanjutkan pekerjaan. Mencakup DUA jendela:
  jendela 1 (14:45-15:14) UX-D1, dan jendela 2 (16:41-17:20) gerbang DS-03.
  Judul bagian Bahasa Inggris mengikuti perintah; isinya Bahasa Indonesia.
-->

# FABRIX — AUTONOMOUS UI/UX EXECUTION HANDOFF

---

## START HERE WHEN USER RETURNS

### Last completed task
**DS-03 — Urutan Migrasi Carbon 38 Layar** · status **selesai** · commit `a615615`

### Current state, konkret

**DS-03 ternyata BUKAN gerbang.** Keputusannya sudah ada di dalam catatan task-nya sendiri
sejak **25 Agustus 2026** — urutan tiga gelombang disetujui, pilot layar publik lalu Master
Item tanpa jeda. Ketiga langkah acceptance-nya sudah tuntas; yang tertinggal hanya statusnya.

> **Koreksi terhadap laporan saya sendiri.** Audit UX-01 dan handoff sebelumnya menyebut
> DS-03 sebagai gerbang yang menahan 22 task. Itu **keliru** — kesimpulan itu diambil dari
> **JUDUL** task ("Menunggu Keputusan Pemilik Produk"), bukan dari isinya. Judulnya memang
> tidak pernah diperbarui setelah keputusannya masuk.

**Yang benar-benar menunggu Anda sekarang adalah DS-09**, dan yang ditunggu **bukan
keputusan** melainkan **perbandingan visual berdampingan** — pemeriksaan yang hanya bisa
dilakukan mata manusia.

### Outstanding
Satu hal: **DS-09 menunggu tinjauan visual Anda.** Buktinya sudah disiapkan (bagian 6).

### Blocked
Tidak ada yang terhalang secara teknis.

### Decision required
1. **DS-09** — tinjauan visual berdampingan. Langkahnya di bagian 6.
2. **`max-width: 60rem` di `/company/setelan`** — satu-satunya batas lebar yang tersisa
   setelah keputusan **LEBAR PENUH** 25 Agu 2026. Saya **pertahankan** dan **tidak**
   memutuskannya. Bagian 12.
3. **13 dokumen governance baru** muncul di `docs/00-GOVERNANCE/` selama jendela ini —
   bertanda *"Proposed Canonical Governance"*, belum di-commit. Bagian 14.

### First next action
Buka **`/items`** dan **`/routing`** berdampingan di 1440px. Periksa empat hal: remah roti,
judul + baris jumlah, kotak pencarian yang **melipat jadi ikon**, dan toolbar tabel. Bila
sama — DS-09 disetujui dan pekerjaan lanjut ke **rebrand FABRIX**.

### Files to read
1. Dokumen ini
2. `docs/ux/FABRIX_UX_01_ASIS_APPLICATION_SHELL_AUDIT.md`
3. Catatan task **DS-03** dan **DS-09** di Daftar Tugas — keduanya memuat keputusan lengkap
4. `tests/kerangka_halaman_bersama.test.ts` — penjaga baru

### Do NOT repeat
- Pengukuran keseragaman 19 layar — sudah, dua kali (sebelum & sesudah perbaikan)
- Audit AS-IS DS-03 dan DS-09 — sudah, isinya di bagian 3
- UX-D1, DS-17, DS-14, RSP-02 (pekerjaan), AUD-47, KRM-05 — semuanya sudah (rinciannya di **Lampiran A**)

---

## 1. Execution Window

| | Jendela 1 | Jendela 2 |
|---|---|---|
| Mulai | 14:45:42 | **16:41:27** |
| Selesai | 15:14 | **17:20** |
| Durasi | 29 menit | **39 menit** |
| Fokus | UX-D1 | **Gerbang DS-03** |
| Berhenti karena | pekerjaan READY habis | pekerjaan READY habis |

Keduanya berhenti karena **pekerjaannya selesai**, bukan karena waktu habis.

## 2. Starting & Ending State

| | Awal jendela 2 | Akhir |
|---|---|---|
| HEAD | `1cf3d06` | **`a615615`** |
| Pohon kerja | bersih | bersih kecuali `docs/00-GOVERNANCE/` (bukan milik saya) |
| Task hidup | 285 | 285 |
| Selesai | 111 | **112** |
| Tersisa | 174 | **173** |
| Kelengkapan | 38,9% | **39,3%** |

> Catatan: perintah menyebut HEAD terakhir `3ec149d`. Sebenarnya `1cf3d06` — tiga commit
> dokumentasi menyusul `3ec149d` di jendela 1, seluruhnya sudah dilaporkan.

Perubahan roadmap **hanya** disebabkan **DS-03**.

---

## 3. AS-IS Audit — DS-03

| Pertanyaan | Jawaban dari bukti |
|---|---|
| Apa isi DS-03? | Menyusun urutan migrasi Carbon 38 layar jadi tiga gelombang, menyodorkannya, dan mencatat keputusannya |
| Keputusan apa yang harus dibuat? | **Sudah dibuat 25 Agu 2026**, tercatat di `notes` task-nya |
| Masih valid? | Ya — dan sudah dijalankan |
| Ada implementasi parsial? | Bukan parsial: **DS-02** (gelombang 1) selesai, **DS-05** (Master Item) selesai, **DS-08** (cetakan) selesai |
| Berapa task bergantung? | **Nol yang terhalang.** Pelaksanaannya hidup di DS-09, yang sudah berjalan sampai halaman ke-22 |
| Konsekuensi menutupnya? | Menghapus gerbang palsu dari peta jalan |
| Konflik dengan task selesai? | Tidak ada |
| Keputusan Carbon yang sudah kanonik? | Ya — tiga gelombang + pilot, tertulis di DS-03 |

**Tindakan**: rekonsiliasi status lewat migrasi `20260831100000_ds03_rekonsiliasi.sql`,
menyentuh **hanya baris DS-03**. Tidak ada keputusan baru yang dibuat.

---

## 4. Carbon Inventory

39 berkas halaman, diukur dengan komentar dibuang lebih dulu:

| Golongan | Jml | Isi |
|---|---:|---|
| **A. Carbon kanonik** | **29** | Seluruh layar internal |
| **B. Carbon tanpa kerangka bersama** | **8** | Layar publik & cetak — memang hidup di luar kerangka aplikasi, bukan utang |
| **D. Carbon + kontrol mentah** | **2** | `/documents` (3) dan `/ppic` (4) — **pengecualian terdaftar beralasan**, pengawasnya hijau |
| **C. shadcn/legacy** | **0** | — |
| **F. campuran** | **0** | — |

**Nol halaman masih memakai shadcn.** Ini jauh lebih maju daripada yang dilaporkan sensus
DS-09 (25 Agu: "29 belum tersentuh").

---

## 5. Migration Order

Prinsip FOUNDATION → SHARED COMPONENT → REFERENCE SCREEN → SMALL BATCH → REGRESSION
**sudah dijalankan** dan tercatat sebagai task yang selesai:

```
DS-01  Fondasi Carbon                       selesai
  ↓
DS-04  UI Shell (header + navigasi)         selesai
  ↓
DS-02  Layar publik (pilot)                 selesai
  ↓
DS-05  Master Item (layar acuan)            selesai
  ↓
DS-08  Cetakan halaman data                 selesai
  ↓
DS-09  Seluruh layar, berurutan             MENUNGGU TINJAUAN VISUAL
```

Tidak ada mass migration yang perlu direncanakan — sudah dikerjakan bertahap.

---

## 6. DS-09 — BUKTI UNTUK TINJAUAN VISUAL ANDA

Kolom persetujuan DS-09 meminta empat hal diperiksa di 19 layar. **Saya ukur keempatnya di
peramban, 1440px**, supaya perbandingan Anda tinggal mengonfirmasi:

| Kriteria | Hasil di 15 layar bertabel |
|---|---|
| Remah roti | ada, 3 butir, **y = 72px** — SERAGAM |
| Judul + baris jumlah | **28px di y = 114px**, baris pengantar ada — SERAGAM |
| Pencarian **MELIPAT** | `expandable`, **tertutup bawaan**, lebar **48px** — SERAGAM |
| Toolbar tabel | ada, tinggi **48px** — SERAGAM |

Empat layar lain (`/kamus`, `/profile`, `/build-tasks`, `/company/setelan`) memang bukan
layar bertabel — remah roti dan judulnya tetap seragam.

**Langkah tinjauan Anda** (dari kolom persetujuan DS-09):
> Buka `/routing` lalu `/items` berdampingan. Keduanya harus punya bentuk kepala halaman
> yang sama persis, kotak pencarian yang sama-sama melipat jadi ikon, dan saringan yang sama
> bentuknya.

**Katalog pembanding**: carbondesignsystem.com/patterns/data-table-pattern ·
/components/data-table/usage · /components/modal/usage · /components/dropdown/usage

**Bila disetujui** → DS-09 ditutup, pekerjaan lanjut ke **rebrand FABRIX**.
**Bila ditolak** → sebutkan layar dan bagiannya; perbaikannya masuk ke komponen bersama.

---

## 7. Yang Diperbaiki di Jendela Ini

Pengukuran menemukan **satu** ketidakseragaman; sapuan tetangganya menemukan **yang kedua**,
dan yang kedua lebih berbahaya.

### (1) `/company/setelan` — pembungkus sendiri tanpa jarak antar-blok

`.setelan-halaman` memakai `padding: $spacing-05` **tanpa `gap`**, menggantikan kerangka
bersama. Terukur: remah roti **8px** dan judul **24px** lebih tinggi daripada 18 layar lain.

### (2) `/items` — LAYAR ACUAN memakai salinan persis kerangka bersama

`.item-halaman` isinya **identik** dengan `.halaman`: padding, flex kolom, dan gap yang sama
nilainya. Benar hari ini **karena disalin, bukan karena satu sumber**.

> Begitu `.halaman` disetel ulang, layar acuan yang sudah Anda setujui **diam-diam berhenti
> cocok** dengan seluruh layar lain, dan **tidak ada yang berbunyi**. Ini kelas
> "kebetulan benar" yang sudah tercatat berkali-kali di CLAUDE.md.

**Keduanya kini memakai kerangka bersama.** Diukur ulang: 19 layar identik,
`/company/setelan` bergeser 64/90 → **72/114**, `/items` tidak berubah.

---

## 8. Regression Guard

`tests/kerangka_halaman_bersama.test.ts` — menutup **KELASNYA**, bukan dua kejadiannya:

| Uji | Membuktikan |
|---|---|
| (a) | Setiap layar internal berkepala memakai pembungkus bersama `halaman` |
| (b) | Nol kelas SCSS yang menduplikasi bentuk kerangka `.halaman` |

**Dibuktikan dua arah**: MERAH sebelum perbaikan — menuduh **tepat dua berkas yang benar** —
dan HIJAU sesudahnya.

---

## 9. Test Log

| Waktu | Uji | Hasil |
|---|---|---|
| 17:05 | `tests/kerangka_halaman_bersama.test.ts` (pra-perbaikan) | **2 MERAH** — tuduhan tepat |
| 17:08 | idem (pasca-perbaikan) | **2 lulus** |
| 17:12 | 8 penjaga UI | **43 lulus / 0 gagal** |
| 17:12 | `npx tsc --noEmit` | **bersih** |
| 17:13 | `npm run lint` | **28 masalah (16 galat)** = baseline, nol berkas yang saya sentuh |
| 16:54 | `npm run build` | **✓ Compiled successfully** |
| 16:54–17:10 | `npx vitest run` (suite penuh) | **68 berkas · 423 lulus · 7 dilewati · 0 gagal** (967 detik) |
| 17:16 | `migrasi_kurung_seimbang` + penjaga baru | **4 lulus** |
| 17:00 & 17:09 | Peramban, 19 layar × 2 putaran | **lulus** |
| 17:10 | Enam lebar × 2 halaman berubah | **12 pengukuran, 0 cacat, 0 galat halaman** |

Suite naik 67→68 berkas dan 421→423 uji: **tepat** penjaga baru, tidak ada yang lain berubah.

---

## 10. Responsive Evidence

Dua halaman yang berubah, enam lebar, tiga arah pemeriksaan:

| Lebar | `/items` | `/company/setelan` |
|---:|---|---|
| 360 | gulir 0 · kanan 0 · kiri 0 · remah@72 · judul@150 | idem |
| 672 | 0 · 0 · 0 · remah@72 · judul@114 | idem |
| 768 | 0 · 0 · 0 | idem |
| 1280 | 0 · 0 · 0 · lebar isi 1024 | 0 · 0 · 0 · lebar isi **960** (max-width) |
| 1440 | 0 · 0 · 0 · lebar isi 1184 | 0 · 0 · 0 · lebar isi **960** |
| 1920 | 0 · 0 · 0 · lebar isi 1664 | 0 · 0 · 0 · lebar isi **960** |

Padding 16px dan gap 16px identik di keduanya, di seluruh lebar.

---

## 11. Findings

| ID | Kategori | Temuan | Bukti | Pemilik | Task | Tindakan |
|---|---|---|---|---|---|---|
| E-1 | GOVERNANCE | **DS-03 bukan gerbang** — keputusannya sudah tercatat 25 Agu; laporan sebelumnya salah baca JUDUL | `notes` DS-03 | Governance | **DS-03** | **FIXED** — direkonsiliasi |
| E-2 | UX DEBT | `/company/setelan` pembungkus sendiri tanpa `gap`; remah 8px & judul 24px meleset | diukur di peramban | UI/UX | **DS-09** | **FIXED** |
| E-3 | UX DEBT | `/items` — layar acuan — memakai salinan persis kerangka bersama | `.item-halaman` vs `.halaman` | UI/UX | **DS-09** | **FIXED** |
| E-4 | GOVERNANCE | **13 dokumen governance baru** muncul di `docs/00-GOVERNANCE/` selama jendela ini, belum di-commit | `git status` | Product Owner | — | **DOCUMENTED** — tidak disentuh |
| E-5 | INFORMATIONAL | DS-09 sensusnya usang: menyebut "29 belum tersentuh", nyatanya **nol halaman shadcn** tersisa | inventaris 39 halaman | UI/UX | **DS-09** | **DOCUMENTED** |
| E-6 | BUSINESS DECISION | `max-width: 60rem` di `/company/setelan` satu-satunya batas lebar tersisa setelah keputusan LEBAR PENUH | `setelan.scss` | Product Owner | — | **DOCUMENTED** — dipertahankan, tidak diputuskan |

Temuan jendela 1 (**D-1…D-11**) tetap berlaku dan isinya ada di **Lampiran A** di bawah.

---

## 12. DECISION REQUIRED

### 1. DS-09 — tinjauan visual berdampingan
Langkah dan katalog pembandingnya di bagian 6. **Ini pemeriksaan yang tidak bisa saya
gantikan** — saya tidak bisa melihat layar.

### 2. `max-width: 60rem` di `/company/setelan`

| Pilihan | Konsekuensi |
|---|---|
| **Pertahankan** (keadaan sekarang) | Formulir setelan tetap terbatas 960px — nyaman dibaca, tapi satu-satunya layar yang tidak lebar penuh |
| **Cabut** | Seluruh layar benar-benar lebar penuh tanpa kecuali; formulirnya melebar sampai 1900px di monitor lebar |

**Saran saya**: pertahankan. Alasan keputusan LEBAR PENUH adalah **tabel padat data yang
kolomnya terpotong**; halaman ini formulir, bukan tabel. Tapi ini **keputusan Anda** —
saya tidak mencabutnya sendiri.

**Task terdampak**: tidak ada yang terhalang; ini rapian, bukan penghalang.

### 3. 13 dokumen governance di `docs/00-GOVERNANCE/`
Bertanda *"Proposed Canonical Governance"*, belum di-commit, **tidak saya sentuh**. Isinya
antara lain FABRIX_CONSTITUTION, DEFINITION_OF_DONE, ADR_REGISTER, RELEASE_GATES. Bila ini
akan jadi aturan yang mengikat, ia mengubah cara kerja sesi berikutnya — dan itu keputusan
Anda untuk menetapkannya.

---

## 13. Change Log

| Berkas | Tindakan | Alasan | Task | Terverifikasi |
|---|---|---|---|---|
| `src/features/mrp/pages/ItemsPage.tsx` | Diubah (3 pembungkus) | Pakai kerangka bersama | DS-09 | 19 layar + 6 lebar |
| `app/(shell)/items/items.scss` | Diubah | Salinan kerangka dihapus | DS-09 | Penjaga (b) |
| `src/features/company/pages/SetelanPerhitunganPage.tsx` | Diubah (2 pembungkus) | Pakai kerangka bersama | DS-09 | 19 layar + 6 lebar |
| `app/(shell)/company/setelan/setelan.scss` | Diubah | Padding dilepas, `max-width` dipertahankan | DS-09 | idem |
| `tests/kerangka_halaman_bersama.test.ts` | **Baru** | Penjaga kelas | DS-09 | Merah lalu hijau |
| `supabase/migrations/20260831100000_ds03_rekonsiliasi.sql` | **Baru** | Status DS-03 | DS-03 | 3 project, potret 91 tabel nol berubah |
| `docs/ux/FABRIX_3H_AUTONOMOUS_EXECUTION_HANDOFF.md` | Diperbarui | Dokumen ini | — | — |
| `next-env.d.ts` | **SEMENTARA → DIKEMBALIKAN** | Ditulis ulang Next.js saat aplikasi dijalankan | — | `git status` bersih |
| `docs/00-GOVERNANCE/` (13 berkas) | **TIDAK DISENTUH** | Bukan milik saya | — | — |

---

## 14. Data / Security

| Pemeriksaan | Hasil |
|---|---|
| Baris dibuat di basis data | **NOL** — verifikasi hanya membaca layar |
| Potret 91 tabel sebelum/sesudah | **NOL tabel berubah** |
| Migrasi menyentuh tabel apa | **hanya `build_tasks`**, `where task_code = 'DS-03'` |
| Task lain ikut berubah | **NOL** — hanya DS-03 yang `completed_at`-nya hari ini selain DS-14/DS-17 dari jendela lalu |
| PT ITM | **tidak disentuh** |
| Kredensial di commit | **nol** |

---

## 15. Scope Audit

| Task | Tersentuh? | Catatan |
|---|---|---|
| DS-09 | **Ya, disengaja** | Dua ketidakseragaman diperbaiki di komponen bersama, persis seperti diinstruksikan kolom `approval_if_rejected` DS-09 |
| DS-10, DS-06, DS-18, DS-20 | Tidak | — |
| AUD-37, PLT-06, MST-09, AUD-42, AUD-48, DS-19 | Tidak | — |
| UX-D1, DS-17, DS-14, RSP-02, AUD-47 | Tidak | Tidak diulang |

---

## 16. Continuation Map

```
COMPLETED
  DS-01 · DS-02 · DS-04 · DS-05 · DS-08 · DS-12 · DS-13 · DS-14 · DS-16 · DS-17
  DS-03 (baru) · UX-D1 · RSP-01
        ↓
MENUNGGU ANDA (bukan terhalang teknis)
  DS-09  -> tinjauan visual berdampingan       <<< SATU-SATUNYA GERBANG NYATA
  DS-18  -> tinjauan lebar modal
        ↓
SIAP SETELAH DS-09 DISETUJUI
  Rebrand FABRIX (RBD-01 .. RBD-07)  -- disebut sendiri oleh `approval_if_approved` DS-09
        ↓
TERBUKA, PUNYA PEMILIK
  DS-06 · DS-10 · DS-20 · NAV-01 · NAV-04 · SEC-04 · KRM-05 (layak ditutup)
```

---

## 17. Roadmap Reconciliation

| Status | Jumlah |
|---|---:|
| Selesai | **112** |
| Menunggu | 166 |
| Menunggu persetujuan | 6 |
| Sedang dikerjakan | 1 |
| Ditunda sadar | 34 (di luar pembagi) |
| Dibatalkan | 3 (di luar pembagi) |
| **Task hidup** | **285** |
| **Tersisa** | **173** |
| **Kelengkapan** | **39,3%** |

Perubahan dari 38,9%: **DS-03**, satu-satunya penyebab.

---

## 18. Git

```
$ git log --oneline -5
a615615 fix(ui): satukan kerangka halaman + rekonsiliasi status DS-03
1cf3d06 docs(ux): koreksi klaim task sekunder + audit KRM-05
24db657 docs(ux): koreksi waktu di handoff
d36bc66 docs(ux): UX-01 as-is audit + handoff
3ec149d fix(dashboard): restore summary loading and error state

$ git status --short
?? docs/00-GOVERNANCE/     <- 13 dokumen milik pemilik produk, sengaja tidak disentuh
```

Nol amend · nol squash · nol rebase · **belum di-push**.

---

## 19. Timeline

```
16:41  gerbang git · HEAD 1cf3d06 · pohon bersih
16:44  baca build_tasks · DS-03 ditemukan SUDAH diputuskan 25 Agu
16:48  DS-09 dibaca -> ternyata sedang berjalan, bukan gerbang keputusan
16:52  inventaris Carbon 39 halaman: 29 kanonik, 8 publik, 2 pengecualian, NOL shadcn
16:56  keempat kriteria DS-09 diukur dari sumber: nol ketidakseragaman
17:00  diukur di PERAMBAN 19 layar -> /company/setelan meleset 8px & 24px
17:03  sapuan tetangga -> /items memakai SALINAN kerangka bersama
17:05  penjaga ditulis lebih dulu -> MERAH, menuduh tepat dua berkas
17:08  perbaikan -> penjaga HIJAU
17:09  19 layar diukur ulang -> identik seluruhnya
17:10  enam lebar × 2 halaman -> 12 pengukuran, nol cacat
17:10  suite penuh -> 68 berkas, 423 lulus, 0 gagal
17:16  migrasi DS-03 diterapkan ke 3 project -> potret 91 tabel nol berubah
17:18  commit a615615 · pohon bersih
17:20  handoff ditulis · STOP
```

---

# LAMPIRAN A — JENDELA 1 (14:45–15:14): UX-D1

> **Kenapa ada lampiran ini.** Versi pertama dokumen ini seluruhnya tentang jendela 1.
> Saat jendela 2 selesai, saya **menimpanya** alih-alih menggabungkannya — 456 baris hilang,
> termasuk daftar temuan, daftar "yang sengaja tidak dikerjakan", dan laporan UX-D1 penuh.
> Lebih buruk lagi, badan dokumen tetap merujuk ke temuan D-1…D-11 yang sudah tidak ada di
> dalamnya. Rujukan menggantung membuat sebuah handoff gagal sebagai handoff.
>
> Isinya dipulihkan di sini apa adanya, dan **tidak diringkas** — supaya tidak ada yang perlu
> menggali riwayat git untuk mengetahui apa yang sudah dikerjakan.

### UX-D1

#### AS-IS
`DashboardPage.tsx:97` memanggil `/api/dashboard/summary`. Route itu tidak ada.

#### Root Cause — DUA lapis, dan lapis kedua yang sebenarnya mematikan
1. **Alamat salah.** `/api/dashboard/summary` (bersarang) vs `/api/dashboard-summary` (datar).
2. **Tidak ada penangkap galat di sekitar `response.json()`.** Next.js menjawab alamat tak
   dikenal dengan halaman HTML. `json()` melempar **sebelum** pemeriksaan `response.ok`,
   sehingga penghentian pemuatan dan penyetelan pesan galat **tidak pernah dijalankan**.

> Memperbaiki lapis 1 saja akan menyembunyikan lapis 2 sampai server menjawab HTML karena
> sebab lain — galat 500, gangguan gateway, sesi habis. Keduanya diperbaiki.

#### Fix
| Aspek | Sebelum | Sesudah |
|---|---|---|
| Alamat | `/api/dashboard/summary` (404) | `/api/dashboard-summary` (200) |
| Pengambilan token | disalin lokal (`getAccessToken`) | `authedFetch` bersama |
| Parse JSON | telanjang, melempar | di dalam `try/catch` |
| Penghentian pemuatan | tersebar di 3 tempat, terlewat | **satu** `finally` |
| Keadaan awal | `summaryLoading: false` | `true` (memang selalu dimuat) |
| Angka saat gagal | `0` (bohong) | `—` (tidak diketahui) |
| Pesan galat | tidak pernah terlihat | `ActionableNotification` Carbon |
| Jalan keluar | tidak ada | tombol **Muat ulang ringkasan** |
| Halaman ditinggalkan | menulis ke komponen mati | dibatalkan |

#### Result
Lima keadaan diverifikasi di peramban sungguhan, **nol rejeksi tak tertangani di semuanya**:

| Keadaan | Kerangka | Angka | Notifikasi | Tombol muat ulang |
|---|---:|---|---:|---:|
| Berhasil | 0 | `0, 0, 0, 0` | 0 | 0 |
| Server jawab HTML 500 | 0 | `—, —, —, —` | 1 | 1 |
| Jaringan putus | 0 | `—, —, —, —` | 1 | 1 |
| 403 ber-JSON | 0 | `—, —, —, —` | 1 | 1 |
| Setelah muat ulang | 0 | `0, 0, 0, 0` | 0 | 0 |

Pesan yang muncul, apa adanya:
- HTML → *"Server memberi respons yang tidak dikenali (kemungkinan gangguan sesaat di layanan database). Coba lagi dalam beberapa saat."*
- Jaringan → *"Tidak bisa terhubung ke server. Coba lagi dalam beberapa saat."*
- 403 → pesan server sendiri: *"Ringkasan KPI ini khusus Admin Perusahaan/General Manager."*

---

### Secondary Task — DIAUDIT, TIDAK ADA YANG DIIMPLEMENTASIKAN

> **KOREKSI TERHADAP VERSI PERTAMA DOKUMEN INI.** Versi pertama menyatakan "tidak ada task
> sekunder yang memenuhi syarat" berdasarkan peta prioritas UX-01 — **tanpa membaca
> `build_tasks` sungguhan**. Itu klaim prematur. Setelah dibaca, **empat kandidat yang tidak
> pernah saya evaluasi** ternyata ada: KRM-05, DS-10, DOC-03, KPI-03. Bagian ini menggantikan
> klaim itu dengan evaluasi yang benar-benar dilakukan.

#### KRM-05 — DIAUDIT, TERNYATA SUDAH TERPENUHI → **SKIPPED**

Task ini berbunyi: *"seluruh elemen interaktif (tombol, input file, input teks, label
checkbox) tingginya HANYA 32px atau kurang — di bawah standar 44×44px"* (dicatat 26 Agu 2026).

**Diukur ulang 27 Agu 2026 di enam lebar. Catatan itu sudah usang** — halaman POD sejak itu
memakai `size="lg"`:

| Elemen | Tinggi | Standar 44px |
|---|---:|---|
| Tombol "Barang sudah diterima" | **48px** | terpenuhi |
| Tombol "Pilih atau ambil foto" | **48px** | terpenuhi |
| Input teks nama penerima | **48px** | terpenuhi |
| Label checkbox (target klik sungguhan) | **44px** | terpenuhi, tepat di batas |

Dua elemen sempat dilaporkan "di bawah 44px" oleh pengukur saya, dan **keduanya salah tuduh** —
dibuktikan dengan **klik tetikus sungguhan**, bukan disimpulkan:
- `input.cds--checkbox` 1×1px → itu kotak centang asli yang **sengaja disembunyikan** Carbon;
  target kliknya label 44px. Diklik di **tepi bawah** label → centangnya **berubah** ✓
- `label "Nama yang menerima"` 16px → itu **label field**, bukan aksi. Diklik → fokus pindah
  ke input yang tingginya **48px** ✓

Enam lebar juga bersih: nol gulir menyamping, nol elemen keluar tepi kanan maupun kiri.

**Fixture: NOL baris dibuat.** Jawaban API disadap lewat penyadapan jaringan, jadi halamannya
merender formulir penuh tanpa menyentuh basis data sama sekali.

**KRM-05 layak ditutup, tetapi saya TIDAK menutupnya** — perintah melarang mengubah
`build_tasks`. Keputusan menutupnya milik Anda.

#### DS-10 — **BLOCKED**, cakupannya jauh lebih luas dari judulnya

Judulnya menyebut "tombol mentah". Yang sebenarnya ada di
`src/components/ui/provenance-info-button.tsx`: **tiga** `<button>` mentah, `Dialog`/
`DialogContent`/`DialogHeader`/`DialogTitle` **shadcn lama**, `Badge` shadcn, bilah tab
**rakitan tangan** (bukan `Tabs` Carbon), dan kelas Tailwind di sepanjang berkas.

Komponen ini dirender di **20 halaman**. Memigrasikannya berarti mengubah tampilan 20 layar
sekaligus — dan CLAUDE.md aturan modal nomor 8 memperingatkan persis kelas ini:
*"seluruh modal lama akan berpadding dobel sekaligus — puluhan layar rusak dalam satu
perubahan yang niatnya merapikan."*

Selain itu **DS-RULES A.1 mengikat**: rencana Carbon harus diserahkan sebelum satu baris kode
ditulis, termasuk memilih varian modal (C.2). Memilih sendiri = keputusan desain yang belum
ditetapkan. **Dihentikan sesuai aturan, bukan karena waktu.**

#### DOC-03 — **SKIPPED**, memaparkan kemampuan menghapus permanen

Backend (`hardDeleteOrphanDocument.ts`) sudah lengkap; yang kurang tombolnya. Tapi ini
memaparkan **penghapusan permanen dokumen** ke layar. Siapa yang boleh menghapus adalah
**kebijakan hak akses** — wilayah keputusan pemilik produk menurut CLAUDE.md, bukan wilayah
saya.

#### KPI-03 — **SKIPPED**, butuh gerbang rencana Carbon

Backend (`updateKpiTarget`, `updateKpiVisibility`) sudah lengkap. Tapi `/kpi` adalah salah
satu halaman yang **belum memakai `DataTable` Carbon**, dan menambahkan formulir + tombol
arsip di sana adalah membangun UI baru di layar yang belum dimigrasikan — kembali ke gerbang
DS-RULES A.1.

#### NAV-03 — **SKIPPED**, bertabrakan dengan SEC-04

Memindahkan `/debug` dan `/test-tenant` ke dalam kerangka aplikasi itu murni struktur. Tapi
kedua halaman itu **belum punya gerbang peran** (SEC-04, terbuka). Membuatnya lebih mudah
ditemukan sebelum digerbangi adalah langkah mundur kecil di sisi keamanan. Dua task saling
menyentuh → dihentikan.

#### Kesimpulan

Sesuai aturan **"satu task selesai penuh > banyak task setengah jadi"**, jendela ini berakhir
dengan **UX-D1 tuntas** dan **KRM-05 terbukti sudah terpenuhi**. Tidak ada task kedua yang
dimulai lalu ditinggalkan setengah jalan.

### Tests

| Waktu | Uji | Cakupan | Hasil | Catatan |
|---|---|---|---|---|
| 01:35 | `tests/dashboard_summary.test.ts` | UX-D1 | **8 lulus / 0 gagal** | 4 uji sumber + 4 uji server |
| 01:40 | penjaga dua arah | alamat lama dikembalikan | **2 MERAH**, lalu **4 HIJAU** | terbukti berbunyi |
| 01:55 | `npx tsc --noEmit` | seluruh repo | **bersih, keluar 0** | — |
| 02:00 | `npm run lint` | seluruh repo | **28 masalah (16 galat)** | = baseline pra-perubahan; nol berkas UX-D1 |
| 02:12 | `npm run build` | produksi | **✓ Compiled successfully** | dijalankan CI |
| 02:15 | `npx vitest run` | suite penuh | ****67 berkas · 421 lulus · 7 dilewati · 0 gagal** (naik tepat +1 berkas / +8 uji = penjaga baru)** | — |
| 01:05 & 02:05 | verifikasi peramban | 5 keadaan | **lulus** | Playwright, tenant uji |
| 02:05 | enam lebar × 2 keadaan | 12 pengukuran | **lulus** | tabel di bagian 6 |

#### Isi penjaga regresi

| # | Uji | Membuktikan |
|---|---|---|
| a | Setiap alamat `/api` punya route sungguhan | 108 alamat disisir; menelusuri `app/api`, paham `[param]` |
| b | Dashboard memakai alamat kanonik datar | bentuk bersarang tidak boleh kembali |
| c | Pemuatan berhenti di semua jalur keluar | `finally` + parse JSON terbungkus |
| d | Angka tak diketahui bukan nol | `m.nilai ?? 0` tidak boleh kembali |
| e | Jalur berhasil menjawab empat angka | bentuk yang dibaca layar |
| f | Angkanya berlingkup tenant | karyawan tenant asing **tidak** ikut terhitung |
| g | Peran tanpa wewenang ditolak **403** di server | bukan sekadar tombol disembunyikan |
| h | Tanpa kredensial ditolak, pesannya tidak bocor | nol jejak tumpukan/kunci/nama tabel |

---

### Responsive

12 pengukuran — enam lebar × dua keadaan. Tiga arah diperiksa terpisah.

| Lebar | Keadaan berhasil | Keadaan galat |
|---:|---|---|
| 360 | gulir 0 · kanan 0 · kiri 0 · 4 kartu · judul 28px | gulir 0 · kanan 0 · kiri 0 · 4 kartu · notifikasi 1 |
| 672 | idem | idem |
| 768 | idem | idem |
| 1280 | idem | idem |
| 1440 | idem | idem |
| 1920 | idem | idem |

Tata letak **tidak dirancang ulang** — hanya keadaan galat yang bertambah.

---

### Carbon

| Aspek | Keputusan | Dasar |
|---|---|---|
| Pemberitahuan beraksi | `ActionableNotification` (`inline`, `kind="error"`, `lowContrast`) | Komponen Carbon untuk pemberitahuan yang punya aksi |
| Anak interaktif | **DILARANG** di `InlineNotification` | `useNoInteractiveChildren`, diverifikasi di paket 1.114.0 |
| Fokus | `hasFocus={false}` | Bawaannya `true`; merebut fokus saat halaman baru terbuka tidak pantas untuk galat yang sudah ada sejak awal |
| Tombol tutup | `hideCloseButton` | Aturan proyek: pesan GAGAL tidak boleh hilang sendiri |
| Keadaan memuat | `SkeletonText` yang sudah ada | Tidak diganti |
| Kartu | `Tile` + kelas `.kisi-metrik` yang sudah ada | Tidak diganti |
| Tipografi & jarak | tidak disentuh | Judul tetap 28px di seluruh lebar |

**Nol migrasi Carbon lain dikerjakan.**

---

### Tenant / Security

| Pemeriksaan | Hasil |
|---|---|
| Berlingkup perusahaan | `getDashboardSummary` menyaring `.eq('company_id', appUser.company_id)` di **seluruh** kueri |
| Terbukti berlingkup | uji (f): karyawan tenant asing **tidak** ikut terhitung |
| Autentikasi | lewat `getCurrentUser` (Bearer); tanpa token → ditolak |
| Wewenang | `isCompanyLeadership`; peran lain **403** di server |
| Kebocoran | uji (h): nol jejak tumpukan, kunci, nama tabel, alamat basis data |
| `company_id` tertanam | **nol** |
| Kredensial tertanam | **nol** — hanya nama variabel lingkungan |
| Perubahan di PT ITM | **nol.** Verifikasi memakai tenant uji (`company_id` 2); **nol baris dibuat atau diubah** — dashboard hanya membaca |
| Fixture uji | company `DashboardSummaryTestCorp` + `...AsingTestCorp`, dibersihkan di `afterAll` |

---

### DISCOVERY LOG

| ID | Kategori | Temuan | Bukti | Dampak | Pemilik | Task kanonik | Tindakan | Status |
|---|---|---|---|---|---|---|---|---|
| D-1 | BUG | Alamat ringkasan dashboard salah | 404 `text/html` terukur | Halaman pertama semua pengguna | UI/UX | — (UX-D1) | **FIXED** | Selesai |
| D-2 | BUG | `response.json()` tanpa penangkap galat → pemuatan tak pernah berhenti | `Uncaught (in promise) SyntaxError` | Kerangka selamanya, nol pesan | UI/UX | — (UX-D1) | **FIXED** | Selesai |
| D-3 | BUG | Angka `0` ditampilkan untuk data yang gagal dimuat | `{m.nilai ?? 0}` | Angka berbohong dengan percaya diri | UI/UX | — (UX-D1) | **FIXED** | Selesai |
| D-4 | TECHNICAL DEBT | `authedJson` bersama memanggil `res.json()` **tanpa** try/catch — cacat laten yang sama | `src/lib/authedFetch.ts` baris akhir | 2 pemakai (SetelanPerhitungan, KPI) bisa mati diam-diam | Architecture | **AUD-37 / PLT-06** | **DOCUMENTED** | Terbuka |
| D-5 | GOVERNANCE | Komentar `authedFetch.ts` menyebut `tests/authed_fetch_wajib.test.ts` sebagai penjaganya — **berkas itu tidak ada** | `ls tests/` | Rasa aman tanpa dasar | Governance | **AUD-37** | **DOCUMENTED** | Terbuka |
| D-6 | UX DEBT | Nama merek & nama perusahaan bertumpuk di header 360px | tangkapan layar `galat-0360.png` | Terbaca berantakan di HP | UI/UX | **NAV-04** | **ALREADY OWNED** | Terbuka |
| D-7 | GOVERNANCE | Pekerjaan UX-D1 **tidak menaikkan** angka roadmap karena tidak punya ID kanonik | roadmap tetap 111/285 | Roadmap melaporkan lebih rendah dari kenyataan | Governance | **AUD-24** | **DOCUMENTED** | Terbuka |
| D-8 | INFORMATIONAL | Carbon melarang anak interaktif di `InlineNotification` | `useNoInteractiveChildren` | Melanggarnya **merusak render**, bukan sekadar gaya | UI/UX | — | **FIXED** | Selesai |
| D-9 | GOVERNANCE | **KRM-05 cakupannya sudah terpenuhi** tapi task-nya masih terbuka — diukur 48/48/48/44px, standarnya 44px | `scratchpad/e2e/krm05-asis.js` + klik nyata | Task terbuka yang sebenarnya selesai; kelas sama dengan RSP-02 & DS-19 | Governance | **AUD-24** | **DOCUMENTED** | Layak ditutup |
| D-10 | UX DEBT | **DS-10 jauh lebih luas dari judulnya**: 3 `<button>` mentah + `Dialog` shadcn + `Badge` shadcn + tab rakitan tangan, dirender di **20 halaman** | `src/components/ui/provenance-info-button.tsx` | Migrasi menyentuh 20 layar sekaligus | UI/UX | **DS-10** | **BLOCKED** — butuh rencana Carbon (DS-RULES A.1) | Terbuka |
| D-11 | INFORMATIONAL | Pengukur target sentuh saya **salah tuduh dua kali** — kotak centang tersembunyi Carbon & label field | dibuktikan lewat klik tetikus sungguhan | Angka mentahnya bisa salah dibaca sebagai pelanggaran | — | — | **DOCUMENTED** | Dikoreksi di laporan |

---

### CHANGE LOG

| Berkas | Tindakan | Alasan | Task | Terverifikasi |
|---|---|---|---|---|
| `src/features/auth/pages/DashboardPage.tsx` | Diubah (+111 / −33) | Alamat kanonik, tiga keadaan tuntas, angka jujur, galat beraksi | UX-D1 | Peramban 5 keadaan + 12 pengukuran lebar |
| `tests/dashboard_summary.test.ts` | **Baru** (8 uji) | Penjaga regresi | UX-D1 | Terbukti merah lalu hijau |
| `docs/ux/FABRIX_3H_AUTONOMOUS_EXECUTION_HANDOFF.md` | **Baru** | Dokumen ini | — | — |
| `src/lib/authedFetch.ts` | **TIDAK diubah** | Cacat laten D-4 milik AUD-37 | — | — |
| `src/features/auth/pages/DashboardPage.tsx` | **PERUBAHAN SEMENTARA → DIKEMBALIKAN** | Alamat lama dikembalikan sebentar untuk membuktikan penjaga berbunyi | UX-D1 | `git status` bersih sesudahnya |
| `src/features/mrp/server/listBoms.ts` | **TIDAK disentuh** | — | — | — |
| `scratchpad/e2e/uxd1-*.js` | Baru (di luar repo) | Skrip verifikasi | UX-D1 | — |

---

### TASK STATE LOG

| Task | Keadaan |
|---|---|
| UX-D1 | **COMPLETED** |
| SEC-04 | **SKIPPED** — butuh keputusan kebijakan akses |
| DS-20 | **SKIPPED** — butuh daftar pengecualian yang diputuskan |
| NAV-04 | **SKIPPED** — butuh keputusan tampilan identitas header |
| KRM-05 | **SKIPPED** — diaudit, cakupannya SUDAH terpenuhi (layak ditutup) |
| DS-10 | **BLOCKED** — butuh rencana Carbon; menyentuh 20 halaman |
| DOC-03 | **SKIPPED** — memaparkan hapus permanen; butuh kebijakan hak akses |
| KPI-03 | **SKIPPED** — membangun UI di layar yang belum dimigrasikan |
| NAV-03 | **SKIPPED** — bertabrakan dengan SEC-04 yang masih terbuka |
| AUD-37 / PLT-06 | **NOT STARTED** — dilarang perintah |
| DS-03 / DS-09 / DS-06 | **BLOCKED** — menunggu keputusan urutan |

---

### Explicitly NOT Done

| Pekerjaan | Kenapa tidak dikerjakan | Pemilik | Ketergantungan | Tindakan berikutnya |
|---|---|---|---|---|
| Mengeraskan `authedJson` terhadap respons bukan-JSON | Mengubah kontrak bersama yang dipakai berkas lain; di luar UX-D1 | Architecture | — | Masukkan ke lingkup AUD-37/PLT-06 |
| Membuat `tests/authed_fetch_wajib.test.ts` yang dijanjikan komentar | Penjaga baru butuh keputusan cakupan | Governance | — | Masukkan ke AUD-37 |
| 16 galat lint pra-ada (`setState` dalam effect, 13 berkas) | Pra-ada; terbukti identik di `04c99cb^` | UI/UX | — | Belum punya ID kanonik |
| 30 peringatan Sass `mixed-decls` | Pra-ada, seluruh repo | UI/UX | — | Belum punya ID kanonik |
| Halaman `/dashboard` tanpa remah roti | **Disengaja** — halaman akar, tercatat di komentarnya | — | — | Tidak perlu tindakan |
| 29 dari 39 halaman belum diukur arah tepi kiri | Di luar UX-D1 | UI/UX | — | Lanjutan DS-14 |
| Mode navigasi per peran | Keputusan pemilik produk 25 Agu, punya pemicu | — | — | Tinjau sebelum tenant luar |

---

### WORK LOG

**[00:00] — Baseline**
TASK: UX-D1 · ACTION: gerbang git + membaca dokumen kanonik ·
RESULT: HEAD `04c99cb`, pohon bersih · EVIDENCE: `git status --short` kosong ·
NEXT: pemeriksaan AS-IS

**[00:05] — AS-IS diperiksa ulang, bukan dipercaya dari laporan**
ACTION: membaca `DashboardPage.tsx`, `app/api/dashboard-summary/route.ts`,
`src/features/auth/server/getDashboardSummary.ts` ·
RESULT: pemanggil memakai `/api/dashboard/summary`; route yang ada `/api/dashboard-summary` ·
EVIDENCE: `DashboardPage.tsx:97` vs `app/api/dashboard-summary/route.ts` ·
NEXT: buktikan akibatnya di peramban

**[00:12] — Akar masalah TERBUKTI dua lapis, bukan satu**
ACTION: menjalankan aplikasi, menyadap respons & galat halaman ·
RESULT: `/api/dashboard/summary` → **404 ber-`text/html`**; `response.json()` melempar
**`Uncaught (in promise) SyntaxError: Unexpected token '<'`**; karena lemparan terjadi
SEBELUM `if (!response.ok)`, baris `setSummaryLoading(false)` dan `setSummaryError(...)`
**tidak pernah tercapai** → 4 kerangka selamanya, 0 pesan ·
EVIDENCE: `scratchpad/e2e/uxd1-asis.js`; endpoint kanonik diuji langsung → **200 JSON**
`{"newPoCount":0,"activeSoCount":0,"activeEmployeeCount":0,"belowMinStockCount":0}` ·
NEXT: tentukan kontrak kanonik

**[00:20] — Kontrak kanonik ditetapkan dari bukti repository**
RESULT: **`/api/dashboard-summary` kanonik**. Seluruh 47 route tingkat atas di `app/api`
memakai bentuk **datar bertanda hubung**; bentuk bersarang hanya untuk sub-sumber daya
(mis. `boms/[bomId]/restore`). **Endpoint kedua TIDAK dibuat** untuk menampung salah ketik ·
NEXT: cari pola galat & percobaan-ulang yang sudah ada

**[00:28] — Pola yang sudah ada ditemukan, bukan dikarang**
RESULT: `PpicDashboardPage.tsx:346-369` sudah punya penanganan persis untuk kasus ini,
lengkap dengan kalimat Indonesianya. Kalimat galat **disalin dari sana**, bukan dibuat baru ·
TEMUAN SAMPINGAN: `src/lib/authedFetch.ts` (bersama) memanggil `res.json()` **tanpa**
penangkap galat — cacat laten yang sama. **DICATAT, tidak diperbaiki** (2 pemakai, di luar UX-D1) ·
NEXT: implementasi

**[00:40] — Implementasi pertama, lalu GAGAL saat diverifikasi**
ACTION: alamat diperbaiki + try/catch + `finally` + tombol muat ulang di dalam
`InlineNotification` ·
RESULT: jalur berhasil OK, **jalur galat MERUSAK HALAMAN**: Carbon melempar
`"component should have no interactive child nodes"` → **nol kartu dirender** ·
EVIDENCE: `scratchpad/uxd1-run.log` ·
NEXT: cari komponen Carbon yang benar

**[00:52] — Diperbaiki lewat paket terpasang, bukan ingatan**
RESULT: `useNoInteractiveChildren` di `@carbon/react@1.114.0` memang MELARANG anak
interaktif di `InlineNotification`. Komponen yang benar adalah **`ActionableNotification`**
(`actionButtonLabel` + `onActionButtonClick`), yang memakai
`useInteractiveChildrenNeedDescription` — bukan yang melarang ·
EVIDENCE: `node_modules/@carbon/react/lib/components/Notification/Notification.js:434,662` ·
NEXT: verifikasi ulang lima keadaan

**[01:05] — Pengukurnya sendiri ketahuan salah**
RESULT: pengukur melaporkan `notifikasi: []` untuk keadaan galat, padahal notifikasinya ADA —
ia hanya mencari `.cds--inline-notification` sedangkan Carbon memakai
`.cds--actionable-notification`. **Pengukurnya diperketat di giliran yang sama**, sesuai
aturan "pengawas yang salah tuduh diperbaiki, bukan dibiarkan" ·
NEXT: penjaga regresi

**[01:20] — Penjaga regresi ditulis**
RESULT: `tests/dashboard_summary.test.ts`, 8 uji. Yang terpenting: uji (a) menyisir
**seluruh** `src/features/**` untuk setiap alamat `/api/...` lalu menelusuri pohon `app/api`
sungguhan (paham segmen dinamis `[param]`, menuntut `route.ts`). Ia akan menangkap salah
ketik alamat di halaman **mana pun**, bukan hanya dashboard. 108 alamat unik diperiksa ·
NEXT: buktikan dua arah

**[01:32] — Uji (f) MERAH, dan sebabnya uji saya sendiri**
RESULT: `activeEmployeeCount` 0, diharapkan 1. Fixture karyawan gagal ditulis karena
memakai kolom yang tidak ada (`employee_code`/`full_name`; yang benar `name`, `wage_type`,
`wage_rate`) — dan **galat penulisannya tidak diperiksa**, persis kelas cacat AUD-43.
Diperbaiki beserta pemeriksaan galatnya ·
NEXT: pembuktian dua arah

**[01:40] — Penjaga terbukti berbunyi DUA ARAH**
RESULT: dengan alamat lama dikembalikan sebentar → uji (a) dan (b) **MERAH**; dikembalikan →
**HIJAU**. Berkas dipulihkan utuh ·
NEXT: lint

**[01:50] — Lint naik 28 → 29, dan itu ULAH PERUBAHAN SAYA**
RESULT: `DashboardPage.tsx` muncul dengan "Calling setState synchronously within an effect".
Sebabnya: pemuat dipindah jadi `useCallback`, sehingga setState-nya jadi **terlihat** oleh
linter. Dua percobaan perbaikan gagal; bentuk akhir mengembalikan pemuat **ke dalam effect**
(bentuk yang sama dengan sebelum perbaikan) dan memicu muat-ulang lewat penghitung
`percobaanMuat`. Ditambah pembatalan saat halaman ditinggalkan ·
RESULT AKHIR: **28 masalah (16 galat)** — **persis baseline pra-perubahan**, dan
`DashboardPage` **tidak lagi disebut sama sekali** ·
NEXT: build + suite penuh

**[02:12] — Build & suite**
RESULT: build **✓ Compiled successfully**; suite penuh ****67 berkas · 421 lulus · 7 dilewati · 0 gagal** (naik tepat +1 berkas / +8 uji = penjaga baru)** ·
NEXT: penerimaan + commit

---

