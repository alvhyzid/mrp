<!--
  AUDIT-ONLY. Nol kode diubah, nol modal dipindahkan, nol task dibuat.
  27 Agu 2026 · HEAD 36e0f1d
-->

# FABRIX — Modal & Form Audit Report
**27 Agustus 2026** · HEAD `36e0f1d` · **AUDIT-ONLY**

---

## 1. Executive Summary

**26 overlay** ditemukan di seluruh aplikasi, di **18 berkas**. Bukan 54 seperti hasil
pencarian mentah — selisihnya adalah `<ModalHeader>`, `<ModalBody>`, `<ModalFooter>` yang
ikut tertangkap pola `<Modal`, dan kata di dalam komentar.

**Tiga temuan yang paling perlu dibaca:**

1. **Enam konfirmasi merusak masih memakai `window.confirm()`** — dua pertiga dari seluruh
   konfirmasi merusak di aplikasi. Hanya tiga yang memakai modal `danger` Carbon.

2. **Nol dari 26 overlay menetapkan fokus awal.** Untuk modal berbahaya itu berarti letak
   fokus bergantung sepenuhnya pada bawaan Carbon. Bawaannya kebetulan aman — terukur
   mendarat di tombol "Batal" — tetapi **tidak ada satu baris kode pun yang menjaminnya**,
   dan tidak ada uji yang akan berbunyi bila kelak berubah.

3. **Empat modal berukuran 12–19 field**, tiga di antaranya memuat **baris berulang**. Modal
   yang tumbuh mengikuti data tidak punya tinggi yang bisa diperkirakan.

**Yang sudah baik dan layak disebut:** nol `Popover`, nol `Drawer`, nol `createPortal`
buatan sendiri, nol `AlertDialog` — tidak ada satu pun sistem overlay tandingan. Hanya dua
`Dialog` shadcn lama yang tersisa, keduanya di komponen bersama, bukan di halaman.

---

## 2. Carbon Sources

**Pengakuan keterbatasan, disebut lebih dulu:** upaya mengambil
`carbondesignsystem.com/components/modal/usage/` lewat WebFetch **GAGAL** — halamannya
kembali kosong/terpotong dua kali. Karena itu bagian "apa kata Carbon" di laporan ini
bersumber dari **paket yang terpasang**, yang menurut aturan proyek ini justru
**lebih tinggi otoritasnya** daripada dokumentasi ("Nomor 4 SELALU MENANG bila bertentangan"
— CLAUDE.md, Urutan Pemeriksaan Carbon).

| Fakta Carbon | Berkas sumber di `node_modules` |
|---|---|
| Tangga lebar modal per ukuran | `@carbon/styles/scss/components/modal/_modal.scss:80,190,218,251` |
| `danger` → tombol utama jadi `kind:"danger"` | `@carbon/react/lib/components/Modal/Modal.js:375,452` |
| `InlineNotification` melarang anak interaktif | `@carbon/react/lib/internal/useNoInteractiveChildren.js:16` |
| `ActionableNotification` untuk pemberitahuan beraksi | `@carbon/react/lib/components/Notification/Notification.js:434` |
| `FileUploader` meneruskan `buttonKind` | `@carbon/react/lib/components/FileUploader/FileUploader.js:217` |
| Latar baris tabel dari `tbody` | `@carbon/styles/scss/components/data-table/_data-table.scss:138` |

---

## 3. Carbon Rules Extracted

**Tangga lebar modal (terukur dari paket):**

| Ukuran | < 672px | ≥ 672px | ≥ 1056px | ≥ 1312px |
|---|---|---|---|---|
| xs | 100% | 48% | 32% | 24% |
| sm | 100% | 60% | 42% | — |
| md | 100% | 84% | 60% | — |
| lg | 100% | 96% | 84% | 72% |

Di bawah 672px **seluruh** ukuran 100% lebar — perilaku Carbon sendiri, bukan tambahan FABRIX.

**Carbon TIDAK menyebutkan** ambang jumlah field. Setiap angka field di standar usulan adalah
**tafsiran FABRIX**, ditandai tegas di dokumen itu.

---

## 4. Repository Scan Method

