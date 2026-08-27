<!--
  STATUS: PROPOSED DECISION — BUKAN KEPUTUSAN.
  Tidak ada satu pun di dokumen ini yang berlaku sebelum pemilik produk menetapkannya.
  27 Agu 2026 · HEAD 96c25d2 · ANALISIS GOVERNANCE, NOL PERUBAHAN UI.
-->

# FABRIX Modal & Form Governance Decision
**Status: PROPOSED DECISION · REQUIRES PRODUCT OWNER DECISION** · 27 Agustus 2026

---

## 1. Problem

Audit modal global menemukan dua dokumen yang sama-sama mengikat menyatakan hal yang
bertentangan tentang formulir panjang, satu kewajiban yang komponennya tidak pernah dibangun,
dan tiga aturan Carbon yang tidak bisa dipatuhi sekaligus.

`FABRIX_CONSTITUTION.md` menetapkan jalan keluarnya sendiri:

> *"If two canonical sources conflict, STOP and create an ADR/decision request."*

Dokumen ini **adalah** decision request itu. Ia disusun agar bisa disalin langsung ke template
ADR di `FABRIX_ADR_REGISTER.md`, yang hari ini masih **kosong — nol ADR tercatat**.

---

## 2. Existing Governance

### Hierarki wewenang (dari `FABRIX_CONSTITUTION.md` §3, dikutip)

| # | Sumber |
|---|---|
| 1 | **Keputusan pemilik produk yang terkonfirmasi** |
| 2 | FABRIX Constitution / canonical governance |
| 3 | Baseline arsitektur yang disetujui |
| 4 | ADR yang disetujui |
| 5 | Daftar tugas |
| 6 | Implementasi berjalan, sebagai bukti AS-IS |
| 7 | Usulan agen |
| 8 | Selera pengembang |

> **Konsekuensi yang menentukan seluruh dokumen ini**: keputusan pemilik produk 26 Agu 2026
> berperingkat **1**; `FABRIX_CARBON_DESIGN_GOVERNANCE.md` berperingkat **2**. Hierarkinya
> jelas — **tetapi** §20 tidak pernah dicabut, dan Constitution melarang penimpaan diam-diam
> (*"No silent architectural overwrite"*). Peringkat menentukan mana yang menang; ia tidak
> menghapus kewajiban mencatat pencabutannya.

### Dokumen yang mengatur wilayah ini

| Dokumen | Status | Wilayahnya |
|---|---|---|
| `CLAUDE.md` §Aturan Komponen Form & Modal | Mengikat, 10 butir | Anatomi, ukuran field, aksi merusak, bantuan klik |
| `docs/governance/cetakan-halaman-data.md` §6e, §6e-2, §6e-3 | Keputusan pemilik produk 26 Agu | Ukuran modal, jumlah kolom, formulir panjang, batas gulir |
| `docs/FABRIX_CARBON_DESIGN_GOVERNANCE.md` §20, §21 | "Mandatory / Project-wide", baseline 24 Agu | Modal bad-examples, kewajiban drawer |
| `docs/00-GOVERNANCE/` (13 berkas) | **"Proposed Canonical Governance"** | Constitution, DoD, ADR, release gates |

---

## 3. Carbon Rules

Dibaca dari halaman resmi (versi kaki halaman: *React Components ^1.114.0, Last updated
24 August 2026* — cocok dengan paket terpasang).

| Kaidah | Kutipan | Halaman |
|---|---|---|
| Ambang isian | *"Use a dialog form when dealing with **less than five inputs**."* | forms-pattern |
| Ambang isian | *"Use a side panel form when dealing with **more than five inputs**."* | forms-pattern |
| Halaman khusus | *"Dedicated page — For more complex, lengthier or **multistep** requests for user input."* | forms-pattern |
| Larangan | *"Don't use to display complex or large amounts of data."* | dialog-pattern |
| Larangan | *"**Don't recreate a full app or page in a dialog.**"* | dialog-pattern |
| Larangan | *"**One modal should never trigger another modal.**"* | dialog-pattern |
| Frekuensi | *"if a user needs to repeatably perform a task, consider making the task completable on the main page."* | modal/usage |
| Progress modal | *"For longer tasks, use a progress modal to give the user a sense of completion and orientation within the focused flow."* | modal/usage |
| Syaratnya | *"A progress modal is **not a solution for excess modal content**."* | modal/usage |
| Percabangan | *"For complex flows with complex choices, consider using a full page instead of a modal."* | modal/usage |

