# Design Debt Register — FABRIX

**Dibuat 25 Agu 2026 sebagai hasil DS-0 nomor 3.** Diukur dari kode, bukan dari kesan.
Cakupan pengukuran: **54 berkas TSX** (38 halaman, 4 komponen fitur, 12 komponen bersama).

Prioritas mengikuti §55: **E → C → B → A**. Alasannya bukan selera — aksesibilitas dan
interaksi menentukan apakah layar **bisa dipakai**, sementara visual menentukan apakah ia
**terlihat rapi**. Yang tidak bisa dipakai lebih mahal daripada yang tidak rapi.

---

## Ringkasan angka

| Golongan | Temuan utama | Ukuran |
|---|---|---|
| **E** Aksesibilitas | `role=` hanya 5 kemunculan di 54 berkas | belum terukur penuh |
| **C** Interaksi | 18 `title=` — **dinaikkan ke golongan E**, lihat E.2 | 18 titik |
| **B** Komponen | Elemen HTML mentah berdampingan dengan komponen bersama | 81 elemen mentah |
| **A** Visual | **Dua sistem warna berjalan bersamaan dan saling tidak cocok** | 88 + 11 titik |

---

## A — VISUAL

### A.1 Dua sistem warna yang saling tidak cocok — utang paling menentukan

Ini temuan terpenting dari seluruh audit, dan ia tidak terlihat dari melihat layar.

**Sistem pertama**: variabel CSS di `app/globals.css`, ditulis dalam HSL.
**Sistem kedua**: **88 warna heksadesimal ditulis langsung** di dalam 54 berkas TSX.

Yang membuatnya serius: **kesepuluh warna yang ditulis tangan itu nilai token Carbon PERSIS.**

| Heks ditulis tangan | Kemunculan | Token Carbon yang cocok |
|---|---:|---|
| `#525252` | 16 | `textSecondary` |
| `#0f62fe` | 16 | `interactive` / `linkPrimary` |
| `#e0e0e0` | 12 | `borderSubtle01` |
| `#161616` | 12 | `textPrimary` |
| `#8d8d8d` | 10 | Gray 50 |
| `#0043ce` | 8 | Blue 70 |
| `#c6c6c6` | 6 | Gray 30 |
| `#f4f4f4` | 4 | `background` (g10) |
| `#da1e28` | 2 | `supportError` |
| `#002d9c` | 2 | Blue 80 |

**Sementara variabel CSS-nya MELESET** — dihitung, bukan ditebak:

| Variabel | Nilai kita | Token Carbon | |
|---|---|---|---|
| `--primary` | `#1064fe` | `#0f62fe` | **beda** |
| `--foreground` | `#171717` | `#161616` | **beda** |
| `--background` | `#ffffff` | `#f4f4f4` (g10) | **beda** (keputusan D-2) |
| `--muted-foreground` | `#525252` | `#525252` | sama |
| `--accent` | `#e0e0e0` | `#e0e0e0` | sama |

**Sebabnya bisa dijelaskan**: warna yang ditulis langsung disalin apa adanya, sedangkan
variabel CSS melewati konversi ke HSL dan pembulatannya menggeser satu-dua satuan.

**INI BUKAN KECEROBOHAN.** Ini akibat menyalin dari ingatan tanpa satu sumber. Orang yang
menulisnya melakukan hal yang benar — mengambil nilai Carbon — dan tetap menghasilkan dua
sistem yang tidak cocok, karena tidak ada satu tempat yang bisa dirujuk. **Tidak bisa
diperbaiki dengan disiplin, hanya dengan struktur.**

**Akibatnya**: elemen yang memakai variabel dan elemen yang memakai heks langsung
menampilkan biru yang **berbeda tipis** — cukup untuk membuat layar terasa "dibuat orang
berbeda", tanpa siapa pun bisa menunjuk apa yang salah. Dan tidak ada satu tempat pun
yang bisa diubah untuk mengganti tema.

**Diselesaikan Carbon secara struktural**: token Carbon jadi satu-satunya sumber, 88 heks
itu dicabut, dan tema Gray 10 (D-2) berlaku dengan mengganti satu nilai.

### A.2 Sebelas varian kelas warna Tailwind mentah

Di luar 88 heks itu, masih ada 11 varian `bg-`/`text-`/`border-` berbasis palet Tailwind
(gray, red, green, dan sebagainya) yang **bukan** palet Carbon sama sekali.

---

## B — KOMPONEN

### B.1 Elemen HTML mentah berdampingan dengan komponen bersama

| Elemen | Ditulis mentah | Komponen bersama dipakai di |
|---|---:|---:|
| `<button>` | **26** | 28 berkas |
| `<input>` | **27** | 23 berkas |
| `<table>` | **25** | 14 berkas (`data-table`) |
| `<select>` | **3** | 18 berkas |