Bukan `grep "Modal"`. Metodenya:
1. Komentar **dibuang lebih dulu** memakai `tests/util/tanpaKomentar.ts` — repo ini punya
   sejarah pengawas yang salah tuduh karena menghitung kata di dalam kalimat penjelasan.
2. Tag pembuka diambil dengan **menghitung kurung kurawal**, supaya ekspresi JSX bertingkat
   tidak memotong atribut terlalu awal.
3. Negative lookahead memisahkan `<Modal` dari `<ModalHeader|Body|Footer`.
4. **Dua pass independen dijalankan dan hasilnya berbeda** (23 vs 24 vs 26). Pass ketiga
   merekonsiliasinya; **26** adalah angka yang bertahan, dan dua pass sebelumnya yang meleset.
   Disebut apa adanya karena angka yang tidak direkonsiliasi adalah angka yang berbohong.

Pola yang dicari dan **tidak ditemukan sama sekali**: `Popover`, `SidePanel`, `Drawer`,
`Sheet`, `AlertDialog`, `createPortal`, `Radix Dialog`.

---

## 5. Total Overlay Inventory

**26 overlay** · 18 `ComposedModal` · 6 `Modal` · 2 `Dialog` (shadcn)
**Ukuran**: `md` 15 · `sm` 8 · tanpa ukuran 2 · `lg` 1
**Danger**: 3

Inventaris lengkap di **Lampiran A**.

---

## 6. CREATE Audit

| Modal | Field | Bertingkat | Baris berulang | Putusan |
|---|---:|---|---|---|
| **PO Klien** (M10) | **19** | ya | **YA** | **KANDIDAT HALAMAN PENUH** |
| **HR / Karyawan** (M06) | **15** | ya | — | **PERLU KEPUTUSAN** |
| **Master Item** (M12) | **14** | ya | — | **PERLU KEPUTUSAN** |
| **BOM** (M07) | **12** | ya | **YA** | **KANDIDAT HALAMAN PENUH** |
| Purchasing — terima barang (M17) | 10 | — | tabel | QUESTIONABLE |
| Pelanggan (M11) | 10 | — | — | CORRECT |
| Purchasing (M16) | 9 | — | — | CORRECT |
| PPIC (M23) | 9 | — | — | CORRECT |
| Work Order (M21) | 8 | — | — | CORRECT |
| Routing (M18) | 7 | — | — | CORRECT |
| Pengiriman (M19) | 7 | — | tabel | QUESTIONABLE |
| Dokumen (M05) | 7 | — | unggah | CORRECT |
| PO Supplier (M15) | 6 | — | **YA** | QUESTIONABLE |
| Gangguan produksi (M24) | 4 | — | — | CORRECT |
| Undang anggota (M26) | 2 | — | — | CORRECT |

**Empat modal ≥ 12 field. Tiga punya baris berulang. Tiga memuat tabel.**

---

## 7. EDIT Audit

FABRIX memakai **modal yang sama** untuk Buat dan Ubah pada hampir seluruh entitas
(`editingXId` menentukan judul dan label tombolnya). **Itu benar** menurut usulan standar
§5.1 — satu bentuk, satu kali belajar.

Konsekuensinya: setiap masalah di alur Buat **otomatis jadi masalah di alur Ubah**. Empat
modal besar di atas berlaku untuk keduanya.

---

## 8–10. DELETE / ARCHIVE / RESTORE Audit

**Enam panggilan `window.confirm()` yang NYATA** (setelah komentar dibuang; pencarian mentah
melaporkan 11 — lima di antaranya di dalam komentar penjelasan):

| Berkas:baris | Yang dihapus |
|---|---|
| `CustomersPage.tsx:224` | client, permanen |
| `PurchasingPage.tsx:372` | supplier, permanen |
| `PurchasingPage.tsx:487` | bahan dari daftar supplier |
| `RoutingsPage.tsx:332` | Routing, permanen |
| `SalesOrdersPage.tsx:365` | — |
| `SalesOrdersPage.tsx:403` | — |

**Tiga modal `danger` Carbon** yang benar: `BomsPage.tsx:1048`, `ItemsPage.tsx:1562`,
`ItemsPage.tsx:1590`.