> **Carbon sendiri tidak satu suara.** Halaman *forms-pattern* mengarahkan >5 isian ke side
> panel; halaman *modal/usage* mengesahkan progress modal untuk "longer tasks". Keduanya
> resmi, keduanya versi yang sama. Ini bukan kelalaian FABRIX.

---

## 4. Conflict-A — formulir panjang

### Pernyataan yang bertentangan

| Sumber | Peringkat | Isi |
|---|---|---|
| `FABRIX_CARBON_DESIGN_GOVERNANCE.md` §20:836-847 | 2 | **"long forms"**, "complete ERP records", "complex workflows" = **Bad examples**; *"prefer a page or side panel/drawer"* |
| `cetakan-halaman-data.md` §6e-2:303-306 | **1** | *"dipecah menjadi beberapa bagian, **bukan** dijadikan halaman penuh dan **bukan** dua kolom"* |

### KOREKSI PENTING terhadap laporan audit saya sendiri

Laporan audit menggambarkan §6e-2 sebagai larangan mutlak terhadap halaman penuh. **Setelah
dibaca utuh, itu tidak benar.** §6e-2 sudah memuat DUA pembatas yang tidak saya sebutkan:

**(a) Uji keabsahan pemecahan**, dikutip:
> *"Bagian itu bisa diberi judul yang **menyebut satu hal**, dan setiap field di dalamnya
> menjawab hal itu. Bila judulnya terpaksa berbunyi 'Lanjutan' atau 'Bagian 2', pemecahannya
> salah — itu memuatkan, bukan mengelompokkan."*

**(b) Jalan keluar ke halaman penuh yang sudah tertulis**, dikutip:
> *"**Kapan TETAP halaman penuh, bukan progress modal:** … ketika langkah berikutnya
> **bergantung pada pilihan** di langkah sebelumnya sampai alurnya bercabang."*

Jadi §6e-2 **tidak** melarang halaman penuh. Ia melarang halaman penuh **sebagai jawaban atas
panjang saja**, dan sudah mengarahkan alur **bercabang** ke halaman penuh.

**Konfliknya karena itu JAUH LEBIH SEMPIT** daripada yang laporan audit saya nyatakan.
Yang benar-benar bertentangan hanya ini: §20 menyebut panjangnya formulir sebagai alasan
cukup untuk keluar dari modal; §6e-2 menyatakan panjang saja **bukan** alasan.

### Diuji terhadap kenyataan: keempat form besar

| Form | Langkah | Judul menyebut satu hal? | Bercabang? | Menurut §6e-2 |
|---|---|---|---|---|
| PO Klien (M10) | Klien · PIC · Tanggal & bayar · Barang | **ya, keempatnya** | tidak | **SAH** |
| BOM (M07) | Resep · Komponen | **ya** | tidak | **SAH** |
| Master Item (M12) | Identitas · Satuan · Persediaan | **ya** | tidak | **SAH** |
| Karyawan (M06) | Identitas · Gaji · Pajak & BPJS | **ya** | tidak | **SAH** |

**Nol langkah berjudul "Lanjutan" atau "Bagian 2". Nol alur bercabang.** Keempatnya
**patuh** pada keputusan 26 Agu — bukan pelanggaran.

### Yang §6e-2 TIDAK atur sama sekali — ini celah, bukan konflik

**Baris berulang.** PO Klien dan BOM memuat baris yang bisa ditambah dan dihapus pengguna.
§6e-2 tidak menyebutnya, Carbon menyebutnya lewat *"Don't use to display complex or large
amounts of data"*, dan §6e-3 memberi bukti terukur kenapa itu berbahaya di modal:

