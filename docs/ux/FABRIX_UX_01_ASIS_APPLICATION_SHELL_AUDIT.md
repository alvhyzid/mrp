<!--
  UX-01 — AUDIT AS-IS APPLICATION SHELL & NAVIGATION
  Dibuat 27 Agu 2026 oleh Claude Code atas perintah pemilik produk.

  SIFAT DOKUMEN: BUKTI, bukan keputusan. Tidak ada satu pun perubahan kode, route,
  komponen, database, atau build_tasks yang dilakukan saat menyusunnya.

  Judul bagian memakai Bahasa Inggris karena begitu ditetapkan di perintah UX-01.
  Isinya Bahasa Indonesia karena yang membacanya pemilik produk.
-->

# FABRIX UX-01
# APPLICATION SHELL & NAVIGATION AS-IS AUDIT

**Tanggal**: 27 Agustus 2026 · **HEAD**: `04c99cb` · **Sifat**: AS-IS + GAP, nol implementasi

---

## 1. Executive Summary

Kerangka aplikasi FABRIX **jauh lebih matang daripada yang diduga**, dan masalahnya bukan
di kerangka melainkan di **isi yang belum ada** dan di **pola bersama yang belum merata**.

Yang terukur:

| Ukuran | Angka |
|---|---|
| Route yang benar-benar ada | **39** |
| Berkas halaman | **39** |
| Workspace navigasi | **15** + 2 menu akun |
| Item navigasi | **104** |
| Item navigasi berstatus aktif | **28** (27%) |
| Item berstatus belum ada | **51** (49%) |
| href navigasi yang rutenya tidak ada | **NOL** |
| Pengukuran responsive (10 halaman × 6 lebar) | **60** |
| Cacat gulir menyamping / tepi kanan / tepi kiri | **NOL dari 60** |
| Pengawas UI yang lulus | **6 berkas, 33 uji, semua hijau** |

**Tiga temuan yang paling perlu dibaca:**

1. **Halaman pertama yang dilihat setiap pengguna rusak diam-diam.** `/dashboard` memanggil
   `/api/dashboard/summary`, sementara route yang ada bernama `/api/dashboard-summary`
   (tanda hubung, bukan garis miring). Empat kartu ringkasannya **berhenti selamanya di
   keadaan memuat** — diukur pada 2 detik dan 6 detik, tetap 4 kerangka abu-abu, **nol
   pesan galat yang terlihat**. Kodenya menangkap galatnya ke dalam state, tapi tidak
   pernah menampilkannya.

2. **Notifikasi punya dua jalur hidup.** Komponen bersama `AreaNotifikasi` dipakai
   **6 dari 39 halaman**, sedangkan `InlineNotification` ditulis langsung di **37 berkas,
   124 kemunculan**. Aturan Pola Unggah Gambar butir 6 menetapkan satu tempat bersama;
   kenyataannya jalur keduanya jauh lebih besar.

3. **Data pengguna diambil sendiri-sendiri di 32 berkas.** `supabase.auth.getSession`
   dipanggil langsung di 32 halaman, sementara `authedFetch` bersama baru dipakai 12.
   Ini persis kelas cacat "kebetulan benar" yang sudah tercatat di CLAUDE.md, dan sudah
   punya dua task: **AUD-37** dan **PLT-06**.

Yang **tidak** ditemukan, dan itu kabar baik: nol menu yang menunjuk halaman fiktif, nol
gulir menyamping di lebar mana pun, nol elemen keluar tepi kiri maupun kanan, dan seluruh
pengawas UI yang sudah dibangun masih hijau.

---

## 2. Baseline Used

Dokumen rujukan yang dipakai, seluruhnya sudah ada di repository:

| Dokumen | Peran |
|---|---|
| `docs/FABRIX_UX_Information_Architecture_v1_0.md` | Target 15 workspace & sitemap |
| `docs/FABRIX_UX_Application_Shell_Navigation_Architecture_v1_0.md` | Spesifikasi shell & navigasi |
| `docs/FABRIX_CARBON_DESIGN_GOVERNANCE.md` | Aturan Carbon |
| `docs/FABRIX-Carbon-UX-Governance/` (16 berkas) | Metodologi audit, register ID kanonik |
| `docs/governance/rujukan-carbon.md` · `cetakan-halaman-data.md` · `design-debt.md` | Cetakan & utang desain |
| `docs/ar0-inventaris-as-is.md` · `docs/nav-matriks-status-dan-konflik.md` | Sumber status navigasi |
| `CLAUDE.md` | Keputusan yang MENGIKAT |

### Temuan pada baseline itu sendiri — DUPLIKAT NAMA, bukan konflik isi

Tiga pasang dokumen arsitektur ada **dua kali** di `docs/`, keduanya terlacak git:

| Pasangan | Beda |
|---|---|
| `..._Application_Shell_Navigation_Architecture_v1.0.md` vs `..._v1_0.md` | 13 baris |
| `..._Information_Architecture_v1.0.md` vs `..._v1_0.md` | 13 baris |
| `..._Sales_Technical_Architecture_Fable5_v0.1.md` vs `..._v0_1.md` | 13 baris |