**Rasio kepatuhan konfirmasi merusak: 3 dari 9 = 33%.**

Ini **persis** cakupan **DS-06** ("Enam window.confirm Tersisa di Empat Halaman"), dan
inventaris task itu **terbukti akurat** — 6 panggilan, 4 halaman. Tidak dikerjakan di sini.

**Pulihkan** (`BomsPage.tsx:1073`) benar: modal `sm` **tanpa** `danger`.

---

## 11–12. VIEW & Progress Modal Audit

**Modal bertingkat: 4** (M06 HR, M07 BOM, M10 PO Klien, M12 Item) — memakai cetakan bersama
`src/components/ui/modal-bertahap.tsx`.

Diuji terhadap keempat syarat usulan standar §8:

| Modal | Berurutan | Muat tanpa gulir | Tanpa konteks halaman | Tanpa baris berulang | Putusan |
|---|---|---|---|---|---|
| Item (M12) | ya | ya | ya | ya | **SAH** |
| HR (M06) | ya | ? | ya | ya | **PERLU DIUKUR** |
| BOM (M07) | ya | ? | ya | **TIDAK** | **KANDIDAT HALAMAN PENUH** |
| PO Klien (M10) | ya | ? | ya | **TIDAK** | **KANDIDAT HALAMAN PENUH** |

---

## 13. Side Panel Audit

**NOL panel samping di seluruh aplikasi.** Nol `SidePanel`, nol `Drawer`, nol `Popover`.

Yang dipakai FABRIX sebagai gantinya: **baris tabel yang dimekarkan**. Itu pilihan yang sah
dan konsisten — 9 halaman memakainya — tetapi berarti **satu alternatif modal tidak tersedia
sama sekali**, dan setiap kasus "perlu melihat halaman di belakangnya" hari ini hanya punya
dua pilihan: modal atau halaman penuh.

Membangun panel samping adalah **keputusan tersendiri yang belum diambil**.

---

## 14. Inline Interaction Audit

Tidak ditemukan modal yang seharusnya inline. Penyaringan, pengurutan, dan pencarian sudah
hidup di toolbar tabel, bukan di modal. **Nol pelanggaran.**

---

## 15. Accessibility Audit

| Pemeriksaan | Hasil terukur |
|---|---|
| `selectorPrimaryFocus` ditetapkan | **0 dari 26** |
| `hasScrollingContent` ditetapkan | **0 dari 26** |
| `preventCloseOnClickOutside` ditetapkan | **0 dari 26** |
| Jebakan fokus | Disediakan Carbon |
| Esc menutup tanpa menyimpan | Terukur bekerja (modal hapus BOM, 27 Agu) |
| Fokus awal pada modal berbahaya | Terukur mendarat di **tombol sekunder** — aman, tapi **tidak dijamin kode mana pun** |

**Ini temuan aksesibilitas paling penting di laporan ini**: bukan bahwa fokusnya salah,
melainkan bahwa **benarnya kebetulan**. Tidak ada kode yang menyatakannya dan tidak ada uji
yang menjaganya.

---

## 16. Responsive Audit

Diukur pada modal yang disentuh pekerjaan hari ini (Master Item, BOM, Dokumen), enam lebar:
nol gulir menyamping, nol elemen keluar tepi, modal jadi layar penuh di 360px.

**BELUM DIUKUR: 23 overlay lainnya.** Disebut tegas supaya tidak dikira sudah.

---

## 17. Compliance Matrix

| Aturan usulan | Patuh | Melanggar | Perlu keputusan | % patuh |
|---|---:|---:|---:|---:|
| Konfirmasi merusak lewat modal Carbon | 3 | **6** | 0 | **33%** |
| Satu primary per modal | 26 | 0 | 0 | 100% |
| Fokus awal ditetapkan eksplisit | **0** | 26 | 0 | **0%** |
| Ukuran sesuai kompleksitas (≤12 field) | 22 | 0 | **4** | 85% |
| Tanpa baris berulang di modal | 23 | 0 | **3** | 88% |
| Tanpa sistem overlay tandingan | 24 | **2** (Dialog shadcn) | 0 | 92% |
| Bahasa Indonesia di isi modal | 26 | 0 | 0 | 100% |