> Tombol yang berada di batas gulir modal **tidak bekerja pada klik pertama** — `mouseup` dan
> `click` tidak pernah terbentuk. Terukur di peramban, bukan diduga.

Modal dengan baris berulang **tidak punya tinggi yang bisa diperkirakan**, jadi ia bisa
melewati batas gulir kapan saja tanpa ada yang menyadarinya.

### Tiga opsi

#### OPTION A — Carbon jadi bawaan; <5 isian → dialog, >5 → side panel, kompleks → halaman

| Dimensi | Konsekuensi |
|---|---|
| UX | Paling dekat dengan yang dikenal pengguna Carbon; formulir pendek terasa ringan |
| Rekayasa | **Butuh membangun side panel lebih dulu** (KONFLIK-B). Tanpa itu opsi ini mustahil dijalankan |
| Konsistensi | Tinggi ke depan; **memutus** dengan seluruh 15 modal formulir yang ada |
| Kepatuhan Carbon | Tertinggi |
| Migrasi | **13 dari 15 modal formulir** harus pindah bentuk |
| Layar terdampak | Item, BOM, PO Klien, Karyawan, Pelanggan, Purchasing ×3, Routing, Pengiriman ×2, Work Order, PPIC, Dokumen |
| Amandemen | Cabut §6e-2; pertahankan §20; bangun side panel |
| **Penilaian saya** | **Tidak disarankan sekarang** — biayanya sangat besar dan ia membatalkan keputusan pemilik produk yang berperingkat 1, demi kepatuhan pada dokumen yang Carbon sendiri tidak konsisten tentangnya |

#### OPTION B — Keputusan 26 Agu jadi deviasi resmi terhadap Carbon

| Dimensi | Konsekuensi |
|---|---|
| UX | Tidak ada yang berubah; pengguna tidak belajar ulang |
| Rekayasa | **Nol migrasi.** Cetakan `modal-bertahap.tsx` sudah ada dan dipakai 4 form |
| Konsistensi | Tinggi — satu bentuk untuk semua formulir panjang |
| Kepatuhan Carbon | **Menyimpang secara sadar dan tercatat**, yang CLAUDE.md izinkan asal beralasan |
| Migrasi | Nol |
| Layar terdampak | Nol |
| Amandemen | §20 dicabut untuk "long forms"; §6e-2 dinaikkan jadi kanonik |
| **Penilaian saya** | **Aman, tapi meninggalkan celah baris berulang tak terjawab** |

#### OPTION C — §6e-2 dipertajam menurut SIFAT pekerjaan, bukan panjangnya *(REKOMENDASI)*

Membedakan empat hal yang selama ini tercampur di bawah kata "panjang":

| Sifat | Bentuk | Alasan |
|---|---|---|
| **Berlangkah sederhana** — urutan tetap, tiap langkah satu konteks | **Progress modal** | Sudah berjalan, sudah lulus uji §6e-2 |
| **Berlangkah bercabang** — langkah berikutnya bergantung pilihan | **Halaman penuh** | Sudah tertulis di §6e-2, tinggal ditegaskan |
| **Alur dengan baris berulang** — tabel/baris yang bisa ditambah | **Halaman penuh** | **BARU.** Tingginya tidak bisa diperkirakan; §6e-3 membuktikan akibatnya terukur |
| **Alur rekayasa/transaksi** yang bisa ditinggal dan dilanjutkan | **Halaman penuh** | Modal tidak punya alamat; pekerjaan yang ditinggal hilang |

| Dimensi | Konsekuensi |
|---|---|
| UX | Formulir tetap; **hanya yang berbaris berulang yang pindah** |
| Rekayasa | Dua layar baru: PO Klien dan BOM |
| Konsistensi | Tertinggi — aturannya menyebut **sebab**, bukan ambang yang bisa diakali |
| Kepatuhan Carbon | Selaras dengan *"Don't use to display complex or large amounts of data"* dan *"complex choices → full page"*, menyimpang sadar dari ambang <5 |
| Migrasi | **2 layar**, bukan 13 |
| Layar terdampak | **PO Klien (M10), BOM (M07)** |
| Amandemen | §20 dipersempit; §6e-2 ditambah butir baris berulang |
| **Penilaian saya** | **DISARANKAN.** Ia menghormati keputusan peringkat 1, memakai bukti terukur FABRIX sendiri (§6e-3), dan memindahkan dua layar — bukan tiga belas |

