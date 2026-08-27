<!--
  STATUS: PROPOSED STANDARD — BELUM KANONIK.
  Dibuat 27 Agu 2026. Menjadi kanonik hanya setelah pemilik produk menyetujuinya.

  Dokumen ini TIDAK mengubah kode apa pun. Ia menetapkan aturan untuk pekerjaan berikutnya.
  Bukti pengukuran yang mendasarinya ada di FABRIX_MODAL_FORM_AUDIT_REPORT.md.
-->

# FABRIX Modal & Form Architecture Standard
**Status: PROPOSED STANDARD — TERTAHAN PADA DUA KONFLIK** · 27 Agustus 2026

---

## 0. BERHENTI DULU — DUA KONFLIK GOVERNANCE

Audit ini menemukan **dua pertentangan langsung antar dokumen yang sama-sama mengikat**.
Perintah audit menyuruh berhenti dan melaporkannya, bukan memilih sendiri. Bagian 4 dan 10
dokumen ini **TIDAK BOLEH dipakai** sebelum keduanya diputuskan.

### KONFLIK-A — formulir panjang: modal bertahap, atau halaman penuh?

| Sumber | Status | Isinya |
|---|---|---|
| `docs/FABRIX_CARBON_DESIGN_GOVERNANCE.md` §20, baris 836-847 | **"Mandatory / Project-wide"**, baseline 24 Agu 2026 | Menyebut **"long forms"**, "complete ERP records", "complex workflows" sebagai **Bad examples** untuk modal, dan: *"For complex contextual editing, prefer a page or side panel/drawer"* |
| `docs/governance/cetakan-halaman-data.md` §6e-2, baris 303-306 | **Keputusan pemilik produk, 26 Agu 2026** | *"formulir yang terlalu panjang **dipecah menjadi beberapa bagian**, bukan dijadikan halaman penuh dan bukan dijadikan dua kolom"* |

Keduanya berlaku menurut ketentuannya masing-masing. Keputusan pemilik produk lebih baru dan
menempati peringkat 1 di `FABRIX_CONSTITUTION.md`, tetapi §20 **tidak pernah dicabut**.

**Yang dibutuhkan**: satu kalimat dari pemilik produk — §20 dicabut untuk formulir panjang,
atau keputusan 26 Agu dipersempit.

### KONFLIK-B — panel samping diwajibkan, tapi tidak ada

`FABRIX_CARBON_DESIGN_GOVERNANCE.md` §21 (baris 851-863) dan tabel pemetaan kanonik (baris
1884) **mewajibkan** panel samping untuk "contextual editing", dengan contoh eksplisit: detail
Work Order, detail bahan, detail pengecualian MRP.

**Terukur**: nol `SidePanel`, nol `Drawer`, nol `Popover` di seluruh kode. Sebuah kewajiban
yang komponennya belum pernah dibangun bukan aturan — ia utang yang berpakaian aturan.

---

## 1. Purpose

Menjawab satu pertanyaan tanpa membaca kode: **kapan sesuatu jadi modal, kapan jadi panel
samping, kapan jadi halaman penuh, dan kapan tidak jadi apa-apa.**

Dokumen ini lahir dari audit 26 overlay yang benar-benar ada di aplikasi, bukan dari teori.

---

## 2. Design Principles

1. **Modal MENGHENTIKAN pekerjaan.** Ia sah hanya bila menghentikan pekerjaan memang tujuannya:
   satu keputusan, satu konfirmasi, satu isian pendek.
2. **Pola menentukan komponen, bukan sebaliknya.** Pilih dulu bentuk interaksinya, baru
   komponennya.
3. **Verifikasi dari paket terpasang, bukan dari nama.** Nilai token dan perilaku komponen
   dibaca dari `node_modules`, dan dibuktikan dengan menjalankan — bukan dari ingatan atau
   dokumentasi yang bisa tertinggal versi.
4. **Satu aksi utama.** Dua tombol primary berdampingan berarti tidak ada yang utama.
5. **Aksi merusak tidak boleh berjarak satu jari dari aksi sehari-hari.**
6. **Yang gagal harus terlihat.** Yang berhasil boleh lewat.

---

## 3. Modal Decision Rules

### Yang CARBON tetapkan — diukur dari paket terpasang

`@carbon/react` 1.114.0 · `@carbon/styles` 1.113.0

