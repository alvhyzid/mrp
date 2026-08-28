# FABRIX — MASTER UI/UX & PRODUCT SURFACE BASELINE

> **AUDIT SAJA.** Nol perubahan sumber, nol migrasi, nol fixture, nol tulisan ke basis data,
> nol perubahan `build_tasks`. HEAD sebelum audit: **`5ed008e`**.
>
> Data terstruktur: `FABRIX_MASTER_UI_UX_BASELINE.json` · Handoff: `…_HANDOFF.md`

---

## 1. EXECUTIVE SUMMARY

FABRIX punya **39 halaman** (29 di dalam shell, 10 di luar), **122 route API**, **181 modul
server**, **254 kontrol form**, dan **109 overlay**. Seluruh 29 halaman shell dibuka dan
diukur di enam lebar: **174 pengukuran, nol gulir menyamping, nol elemen melewati kedua tepi,
nol galat konsol**.

Tiga hal yang paling menentukan arah kerja berikutnya:

1. **Cacat yang tersisa hampir seluruhnya KELAS, bukan halaman.** Dari 21 temuan, **17
   bersifat lintas halaman**. Mengerjakan halaman satu per satu akan menyentuh kelas yang sama
   berulang kali — itulah sebabnya pola kerja lama menghasilkan 0 dari 22 halaman selesai.
2. **Nol P0.** Tiga kegagalan diam di jalur menulis diperiksa satu per satu: ketiganya membuat
   layar **tidak berubah** saat gagal, bukan menampilkan berhasil palsu. Tidak ada data yang
   hilang diam-diam. Menyebutnya P0 akan melebih-lebihkan.
3. **Empat dari sepuluh keputusan bisnis MEMBLOKIR** empat workstream. Enam workstream lain
   **bisa jalan hari ini tanpa menunggu siapa pun**.

**Yang paling mahal dari audit ini bukan daftar temuannya, melainkan pemetaan mana yang bisa
paralel.** Enam workstream dapat berjalan bersamaan; empat menunggu keputusan.

## 2. CURRENT BASELINE

| | Nilai | Sumber | Keyakinan |
|---|---|---|---|
| HEAD | `5ed008e` | git | TINGGI |
| Pohon kerja | bersih (kecuali `docs/00-GOVERNANCE/` untracked, sudah ada sebelumnya) | git | TINGGI |
| Task | **326** total · **115** selesai · **35,3%** | `build_tasks` baca-saja | TINGGI |
| UI Revision | **0 dari 22** | Definition of Done | TINGGI |
| Uji | **79** berkas · **535** kasus | filesystem | TINGGI |

## 3. ROUTE INVENTORY

| Jenis | Jumlah |
|---|---|
| Route halaman (`app/**/page.tsx`) | **39** |
| — di dalam shell | 29 |
| — di luar shell (publik, cetak, debug) | 10 |
| — dinamis (`[param]`) | 2 |
| Route API (`app/api/**/route.ts`) | **122** |
| Layout | 29 |
| Berkas halaman fitur (`src/features/**/pages`) | **39** |
| **Halaman fitur tanpa route** | **0** |

**Nol route mati, nol UI tanpa route, nol route dikarang.** Setiap berkas halaman punya route,
dan setiap route menunjuk berkas yang ada.

> **METODE**: enumerasi filesystem. **BATAS**: route yang disembunyikan oleh peran tetap
> terhitung "ada" — daftar ini menjawab *apa yang ada*, bukan *apa yang terlihat oleh peran
> tertentu*.

## 4. PAGE INVENTORY

29 halaman shell, seluruhnya terbuka dan terukur:

`/ai-project` `/ai-readiness` `/attendance` `/boms` `/build-tasks` `/company`
`/company/setelan` `/customer-purchase-orders` `/customers` `/dashboard` `/documents` `/hr`
`/items` `/kamus` `/kpi` `/kpi/saya` `/operating-profit` `/ppic` `/process-mining`
`/production` `/profile` `/purchasing` `/routing` `/sales-orders` `/shipments` `/team`
`/warehouse` `/whats-new` `/work-orders`

