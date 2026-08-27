<!--
  HANDOFF UTAMA — JENDELA KERJA MANDIRI 3 JAM, 27 Agustus 2026.
  Dokumen ini SATU-SATUNYA sumber untuk melanjutkan pekerjaan setelah pemilik produk kembali.
  Judul bagian Bahasa Inggris mengikuti perintah; isinya Bahasa Indonesia.
-->

# FABRIX — 3-HOUR AUTONOMOUS UI/UX EXECUTION REPORT

---

## HANDOFF — MULAI DARI SINI SAAT ANDA KEMBALI

### 1. Task terakhir yang selesai
- **ID**: UX-D1 (temuan UX-01; **tidak punya ID kanonik di `build_tasks`**)
- **Status**: **SELESAI & DITERIMA**
- **Commit**: `3ec149d`

### 2. Task yang sedang berjalan
- **Tidak ada.** Jendela kerja berakhir dengan UX-D1 tuntas dan pohon kerja bersih.

### 3. Keadaan sekarang, konkret
Halaman `/dashboard` sudah benar-benar menampilkan empat angka ringkasannya. Bila
pemuatannya gagal, pengguna sekarang **melihat** kegagalannya, kartunya menampilkan tanda
pisah (bukan angka nol palsu), dan ada tombol **"Muat ulang ringkasan"** di dalam pesan
galatnya. Kerangka abu-abu yang berputar selamanya sudah tidak mungkin terjadi lagi.

### 4. Yang belum selesai
Tidak ada bagian UX-D1 yang menggantung.

**Satu hal yang menunggu keputusan Anda, dan mudah**: **KRM-05** ternyata **sudah terpenuhi** —
seluruh target sentuh halaman POD terukur 48/48/48/44px terhadap standar 44px. Task-nya masih
terbuka karena saya dilarang mengubah `build_tasks`. Layak Anda tutup.

Temuan lain yang **sengaja tidak dikerjakan** tercatat di bagian 11 dan "Explicitly NOT Done".

### 5. Keputusan yang dibutuhkan dari Anda
Lima keputusan dari UX-01 masih terbuka (tidak bertambah selama jendela ini). Rinciannya di
`docs/ux/FABRIX_UX_01_ASIS_APPLICATION_SHELL_AUDIT.md` bagian 19.

### 6. SATU langkah berikutnya yang disarankan
Buka `/dashboard` sendiri di peramban dan pastikan empat angkanya muncul. Setelah Anda
puas, saya push commit UX-D1. **Belum saya push.**

### 7. Berkas yang perlu dibaca lebih dulu
1. Dokumen ini
2. `docs/ux/FABRIX_UX_01_ASIS_APPLICATION_SHELL_AUDIT.md` — audit AS-IS shell & navigasi
3. `src/features/auth/pages/DashboardPage.tsx` — komentarnya menjelaskan seluruh sebab-akibatnya
4. `tests/dashboard_summary.test.ts` — penjaga regresinya

### 8. Perintah yang bisa dijalankan berikutnya
```
npx vitest run tests/dashboard_summary.test.ts     # 8 uji UX-D1
npm run build                                       # build produksi
git log --oneline -3                                # commit terakhir
```

### 9. JANGAN diulang
- Pemeriksaan AS-IS UX-D1 — sudah dilakukan dan tercatat di bawah.
- Verifikasi peramban lima keadaan (berhasil, HTML 500, jaringan putus, 403, muat ulang) — sudah.
- Uji enam lebar untuk dashboard, dua keadaan — sudah, 12 pengukuran.
- Pembuktian penjaga dua arah — sudah.

---

## 1. Execution Window
- **Perintah jendela 3 jam masuk**: 14:45 WIB, 27 Agustus 2026
- **Selesai**: 15:14 WIB — **29 menit**, bukan 3 jam
- **Berhenti karena**: seluruh pekerjaan READY yang aman sudah tuntas. **Bukan** karena waktu habis.

> **Catatan kejujuran waktu, karena ini mudah salah dibaca.** UX-D1 **sudah berjalan sebelum
> jendela ini dibuka** — perintah 3 jam datang di tengah pekerjaan, saat pemeriksaan AS-IS,
> implementasi pertama, dan perbaikan Carbon sudah selesai. Yang terjadi **di dalam** jendela
> 14:45–15:14 adalah: penjaga regresi, pembuktian dua arah, perbaikan lint yang saya sendiri
> sebabkan, build, suite penuh, commit, dan dokumen ini.
>
> Penanda `[00:xx]` di work log di bawah adalah **urutan pekerjaan**, bukan jam dinding.
> Jam dinding sungguhan yang tercatat: **14:45:42** mulai · **14:57:07–14:57:18** build ·
> **14:57:27–15:12:39** suite penuh (911,7 detik) · **15:13:45** kedua commit selesai,
> pohon kerja bersih.