---

## 5. Conflict-B — side panel

**Keadaan terukur**: nol `SidePanel`, nol `Drawer`, nol `Popover` di seluruh kode.
`FABRIX_CARBON_DESIGN_GOVERNANCE.md` §21 dan tabel pemetaan (baris 1884) mewajibkannya,
dengan contoh eksplisit: detail Work Order, detail bahan, detail pengecualian MRP.

**Yang FABRIX pakai sebagai gantinya hari ini**: baris tabel yang dimekarkan, di **9 halaman**.
Itu bukan ketiadaan pola — itu **pola lain yang konsisten dipakai**.

| Opsi | Kegunaan | Selaras Carbon | Manfaat UX | Biaya | Risiko | Cakupan migrasi |
|---|---|---|---|---|---|---|
| **A** — wajib, bangun komponen bersama | Semua contextual editing | Tinggi | Konteks halaman tetap terlihat | **Besar** — komponen baru + migrasi 9 halaman | Pola ketiga hidup berdampingan sebelum yang lama dicabut | 9 halaman |
| **B** — opsional | Dipakai bila cocok | Sedang | Fleksibel | Rendah | **"Opsional" berarti tiap layar memilih sendiri — itu melahirkan dua jalur hidup** | 0 |
| **C** — hanya untuk kategori tertentu | Mis. hanya alur bercabang | Sedang | Terarah | Sedang | Butuh definisi kategori yang tegas | terbatas |
| **D** — governance direvisi: baris mekar diakui sebagai pola kontekstual FABRIX | — | **Deviasi tercatat** | Nol pembelajaran ulang; sudah terbukti di 9 halaman | **Nol** | Kelak bila butuh side panel sungguhan, keputusannya diambil ulang | 0 |

**Rekomendasi: OPTION D**, dengan satu syarat: §21 **dicabut secara tertulis**, bukan
dibiarkan menggantung. Kewajiban yang komponennya tak pernah dibangun selama ini tidak menahan
apa pun — ia hanya membuat setiap audit berikutnya menemukan "pelanggaran" yang sama.

---

## 6. Focus Conflict

Tiga halaman resmi Carbon, tiga aturan:

| # | Sumber | Aturan |
|---|---|---|
| 1 | `components/modal/usage/` | *"set the initial focus to the first location that accepts user input… If it is a transactional modal without form inputs… the first focus should be on the **primary button**."* |
| 2 | `components/modal/accessibility/` | Fokus ke tombol **batal** untuk dialog berbahaya |
| 3 | Aturan umum dialog | Fokus ke elemen **fokusable pertama** — pada anatomi Carbon itu ikon tutup (×) |

**Pada modal hapus tanpa isian, aturan (1) menaruh fokus di tombol HAPUS.**

**Keadaan FABRIX terukur**: **nol dari 26 overlay** menetapkan `selectorPrimaryFocus`.
Bawaan Carbon terukur mendarat di tombol sekunder — aman, tapi **kebetulan**.

### Usulan aturan FABRIX per operasi

| Operasi | Fokus awal | Dasar |
|---|---|---|
| **CREATE** | Field pertama | Carbon (1); modal berisi formulir |
| **EDIT** | Field pertama | Sama |
| **DELETE** | **Tombol Batal** | Carbon (2); (1) akan menaruhnya di tombol Hapus |
| **ARCHIVE** | **Tombol Batal** | Sama; bisa dipulihkan tapi tetap mengubah keadaan |
| **RESTORE** | Tombol utama (Pulihkan) | Bukan merusak; Carbon (1) berlaku apa adanya |
| **INFORMATION** | Tombol tutup | Tidak ada isian; tidak ada yang merusak |

