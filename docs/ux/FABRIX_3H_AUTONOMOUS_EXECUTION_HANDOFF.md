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
- UX-D1, DS-17, DS-14, RSP-02 (pekerjaan), AUD-47, KRM-05 — semuanya sudah

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

Temuan jendela 1 (D-1…D-11) tetap berlaku dan tidak diulang di sini.

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