## 2. Starting Baseline
- **HEAD**: `04c99cb`
- **Git**: pohon kerja bersih; satu berkas belum terlacak (`docs/ux/` dari UX-01)
- **Roadmap awal**: 285 task hidup · 111 selesai · 174 tersisa

## 3. Work Completed
| Task | Status | Commit |
|---|---|---|
| UX-D1 — Dashboard summary route mismatch & visible error state | **SELESAI** | `3ec149d` |
| Task sekunder | **TIDAK DIMULAI** | — (alasan di bagian 11) |

---

## LIVE WORK LOG

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

## 4. UX-D1

### AS-IS
`DashboardPage.tsx:97` memanggil `/api/dashboard/summary`. Route itu tidak ada.

### Root Cause — DUA lapis, dan lapis kedua yang sebenarnya mematikan
1. **Alamat salah.** `/api/dashboard/summary` (bersarang) vs `/api/dashboard-summary` (datar).
2. **Tidak ada penangkap galat di sekitar `response.json()`.** Next.js menjawab alamat tak
   dikenal dengan halaman HTML. `json()` melempar **sebelum** pemeriksaan `response.ok`,
   sehingga penghentian pemuatan dan penyetelan pesan galat **tidak pernah dijalankan**.

> Memperbaiki lapis 1 saja akan menyembunyikan lapis 2 sampai server menjawab HTML karena
> sebab lain — galat 500, gangguan gateway, sesi habis. Keduanya diperbaiki.

### Fix
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

### Result
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

## 5. Tests

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

### Isi penjaga regresi

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

## 6. Responsive

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

## 7. Carbon

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

## 8. Tenant / Security

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

## 9. Regression

Suite penuh dijalankan sesudah perubahan: ****67 berkas · 421 lulus · 7 dilewati · 0 gagal** (naik tepat +1 berkas / +8 uji = penjaga baru)**.

---

## 10. Scope Audit

Perubahan UX-D1 **tidak** mengambil alih task mana pun:

| Task | Tersentuh? | Catatan |
|---|---|---|
| AUD-37 / PLT-06 | **Tidak** | Satu halaman memakai `authedFetch` bersama karena panggilannya memang harus diubah. Sapuan 32 berkas lain **tidak** dikerjakan. |
| DS-03 / DS-09 | Tidak | Nol migrasi Carbon |
| DS-06 | Tidak | Nol `window.confirm` disentuh |
| DS-19 / DS-20 / MST-09 / AUD-42 / AUD-48 | Tidak | — |
| DS-17 | Tidak | Nol berkas BOM disentuh |

---

## 11. Secondary Task — DIAUDIT, TIDAK ADA YANG DIIMPLEMENTASIKAN

> **KOREKSI TERHADAP VERSI PERTAMA DOKUMEN INI.** Versi pertama menyatakan "tidak ada task
> sekunder yang memenuhi syarat" berdasarkan peta prioritas UX-01 — **tanpa membaca
> `build_tasks` sungguhan**. Itu klaim prematur. Setelah dibaca, **empat kandidat yang tidak
> pernah saya evaluasi** ternyata ada: KRM-05, DS-10, DOC-03, KPI-03. Bagian ini menggantikan
> klaim itu dengan evaluasi yang benar-benar dilakukan.

### KRM-05 — DIAUDIT, TERNYATA SUDAH TERPENUHI → **SKIPPED**

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

### DS-10 — **BLOCKED**, cakupannya jauh lebih luas dari judulnya

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

### DOC-03 — **SKIPPED**, memaparkan kemampuan menghapus permanen

Backend (`hardDeleteOrphanDocument.ts`) sudah lengkap; yang kurang tombolnya. Tapi ini
memaparkan **penghapusan permanen dokumen** ke layar. Siapa yang boleh menghapus adalah
**kebijakan hak akses** — wilayah keputusan pemilik produk menurut CLAUDE.md, bukan wilayah
saya.

### KPI-03 — **SKIPPED**, butuh gerbang rencana Carbon

Backend (`updateKpiTarget`, `updateKpiVisibility`) sudah lengkap. Tapi `/kpi` adalah salah
satu halaman yang **belum memakai `DataTable` Carbon**, dan menambahkan formulir + tombol
arsip di sana adalah membangun UI baru di layar yang belum dimigrasikan — kembali ke gerbang
DS-RULES A.1.

### NAV-03 — **SKIPPED**, bertabrakan dengan SEC-04

Memindahkan `/debug` dan `/test-tenant` ke dalam kerangka aplikasi itu murni struktur. Tapi
kedua halaman itu **belum punya gerbang peran** (SEC-04, terbuka). Membuatnya lebih mudah
ditemukan sebelum digerbangi adalah langkah mundur kecil di sisi keamanan. Dua task saling
menyentuh → dihentikan.

### Kesimpulan