Ambiguitas Carbon **didokumentasikan, bukan disembunyikan**: FABRIX memilih (2) untuk operasi
merusak dan (1) untuk sisanya, dan menetapkannya **eksplisit** lewat `selectorPrimaryFocus` —
bukan mengandalkan bawaan.

---

## 7. Field Count Conflict

Tiga angka beredar: Carbon **<5**; standar usulan saya **4/8/12**; keputusan 26 Agu **tidak
memakai angka sama sekali**.

### Haruskah jumlah field jadi penentu?

| Model | Penilaian |
|---|---|
| **A — batas keras** | **Tidak.** Formulir 4 field dengan baris berulang lebih berat daripada 12 field tetap |
| **B — heuristik** | Mendekati, tapi masih menempatkan angka di depan |
| **C — sinyal sekunder** | **Ya** |
| **D — tidak dipakai sendirian** | **Ya, dan ini yang disarankan** |

**Rekomendasi: C + D.** Jumlah field dipakai **hanya** sebagai pemicu pemeriksaan, bukan
sebagai vonis. Yang memutuskan adalah **sifat pekerjaannya**:

| Faktor | Bobot | Kenapa |
|---|---|---|
| **Baris berulang / tabel** | **PENENTU** | Tinggi tak terduga; §6e-3 membuktikan akibatnya terukur |
| **Percabangan** | **PENENTU** | Sudah tertulis di §6e-2 dan di Carbon |
| **Bisa ditinggal & dilanjutkan** | **PENENTU** | Modal tidak punya alamat |
| **Butuh melihat halaman di belakangnya** | **PENENTU** | Carbon: *"Don't use if additional information outside the modal needs to be consulted"* |
| **Frekuensi harian** | Tinggi | Carbon: *"if a user needs to repeatably perform a task, consider making the task completable on the main page"* |
| **Durasi tugas** | Sedang | Pekerjaan panjang menuntut penyimpanan sementara |
| **Perilaku di ponsel** | Sedang | Di bawah 672px semua modal 100% lebar |
| **Sifat merusak** | Sedang | Menentukan varian, bukan bentuk |
| **Jumlah field** | **Rendah — pemicu saja** | ≥ 9 field → wajib diperiksa terhadap faktor di atas |

Ini mencegah keduanya sekaligus: *"12 field = otomatis modal"* dan *"5 field = otomatis side
panel"*.

---

## 8–9. Options & Recommended Resolution

| Konflik | Rekomendasi |
|---|---|
| A — formulir panjang | **OPTION C** — aturan menurut sifat pekerjaan; 2 layar pindah, bukan 13 |
| B — side panel | **OPTION D** — akui baris mekar sebagai pola kontekstual FABRIX; **cabut §21 secara tertulis** |
| Fokus | Merusak → **Batal**; berisi formulir → **field pertama**; ditetapkan **eksplisit** |
| Jumlah field | **Sinyal sekunder**, bukan batas; ≥ 9 memicu pemeriksaan |

---

## 10. Proposed FABRIX Rules — FORM INTERACTION DECISION MATRIX

| Kondisi | Modal | Progress Modal | Halaman Penuh | Inline |
|---|:---:|:---:|:---:|:---:|
| Konfirmasi merusak | **✓** (danger) | | | |
| Pemberitahuan yang harus diakui | **✓** (pasif) | | | |
| ≤ 4 field, urutan tetap | **✓** | | | |
| 5–8 field, urutan tetap, satu konteks | **✓** | | | |
| Field bisa dikelompokkan jadi ≥2 konteks utuh | | **✓** | | |
| **Ada baris berulang / tabel** | | | **✓** | |
| **Alur bercabang** | | | **✓** | |
| **Bisa ditinggal & dilanjutkan** | | | **✓** | |
| **Butuh melihat halaman di belakangnya** | | | **✓** | |
| Dikerjakan berkali-kali setiap hari | | | **✓** | ✓ |
| Mengubah satu field | | | | **✓** |
| Menyaring / mengurutkan / memilih | | | | **✓** |

### Decision tree