10 non-shell: `/login` `/register` `/forgot-password` `/reset-password` `/invite/accept`
`/pod/[token]` `/debug` `/test-tenant` `/shipments/[id]/surat-jalan` `/(public)`

## 5. CAPABILITY MATRIX

| Golongan | Jumlah |
|---|---|
| **A** — UI + backend | **109** route |
| **C** — backend tanpa UI | **13** route |
| Modul server | 181 |

**Tiga entitas yang SELURUH rutenya tanpa UI** — ini golongan C paling murni, dan pelajaran
langsung dari kasus yang sudah menggigit sekali:

| Entitas | Route | Metode |
|---|---|---|
| `customer-delivery-addresses` | 3 | GET, POST, PATCH, DELETE (+ restore) |
| `document-signatures` | 1 | POST |
| `stock-alerts` | 1 | POST (refresh) |

Sepuluh route golongan C lainnya tersebar di entitas yang **punya** layar — mis.
`/api/work-orders/status`, `/api/work-orders/reopen`, `/api/kpi/[id]/target`.

## 6. CRUD / LIFECYCLE MATRIX

50 entitas diturunkan dari segmen pertama route API. Yang punya siklus hidup eksplisit:

| Entitas | Siklus hidup yang ada | Punya UI? |
|---|---|---|
| `customers` · `routings` · `suppliers` | archive · restore | ya |
| `boms` | restore (hapus/arsip lewat DS-17) | ya |
| `production-batches` | start · complete | ya |
| `shipments` | dispatch | ya |
| `customer-purchase-orders` | approve | ya |
| `attendance` | decide ×2 | ya |
| `kamus` | confirm | ya |
| `pod` | confirm | ya |
| **`work-orders`** | **reopen — nol pemanggil UI** | sebagian |
| **`customer-delivery-addresses`** | **restore — nol pemanggil UI** | **tidak** |

## 7. FORM INVENTORY

| | Nilai |
|---|---|
| Halaman berkontrol form | **28** |
| Total kontrol | **254** |
| `invalidText` | **14** |
| `InlineNotification` | **110** |
| `aria-*` ditulis tangan | **0** |
| Halaman memakai `<form>` sungguhan | 8 |
| Formulir bertahap (`PenandaLangkah`/`FooterBertahap`) | **4** halaman |

**14 dari 254 kontrol punya galat tingkat field.** Angka itu naik dari 5 lewat dua pilot
DS-25; sisanya belum.

## 8. MODAL / OVERLAY INVENTORY

**109 overlay di 22 berkas.**

| Jenis | Jumlah |
|---|---|
| `Dropdown` | 82 |
| `ComposedModal` | 18 |
| `Modal` | 7 |
| `Toggletip` | 2 |
| `Tooltip` · `OverflowMenu` · `Popover` | **0** |

**Nol `Tooltip` dan nol `OverflowMenu`** layak dicatat: aturan bantuan-klik memang melarang
tooltip hover, dan ketiadaan `OverflowMenu` sejalan dengan temuan F-09 (nol aksi massal).

## 9. CARBON AUDIT

**49 jenis komponen Carbon, 1.291 pemakaian.**

Elemen mentah yang tersisa di berkas halaman:

| Elemen | Jumlah | Vonis |
|---|---|---|
| `<h2>` `<h3>` `<h4>` | 50 · 12 · — | **BUKAN pelanggaran** — judul bagian yang sah |
| `<h1>` | 6 | 5 di cabang penolakan akses + 1 halaman cetak |
| `<form>` | 8 | sah — Carbon tidak mewajibkan komponen `Form` |
| `<input>` | **3** | pelanggaran |
| `<button>` | **2** | pelanggaran |
| `<table>` | **2** | pelanggaran (sebagian pengecualian tercatat) |

> **PERINGATAN PENGUKURAN**: memasukkan `<h2>`–`<h4>` ke daftar "elemen mentah" akan
> melahirkan 62 pelanggaran palsu. Judul memang ditulis sebagai tag.