Diperiksa: **selisihnya HANYA blok komentar asal-usul 13 baris** yang ada di versi
garis-bawah. Isi arsitekturnya identik. Jadi ini **bukan konflik canonical** dan audit
tidak dihentikan.

**Tetapi ini tetap berbahaya, dan sebabnya ada di dalam komentar itu sendiri.** Blok yang
hanya ada di versi garis-bawah berbunyi: *"Status: DOKUMEN RUJUKAN, bukan keputusan yang
sudah berlaku … Beberapa bagian dokumen ini SUDAH DIBATALKAN pemilik produk."* Siapa pun
yang membuka versi bertitik mendapat arsitekturnya **tanpa peringatan itu**, dan bisa
memperlakukannya sebagai mengikat.

**Canonical = versi GARIS-BAWAH**, karena itulah yang dirujuk `CLAUDE.md`.

---

## 3. Repository Evidence

```
app/                    39 page.tsx · 110 route.ts (API)
src/features/           17 domain · 39 berkas halaman · 4 berkas komponen
src/components/ui/      16 komponen bersama
src/features/navigasi/  navConfig.ts (356 baris) · AppShellCarbon.tsx (363 baris)
tests/                  6 pengawas UI, 33 uji, semua hijau
```

Navigasi hidup di **berkas TypeScript bertipe**, bukan tabel database — keputusan tercatat
di kepala `navConfig.ts`, dengan alasan bahwa navigasi per-tenant belum punya pemakai.

Penjaganya nyata: `tests/nav_status_jujur.test.ts` membandingkan setiap `href` dengan route
yang benar-benar ada di App Router.

---

## 4. Running Application Evidence

Aplikasi **dijalankan sungguhan** (`npm run dev`), masuk sebagai `company.b@debug.mrp`
(tenant uji, company_id 2). **Nol data dibuat, nol data diubah** — audit ini hanya membaca.

10 halaman × 6 lebar = **60 pengukuran**, ditambah pemeriksaan shell terpisah di 1440px dan
360px. Tangkapan layar tersimpan (lihat bagian 22).

> **PT ITM tidak disentuh sama sekali.** Aturan CLAUDE.md: verifikasi manual hanya di tenant
> uji, sekalipun tindakannya terasa "hanya melihat".

---

## 5. Global Shell Audit

Diukur langsung dari DOM pada `/items`, 1440px dan 360px.

| # | Komponen | Ada | Berfungsi | Terverifikasi | Bukti | Status |
|---|---|---|---|---|---|---|
| A | Global Header | Ya | Ya | Ya | `.cds--header` ada di seluruh halaman shell | 🔵 |
| B | Konteks Produk/Perusahaan | Ya | Ya | Ya | `.cds--header__name` = "FABRIX Company B" | 🔵 |
| C | Global Search | **Tidak** | — | Ya | Nol `.cds--header__search`, nol input pencarian di header | 🔴 |
| D | Command Palette | **Tidak** | — | Ya | Nol kode terkait di shell | 🔴 |
| E | Quick Create | Ya | Sebagian | Ya | Satu tombol `+` → `/customer-purchase-orders`; **bukan menu**, hanya satu tujuan | 🟡 |
| F | Notifications | Ya | Ya | Ya | `NotificationBell` di header; **halaman notifikasi belum ada** | 🟡 |
| G | Task / Approval Center | **Tidak** | — | Ya | Nav menandainya `sebagian`: persetujuan PO klien ada di halamannya sendiri | 🟡 |
| H | Help | **Tidak** | — | Ya | Nol aksi bantuan di `HeaderGlobalBar` (4 aksi: Notifikasi, Buat PO klien, Menu akun, Keluar) | 🔴 |
| I | User Menu | Ya | Ya | Ya | `UserAvatar` + nama + label peran + `HeaderPanel`/`Switcher` | 🔵 |
| J | Left Navigation | Ya | Ya | Ya | `.cds--side-nav`, 16 simpul tingkat atas | 🔵 |
| K | Workspace Navigation | Ya | Ya | Ya | 15 workspace + 2 menu akun, 104 item | 🔵 |
| L | Breadcrumb | Ya | Ya | Ya | `.cds--breadcrumb` di 9 dari 10 halaman yang diuji; contoh: Dashboard / Product & Engineering / Items | 🟢 |
| M | Page Header | Ya | Ya | Ya | `KepalaHalaman` bersama dipakai **30 dari 39** halaman | 🟢 |
| N | Tabs | **Tidak** | — | Ya | Nol `.cds--tabs` di 10 halaman yang diuji | 🔴 |
| O | Contextual Action Bar | Sebagian | Sebagian | Ya | Aksi ada di `TableToolbar` per halaman, bukan sebagai bilah kontekstual global | 🟡 |
| P | Right Context Panel | **Tidak** | — | Ya | Nol `.cds--side-panel`; rincian memakai baris yang dimekarkan | 🔴 |

**Aksesibilitas kerangka**: `SkipToContent` **ADA** dan menunjuk `#main-content` yang
benar-benar ada. Ini syarat Carbon yang sering terlewat, dan di sini terpenuhi.