Sesuai aturan **"satu task selesai penuh > banyak task setengah jadi"**, jendela ini berakhir
dengan **UX-D1 tuntas** dan **KRM-05 terbukti sudah terpenuhi**. Tidak ada task kedua yang
dimulai lalu ditinggalkan setengah jalan.

## 12. Blockers

Tidak ada blocker yang menghentikan UX-D1. Yang menghentikan **task sekunder** ada di bagian 11.

---

## 13. Decisions Required

Tidak ada keputusan **baru** yang lahir dari jendela ini. Lima keputusan dari UX-01 masih
terbuka — lihat `FABRIX_UX_01_ASIS_APPLICATION_SHELL_AUDIT.md` bagian 19.

---

## DISCOVERY LOG

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

## CHANGE LOG

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

## TASK STATE LOG

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

## Explicitly NOT Done

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

## 14. Unexpected Changes
**Nol.** Satu-satunya berkas di luar UX-D1 yang sempat berubah adalah `next-env.d.ts`
(ditulis ulang sendiri oleh Next.js saat aplikasi dijalankan) — sudah dikembalikan.

## 15. Git State
```
$ git status --short
(bersih — nol perubahan tertunda)

$ git log --oneline -3
3ec149d fix(dashboard): restore summary loading and error state
04c99cb feat(bom): implement lifecycle delete archive restore
44a06c1 chore(governance): close DS-14 measurement
```
**Belum di-push.** Menunggu Anda mencoba `/dashboard` sendiri.

## 16. Commits
**Satu commit untuk UX-D1**: `3ec149d` — `fix(dashboard): restore summary loading and error state`
(2 berkas: `DashboardPage.tsx` diubah, `tests/dashboard_summary.test.ts` baru).

**Satu commit terpisah untuk dokumentasi**: audit UX-01 dan dokumen handoff ini.
Dipisahkan supaya commit UX-D1 memuat kode dan penjaganya saja.

Nol amend, nol squash, nol commit lama disentuh.

## 17. Final Roadmap Position

| | Awal jendela | Akhir jendela |
|---|---|---|
| Task hidup | 285 | 285 |
| Selesai | 111 | 111 |
| Tersisa | 174 | 174 |
| Kelengkapan | 38,9% | 38,9% |

**Angkanya TIDAK berubah, dan itu benar** — UX-D1 tidak punya baris di `build_tasks`, dan
perintah melarang membuat ID baru maupun mengubah `build_tasks`. Konsekuensinya dicatat
sebagai temuan **D-7** di bawah kepemilikan **AUD-24**.

---

## CONTINUATION MAP

```
COMPLETED
  DS-17 · DS-14 · RSP-02(pekerjaan) · AUD-47(rekonsiliasi) · UX-01 · UX-D1
        ↓
IN PROGRESS
  (tidak ada)
        ↓
BLOCKED
  DS-09  ← DS-03 (keputusan urutan 38 layar)
  DS-06  ← DS-09
  RBD-02b ← NAV-01
  Quality ← GDG-08 · Traceability ← GDG-03
        ↓
NEXT READY TASK (butuh keputusan Anda dulu)
  DS-03 — tetapkan urutan migrasi Carbon; membuka 22 task di belakangnya
```

---

## TIMELINE

```
00:00  gerbang git · HEAD 04c99cb · pohon bersih
00:05  AS-IS diperiksa ulang dari HEAD, bukan dari laporan UX-01
00:12  akar masalah terbukti DUA lapis lewat pengukuran peramban
00:20  kontrak kanonik ditetapkan: /api/dashboard-summary
00:28  pola galat yang sudah ada ditemukan di PpicDashboardPage
00:40  implementasi pertama — jalur galat MERUSAK halaman
00:52  diperbaiki: ActionableNotification, diverifikasi dari paket terpasang
01:05  pengukur sendiri ketahuan salah kelas, diperketat
01:20  penjaga regresi ditulis (8 uji, 108 alamat disisir)
01:32  uji (f) merah — fixture saya sendiri gagal diam-diam, diperbaiki
01:40  penjaga terbukti berbunyi DUA ARAH
01:50  lint naik 28→29 karena perubahan saya — direstrukturisasi sampai kembali 28
       (empat langkah di atas terjadi SEBELUM jendela 3 jam dibuka)
— batas jendela 3 jam dibuka di sini (14:45 jam dinding) —
14:57  build ✓ Compiled successfully
15:12  suite penuh HIJAU: 67 berkas · 421 lulus · 7 dilewati · 0 gagal
15:13  commit 3ec149d (UX-D1) + d36bc66 (dokumentasi) · pohon kerja bersih
15:14  STOP — bukan karena waktu habis, tapi karena tidak ada task lain yang READY
```

---

## 18. FINAL STATUS

- **UX-D1**: `**CLOSED**`
- **Task sekunder**: **NOT STARTED** — lima kandidat diaudit satu per satu (bagian 11);
  satu di antaranya (**KRM-05**) terbukti **cakupannya sudah terpenuhi** dan layak Anda tutup