## 10. RESPONSIVE AUDIT

**174 pengukuran** (29 halaman × 6 lebar: 360/672/768/1280/1440/1920).

| Yang diukur | Hasil |
|---|---|
| Gulir menyamping | **0** |
| Elemen melewati tepi kanan | **0** |
| Elemen melewati tepi kiri | **0** |
| Galat konsol | **0** |
| Pengukuran bersih penuh | **162 dari 174** |
| Halaman ditandai | **2** (`/company`, `/profile`) — seluruhnya soal nama tombol, bukan tata letak |

**UNABLE TO VERIFY**: 10 halaman non-shell tidak diukur. Data tenant uji sebagian kosong, jadi
beberapa tabel diukur dalam keadaan kosong — keadaan berisi belum tentu sama.

## 11. ACCESSIBILITY AUDIT

| Yang diperiksa | Hasil |
|---|---|
| `<main>` | **29 dari 29** |
| Skip-link | **29 dari 29** |
| Tepat satu `<h1>` | **174 dari 174** pengukuran |
| Lompatan tingkat judul | **0** |
| Input tanpa label | **0** |
| **Tombol tanpa nama aksesibel** | **3** |
| Tombol lebih pendek dari 40px | 348 kemunculan |

**UNABLE TO VERIFY**: kontras warna, urutan Tab, perangkap fokus dialog, dan pengumuman
pembaca layar — tidak diukur di batch ini.

## 12. STATE MATRIX

| Keadaan | Cakupan |
|---|---|
| Memuat | 37 dari 39 halaman |
| Kosong | 25 dari 39 halaman |
| Penjaga izin | 19 dari 39 halaman |
| **Kegagalan yang tidak terlihat** | **32 titik di 13 halaman** |
| — di jalur **menulis** | **3** |
| — di jalur membaca | 29 |

Ketiga jalur menulis diperiksa satu per satu: `AiProjectDashboardPage:107` (snapshot),
`ItemsPage:452` dan `PurchasingPage:515` (hapus harga supplier). **Ketiganya membuat layar
tidak berubah saat gagal** — tidak ada yang tampak berhasil padahal gagal.

## 13. VALIDATION AUDIT

| | Nilai |
|---|---|
| Modul server berpesan 4xx | **145** |
| Golongan **A** (bisa jadi galat field) | **90** |
| Golongan **B/C** (memang tingkat formulir) | **519** |
| Modul sudah memakai kontrak bersama | **2** |

> **REKONSILIASI ANGKA**: batch DS-25 melaporkan *"114 A di 59 modul"*. Pengukur waktu itu
> hanya mengenali objek mentah `body: { error: '…' }` dan memakai penyaring kata yang lebih
> longgar. Pengukur sekarang mengenali **tiga bentuk** (objek mentah, pembangun bertipe, dan
> modul validasi murni) dan penyaring yang lebih ketat: **90 A di 145 modul**. Angka lama
> **tidak salah untuk metodenya**, tetapi metodenya lebih sempit. Yang berlaku sekarang: 90.

**85% pesan validasi memang sudah benar di tingkat formulir.**

## 14. ACTION / STATUS MATRIX

| Temuan | Jumlah |
|---|---|
| Route tanpa pemanggil UI | **13** |
| Entitas tanpa layar sama sekali | **3** |
| Aksi status ada di server, nol tombol di UI | `/api/work-orders/status`, `/api/work-orders/reopen` |

`/work-orders` menawarkan saringan **"Dijeda"** dan **"Batal"** untuk keadaan yang **tidak
bisa dihasilkan siapa pun** dari layar. Ini kejadian **keempat** dari kelas yang CLAUDE.md
sudah catat tiga kali.

## 15. DUPLICATION AUDIT