**Perilaku layar sempit di 360px, diukur sungguhan:**
- Side nav **tidak terlihat** secara bawaan → benar, ia jadi menu buka-tutup
- Tombol hamburger diklik → menu **terbuka** ✓
- Berpindah halaman lewat menu → menu **menutup sendiri** ✓ (aturan RSP-01 terbukti berlaku)

---

## 6. Navigation Audit

Target IA punya 15 workspace tingkat atas. Aplikasi juga punya 15 — **tapi bukan 15 yang sama.**

| Target IA | Keadaan di aplikasi | Putusan |
|---|---|---|
| 🏠 Overview | Ada, 5 item | **MATCH** |
| 🎯 Control Tower | Ada, 5 item, seluruhnya belum ada | **MATCH** (kosong) |
| 💼 Sales & CRM | Ada, 9 item, 3 aktif | **MATCH** |
| 🧩 Product & Engineering | Ada, 7 item, 3 aktif | **MATCH** |
| 📅 Planning & APS | Ada, 8 item, 1 aktif | **MATCH** |
| 📦 Supply Chain | Ada, 10 item, 3 aktif | **MATCH** |
| 🏭 Manufacturing | Ada, 7 item, 2 aktif | **MATCH** |
| 🔍 Quality | Ada, 5 item, **nol aktif** | **MATCH** (kosong total) |
| 🔗 Traceability | Ada, 4 item, **nol aktif** | **MATCH** (kosong total) |
| 🔧 Maintenance | Ada, 4 item, seluruhnya diparkir | **MATCH** (parkir) |
| 💰 Finance & Costing | Ada, 8 item, 1 aktif | **MATCH** |
| 📊 Data & Analytics | Ada, 6 item, 3 aktif | **MATCH** |
| ✨ AI | Ada, 5 item, 2 aktif | **MATCH** |
| 🔌 Integrations | **BUKAN workspace** — 4 itemnya ada di menu akun "Settings" | **MISPLACED** |
| ⚙️ Administration | **BUKAN workspace** — ada di menu akun | **MISPLACED** |
| — | **People** (4 item, 2 aktif) | **EXTRA** — tidak ada di IA |
| — | **Internal** (4 item, 2 aktif + 2 internal) | **EXTRA** — alat tim, tidak ada di IA |

**Sebaran status 104 item navigasi:**

| Status | Jml | Arti |
|---|---:|---|
| `aktif` | 28 | Halamannya ada dan terbukti terbuka |
| `belum-ada` | 51 | Belum ada apa pun |
| `sebagian` | 15 | Kemampuannya ada, menumpang di halaman lain |
| `diparkir` | 7 | Ditunda sadar dengan pemicu tertulis |
| `internal` | 2 | Alat tim |
| `ditolak` | 1 | Sales Forecast — keputusan tercatat (SLS-90) |

**Urutan workspace SENGAJA berbeda dari IA.** Aplikasi memakai urutan alur kerja
(Sales → Product → Planning → Manufacturing → Supply Chain), dengan alasan tertulis di
`navConfig.ts`: menu yang mengikuti alur kerja bisa dibaca sebagai urutan proses, sehingga
orang baru belajar sistemnya dari menunya sendiri. **Ini bukan penyimpangan yang perlu
diperbaiki** — ini keputusan yang sudah diambil dan beralasan.

**Navigasi TIDAK menyaring per peran** — satu mode, seluruh item ditampilkan dengan penanda
status. Ini keputusan pemilik produk 25 Agu 2026, dengan pemicu pencabutan tertulis:
sebelum tenant di luar PT ITM diberi akses.

---

## 7. Route Inventory

**39 route nyata**, seluruhnya ditemukan di App Router. **Nol route dikarang.**

| Route | Workspace | Di navigasi? | Status |
|---|---|---|---|
| `/dashboard` | Overview | Ya | 🔵 (isinya rusak — bagian 17) |
| `/customers` · `/customer-purchase-orders` · `/sales-orders` | Sales & CRM | Ya | 🔵 |
| `/items` · `/boms` · `/routing` | Product & Engineering | Ya | 🔵 |
| `/ppic` | Planning & APS | Ya | 🔵 |
| `/work-orders` · `/production` | Manufacturing | Ya | 🔵 |
| `/warehouse` · `/shipments` · `/purchasing` | Supply Chain | Ya | 🔵 |
| `/hr` · `/attendance` | People | Ya | 🔵 |
| `/operating-profit` | Finance & Costing | Ya | 🔵 |
| `/kpi` · `/kpi/saya` · `/process-mining` | Data & Analytics | Ya | 🔵 |
| `/ai-project` · `/ai-readiness` | AI | Ya | 🔵 |
| `/whats-new` · `/build-tasks` | Internal | Ya | 🔵 |
| `/debug` · `/test-tenant` | Internal | Ya (`internal`) | 🔵 — **tanpa gerbang peran, lihat SEC-04** |
| `/company` · `/team` · `/documents` · `/kamus` | Administration (menu akun) | Ya | 🔵 |
| `/profile` | Settings (menu akun) | Ya | 🔵 |
| `/company/setelan` | Settings (menu akun) | Ya (`sebagian`) | 🟡 — ditandai belum bisa dibuka (AUD-35) |
| `/` · `/login` · `/register` · `/forgot-password` · `/reset-password` · `/invite/accept` | — (publik) | Tidak, dan memang benar | 🔵 |
| `/pod/[token]` | — (publik, lewat QR) | Tidak (dinamis) | 🔵 |
| `/shipments/[shipmentId]/surat-jalan` | Supply Chain (cetak) | Tidak (dinamis) | 🔵 |