```
MULAI
 │
 ├─ Merusak & butuh konfirmasi?        → MODAL danger (fokus awal: Batal)
 ├─ Hanya memberi tahu?                → MODAL pasif
 │
 ├─ Ada baris berulang atau tabel?     → HALAMAN PENUH        ← penentu
 ├─ Langkah berikutnya bercabang?      → HALAMAN PENUH        ← penentu
 ├─ Bisa ditinggal lalu dilanjutkan?   → HALAMAN PENUH        ← penentu
 ├─ Perlu melihat halaman di belakang? → HALAMAN PENUH        ← penentu
 │                                        (side panel bila kelak dibangun)
 ├─ Dikerjakan berkali-kali sehari?    → INLINE / halaman utama
 │
 ├─ Field-nya bisa dikelompokkan jadi ≥2 konteks utuh,
 │  masing-masing berjudul SATU HAL?   → PROGRESS MODAL
 │     (bila judulnya terpaksa "Bagian 2" → pengelompokannya salah)
 │
 ├─ ≤ 8 field, satu konteks?           → MODAL
 └─ Selain itu                         → periksa ulang dari atas
```

**Jumlah field tidak muncul sebagai penentu di mana pun** — hanya di ujung, setelah seluruh
pertanyaan tentang sifat pekerjaan dijawab.

---

## 11. Impact on Existing Screens

Bila OPTION C + D diambil:

| Layar | Sekarang | Menurut usulan | Pindah? |
|---|---|---|---|
| **PO Klien (M10)** | Progress modal, 19 field, **baris berulang** | **Halaman penuh** | **YA** |
| **BOM (M07)** | Progress modal, 12 field, **baris berulang** | **Halaman penuh** | **YA** |
| Master Item (M12) | Progress modal, 14 field | **Tetap** — nol baris berulang, nol percabangan | tidak |
| Karyawan (M06) | Progress modal, 15 field | **Tetap** | tidak |
| Purchasing terima barang (M17) | Modal + tabel | **Perlu diukur** — tabelnya baca-saja atau bisa diisi? | mungkin |
| Pengiriman (M19) | Modal + tabel | **Perlu diukur** | mungkin |
| PPIC (M22) | Modal + tabel | **Perlu diukur** | mungkin |
| 15 modal lain | Modal | **Tetap** | tidak |
| 6 `window.confirm` | Kotak peramban | Modal danger — **milik DS-06**, bukan tahap ini | ya, di DS-06 |

**Dua layar pindah pasti, tiga perlu diukur, sembilan belas tetap.**

---

## 12. Required Governance Amendments

| # | Berkas | Perubahan |
|---|---|---|
| 1 | `FABRIX_CARBON_DESIGN_GOVERNANCE.md` §20 | **"long forms" dicabut** dari Bad examples; diganti "forms with repeating rows or branching flows" |
| 2 | `FABRIX_CARBON_DESIGN_GOVERNANCE.md` §21 + baris 1884 | Kewajiban side panel **dicabut**; baris mekar diakui sebagai pola kontekstual FABRIX |
| 3 | `cetakan-halaman-data.md` §6e-2 | **Ditambah** butir: baris berulang → halaman penuh |
| 4 | `CLAUDE.md` Aturan Komponen Form & Modal | **Butir 11 baru**: fokus awal per operasi |
| 5 | `FABRIX_ADR_REGISTER.md` | **ADR-001** mencatat pencabutan §20 & §21 beserta alasannya |
| 6 | `FABRIX_MODAL_FORM_ARCHITECTURE_STANDARD.md` | Status **PROPOSED → CANONICAL** setelah 1–5 |

---

## 13. Migration Consequences

**Nol migrasi database. Nol perubahan API. Nol perubahan model data.** Yang berpindah adalah
tempat formulirnya dirender.

Risiko yang perlu disadari: memindahkan PO Klien dan BOM ke halaman penuh berarti **membuat
dua route baru**, dan aturan navigasi FABRIX melarang route yang dikarang maupun halaman
kosong. Keduanya harus lahir lengkap, bukan bertahap.