**Kepatuhan keseluruhan: 22 dari 26 overlay tanpa pelanggaran struktural (85%)**, dengan dua
kelas cacat yang menyeluruh: fokus awal (26/26) dan konfirmasi merusak (6/9).

---

## 18. Violations

| # | Pelanggaran | Jumlah | Pemilik |
|---|---|---:|---|
| V-1 | `window.confirm()` untuk aksi merusak | 6 | **DS-06** |
| V-2 | Fokus awal tidak ditetapkan | 26 | **NO CANONICAL ID** |
| V-3 | `Dialog` shadcn tersisa di komponen bersama | 2 | **DS-10**, **DS-20** |

---

## 19. Questionable Patterns

| # | Pola | Jumlah | Catatan |
|---|---|---:|---|
| Q-1 | Modal ≥ 12 field | 4 | Butuh keputusan bentuk |
| Q-2 | Baris berulang di dalam modal | 3 | PO Klien, BOM, PO Supplier |
| Q-3 | Tabel di dalam modal | 3 | Purchasing, Pengiriman, PPIC |
| Q-4 | Modal tanpa ukuran eksplisit | 2 | Mengambil `md` bawaan tanpa dinyatakan |

---

## 20. Product Decisions Required

1. **PO Klien (19 field, bertingkat, baris berulang) → halaman penuh?**
   Ini modal terbesar di aplikasi. Memindahkannya mengubah alur kerja harian.
2. **BOM (12 field, bertingkat, baris berulang) → halaman penuh?**
3. **Master Item (14) dan HR (15) → tetap modal bertahap, atau halaman penuh?**
4. **Bangun panel samping?** Hari ini nol. Tanpa itu, "perlu konteks halaman" hanya punya dua
   jawaban.
5. **Ambang field 4/8/12 di standar usulan** — angka tafsiran FABRIX, bukan Carbon. Disetujui?

---

## 21. Recommended Standard

`docs/ux/FABRIX_MODAL_FORM_ARCHITECTURE_STANDARD.md` — **PROPOSED**, belum kanonik.

---

## 22–23. Migration Candidates & Priority

| Prioritas | Kandidat | Sekarang | Disarankan | Kenapa | Bisa di bawah DS-09? | Perlu keputusan? |
|---|---|---|---|---|---|---|
| **P0** | 6 `window.confirm` | kotak peramban | Modal `danger` | Aksi merusak tanpa penjelasan akibat | **Tidak — milik DS-06** | Tidak |
| **P0** | Fokus awal 26 modal | bawaan | `selectorPrimaryFocus` eksplisit | Benarnya kebetulan | **Ya** | Tidak |
| **P1** | PO Klien (M10) | modal bertahap | halaman penuh | 19 field + baris berulang | Tidak | **YA** |
| **P1** | BOM (M07) | modal bertahap | halaman penuh | 12 field + baris berulang | Tidak | **YA** |
| **P2** | Item (M12), HR (M06) | modal bertahap | ditinjau | 14 dan 15 field | Tidak | **YA** |
| **P2** | 2 `Dialog` shadcn | shadcn | Carbon | Dua jalur hidup | Tidak — DS-10/DS-20 | Tidak |
| **P3** | 2 modal tanpa ukuran | implisit | eksplisit | Kejelasan | **Ya** | Tidak |

---

## 24. Governance Impact

**Nol `build_tasks` diubah. Nol task baru dibuat.** Seluruh pelanggaran yang punya pemilik
dipetakan ke task yang **sudah ada** (DS-06, DS-10, DS-20). Yang belum punya pemilik ditandai
**NO CANONICAL ID** — bukan diberi ID karangan.

Standar diusulkan sebagai **PROPOSED**, sesuai perintah.

---

## 25. Files Changed

| Berkas | Tindakan |
|---|---|
| `docs/ux/FABRIX_MODAL_FORM_ARCHITECTURE_STANDARD.md` | Baru |
| `docs/ux/FABRIX_MODAL_FORM_AUDIT_REPORT.md` | Baru (dokumen ini) |

**Nol perubahan di `src/`, `app/`, `tests/`, `supabase/`.**