Artinya untuk setiap jenis kontrol ada **dua jalur yang sama-sama hidup**. Tombol yang
ditulis mentah tidak ikut berubah saat komponen bersama diperbaiki — dan itulah mekanisme
persis bagaimana perbaikan "sudah diterapkan" tetap meninggalkan layar yang lama.

Catatan jujur: sebagian `<table>` mentah mungkin memang disengaja (tabel cetak surat
jalan, misalnya). Angka di atas belum memisahkan yang sengaja dari yang telanjur.

### B.2 Cetakan modal Carbon baru dipakai 1 dari 14

Empat belas berkas memakai modal; **satu** memakai cetakan `carbonModalContent`. Ini sudah
tercatat sebagai `AUD-25`.

Sisi baiknya untuk migrasi Carbon: 13 modal lain **belum** setengah dipindahkan, jadi tidak
ada pekerjaan bongkar-pasang setengah jadi.

---

## C — INTERAKSI

### C.1 Delapan belas bantuan yang hanya muncul saat kursor lewat

Atribut `title=` muncul **18 kali**. Aturan proyek (CLAUDE.md, 24 Agu 2026) sudah
menetapkan bahwa penjelasan bantuan **dibuka dengan KLIK, tidak pernah hanya dengan
sentuhan kursor** — karena tooltip hover **tidak bisa dipakai sama sekali** di HP dan
tablet, dan justru perangkat itulah yang dipakai di lantai produksi.

Komponen penggantinya (`FieldLabel`) sudah ada, tapi baru dipakai **3 berkas**.

**Carbon menyediakan padanannya**: `Toggletip` (dibuka dengan klik) dan `Tooltip` (hover,
hanya untuk label singkat non-esensial).

---

## E — AKSESIBILITAS

### E.2 Delapan belas bantuan yang tidak bisa dipakai di HP — prioritas TERTINGGI

**Dinaikkan dari golongan C ke E pada 25 Agu 2026 atas keputusan pemilik produk**, dan
alasannya tepat: tooltip hover bukan soal kenyamanan interaksi, melainkan soal **bisa atau
tidak bisa dipakai sama sekali**. Di HP dan tablet tidak ada "kursor lewat" — penjelasannya
tidak pernah muncul. Dan justru perangkat itulah yang dipakai di lantai produksi.

Delapan belas `title=` berarti delapan belas penjelasan yang **tidak terlihat oleh separuh
penggunanya**. Aturan penggantinya sudah ditulis (bantuan dibuka dengan KLIK), komponennya
sudah ada (`FieldLabel`), tapi baru dipakai 3 berkas.

**Cara memperbaikinya: aturan pramuka DS-3** — layar yang disentuh, dibereskan sekalian.
Bukan proyek penyisiran tersendiri, karena penyisiran sekali jalan akan meninggalkan yang
lahir sesudahnya.

Padanan Carbon: `Toggletip` (klik) untuk penjelasan yang perlu dibaca, `Tooltip` (hover)
hanya untuk label singkat yang tidak esensial.

### E.1 Belum terukur penuh — dan itu sendiri temuan

Yang bisa diukur sekarang: `aria-label` 13 kemunculan, `role=` **5 kemunculan di 54
berkas**, dan **nol `<img>` tanpa `alt`** (bagus).

**Yang TIDAK bisa disimpulkan dari angka ini**: apakah layarnya bisa dipakai dengan
keyboard saja, apakah urutan fokus masuk akal, apakah kontras warnanya lolos. Menyisir
teks tidak bisa menjawab itu — butuh pengujian sungguhan.

**Nilai Carbon di sini paling besar dan paling sering diremehkan**: komponen Carbon sudah
membawa peran ARIA, perangkap fokus, dan navigasi keyboard bawaan. Mengganti `<button>`
mentah dengan `Button` Carbon menutup sebagian utang ini **tanpa pekerjaan aksesibilitas
terpisah**.

---

## Yang SUDAH benar, supaya tidak ikut dibongkar

- **Font sudah IBM Plex Sans** lewat `next/font/google`, dipasang sekali di layout. Ini
  font resmi Carbon — bagian ini **sudah selesai sebelum Carbon masuk**.
- **Ukuran field 40px** cocok persis dengan Carbon `md`.
- **Anatomi modal** (Header/Body/Footer, tombol lebar penuh) sudah menyalin Carbon.
- **Empat lebar uji responsive** masing-masing jatuh di pita Carbon yang berbeda.
- **Panel Asal-Usul** dipakai 17 berkas — pola domain yang berhasil menyebar.

---

## Batas register ini

- Diukur lewat **pencocokan teks**, bukan dengan menjalankan layarnya. Ia menemukan apa
  yang ADA di kode; ia tidak bisa menemukan yang tampak salah hanya saat dipakai.
- **Golongan E belum diaudit sungguhan** — angka di atas hanya penanda kasar.
- Belum memisahkan yang **sengaja** dari yang **telanjur** pada elemen HTML mentah.