| Pola | Keadaan |
|---|---|
| Kepala halaman + breadcrumb | **30 halaman** lewat `KepalaHalaman` — terpusat |
| Peta label/status | **10 kelompok ganda** — disalin |
| `window.confirm` | **6** di 4 halaman — belum lewat modal Carbon |
| Notifikasi | `AreaNotifikasi` hanya di **7 dari 39** halaman |
| Bantuan kontekstual | `FieldLabel` 2 · `ProvenanceInfoButton` 17 — dua jalur |
| Kontrak galat field | **2 modul** memakai `src/lib/kontrakGalatField.ts` |

## 16. UX DEBT REGISTER

**21 temuan. Nol P0. Delapan P1, sembilan P2, empat P3. 17 dari 21 bersifat KELAS.**

| ID | Sev | Golongan | Temuan | Tingkat |
|---|---|---|---|---|
| UX-AUDIT-0001 | **P1** | ACCESSIBILITY | 3 tombol unggah gambar tanpa nama aksesibel | kelas |
| UX-AUDIT-0002 | **P1** | CORRECTNESS | 32 kegagalan tak terlihat (3 di jalur menulis) | kelas |
| UX-AUDIT-0003 | **P1** | ARCHITECTURE | 13 route tanpa UI; 3 entitas tanpa layar | kelas |
| UX-AUDIT-0004 | **P1** | CORRECTNESS | Aksi status WO tanpa UI, saringannya ada | halaman |
| UX-AUDIT-0005 | **P1** | VALIDATION | 90 galat golongan A masih tingkat formulir | kelas |
| UX-AUDIT-0006 | **P1** | ACCESSIBILITY | Dropdown Carbon nol `aria-invalid` | kelas |
| UX-AUDIT-0007 | **P1** | USABILITY | 6 `window.confirm` tersisa | kelas |
| UX-AUDIT-0008 | **P1** | CONSISTENCY | 5 cabang penolakan menulis judul sendiri | kelas |
| UX-AUDIT-0009 | P2 | TECHNICAL_DEBT | 10 peta label disalin | kelas |
| UX-AUDIT-0010 | P2 | CONSISTENCY | Elemen mentah: 3 input, 2 button, 2 table | kelas |
| UX-AUDIT-0011 | P2 | CONSISTENCY | `AreaNotifikasi` 7 dari 39 halaman | kelas |
| UX-AUDIT-0012 | P2 | VALIDATION | Validator berhenti di galat pertama | kelas |
| UX-AUDIT-0013 | P2 | GOVERNANCE | Tiga mekanisme bantuan bersaing | keputusan |
| UX-AUDIT-0014 | P2 | USABILITY | 14 halaman tanpa keadaan kosong terdeteksi | kelas |
| UX-AUDIT-0015 | P2 | USABILITY | 2 halaman tanpa keadaan memuat | kelas |
| UX-AUDIT-0016 | P2 | ARCHITECTURE | Nama field lintas batas dijaga di 2 modul saja | kelas |
| UX-AUDIT-0017 | P2 | RESPONSIVENESS | 348 tombol < 40px — **perlu tinjauan per kasus** | kelas |
| UX-AUDIT-0018 | P3 | ACCESSIBILITY | Halaman cetak tanpa `h1` | halaman |
| UX-AUDIT-0019 | P3 | CARBON | `FileUploader` memaku `h3` | kelas |
| UX-AUDIT-0020 | P3 | TECHNICAL_DEBT | Penjaga judul memeriksa himpunan, bukan urutan | kelas |
| UX-AUDIT-0021 | P3 | RESPONSIVENESS | 10 halaman non-shell belum pernah diukur | kelas |

## 17. DEPENDENCY GRAPH

```
KEPUTUSAN BISNIS                    WORKSTREAM                       HALAMAN
─────────────────                   ──────────                       ───────
DEC-01 field wajib ────membatasi──▶ B validation ──kelas──▶ 28 halaman berform
DEC-02 bantuan kanonik ──BLOKIR───▶ F forms      ──kelas──▶ 19 halaman
DEC-03/04 confirm ───────BLOKIR───▶ E carbon     ──kelas──▶ 4 halaman
DEC-06/07 entitas & WO ──BLOKIR───▶ I lifecycle  ──────────▶ /work-orders + 3 entitas
                                    A correctness ─────────▶ 13 halaman   [BISA JALAN]
                                    C a11y        ─────────▶ 2 + semua    [BISA JALAN]
                                    D responsive  ─────────▶ 10 halaman   [BISA JALAN]
                                    G tables      ─────────▶ —            [BISA JALAN]
                                    H shell       ─────────▶ —            [BISA JALAN]
                                    J page UX     ─────────▶ 14 halaman   [BISA JALAN]
```