---

## 26. Tests

Tidak dijalankan, dan **memang tidak perlu**: nol kode berubah. Skrip pengukuran audit
dijalankan dari `scripts/` dan **dihapus setelah dipakai** — tidak tertinggal di repo.

---

## 27. Git State

Sebelum dan sesudah: HEAD `36e0f1d`, pohon kerja bersih kecuali `docs/00-GOVERNANCE/`
(13 dokumen milik pemilik produk, tidak disentuh).

---

## 28. Next Recommended Batch

**Fokus awal modal berbahaya (V-2)** — 26 overlay, nol keputusan produk, bisa dikerjakan di
bawah DS-09, dan menutup kelas cacat "benarnya kebetulan" yang sudah berulang di proyek ini.

---

# Lampiran A — Inventaris Lengkap 26 Overlay

| ID | Berkas:baris | Tag | Ukuran | Danger |
|---|---|---|---|---|
| M01 | `components/ui/provenance-info-button.tsx:79` | Dialog (shadcn) | — | — |
| M02 | `auth/pages/ProfilePage.tsx:484` | Modal | sm | — |
| M03 | `company/pages/CompanySettingsPage.tsx:269` | Modal | sm | — |
| M04 | `documents/pages/DocumentsPage.tsx:439` | ComposedModal | md | — |
| M05 | `documents/pages/DocumentsPage.tsx:538` | ComposedModal | lg | — |
| M06 | `hr/pages/HrDashboardPage.tsx:684` | ComposedModal | md | — |
| M07 | `mrp/pages/BomsPage.tsx:824` | ComposedModal | md | — |
| M08 | `mrp/pages/BomsPage.tsx:1048` | Modal | sm | **DANGER** |
| M09 | `mrp/pages/BomsPage.tsx:1073` | Modal | sm | — |
| M10 | `mrp/pages/CustomerPurchaseOrdersPage.tsx:808` | ComposedModal | md | — |
| M11 | `mrp/pages/CustomersPage.tsx:476` | ComposedModal | md | — |
| M12 | `mrp/pages/ItemsPage.tsx:1220` | ComposedModal | md | — |
| M13 | `mrp/pages/ItemsPage.tsx:1562` | Modal | sm | **DANGER** |
| M14 | `mrp/pages/ItemsPage.tsx:1590` | Modal | sm | **DANGER** |
| M15 | `mrp/pages/PurchasingPage.tsx:1070` | ComposedModal | md | — |
| M16 | `mrp/pages/PurchasingPage.tsx:1201` | ComposedModal | md | — |
| M17 | `mrp/pages/PurchasingPage.tsx:1310` | ComposedModal | md | — |
| M18 | `mrp/pages/RoutingsPage.tsx:727` | ComposedModal | md | — |
| M19 | `mrp/pages/ShipmentsPage.tsx:833` | ComposedModal | md | — |
| M20 | `mrp/pages/ShipmentsPage.tsx:1032` | ComposedModal | sm | — |
| M21 | `mrp/pages/WorkOrdersPage.tsx:1060` | ComposedModal | md | — |
| M22 | `ppic/pages/PpicDashboardPage.tsx:1649` | ComposedModal | md | — |
| M23 | `ppic/pages/PpicDashboardPage.tsx:1858` | ComposedModal | md | — |
| M24 | `production/pages/ProductionDashboardPage.tsx:1031` | ComposedModal | md | — |
| M25 | `signatures/components/ConfirmAndSignModal.tsx:80` | Dialog (shadcn) | — | — |
| M26 | `team/pages/TeamManagePage.tsx:389` | ComposedModal | sm | — |

# Lampiran E — Rujukan Carbon

Halaman resmi **tidak berhasil diambil** lewat WebFetch (dua kali, isi kosong/terpotong).
Rujukan yang dipakai adalah paket terpasang — lihat §2. Alamat katalog untuk perbandingan
berdampingan oleh pemilik produk:

- https://carbondesignsystem.com/components/modal/usage/
- https://carbondesignsystem.com/components/modal/accessibility/
- https://carbondesignsystem.com/components/button/usage/
- https://carbondesignsystem.com/patterns/forms-pattern/