**Rekonsiliasi route ↔ navigasi:**

- **href navigasi yang rutenya TIDAK ADA: NOL.** Aturan navigasi nomor 2 ("alamat halaman
  dilarang dikarang") terbukti dipatuhi.
- **Route tanpa rumah di navigasi: 6**, dan keenamnya halaman **sebelum login** — memang
  seharusnya tidak ada di navigasi. Aturan navigasi nomor 3 juga terpenuhi.

---

## 8. Page Inventory

39 berkas halaman di 17 domain. Ringkasan adopsi pola bersama, diukur dengan komentar
dibuang lebih dulu (supaya kata di dalam komentar tidak salah dihitung):

| Pola bersama | Adopsi | Catatan |
|---|---:|---|
| `KepalaHalaman` (remah + judul) | **30 / 39** | 9 yang tidak: 7 halaman publik (memang tidak berkerangka), POD, dan cetak surat jalan |
| `DataTable` Carbon | **15 / 39** | 24 sisanya memang bukan halaman daftar (dasbor, formulir, cetak, publik) |
| `AreaNotifikasi` bersama | **6 / 39** | ⚠️ berdampingan dengan 124 `InlineNotification` langsung |
| `authedFetch` bersama | **12 / 39** | ⚠️ berdampingan dengan 32 berkas yang memanggil `getSession` sendiri |
| `Modal`/`ComposedModal` Carbon | **15 / 39** | 24 kemunculan |
| `Dialog` lama (shadcn) di halaman | **0 / 39** | Bersih — migrasi modal tuntas di lapisan halaman |

**Elemen mentah di lapisan halaman hampir habis** — `<table>` 1 berkas, `<button>` 1 berkas,
`<input>` 1 berkas, `<select>` nol. Ketiganya di halaman yang memang dikecualikan (cetak /
POD publik), dan penjaganya hijau.

**Tetapi lapisan komponen belum pernah disisir sama sekali** — ini persis cakupan **DS-20**:

| `src/features/**/components/` (4 berkas) | Jml |
|---|---:|
| `<button>` mentah | 4 |
| `<table>` mentah | 1 |
| `<input>` mentah | 1 |
| `Dialog` lama (shadcn) | 1 |
| `getSession` sendiri | 1 |

---

## 9. Feature Inventory & 10. Feature Status Matrix

Status di bawah **tidak** disimpulkan dari keberadaan database/API. Yang dipakai: bisa
dibuka di peramban (🔵), ada tapi belum utuh (🟡), atau tidak ada apa pun (🔴).

| Workspace | 🔵 Terverifikasi | 🟡 Sebagian | 🔴 Belum ada | ⚪ Diparkir/Ditolak |
|---|---:|---:|---:|---:|
| Overview | 1 | 2 | 2 | 0 |
| Sales & CRM | 3 | 1 | 5 | 0 |
| Product & Engineering | 3 | 0 | 4 | 0 |
| Planning & APS | 1 | 1 | 3 | 3 |
| Manufacturing | 2 | 2 | 3 | 0 |
| Supply Chain | 3 | 3 | 4 | 0 |
| **Quality** | **0** | **0** | **5** | 0 |
| **Traceability** | **0** | **1** | **3** | 0 |
| People | 2 | 2 | 0 | 0 |
| Finance & Costing | 1 | 2 | 5 | 0 |
| Data & Analytics | 3 | 0 | 2 | 1 |
| AI | 2 | 0 | 3 | 0 |
| **Maintenance** | **0** | **0** | **0** | **4** |
| **Control Tower** | **0** | **0** | **5** | 0 |
| Internal | 4 | 0 | 0 | 0 |
| Administration | 4 | 0 | 3 | 0 |
| Settings | 1 | 1 | 4 | 0 |

**Tiga workspace tanpa satu pun layar**: Quality, Traceability, Control Tower.
Maintenance seluruhnya diparkir dengan pemicu tertulis.

---

## 11. UX Architecture → Application Gap

Target UX yang belum tercermin di aplikasi:

| Target UX | Keadaan | Klasifikasi | ID kanonik |
|---|---|---|---|
| Global Search | Tidak ada | **MISSING** | NO CANONICAL ID |
| Command Palette | Tidak ada | **MISSING** | NO CANONICAL ID |
| Help di header | Tidak ada | **MISSING** | NO CANONICAL ID |
| Tasks & Approvals terpusat | Tersebar di halaman masing-masing | **PARTIAL** | **OVR-01** |
| Halaman Notifications | Hanya lonceng di header | **PARTIAL** | NO CANONICAL ID |
| My Work | Tidak ada | **MISSING** | NO CANONICAL ID |
| Recent Activity | Tidak ada | **MISSING** | NO CANONICAL ID |
| Integrations sebagai workspace | Ada di menu akun, bukan workspace | **NEEDS DECISION** | NO CANONICAL ID |
| Administration sebagai workspace | Ada di menu akun, bukan workspace | **NEEDS DECISION** | NO CANONICAL ID |
| Tabs di halaman | Tidak dipakai di mana pun | **MISSING** | NO CANONICAL ID |
| Right Context Panel | Memakai baris yang dimekarkan | **NEEDS DECISION** | NO CANONICAL ID |
| Quality (5 layar) | Nol layar, nol tabel di skema | **MISSING** | **GDG-08**, **QMS-01** |
| Traceability (layar penelusuran) | Data ada, layar tidak | **MISSING** | **GDG-03** |
| Control Tower (5 layar) | Nol layar | **MISSING** | NO CANONICAL ID |
| Carbon di seluruh halaman | Sebagian besar sudah | **PARTIAL** | **DS-09**, **DS-03** |

---

## 12. Application → UX Architecture Gap

Arah sebaliknya — yang **sudah ada** tapi belum terwakili benar di arsitektur UX:

| Yang sudah ada | Usulan | Alasan |
|---|---|---|
| Workspace **People** (HR, Attendance, Payroll, Employees) | **ADD TO IA** | Empat item nyata, dua sudah aktif; IA tidak memuatnya sama sekali |
| Workspace **Internal** (What's New, Build Tasks) | **ADD TO IA** — sebagai wilayah internal | Nyata dipakai tim, tapi bukan fitur tenant |
| `/debug`, `/test-tenant` | **HIDE** dari pengguna non-internal | Sudah bertanda `internal`, tapi **tanpa gerbang peran** — SEC-04 |
| `/process-mining` | **ADD TO IA** | Aktif, tapi tidak muncul eksplisit di sitemap IA |
| `/kamus` (Glossary Queue) | **ADD TO IA** | Aktif; kamus adalah tulang punggung istilah layar |
| `/whats-new` | **CONTEXTUAL ONLY** | Layak jadi panel, bukan halaman workspace |
| `/operating-profit` | **ADD TO IA** | Satu-satunya layar Finance yang aktif |
| `/shipments/[id]/surat-jalan` | **CONTEXTUAL ONLY** | Halaman cetak, bukan tujuan navigasi |
| `/pod/[token]` | **CONTEXTUAL ONLY** | Halaman publik lewat QR, di luar shell |
| Sales Forecast | **DEPRECATE** — sudah bertanda `ditolak` | Keputusan tercatat SLS-90; IA masih memuatnya |

---

## 13. Carbon Audit

**Yang terukur baik:**

| Aspek | Bukti |
|---|---|
| Sudut tajam (nol border-radius) | `tests/sudut_tajam_carbon.test.ts` **hijau** |
| Layar publik Carbon | `tests/layar_publik_carbon.test.ts` **hijau** |
| Elemen mentah di halaman internal | `tests/elemen_mentah_halaman_internal.test.ts` **hijau** |
| Wadah tabel tanpa `overflow-hidden` | `tests/wadah_tabel_tanpa_overflow_hidden.test.ts` **hijau** |
| Kejujuran status navigasi | `tests/nav_status_jujur.test.ts` **hijau** |
| Kebocoran istilah mentah ke layar | `tests/ui_raw_leak_watchdog.test.ts` **hijau** |
| UI Shell Carbon | `Header`, `SideNav`, `SkipToContent`, `HeaderPanel`, `Switcher` — dirakit dari Carbon, bukan sendiri |
| Pagination Carbon | 14 berkas |
| `TableToolbarSearch` | 15 berkas |
| Keadaan memuat (`Skeleton`/`Loading`) | 34 berkas |
| Tag Carbon | 23 berkas, 71 kemunculan |

**Gap yang terukur:**

| Gap | Angka | ID kanonik |
|---|---:|---|
| `AreaNotifikasi` bersama vs `InlineNotification` langsung | 6 vs 37 berkas | NO CANONICAL ID |
| Elemen mentah di lapisan komponen | 6 kemunculan di 4 berkas | **DS-20** |
| `window.confirm` untuk aksi merusak | **6 panggilan di 4 halaman** (Routing 1, Purchasing 2, Sales Order 2, Pelanggan 1) | **DS-06** |
| Atribut `title=` (bantuan hover) | 104 kemunculan di 35 berkas — **belum digolongkan**; sebagian sah, sebagian melanggar aturan bantuan-klik | **MST-22** sebagian |
| `DataTable` Carbon belum merata | 15 / 39 | **DS-09** |
| Tabs Carbon tidak dipakai sama sekali | 0 | NO CANONICAL ID |

> **Catatan metode, dicatat karena saya sendiri sempat tergelincir**: pencarian mentah
> `window.confirm` di BomsPage memberi 2 kecocokan — keduanya ternyata **di dalam komentar
> penjelasan**. Setelah komentar dibuang lewat `tanpaKomentar`, jawabannya **nol**. Seluruh
> angka di dokumen ini diukur setelah komentar dibuang.

---

## 14. Responsive Audit

**60 pengukuran: 10 halaman × 6 lebar wajib.** Tiga arah diperiksa terpisah — gulir
menyamping, elemen melewati tepi kanan, elemen melewati tepi kiri.

| Lebar | Halaman diuji | Gulir menyamping | Lewat tepi kanan | Lewat tepi kiri |
|---:|---:|---:|---:|---:|
| 360 | 10 | **0** | **0** | **0** |
| 672 | 10 | **0** | **0** | **0** |
| 768 | 10 | **0** | **0** | **0** |
| 1280 | 10 | **0** | **0** | **0** |
| 1440 | 10 | **0** | **0** | **0** |
| 1920 | 10 | **0** | **0** | **0** |

Halaman yang diuji: `/dashboard`, `/items`, `/boms`, `/work-orders`, `/purchasing`,
`/ppic`, `/kpi`, `/customers`, `/warehouse`, `/shipments`.

**Perilaku navigasi di 360px**: side nav tersembunyi bawaan, terbuka lewat hamburger,
**menutup sendiri setelah berpindah halaman** — aturan RSP-01 terbukti berlaku, bukan
sekadar tertulis.

**Batas yang jujur**: 10 dari 39 halaman diuji. **29 halaman lain BELUM diukur untuk arah
tepi kiri** — dan aturan CLAUDE.md sendiri menyebut bahwa setiap halaman yang pernah
dinyatakan lulus sebelum 26 Agu 2026 belum diperiksa untuk arah itu.

---

## 15. Permission / Role UX Audit

| Aspek | Keadaan | Bukti |
|---|---|---|
| Penyaringan navigasi per peran | **TIDAK ADA** — satu mode | `navConfig.ts` nol acuan peran |
| Apakah itu cacat? | **Bukan** — keputusan pemilik produk 25 Agu 2026, dengan pemicu pencabutan tertulis | CLAUDE.md |
| Quick Create per peran | **Ada** | `canQuickCreateCustomerPo(role)` di shell |
| Label peran di menu akun | **Ada** | `getRoleLabel(role)` |
| Halaman yang memeriksa izin sendiri | **15 dari 39** | pola `canManage*` / `role ===` |
| Fungsi izin terpusat | **28 fungsi** di `src/lib/roles.ts`, 16 peran | — |
| Gerbang peran `/debug` & `/test-tenant` | **TIDAK ADA** | Keduanya hanya menampilkan peran, tidak memeriksa peran pembukanya |

### Keterbatasan verifikasi yang WAJIB disebut

**UX per peran TIDAK BISA diverifikasi tanpa menyentuh PT ITM.** Dari 8 akun yang ada,
**tujuh milik company_id 1 (PT ITM)** dan hanya satu milik tenant uji — dan yang satu itu
`company_admin`. Aturan CLAUDE.md melarang verifikasi manual memakai akun PT ITM,
sekalipun terasa hanya melihat.

Jadi untuk peran non-admin, status yang jujur adalah **⚫ UNKNOWN**, bukan lulus.
Yang bisa dinyatakan hanyalah hasil pembacaan kode: navigasi tidak menyaring apa pun,
dan 15 halaman memeriksa izin sendiri.

**Pembedaan yang wajib dijaga**: tombol yang disembunyikan **bukan** keamanan. Yang
membuktikan keamanan adalah penolakan server — dan itu memang ada dan teruji untuk BOM
(403/404 di `tests/bom_lifecycle.test.ts`), tetapi **belum disapu untuk seluruh layar**.

---

## 16. Shared Pattern / Duplication Audit

| Pola | Keadaan | Klasifikasi |
|---|---|---|
| Page header + breadcrumb | `KepalaHalaman` 30/39 | **SHARED PATTERN** |
| Tabel daftar | `DataTable` Carbon 15/39; nol tabel mentah di halaman | **SHARED PATTERN** |
| Modal | `Modal`/`ComposedModal` 15 berkas; nol `Dialog` lama di halaman | **SHARED PATTERN** |
| Modal bertahap | `modal-bertahap.tsx` bersama | **SHARED PATTERN** |
| Notifikasi | `AreaNotifikasi` 6 vs `InlineNotification` 37 | **INCONSISTENT** |
| Pengambilan token & data pengguna | `authedFetch` 12 vs `getSession` sendiri 32 | **DUPLICATE** |
| Konfirmasi aksi merusak | Modal Carbon di sebagian, `window.confirm` di 4 halaman | **INCONSISTENT** |
| Bantuan field | `field-help.tsx` bersama vs 104 atribut `title=` | **NEEDS GOVERNANCE** |
| Pencarian tabel | `TableToolbarSearch` 15 berkas | **SHARED PATTERN** |
| Keadaan memuat | Skeleton Carbon 34 berkas | **SHARED PATTERN** |
| Status/label | `Tag` Carbon 23 berkas | **SHARED PATTERN** |
| Pembagian halaman | `Pagination` Carbon 14 berkas | **SHARED PATTERN** |
| Elemen di lapisan komponen | Tidak pernah disisir | **NEEDS GOVERNANCE** |
| Drawer / panel kanan | Tidak ada sama sekali | **LOCAL PATTERN** (baris dimekarkan) |
| Timeline · Lampiran · Aktivitas | Tidak ada sama sekali | — |

---

## 17. UX Debt

| ID | Area | Keadaan sekarang | Target | Gap | Berat | Pemilik | Ketergantungan | Task kanonik |
|---|---|---|---|---|---|---|---|---|
| UX-D1 | Dashboard | `/api/dashboard/summary` **404**; 4 kartu berhenti selamanya di keadaan memuat, **nol pesan galat terlihat** | Ringkasan tampil atau galatnya terbaca | Alamat API salah (`dashboard/summary` vs `dashboard-summary`) + keadaan galat tidak dirender | **P0** | UI/UX + Backend | — | **NO CANONICAL ID** |
| UX-D2 | Notifikasi | 2 jalur hidup: `AreaNotifikasi` 6 vs `InlineNotification` 37 | Satu jalur bersama | Aturan ada, jalur keduanya jauh lebih besar | **P1** | UI/UX | — | **NO CANONICAL ID** |
| UX-D3 | Identitas pengguna | `getSession` sendiri di 32 berkas | Satu sumber | Kelas "kebetulan benar" | **P1** | Architecture | — | **AUD-37**, **PLT-06** |
| UX-D4 | Aksi merusak | 6 `window.confirm` di 4 halaman | Modal danger Carbon | — | **P1** | UI/UX | DS-09 per halaman | **DS-06** |
| UX-D5 | Lapisan komponen | Nol pengawasan; 6 elemen mentah | Ikut diawasi | Pengawas hanya menyisir `pages/` | **P2** | Governance | — | **DS-20** |
| UX-D6 | Carbon menyeluruh | 15/39 DataTable, 30/39 page header | Seluruh layar | Urutan belum ditetapkan | **P1** | UI/UX | **DS-03** | **DS-09** |
| UX-D7 | Bantuan field | 104 `title=` belum digolongkan | Bantuan lewat klik | Belum disapu | **P2** | UI/UX | — | **MST-22** sebagian |
| UX-D8 | Global Search / Command Palette / Help | Tidak ada | Ada di shell | Belum pernah dibangun | **P2** | NEEDS BUSINESS DECISION | NAV-01 | **NO CANONICAL ID** |
| UX-D9 | Tasks & Approvals | Tersebar | Satu tempat | — | **P2** | UI/UX | — | **OVR-01** |
| UX-D10 | Halaman debug tanpa gerbang | Staf mana pun bisa membuka | Tertutup | — | **P1** | Security | — | **SEC-04** |
| UX-D11 | Integrations & Administration | Di menu akun, bukan workspace | Workspace tingkat atas menurut IA | Perbedaan sadar atau kelalaian? | **P2** | NEEDS BUSINESS DECISION | — | **NAV-01** |
| UX-D12 | Dokumen arsitektur ganda | 3 pasang, versi bertitik tanpa peringatan status | Satu berkas per dokumen | Duplikat nama | **P2** | Governance | — | **NO CANONICAL ID** |
| UX-D13 | Uji tepi kiri belum menyeluruh | 10 dari 39 halaman | Seluruh halaman | 29 halaman belum diukur | **P2** | UI/UX | — | **DS-14** (sudah tutup, cakupannya terbatas) |
| UX-D14 | UX per peran belum terverifikasi | Tenant uji hanya punya 1 peran | Bisa diuji tanpa PT ITM | Akun peran di tenant uji belum ada | **P2** | Governance | — | **NO CANONICAL ID** |
| UX-D15 | `/company/setelan` | Ditandai belum bisa dibuka | Bisa dibuka | — | **P2** | UI/UX | — | **AUD-35** |

---

## 18. Dependency / Blocker

```
DS-03  (urutan 38 layar)            → DS-09 (Carbon menyeluruh) → DS-06, AUD-06, AUD-25
NAV-01 (arsitektur navigasi final)  → RBD-02b, UX-D11, UX-D8
PLT-05 (daftar pilihan tenant)      → MST-24, AUD-20
AUD-37 / PLT-06                     → UX-D3   (satu sumber data pengguna)
GDG-08 (modul mutu belum ada)       → seluruh workspace Quality
GDG-03 (layar penelusuran lot)      → workspace Traceability
```

**Tidak ada ketergantungan** untuk: UX-D1 (dashboard), UX-D2 (notifikasi), DS-20, SEC-04.
Keempatnya bisa dimulai kapan saja.

---

## 19. Business Decisions Required

1. **Integrations & Administration: workspace tingkat atas, atau tetap di menu akun?**
   IA menetapkan workspace; aplikasi menaruhnya di menu akun. Keduanya masuk akal — yang
   tidak boleh adalah ketidakjelasan mana yang berlaku. (NAV-01)
2. **Global Search / Command Palette / Help: dibangun sekarang, atau ditunda?**
   Ketiganya ada di spesifikasi shell dan belum ada sama sekali. Belum ada task kanoniknya.
3. **Right Context Panel vs baris yang dimekarkan.** Aplikasi memakai baris yang dimekarkan
   di mana-mana; IA menyebut panel kanan. Perlu satu arah, supaya tidak lahir dua pola.
4. **Tabs Carbon: dipakai atau tidak?** Nol pemakaian hari ini. Bila memang tidak dipakai,
   sebaiknya dinyatakan sebagai deviasi resmi, bukan dibiarkan menggantung.
5. **Akun peran di tenant uji.** Tanpa itu, UX per peran tidak akan pernah bisa diverifikasi
   tanpa melanggar aturan PT ITM.

---

## 20. Priority Map

### A. BISA DIKERJAKAN SEKARANG (nol ketergantungan)

| Urut | ID | Alasan urutan |
|---:|---|---|
| 1 | **UX-D1** — dashboard 404 | Halaman pertama yang dilihat setiap pengguna, rusak diam-diam, dan perbaikannya kecil |
| 2 | **SEC-04** — gerbang halaman debug | Keamanan, sudah punya task, tidak menunggu apa pun |
| 3 | **UX-D2** — satukan jalur notifikasi | Dua jalur hidup; makin lama makin mahal |
| 4 | **DS-20** — pengawas lapisan komponen | Wilayah yang tidak pernah ditanyai sama sekali |
| 5 | **AUD-37 / PLT-06** — satu sumber data pengguna | 32 salinan; kelas "kebetulan benar" |

### B. TERHALANG KETERGANTUNGAN

| ID | Menunggu |
|---|---|
| DS-09 (Carbon 39 layar) | **DS-03** — urutannya |
| DS-06 (window.confirm) | DS-09 per halaman |
| AUD-06, AUD-25 (modal) | DS-09 |
| Workspace Quality | **GDG-08** — modul mutu belum ada |
| Workspace Traceability | **GDG-03** |
| RBD-02b (kelompok navigasi) | **NAV-01** |

### C. PERLU KEPUTUSAN BISNIS

UX-D8 (Search/Palette/Help) · UX-D11 (Integrations & Administration) · Right Context Panel ·
Tabs · Akun peran di tenant uji

---

## 21. Recommended Next Task

**UX-D1 — Ringkasan Dashboard Tidak Pernah Muncul, dan Galatnya Tidak Terlihat**

Belum punya ID kanonik: **NO CANONICAL ID**.

- **Kenapa ini duluan.** Ini halaman pertama yang dilihat setiap orang setiap hari.
  Empat kartu ringkasannya berhenti selamanya di keadaan memuat, dan **tidak ada apa pun
  di layar yang memberi tahu bahwa ada yang salah**. Diam lebih buruk daripada galat: orang
  mengira sistemnya lambat, lalu menunggu.
- **Ketergantungan.** Nol.
- **Cakupan.** Dua hal: alamat API yang tidak cocok (`/api/dashboard/summary` dipanggil,
  `/api/dashboard-summary` yang ada), dan keadaan galat yang tertangkap ke state tapi tidak
  pernah dirender.
- **Hasil yang diharapkan.** Ringkasan tampil; bila gagal, **galatnya terbaca**, bukan
  kerangka abu-abu yang tidak pernah selesai.
- **Kenapa BUKAN DS-09 (Carbon menyeluruh) duluan**: DS-09 menunggu **DS-03**, dan DS-03
  adalah keputusan Anda, bukan pekerjaan.

---

## 22. Evidence Index

| Bukti | Tempat |
|---|---|
| Tangkapan layar shell 1440 & 360 | `scratchpad/e2e/ux01/shell-1440.png`, `shell-0360.png` |
| Tangkapan layar 10 halaman @360 & @1440 | `scratchpad/e2e/ux01/_*-360.png`, `_*-1440.png` |
| Dashboard keadaan akhir | `scratchpad/e2e/ux01/dashboard-final-1440.png` |
| 60 pengukuran responsive (JSON) | `scratchpad/e2e/ux01/hasil.json` |
| Log audit lengkap | `scratchpad/ux01-run.log` |
| Skrip audit shell | `scratchpad/e2e/ux01-shell.js` |
| Pengukur dua tepi bersama | `scratchpad/e2e/pengukur.js` |
| Pengawas UI (6 berkas, 33 uji, hijau) | `tests/` — dijalankan 27 Agu 2026 |

---

## 23. Scope Exclusions

**Tidak dikerjakan, sesuai perintah:** nol halaman baru, nol route baru, nol perubahan
navigasi, nol perubahan komponen, nol perubahan CSS/SCSS, nol redesign, nol refactor,
nol migrasi, nol perubahan database, nol perubahan `build_tasks`, nol task baru, nol
perbaikan cacat.

**Tidak diaudit, dan disebut supaya tidak dikira sudah:**
- 29 dari 39 halaman belum diukur responsive-nya di giliran ini
- UX per peran non-admin — tidak bisa tanpa menyentuh PT ITM
- Aksesibilitas mendalam (pembaca layar, urutan Tab per halaman) — hanya `SkipToContent`
  dan `#main-content` yang diperiksa
- Kinerja / waktu muat
- Isi 110 route API di luar yang menyentuh 10 halaman yang diuji

---

## UX-01 DECISION

**AUDIT COMPLETE**

### Recommended Next Task

- **ID**: NO CANONICAL ID (dicatat di dokumen ini sebagai **UX-D1**)
- **Nama**: Ringkasan Dashboard Tidak Pernah Muncul, dan Galatnya Tidak Terlihat
- **Alasan**: halaman pertama yang dilihat setiap pengguna; empat kartunya berhenti
  selamanya di keadaan memuat tanpa satu pun pesan galat; nol ketergantungan
- **Ketergantungan**: tidak ada
- **Hasil yang diharapkan**: ringkasan tampil, atau kegagalannya terbaca di layar

**STOP.** Task berikutnya menunggu tinjauan Anda.