**Satu urutan yang benar-benar SEQUENTIAL**: sensus "modul mana yang punya layar" harus
mendahului rollout validasi modul ketiga. Tanpa itu, pekerjaannya menghasilkan sesuatu yang
tidak bisa diverifikasi siapa pun — persis yang hampir terjadi dua batch lalu.

## 18. PARALLEL WORKSTREAMS

| Stream | Isi | Temuan | Usaha | Risiko regresi | Mulai sekarang? |
|---|---|---|---|---|---|
| **A** correctness/data | kegagalan diam, aksi/status | 0002, 0004 | M | SEDANG | **YA** |
| **B** validation | rollout kontrak galat field | 0005, 0012, 0016 | XL | SEDANG | **YA** (lebar dibatasi DEC-01) |
| **C** accessibility | nama tombol, aria Dropdown | 0001, 0006, 0018 | **S** | RENDAH | **YA** |
| **D** responsive | 10 halaman non-shell, target sentuh | 0017, 0021 | M | RENDAH | **YA** |
| **E** carbon | `window.confirm`, elemen mentah | 0007, 0010, 0019 | M | SEDANG | tidak — DEC-03/04 |
| **F** forms | notifikasi, bantuan kontekstual | 0011, 0013 | L | SEDANG | tidak — DEC-02 |
| **G** tables | kemampuan DataTable | — | S | RENDAH | **YA** |
| **H** navigation/shell | — | — | XS | RENDAH | **YA** |
| **I** lifecycle/actions | entitas tanpa layar, status WO | 0003, 0004 | L | **TINGGI** | tidak — DEC-06/07 |
| **J** page-specific UX | judul cabang penolakan, keadaan kosong | 0008, 0014, 0015 | L | RENDAH | **YA** |

**Enam dari sepuluh bisa jalan hari ini.**

## 19. PAGE READINESS

Tidak ada halaman berstatus **READY**: setiap halaman bergantung pada minimal satu kelas yang
belum tuntas (validasi, kegagalan diam, atau notifikasi).

| Status | Jumlah | Keterangan |
|---|---|---|
| READY | **0** | — |
| **READY WITH CLASS DEPENDENCY** | **27** | terukur bersih; menunggu kelas |
| BLOCKED | **2** | `/work-orders` (DEC-07), `/company`+`/profile` untuk a11y |
| NOT AUDITED | **10** | halaman non-shell |
| NOT APPLICABLE | 1 | halaman cetak surat jalan |

> **Ini angka yang paling mudah disalahbaca.** "27 READY WITH CLASS DEPENDENCY" **bukan**
> "27 hampir selesai". Artinya: tidak ada lagi cacat khusus halaman itu yang menghalangi —
> yang tersisa adalah kelas yang dibagi bersama halaman lain.

## 20. PAGE QUALITY

Cacat yang **khusus satu halaman** (bukan kelas) hanya ada di tiga halaman:

| Halaman | P1 | P2 | P3 | Cacat khusus halaman |
|---|---|---|---|---|
| `/work-orders` | 1 | — | — | aksi status tanpa UI (0004) |
| `/company` | 1 | — | — | tombol logo tanpa nama (0001) |
| `/profile` | 1 | — | — | dua tombol foto/tanda tangan tanpa nama (0001) |
| 26 halaman lain | — | — | — | **nol cacat khusus halaman** |

**Inilah temuan struktural terpenting audit ini**: 26 dari 29 halaman shell **tidak punya
cacat miliknya sendiri**. Seluruh sisanya kelas.

## 21. REFERENCE IMPLEMENTATIONS — apa yang SUDAH ada

