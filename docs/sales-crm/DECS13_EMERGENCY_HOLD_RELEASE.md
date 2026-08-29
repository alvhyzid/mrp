# DEC-S13 — PELEPASAN DARURAT PENGHALANG

**Tanggal:** 30 Agustus 2026 · **Keputusan arsitektur:** **YA, FABRIX wajib mendukungnya**
**Status implementasi:** **SELESAI & TERVERIFIKASI** untuk penghalang PO Klien.

## Prinsip

> **PELEPASAN DARURAT ≠ MELEWATI WEWENANG.**
> Ia **wewenang lain yang lebih tinggi**, dengan alasan wajib dan jejak wajib.

```
NORMAL   : departemen penahan  →  melepas sendiri
DARURAT  : wewenang lebih tinggi  →  alasan WAJIB  →  jejak WAJIB  →  lepas
```

## AS-IS sebelum pekerjaan ini

`lepas_po_klien()` mewajibkan pelepas berasal dari **departemen yang sama** dengan penahan —
dibaca dari `actor_department_snapshot` pada jejak penahanan.

**Konsekuensi yang sudah disadari sejak awal dan sengaja dibiarkan** (tertulis di komentar
migrasi 20260906110000): bila satu-satunya pemegang peran departemen itu tidak tersedia,
PO-nya **tertahan tanpa jalan keluar**.

**Nol infrastruktur darurat yang sudah ada** — disisir: nol tabel `*override*`/`*emergency*`,
nol kolom wewenang, nol fungsi.

## Wewenang — EKSPLISIT, bukan disimpulkan

`EMERGENCY_HOLD_RELEASE_ROLES` di `src/lib/roles.ts`, dipasangkan dengan
`jwt_boleh_lepas_darurat()` di basis data.

**Kenapa punya nama sendiri padahal isinya sama dengan kepemimpinan:**
(a) di tempat pemakaian terbaca **"wewenang darurat"**, bukan *"kebetulan dia pimpinan"*;
(b) mempersempitnya kelak — misalnya **hanya General Manager** — mengubah **satu baris**.

Diturunkan dari `LEADERSHIP_ROLES` supaya **tidak lahir daftar peran kedua** yang bisa menyimpang.

> **KEPUTUSAN TERBUKA untuk pemilik produk**: apakah wewenang darurat seharusnya **lebih
> sempit** daripada kepemimpinan (mis. hanya General Manager)? Hari ini: `company_admin` +
> `general_manager`. Mengubahnya = satu baris di dua tempat yang sudah saling menunjuk.

## Yang TIDAK dibangun

**Nol** tabel penghalang baru · **nol** tabel log baru · **nol** sistem persetujuan kedua ·
**nol** peran baru. Yang ditambah: **dua kolom** pada log kanonik, **satu** katalog alasan,
**satu** penolong wewenang, **satu** fungsi.

## Aturan yang ditegakkan server

| Aturan | Perilaku |
|---|---|
| Tanpa login | ditolak di **lapisan izin basis data** (`42501`) |
| Tanpa identitas/tenant | ditolak — `wajib_identitas_tenant()` |
| Perusahaan lain | "PO client tidak ditemukan di perusahaan Anda" |
| Tanpa wewenang darurat | "Peran Anda tidak berwenang melakukan pelepasan darurat" |
| **Penghalang milik departemen sendiri** | **ditolak** — "Pakai pelepasan biasa" |
| PO tidak sedang ditahan | ditolak |
| Kategori tidak dikenal | ditolak |
| **Kategori tanpa catatan** | ditolak — **keempat kategori darurat mewajibkan catatan** |

**Kenapa keempatnya wajib bercatatan**: kategori saja tidak cukup untuk
mempertanggungjawabkan keputusan yang melampaui wewenang orang lain berbulan-bulan kemudian.

## Data yang tersimpan

Baris **BARU** di `status_transition_log` (bukan menimpa apa pun): pelaku · nama · peran ·
departemen · waktu · dari-ke · kategori alasan · catatan · **`authority_basis`** ·
**`overridden_department`**.

**Sejarah tidak pernah ditulis ulang**: baris penahanan asli tetap milik penahannya —
diuji ulang **sesudah** pelepasan darurat (pemeriksaan 13), termasuk memastikan `authority_basis`
pada baris penahanan tetap **null**.

## Layar

Tombol **"Lepas darurat"** hanya muncul bila jalur normal memang tertutup bagi pengguna itu:
penghalangnya milik **departemen lain** dan ia memegang wewenang darurat. Menyembunyikannya
hanya menyembunyikan — **yang menegakkan tetap fungsi basis data**.

Modal varian **danger** (berbeda dari pelepasan biasa yang transaksional), menampilkan
**penahanan asli** — siapa, departemen apa, kapan, alasannya — **sebelum** keputusan diambil.
Riwayat menandainya **"Dilepas darurat"** beserta dasar wewenang dan departemen yang dilampaui.

## Bukti

| Pemeriksaan | Hasil |
|---|---|
| `tests/lepas_darurat_po_klien.test.ts` | **15 lulus** |
| Mutasi wewenang darurat dicabut | **4 pemeriksaan gagal** |
| Mutasi larangan jalan pintas dicabut | **1 pemeriksaan gagal** |
| Mutasi dasar wewenang dikosongkan | **2 pemeriksaan gagal** |
| Sesudah ketiganya dipulihkan | **15 lulus** |
| Verifikasi peramban | 6 lebar × 2 keadaan bersih; **0 permintaan non-GET** |
| Regresi penuh | **92 berkas · 705 lulus · 7 dilewati · 0 gagal**, dicocokkan ke sumber **712 = 712** |
| Kasus berhasil yang berwenang | pemeriksaan 11 & 15 — termasuk **pelepasan biasa tetap bekerja** |

## Yang TIDAK dicakup

Pelepasan darurat **hanya untuk penghalang PO Klien**. Penghalang lain — bila kelak ada —
memerlukan katalog alasan dan wewenangnya sendiri; **jangan** diperluas diam-diam dengan
menambah entitas ke fungsi yang sama tanpa keputusan.