| Fakta | Sumber terukur |
|---|---|
| Lebar modal per ukuran | `@carbon/styles/scss/components/modal/_modal.scss:80,190,218,251` |
| `danger` mengubah tombol utama jadi `kind: "danger"` | `Modal.js:375` dan `:452` |
| `InlineNotification` **MELARANG** anak interaktif | `internal/useNoInteractiveChildren.js:16` |
| `ActionableNotification` ADA untuk pemberitahuan beraksi | `Notification.js:434` |
| `FileUploader` meneruskan `buttonKind`, bawaannya `primary` | `FileUploader.js:217`, PropTypes `:271` |

**Tangga lebar modal Carbon, terukur:**

| Ukuran | < 672px | ≥ 672px (md) | ≥ 1056px (lg) | ≥ 1312px (xlg) |
|---|---|---|---|---|
| `xs` | 100% | 48% | 32% | 24% |
| `sm` | 100% | 60% | 42% | — |
| `md` (bawaan) | 100% | 84% | 60% | — |
| `lg` | 100% | 96% | 84% | 72% |

> **Konsekuensi yang sering terlewat:** di bawah 672px **SELURUH ukuran modal Carbon 100%
> lebar**. Aturan FABRIX "modal lebar → layar penuh di HP" bukan tambahan kita; itu perilaku
> Carbon sendiri. Yang perlu kita jaga hanyalah agar isinya tetap terbaca di situ.

### KOREKSI PENTING — Carbon MEMANG menyebut angkanya

> **Versi pertama dokumen ini menyatakan "Carbon tidak menyebutkan angka batas jumlah field".
> Itu KELIRU.** Angkanya ada, hanya saja hidup di halaman **POLA FORMULIR**, bukan di halaman
> komponen Modal — persis kesalahan yang dicegah aturan "Urutan Pemeriksaan Carbon" di
> CLAUDE.md: **pola dulu, komponen kemudian.** Saya memeriksa komponen dan paketnya, lalu
> menyimpulkan terlalu jauh.

**CARBON MENYATAKAN**, kutipan harfiah dari
`https://carbondesignsystem.com/patterns/forms-pattern/` bagian *Variants*:

> *"Use a dialog form when dealing with **less than five inputs**."*
> *"Use a side panel form when dealing with **more than five inputs**."*
> *"Dedicated page — For more complex, lengthier or multistep requests for user input."*

Dan dari `https://carbondesignsystem.com/patterns/dialog-pattern/`:

> *"Don't use to display complex or large amounts of data."*
> *"**Don't recreate a full app or page in a dialog.**"*
> *"**One modal should never trigger another modal.**"*

**Akibatnya untuk FABRIX, dan ini keras**: dengan ambang Carbon (< 5 isian), hanya **2 dari 15
modal formulir** yang patuh — Undang anggota (2 field) dan Catat gangguan (4 field). Tiga
belas sisanya, menurut Carbon, seharusnya panel samping atau halaman penuh.

**TAPI** keputusan pemilik produk 26 Agu 2026 menetapkan sebaliknya (KONFLIK-A di bagian 0).
Karena itu tabel di bawah **TERTAHAN** dan tidak boleh dipakai sampai konfliknya diputuskan.

---

## 4. Create Decision Rules — **TERTAHAN OLEH KONFLIK-A**

> Angka 4/8/12 di bawah adalah **tafsiran FABRIX** yang saya turunkan sebelum menemukan
> ambang Carbon yang sebenarnya (< 5). Ia **lebih longgar** daripada Carbon dan **lebih ketat**
> daripada keputusan pemilik produk 26 Agu. Jangan dipakai sebelum KONFLIK-A diputuskan.

| Kompleksitas | Ukuran | Bentuk | Alasan |
|---|---|---|---|
| **Sederhana** | ≤ 4 field, tanpa gulir | **Modal** (`sm`) | Satu tarikan napas |
| **Menengah** | 5–8 field | **Modal** (`md`) | Masih satu layar di desktop |
| **Kompleks** | 9–12 field | **Modal bertahap** | Dipecah jadi langkah, bukan digulir |
| **Sangat kompleks** | > 12 field | **KANDIDAT HALAMAN PENUH** — perlu keputusan | Di bawah |
| **Punya baris berulang** | tabel/baris yang bisa ditambah | **KANDIDAT HALAMAN PENUH** | Di bawah |
| **Butuh konteks halaman di belakangnya** | apa pun | **Panel samping** | Belum ada di FABRIX |

**Kenapa baris berulang jadi pemicu, bukan jumlah field:** modal yang memuat baris yang bisa
ditambah dan dihapus tidak lagi punya tinggi yang bisa diperkirakan. Ia tumbuh mengikuti
pekerjaan pengguna, dan setiap pertumbuhan mendorong tombol aksinya keluar layar.

---

## 5. Edit Decision Rules

