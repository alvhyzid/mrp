# HIERARKI JUDUL — HANDOFF (`DS-24`)

Laporan penuh: `FABRIX_HEADING_HIERARCHY_FINAL_REPORT.md`
Menggantikan: `FABRIX_DS23_HEADING_HIERARCHY_HANDOFF.md`

---

## KEPEMILIKAN — inti batch ini

| | |
|---|---|
| Nomor lama (salah) | `DS-23` |
| Pemilik sebenarnya `DS-23` | temuan **F-01/F-11** — sistem token paralel, 181 pemakaian / 17 berkas |
| Sumber bukti | `FABRIX_TASK_ID_RECONCILIATION_DS21_DS22.md` §7 butir 2 — **PROPOSED**, menunggu keputusan pemilik produk |
| **Nomor kanonik baru** | **`DS-24`** |
| Status | `selesai`, `completed_at` terisi, urgensi `penting` |

**Kenapa `DS-24` aman** — diperiksa empat syarat, bukan diambil dari skrip: tidak ada di
`build_tasks`; register kanonik mencadangkan **tepat satu** nomor `DS` (`DS-21`, untuk
F-01/F-11); sepuluh temuan `F-xx` lain menunggu ID tetapi **tanpa nomor yang dicadangkan**;
dan register menutup dengan *"next free: `DS-21` dan `AUD-49`"* — `DS-21`/`DS-22` terpakai,
`DS-23` dicadangkan, jadi `DS-24` yang pertama benar-benar bebas.

**Pencadangan F-01/F-11 UTUH.** `DS-23` = **0 baris** di ketiga project, diverifikasi
**sesudah** migrasi. Nol baris migrasi menyebut F-01 atau F-11.

## KOREKSI ANGKA YANG BEREDAR

> Brief batch ini menyebut **7 false positive / 4 cacat**. Yang benar: **5 false positive /
> 6 cacat**.

Angka 7/4 berasal dari laporan `DS-23` yang ikut menghitung dua judul modal yang memang sudah
benar (`BomsPage:941`, `CustomerPurchaseOrdersPage:977`) seolah termasuk sebelas titik —
padahal keduanya situs tambahan **di dalam** halaman yang cacatnya nyata. Dihitung ulang dari
pohon sebelum perbaikan (`fbc0c87`): **5 + 6 = 11**.

Akibat kekeliruan itu bukan sekadar angka: ia **menghilangkan dua halaman** dari daftar yang
benar-benar diperbaiki.

## APA YANG BERUBAH DI BATCH INI

**Nol perubahan sumber produk.** Implementasinya sudah masuk di `5857779`, dan batch ini
mengauditnya ulang: setiap baris yang berubah adalah tag `<hN>`.

Yang baru:

1. **Uji (f)** di `tests/hierarki_judul_lintas_halaman.test.ts` — menangkap **judul anak
   lebih tinggi daripada induknya**. Penjaga versi pertama **tidak menangkapnya**: himpunan
   `{3,4}` tetap bersambung, jadi `h4` yang membungkus `h3` lolos. Alat ukurnya diperbaiki
   lebih dulu, sebelum apa pun disimpulkan darinya.
2. **Migrasi** `20260902100000_ds24_hierarki_judul.sql` — satu task, dibuat dan ditutup.
3. **Dua dokumen** ini.

## PENJAGA REGRESI — 6 uji

Semua **dibuktikan menggigit** dengan menyisipkan ulang cacatnya. Uji (a) adalah **tripwire**:
kelima uji lain bergantung pada asumsi bahwa `h1` datang dari komponen bersama; bila `h1` itu
pindah, mereka diam-diam salah tanpa satu pun berubah warna.

**Batas yang disebut terbuka**: penjaga memeriksa **himpunan** tingkat, bukan urutannya —
karena urutan sumber bukan urutan DOM. Bentuk yang lolos: `h2` lalu `h4` di halaman yang
kebetulan juga memakai `h3`.

## BUKTI

- **18 pengukuran** tersasar di batch ini (`/routing`, `/work-orders`, `/items` × 6 lebar):
  nol lompatan, tepat satu `h1`, nol gulir menyamping, nol elemen melewati kedua tepi.
- **42 + 8** pengukuran dari batch sebelumnya tetap berlaku — kodenya identik.
- **Kontainmen migrasi**: potret jumlah baris **eksak** seluruh **91 tabel** di ketiga
  project, sebelum & sesudah — **1 tabel berubah**, `build_tasks` +1. Nol perubahan di 90
  tabel lain.
- **Nol fixture**, nol baris tertulis lewat peramban (non-GET diblokir).

Satu catatan kejujuran: dalam skrip tersasar ini, langkah "modal PO `/purchasing`" tetap
memberi hasil kosong — kliknya berpindah halaman. Itu **cacat pengukur yang sudah diketahui**,
bukan cacat produk; modal `/purchasing` sudah diverifikasi terpisah dengan skrip yang mencatat
URL sebelum & sesudah, dan hasilnya `h2` label → `h2` judul → **`h3` "Baris item"**.

## TASK BERIKUTNYA — SATU REKOMENDASI

**Kelas `invalidText` / galat field.** Alasannya dependensi nyata, bukan urutan daftar:

- Ia **butir Definition of Done** yang menggagalkan `/routing` **dan** `/work-orders`. Selama
  belum dikerjakan, setiap pilot halaman berikutnya gagal pada butir yang sama.
- Ia terbesar (**5** dari **237** kontrol form punya `invalidText`; 22 dari 26 halaman nol).
- Aturannya **sudah dijawab Carbon** lewat pola Form validation — tidak butuh keputusan
  pemilik produk untuk memulai.

**Belum boleh dimulai**: `/production`, `/customers`, `/ppic` — ketiganya menunggu kelas
validasi dan kelas keadaan panel detail.

## BLOKER YANG TERSISA

**Pencadangan ID masih hidup di markdown sementara alokator membaca basis data.** Selama itu
bertahan, tabrakan yang sama akan terulang. Dokumen rekonsiliasi sudah menawarkan dua jalan
menutupnya — task yang dicadangkan **dibuat** berstatus `menunggu_persetujuan` sehingga skrip
melihatnya, atau alokator ikut membaca berkas register. **Keduanya menunggu keputusan Anda**,
bersama keputusan asli tentang nomor untuk F-01/F-11.

## STOP

Sesuai brief: berhenti setelah kepemilikan hierarki judul selesai. Tidak lanjut ke kelas
berikutnya, tidak mulai `/production`. Menunggu handoff.
