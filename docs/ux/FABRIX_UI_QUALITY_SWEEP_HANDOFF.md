# FABRIX — UI QUALITY SWEEP HANDOFF

**28 Agustus 2026 · HEAD `5692ec5` · AUDIT SAJA**

> Ditulis supaya sesi berikutnya bisa langsung melanjutkan tanpa mengulang penyelidikan.
> Laporan penuh: `FABRIX_UI_QUALITY_SWEEP_REPORT.md`.

---

## APA YANG DIPERIKSA

Enam kelas, seluruhnya diukur dari repositori atau dari peramban:

1. **N-1 DatePicker / validasi bawaan** — seluruh pemakaian DatePicker, lalu diperluas ke
   **setiap `<form>` di repositori** beserta permukaan validasi bawaannya
2. **Arsitektur galat form** — `invalidText` · `invalid` · `helperText` ·
   `InlineNotification` · `aria-*` di 37 berkas halaman
3. **Semantik notifikasi** — judul dipaku mati, notifikasi bersyarat ada-tidaknya pesan,
   berhasil masuk cabang galat
4. **Register task** — `DS-21` · `DS-22` · `DS-23` dan ID yang dicadangkan
5. **Kesiapan 22 halaman**
6. **Kesesuaian BOM**

## APA YANG DITEMUKAN

**Dua kesan dari angka mentah terbukti KELIRU, dan itu hasil paling berharga:**

| Dugaan | Kenyataan terukur |
|---|---|
| N-1 kelas lintas halaman | **DatePicker dipakai SATU kali** di seluruh repo, dan sudah diperbaiki. `pattern=` nol di tempat lain |
| Cacat notifikasi `/purchasing` tersebar di 9 halaman | **Nol halaman** punya tanda tangan yang persis. Setiap halaman yang menaruh teks berhasil di variabel pesan **juga memeriksa status** |

**Satu temuan baru, dan ia kelas yang sama dengan N-1 dengan arah berlawanan:**

> **`/items`: lima atribut `required` tidak pernah menegakkan apa pun.**
>
> Halaman ini memakai `requestSubmit()` — API yang **benar**, karena ia menjalankan
> validasi bawaan. Komentar yang menjelaskannya juga **akurat**. Tetapi langkahnya
> dirender **bersyarat**, sehingga kontrolnya **unmount**: di langkah 2 tempat simpan
> terjadi, **nol** kontrol `required` masih terpasang dan `checkValidity()` bernilai
> **true**.
>
> **Diukur di peramban**: dengan seluruh field wajib kosong, menekan "Tambah item" tetap
> mengirim `POST /api/items`. Berpindah langkah juga tidak memvalidasi.
>
> Integritas data **tidak terancam** — server tetap menolak. Yang hilang adalah galat
> inline, dan `required` memberi kesan perlindungan yang tidak ada.

**Terkonfirmasi persis**: `invalidText` **5** dari 154 kontrol berlabel, vs
`InlineNotification` **123**. Untuk 149 kontrol, pengguna tidak pernah tahu **field mana**
yang salah.

## APA YANG DIPERBAIKI

**Tidak ada.** Nol perubahan sumber, nol perubahan `build_tasks`, nol migrasi.

Kasus yang sama dengan `/company/setelan` **tidak ditemukan**, jadi tidak ada yang perlu
diperbaiki di sapuan ini.

## APA YANG TIDAK DIPERBAIKI — DAN KENAPA

| # | Temuan | Alasan tidak dikerjakan sekarang |
|---|---|---|
| **S-1** | `required`/validasi antar langkah di `/items` | Perbaikannya hidup di **komponen modal bertahap bersama** dan menyentuh **4 halaman** (BOM, PO Klien, Master Item, Karyawan). Memperbaikinya sambil menyapu adalah persis yang dilarang |
| **S-2** | `invalidText` 5 dari 154 | Kelas lintas halaman; dikerjakan sebagai kelas, bukan per halaman |
| **S-3** | 7 judul `"Gagal"` dipaku mati | Diperiksa **per variabel**: ketujuhnya hanya menerima teks galat. Risikonya **laten**, bukan aktual |
| **S-4** | BOM menyimpang di 3 butir | Bukan regresi; menunggu gilirannya |

## PEMILIK TASK

**Nol task dibuat, nol diubah.**

| Kode | Keadaan |
|---|---|
| `DS-21` · `DS-22` | **selesai** |
| `DS-23` · `DS-24` · `AUD-49` | **kosong** |
| Tabrakan `DS-21` | terdokumentasi, **menunggu keputusan** |
| ID dicadangkan register yang masih kosong | **11** |

**Nol dari 22 halaman punya pemilik task kanonik.** Setiap rollout akan menghadapi
pertanyaan ID yang sama.

> **Jangan memakai "kode berikutnya" tanpa membaca
> `docs/FABRIX-Carbon-UX-Governance/CANONICAL-ID-REGISTER-2026-08-27.md` lebih dulu.**
> Skrip kanonik hanya membaca `build_tasks`; pencadangan hidup di markdown.

## KETERGANTUNGAN

| Yang menghalangi | Halaman terdampak |
|---|---|
| **N-2** — `DI_LUAR_AREA` dihitung hadir? | `/attendance`, sisa `/hr` |
| **N-3** — keunikan supplier: nama atau kode? | sisa `/purchasing` |
| `DS-19` masih `sedang_dikerjakan` | `/ppic` — risiko bentrok berkas |

**Nol halaman terhalang oleh ketiadaan governance.** D-A dan D-B sudah diterima, cetakan
sudah ada.

## HALAMAN BERIKUTNYA

**`/routing`** — dan alasannya bukan karena ia paling buruk:

- Baris berulangnya **terparah di seluruh repo**: 642px per baris di 360px
- Pola perbaikannya **sudah terbukti** (DS-22), tinggal diterapkan
- **Nol ketergantungan**, risiko rendah
- **Nilai pakai ulang tertinggi**: ia membuktikan pola DS-22 berlaku di luar BOM

Berikutnya: `/work-orders` → `/production` → `/customers` → `/ppic` (terakhir dari lima
justru karena risikonya: 1.964 baris dan `DS-19` masih berjalan di berkas yang sama).

## KEPUTUSAN BISNIS

**N-2** dan **N-3** tetap milik pemilik produk. **Tidak dijawab di sini**, dan tidak
menghentikan pekerjaan yang tidak bergantung padanya — `/routing` dan empat halaman lain
di daftar atas seluruhnya bebas dari keduanya.

## STATUS TEST

**Suite penuh TIDAK dijalankan**, dan itu disengaja: batch ini nol perubahan sumber.
Keadaan terakhir yang diketahui, dari batch sebelumnya: **74 berkas / 476 uji lulus**.

Yang dijalankan di batch ini hanya **pengukuran peramban baca-saja** untuk membuktikan
temuan `/items` — seluruh non-GET diblokir di lapisan jaringan, **nol baris tertulis**.

## STATUS GIT

| | |
|---|---|
| HEAD awal | `5692ec5` |
| Perubahan sumber | **nol** |
| Berkas baru | dua dokumen di `docs/ux/` |
| `docs/00-GOVERNANCE/` | tetap belum terlacak, **tidak ikut** |
| Push | **tidak** |

## COMMIT

Satu commit dokumentasi: `docs(ux): audit cross-page UI quality patterns`.