| Rujukan | Ada? | Di mana |
|---|---|---|
| Shell aplikasi | **YA** | `AppShellCarbon.tsx` |
| Kepala halaman + breadcrumb | **YA** | `KepalaHalaman`, 30 halaman |
| Halaman daftar | **YA** | cetakan dari `/items` |
| Formulir halaman penuh (D-A) | **YA** | `/company/setelan` |
| Modal bertahap | **YA** | `PenandaLangkah`/`FooterBertahap`, 4 halaman |
| Baris berulang (D-B) | **YA** | `/routing`, `/boms` |
| Aksi merusak | **SEBAGIAN** | 10 halaman; 6 `window.confirm` tersisa |
| Validasi field | **YA** | `/purchasing`, `/warehouse` + `kontrakGalatField.ts` |
| Keadaan kosong dua jalan keluar | **YA** | `/work-orders` |
| Notifikasi | **SEBAGIAN** | `AreaNotifikasi`, 7 halaman |
| Panel detail | **YA** | `/items` (MST-16) |
| **Keadaan galat halaman penuh** | **TIDAK** | belum ada rujukan |
| **Aksi massal / pilih banyak baris** | **TIDAK** | nol di seluruh aplikasi (F-09) |

## 22. BUSINESS DECISIONS

| ID | Pertanyaan | Memblokir | Rekomendasi |
|---|---|---|---|
| **DEC-01** | Field mana yang wajib diisi secara bisnis, dan kalimat penolakannya? | **YA** — lebar STREAM B | tetapkan bertahap saat tiap modul disentuh |
| **DEC-02** | Mekanisme bantuan kontekstual mana yang kanonik? | **YA** — STREAM F | `FieldLabel` untuk bantuan field; `ProvenanceInfoButton` tetap untuk asal-usul angka |
| **DEC-03** | `window.confirm` disapu sekarang atau ikut migrasi halaman? | **YA** — STREAM E | sapu sekarang, hanya 6 titik |
| **DEC-04** | `DS-06` atau `AUD-47` yang memiliki konfirmasi merusak? | **YA** — STREAM E | `DS-06`; `AUD-47` ditutup duplikat |
| **DEC-05** | Nomor mana untuk F-01/F-11? | tidak | `DS-23`, sesuai usulan rekonsiliasi |
| **DEC-06** | Tiga entitas tanpa layar: dibangun, dicabut, atau dibiarkan? | **YA** — STREAM I | putuskan per entitas |
| **DEC-07** | Siapa boleh menjeda/membatalkan Work Order, dan apakah UI-nya dibangun? | **YA** — STREAM I | bangun UI; servernya sudah lengkap |
| **DEC-08** | `DI_LUAR_AREA` dihitung hadir? | tidak | — |
| **DEC-09** | Keunikan supplier: nama atau kode? | tidak | — |
| **DEC-10** | Di mana keputusan mengikat disimpan (CONFLICT-2)? | tidak | CLAUDE.md untuk ATURAN, `build_tasks` untuk PEKERJAAN |

## 23. REGRESSION INVENTORY

**79 berkas uji, 535 kasus.** Penjaga per kelas:

| Kelas | Penjaga ada? |
|---|---|
| Hierarki judul | **YA** — 6 uji |
| Validasi field | **YA** — 17 + 12 uji, dua modul |
| Elemen mentah | **YA** |
| Responsif / dua tepi | **YA** |
| Migrasi (kurung, tenant literal) | **YA** |
| Jalur baca tidak menulis | **YA** |
| **Kegagalan diam** | **TIDAK** |
| **Nama aksesibel tombol** | **TIDAK** |
| **Aksi status tanpa UI** | **TIDAK** |
| **Route tanpa pemanggil UI** | **TIDAK** |

**Empat kelas P1 tidak punya penjaga sama sekali.** Selama itu, perbaikannya bisa mundur tanpa
ada yang berbunyi.

## 24. DATA SAFETY