1. **Ubah memakai bentuk yang SAMA dengan Buat** untuk entitas yang sama. Dua bentuk berbeda
   untuk satu entitas memaksa orang belajar dua kali.
2. **Ringkasan konfirmasi hanya untuk data BARU, tidak untuk mengubah** — aturan CLAUDE.md
   nomor 7, tetap berlaku.
3. **Bila mengubah butuh melihat data lain di halaman** (membandingkan antar baris), itu
   **panel samping**, bukan modal.

---

## 6. Delete / Danger Decision Rules

1. **Konfirmasi merusak WAJIB memakai `Modal` Carbon dengan properti `danger`.**
   **`window.confirm()` DILARANG.** Alasannya bukan rupa: ia memblokir seluruh peramban, tidak
   bisa menonjolkan nama barisnya, tidak bisa diuji dari kode, dan tidak bisa menjelaskan
   **akibat**.
2. **Modal berbahaya menjelaskan AKIBAT, bukan hanya bertanya "yakin?".**
3. **Server yang memutuskan hapus-vs-arsip, bukan pengguna** (CLAUDE.md aturan nomor 10).
   Layar menampilkan satu tombol dan **melaporkan** apa yang sebenarnya terjadi.
4. **Fokus awal TIDAK BOLEH mendarat di tombol merusak.**
5. **Bila penghapusan menuntut konfigurasi** (memilih apa yang ikut terhapus, memindahkan
   anaknya), itu **alur**, bukan konfirmasi — dan alur bukan modal.

---

## 7. Archive / Restore Rules

- **Arsip**: konfirmasi pendek. Modal `sm`, **tanpa** `danger` bila bisa dipulihkan.
- **Pulihkan**: konfirmasi pendek, **tidak pernah** `danger` — memulihkan bukan merusak.
- Keduanya menjelaskan **apa yang berubah ke depan**, bukan apa yang terjadi ke belakang.

---

## 8. Progress Modal Rules

Modal bertahap sah bila **seluruh** syarat ini terpenuhi:
1. Langkahnya **berurutan tanpa percabangan**.
2. Tiap langkah muat **tanpa menggulir**.
3. Pengguna **tidak perlu** melihat halaman di belakangnya.
4. **Tidak ada** baris berulang atau tabel di dalamnya.

Bila salah satu tidak terpenuhi → **kandidat halaman penuh**.

---

## 9. Side Panel Rules

**FABRIX belum punya panel samping sama sekali** — nol `SidePanel`, nol `Drawer`, nol
`Popover` di seluruh kode. Aturan di bawah berlaku **saat** ia dibangun, dan membangunnya
adalah keputusan tersendiri yang belum diambil.

Panel samping dipakai bila pengguna **perlu melihat halaman di belakangnya sambil bekerja**.

---

## 10. Full Page Rules

Halaman penuh dipakai bila: > 12 field, ATAU ada baris berulang/tabel, ATAU ada percabangan,
ATAU pekerjaannya bisa ditinggal dan dilanjutkan.

---

## 11. Inline Interaction Rules

Jangan memakai modal untuk: mengubah satu field, menyaring, mengurutkan, atau memilih baris.

---

## 12. Responsive Rules

Enam lebar wajib: **360 / 672 / 768 / 1280 / 1440 / 1920**, ditambah **titik perubahan**
milik layar itu sendiri. Tiga arah diperiksa terpisah: gulir menyamping, elemen melewati tepi
kanan, elemen melewati tepi kiri.

> **Titik perubahan wajib ikut diukur.** Pada 27 Agu 2026, kolom detail Master Item jatuh
> 444px → 225px tepat di 1056px — lebar yang **tidak** ada di daftar enam, jadi tidak pernah
> difoto siapa pun.

---

## 13. Accessibility Rules

| Aturan | Keadaan FABRIX hari ini |
|---|---|
| Jebakan fokus | Disediakan Carbon |
| Esc menutup tanpa menyimpan | Disediakan Carbon; terukur bekerja |
| Fokus awal **bukan** di tombol merusak | **NOL modal menetapkan `selectorPrimaryFocus`** |
| `aria-label` / `modalHeading` terisi | Sebagian |

**Terukur**: nol dari 26 overlay menetapkan `selectorPrimaryFocus`. Bawaan Carbon kebetulan
mendaratkan fokus di tombol sekunder — terukur pada modal hapus BOM — tetapi **tidak ada satu
pun kode yang menjamin itu**.

---

## 14. Button Hierarchy

1. **Satu primary per modal.** Tidak pernah dua.
2. **Aksi merusak**: `danger` untuk aksi utama modal berbahaya; `danger--ghost` untuk aksi
   merusak di dalam panel detail.