---

## 14. Decisions Required From Product Owner

Lihat blok di bawah.

---

## 15. Explicit Non-Decisions

Yang **TIDAK** saya putuskan, dan sengaja:

1. Mana yang menang antara §20 dan keputusan 26 Agu.
2. Apakah side panel dibangun.
3. Aturan fokus mana dari tiga aturan Carbon.
4. Apakah PO Klien dan BOM pindah ke halaman penuh.
5. Apakah 13 dokumen `docs/00-GOVERNANCE/` naik dari "Proposed" jadi kanonik.
6. Apakah ambang jumlah field dipakai sama sekali.

---

## 16. Next Implementation Sequence

Bila keputusan diambil, urutan yang disarankan — **tidak dimulai sebelum itu**:

1. **ADR-001** dicatat (mekanisme yang Constitution sendiri tuntut).
2. **Amandemen governance** 1–4 di tabel §12.
3. **Fokus awal 26 modal** — nol keputusan produk tersisa, bisa di bawah DS-09.
4. **DS-06** — 6 `window.confirm` jadi modal danger.
5. **Baru kemudian** pemindahan bentuk, satu layar per giliran, dengan pengukuran sebelum dan
   sesudah.

---

## PRODUCT OWNER DECISION BLOCK

### DECISION 1 — Strategi formulir panjang
- **A** — Carbon jadi bawaan (<5 dialog, >5 side panel) → **13 layar pindah**, dan side panel harus dibangun dulu
- **B** — Keputusan 26 Agu jadi deviasi resmi → **nol layar pindah**, celah baris berulang tetap terbuka
- **C** *(saran saya)* — aturan menurut **sifat pekerjaan** → **2 layar pindah**, celah baris berulang tertutup

### DECISION 2 — Side panel
- **A** — Wajib, bangun komponen bersama → 9 halaman bermigrasi
- **B** — Opsional → tiap layar memilih sendiri; melahirkan dua jalur hidup
- **C** — Hanya kategori tertentu → butuh definisi kategori
- **D** *(saran saya)* — Cabut §21; akui baris mekar sebagai pola kontekstual FABRIX → nol biaya

### DECISION 3 — Aturan fokus awal
- **A** — Ikuti Carbon (1) apa adanya → pada modal hapus, fokus mendarat di tombol **HAPUS**
- **B** *(saran saya)* — Merusak → **Batal**; berisi formulir → **field pertama**; ditetapkan eksplisit
- **C** — Biarkan bawaan Carbon → hari ini aman, tapi kebetulan, dan tak ada uji yang menjaganya

### DECISION 4 — Jumlah field
- **A** — Batas keras → 4 field berbaris-berulang lolos, 12 field tetap tertolak
- **B** — Heuristik → angka tetap di depan
- **C/D** *(saran saya)* — **Sinyal sekunder saja**; ≥9 memicu pemeriksaan, sifat pekerjaan yang memutuskan

### DECISION 5 — PO Klien (19 field, 4 langkah, baris berulang)
- **Modal** → melanggar Carbon di dua tempat
- **Progress modal** *(keadaan sekarang)* → lulus §6e-2, tapi tingginya tak terduga
- **Side panel** → butuh DECISION 2 = A
- **Halaman penuh** *(saran saya)* → butuh route baru; nol perubahan data

### DECISION 6 — BOM (12 field, 2 langkah, baris berulang)
- **Modal** → tidak disarankan
- **Progress modal** *(keadaan sekarang)* → lulus §6e-2
- **Side panel** → butuh DECISION 2 = A
- **Halaman penuh** *(saran saya)* → sejalan dengan PO Klien

---

> **Satu pengukuran yang belum saya lakukan, dan akan menajamkan DECISION 5 dan 6**: apakah
> langkah-langkah keempat form besar itu benar-benar **menggulir** di 768px. Bila ya, §6e-3
> berlaku pada mereka — tombolnya bisa menelan klik pertama. Itu bukti terukur, bukan pendapat,
> dan saya bisa mengambilnya kapan pun Anda minta.