| | |
|---|---|
| Mutasi production | **0** |
| Perubahan `build_tasks` | **0** |
| Migrasi dibuat | **0** |
| Fixture dibuat | **0** |
| Perubahan sumber | **0** |
| Permintaan non-GET dari peramban | **0** — penghadang terpasang dan **tidak pernah perlu berbunyi** |

Basis data hanya **dibaca** (`select` ke `build_tasks`).

## 25. GOVERNANCE CONFLICTS

| ID | Isi | Status |
|---|---|---|
| CONFLICT-1 | `window.confirm`: sapu sekarang vs ikut migrasi | menunggu keputusan |
| CONFLICT-2 | Tiga rumah untuk keputusan mengikat | menunggu keputusan |
| CONFLICT-3 | `DS-06` vs `AUD-47` duplikat | menunggu keputusan |
| CONFLICT-4 | Model kepemilikan governance vs otonomi CLAUDE.md | menunggu keputusan |
| **DS-23** | dicadangkan untuk F-01/F-11, belum dijawab | menunggu keputusan |

**Nol konflik baru ditemukan audit ini.**

## 26. HISTORICAL / RECONCILED METRICS

| Angka | Nilai lama | Sumber & tanggal | Nilai sekarang | Vonis |
|---|---|---|---|---|
| Halaman | 39 | Master Plan | **39** | cocok |
| Halaman shell diukur | 29 × 6 = 174 | Master Plan | **174** | cocok |
| Kelengkapan roadmap | 38,9% → 39,3% | handoff 3H | **35,3%** | **berbeda metode** — angka lama memakai pembagi "task hidup"; sekarang selesai/total |
| Galat golongan A | 114 di 59 modul | DS-25 | **90 di 145 modul** | **direkonsiliasi** — pengukur lama lebih sempit (satu bentuk pesan) |
| Kontrol form | 237 (9 jenis) | DS-25 | **254** (16 jenis) | **berbeda cakupan**, bukan berubah |
| `invalidText` | 5 | sapuan | **14** | naik lewat dua pilot |
| Cacat matriks kualitas | 300 | Master Plan | **21 temuan** | **beda satuan** — 300 = sel matriks 12 dimensi × 39 halaman; 21 = temuan yang bisa ditindaklanjuti |
| UI Revision | 0/22 | seluruh dokumen | **0/22** | cocok |

**Dokumen usang yang teridentifikasi**: `FABRIX_DS23_*` (dua berkas, sudah ditandai
digantikan). Tidak ada yang dihapus.

## 27. RECOMMENDED EXECUTION ORDER

1. **STREAM C (accessibility)** — usaha **S**, risiko **RENDAH**, tidak menunggu siapa pun,
   dan menutup satu-satunya P1 yang khusus halaman. **Batch terkecil dengan hasil terbesar.**
2. **STREAM A (correctness)** — kegagalan diam 32 titik + penjaganya, yang belum ada.
3. **STREAM B (validation)** — didahului **sensus modul mana yang punya layar** (SEQUENTIAL).
4. **STREAM D, G, H, J** — bisa berjalan paralel dengan 1–3.
5. **STREAM E, F, I** — menunggu DEC-02/03/04/06/07.

## 28. KNOWN UNKNOWNS

1. **10 halaman non-shell** belum pernah diukur responsif maupun aksesibilitas.
2. **Kontras warna, urutan Tab, perangkap fokus dialog** — tidak diukur.
3. **Halaman dalam keadaan BERISI** — tenant uji sebagian kosong; tabel diukur kosong.
4. **Peran selain satu akun uji** — 16 peran dikenal sistem, satu yang dipakai mengukur.
5. **Penggolongan A/B/C per pesan** — 90 adalah batas atas dari penyaring kata, bukan vonis.
6. **Apakah 348 tombol < 40px benar-benar sulit ditekan** — butuh tinjauan per kasus.
7. **Modul mana dari 143 sisanya yang punya layar** — sensusnya belum ada.

## 29. HANDOFF

Lihat `FABRIX_MASTER_UI_UX_BASELINE_HANDOFF.md`.