3. **Sekunder = "Batal"**, selalu ada, selalu di kiri aksi utama.
4. **Aksi merusak berjauhan dari aksi biasa DI SEMUA LEBAR** — bukan hanya di desktop.
5. **Tombol berlabel teks**, bukan ikon saja.

---

## 15. Focus Rules — **CARBON SENDIRI TIDAK SATU SUARA**

Tiga halaman resmi Carbon memberi **tiga aturan berbeda** untuk fokus awal, dan ketiganya
tidak bisa dipatuhi sekaligus:

1. `components/modal/usage/` — *"set the initial focus to the first location that accepts user
   input… If it is a transactional modal without form inputs… the first focus should be on the
   **primary button**."*
2. `components/modal/accessibility/` — fokus ke tombol **batal** untuk dialog berbahaya.
3. Aturan umum dialog — fokus ke elemen **fokusable pertama**, yang pada anatomi modal Carbon
   justru ikon tutup (×) di header.

Pada modal hapus tanpa isian, aturan (1) menaruh fokus di tombol **HAPUS**.

**Usulan FABRIX**: ikuti aturan (2) — fokus ke tombol sekunder untuk modal berbahaya —
dan tetapkan **eksplisit** lewat `selectorPrimaryFocus`. Mengandalkan bawaan berarti
bergantung pada sesuatu yang tidak dinyatakan di mana pun, dan yang Carbon sendiri
perselisihkan.

**Ini butuh keputusan Anda**, karena memilih di antara tiga aturan Carbon bukan wewenang saya.

---

## 16. Content / Copy Rules

Bahasa Indonesia, dari Kamus. Judul menyebut **objeknya**. Isi menyebut **akibatnya**.
Tombol menyebut **kata kerjanya** — bukan "OK".

---

## 17. Decision Tree

```
MULAI
 │
 ├─ Konfirmasi merusak?            ─ ya → Modal `danger`, ukuran sm
 │                                        (fokus awal di "Batal")
 ├─ Pemberitahuan yang harus diakui? ─ ya → Modal pasif, ukuran sm
 │
 ├─ Perlu melihat halaman di belakangnya sambil bekerja?
 │                                 ─ ya → PANEL SAMPING (belum ada di FABRIX)
 │
 ├─ Ada baris berulang atau tabel? ─ ya → HALAMAN PENUH
 │
 ├─ Berapa field?
 │     ≤ 4   → Modal sm
 │     5–8   → Modal md
 │     9–12  → Modal bertahap
 │     > 12  → HALAMAN PENUH
 │
 ├─ Isinya menggulir di 768px?     ─ ya → naik satu tingkat, lalu ukur lagi
 │                                        masih menggulir → HALAMAN PENUH
 └─ SELESAI
```

---

## 18. Anti-patterns

1. `window.confirm()` untuk aksi merusak — **6 kejadian hari ini**.
2. Dua tombol primary dalam satu blok.
3. Anak interaktif di dalam `InlineNotification` — Carbon **melemparkan galat**; halamannya
   gagal dirender, bukan sekadar terlihat aneh.
4. Modal yang tumbuh mengikuti data.
5. Fokus awal di tombol merusak.
6. Menonaktifkan tombol tanpa menjelaskan sebabnya.
7. Angka `0` untuk data yang gagal dimuat.
8. **Modal memicu modal lain** — Carbon: *"One modal should never trigger another modal."*
9. **Membangun ulang halaman di dalam dialog** — Carbon: *"Don't recreate a full app or page
   in a dialog."*

---

## 19. Exceptions

Pengecualian **wajib ditulis beserta alasannya** di tempat kodenya, dan didaftarkan di
pengawas yang relevan — bukan disepakati dalam percakapan.

---

## 20. Migration Strategy

**Jangan memindahkan modal secara massal.** Urutannya: perbaiki **kelas cacat** lebih dulu
(anti-pattern 1, 3, 5), baru pindahkan bentuk (halaman penuh) satu per satu dengan
pengukuran sebelum dan sesudah.

---

## 21. Current FABRIX Compliance Matrix

Ringkasan; rinciannya di laporan audit.

| Aturan | Patuh | Melanggar | Perlu keputusan |
|---|---:|---:|---:|
| Konfirmasi merusak memakai modal Carbon | 3 | **6** | 0 |
| Satu primary per modal | 25 | **1** (sudah diperbaiki 27 Agu) | 0 |
| Fokus awal ditetapkan eksplisit | **0** | 26 | 0 |
| Ukuran modal sesuai kompleksitas | 22 | 0 | **4** (12–19 field) |
| Baris berulang di dalam modal | 23 | 0 | **3** |
