# REKONSILIASI KODE TASK — DS-21 & DS-22

**STATUS: PROPOSED** — memuat usulan penyelesaian, **bukan** penyelesaian.
**28 Agustus 2026 · HEAD `4d39c0c` · nol perubahan `build_tasks`, nol perubahan sumber**

---

## 1. RINGKAS

| | |
|---|---|
| Tabrakan ditemukan | **satu**, yaitu `DS-21` |
| `DS-22` | **tidak ada tabrakan** — kode itu tidak pernah dicadangkan |
| Data rusak | **nol** |
| Task tertimpa | **nol** |
| Yang benar-benar hilang | **tempat untuk temuan F-01/F-11** |
| Membutuhkan pemilik produk | **YA** — satu keputusan, di §7 |

---

## 2. DS-21 — ASAL DUA KLAIM

### Klaim A — register kanonik (lebih dahulu)

`docs/FABRIX-Carbon-UX-Governance/CANONICAL-ID-REGISTER-2026-08-27.md` §4:

> `— ← F-01, F-11 | **NEW CANONICAL ID REQUIRED** (next free `DS-21`) | not created |
> **Product owner** to authorise | Parallel token system: `app/globals.css`,
> `tailwind.config.ts`, 181 usages / 17 files`

Dan di kakinya:

> *"No new identifier was created by this register. Next free numbers are `DS-21` and `AUD-49`."*

Diperkuat `RECONCILIATION-2026-08-27.md` baris 93, yang menandai F-01 **CONFIRMED** dengan
angka terukur: `text-muted-foreground` 72 · `text-foreground` 39 · `text-primary` 29 ·
`text-destructive` 18 · `bg-muted` 11 · `bg-background` 6 · sisanya 6 = **181 pemakaian di
17 berkas**.

**Masuk repositori: 27 Agu 2026, 01:35** (commit `7a6b4ce`).

### Klaim B — task yang benar-benar dibuat (kemudian)

`DS-21` — *"Indikator Langkah Modal Bertahap Meluber Horizontal di 360px"*.
Migrasi `20260901100000`, ditutup `20260901110000`, status **selesai**.

**Masuk repositori: 27 Agu 2026, 21:22** (commit `ecdf10b`).

---

## 3. SEBAB — DINYATAKAN APA ADANYA

Register sudah berada di repositori **dua puluh jam** sebelum `DS-21` dibuat. Saya tidak
membacanya. Kode diambil lewat mekanisme kanonik `scripts/kode-task-berikutnya.js`, yang
menjawab `DS-21` karena ia **hanya membaca tabel `build_tasks`** — dan pencadangan itu hidup
di **berkas markdown**, bukan di tabel.

**Ini kelalaian membaca, bukan balapan waktu, dan bukan kegagalan skrip.** Skripnya menjawab
persis pertanyaan yang bisa dijawabnya.

> **Catatan yang lebih berguna daripada permintaan maaf**: sepanjang pencadangan ID hidup di
> berkas markdown sementara pengalokasian ID membaca basis data, tabrakan yang sama akan
> terjadi lagi. Itu bentuk "dua jalur hidup" — dan yang menyelesaikannya bukan kehati-hatian,
> melainkan menyatukan tempatnya. Diusulkan di §7 sebagai bagian dari keputusan.

---

## 4. DS-22 — DIPERIKSA, TIDAK ADA TABRAKAN

`DS-22` — *"Baris Komponen BOM: Kolom Mengikuti Lebar LAYAR…"*, status **selesai**.

Disisir dari seluruh `docs/FABRIX-Carbon-UX-Governance/`: kode yang disebut berhenti di
`DS-21`. Register menyatakan kosong berikutnya *"`DS-21` dan `AUD-49`"* — **`DS-22` tidak
pernah dicadangkan siapa pun.**

**Putusan: `DS-22` sah, tidak perlu tindakan apa pun.**

---

## 5. BUKTI YANG TIDAK BOLEH DIHAPUS

Pekerjaan `DS-21` yang sudah selesai memuat bukti yang berdiri sendiri, dan **tidak boleh
dibuang demi merapikan penomoran**:

- 24 pengukuran peramban (4 formulir × 6 lebar) → nol luber
- Aritmetika penyebab yang mereproduksi ketiga angka terukur: `16 + N × 128 − 358`
- `tests/ds21_penanda_langkah_responsif.test.ts` — 6 penjaga, dibuktikan MERAH lebih dulu
- Penjaga (a2) yang mengikat konstanta 128px ke nilai yang dipancarkan paket Carbon
- Commit `ecdf10b`, `c39c6bf`

Bukti itu menempel pada **pekerjaannya**, bukan pada **nomornya**.

---

## 6. DAMPAK

| Yang terdampak | Dampak |
|---|---|
| Basis data | **Nihil.** Dua baris sah, tidak ada yang tertimpa |
| Pekerjaan DS-21/DS-22 | **Nihil.** Keduanya selesai dan terbukti |
| Temuan F-01/F-11 (token paralel, 181 pemakaian/17 berkas) | **Kehilangan tempat.** Masih belum tercatat sebagai task |
| Register §4 | **Usang** pada satu baris |
| Sepuluh temuan lain di register yang juga menunggu ID | **Tidak terdampak** |

> Perlu disebut juga: kolom status di register itu adalah **potret** pada commit `7ce6e3c`
> dan sudah bergeser. Register menulis `DS-17` *menunggu* dan `DS-14` *menunggu*; basis data
> hari ini menulis keduanya **selesai**. `AUD-47` tertulis *menunggu*; basis data menulis
> **dibatalkan**. Wajar untuk potret bertanggal — disebut supaya tidak dibaca sebagai keadaan
> sekarang.

---

## 7. USULAN PENYELESAIAN

### Yang diusulkan

1. **`DS-21` dan `DS-22` TETAP seperti adanya.** Menomori ulang task yang sudah selesai
   memutus tautan ke commit, migrasi, dan berkas ujinya — mahal, dan tidak memperbaiki apa pun.
2. **F-01/F-11 mendapat kode kosong berikutnya, yaitu `DS-23`.** Diperiksa lewat mekanisme
   kanonik hari ini.
3. **Baris §4 register dikoreksi** supaya menunjuk kode yang benar, dengan catatan kenapa
   berubah. Register itu **milik pemilik produk**, jadi tidak disunting sepihak.
4. **Pencadangan ID berhenti hidup di markdown.** Selama pencadangan ada di berkas dan
   pengalokasian membaca basis data, tabrakan yang sama pasti terulang. Dua jalan yang
   sama-sama menyelesaikannya: (a) task yang dicadangkan **dibuat** dengan status
   `menunggu_persetujuan`, sehingga skrip melihatnya; atau (b) `kode-task-berikutnya.js`
   ikut membaca berkas register.

### Yang TIDAK diusulkan

- Menghapus atau menomori ulang `DS-21`/`DS-22`
- Menyunting `build_tasks`
- Menyunting register milik pemilik produk

---

## 8. APAKAH MEMBUTUHKAN PEMILIK PRODUK

**YA — satu keputusan.**

> **Terima usulan §7 (DS-21/DS-22 tetap, F-01/F-11 jadi `DS-23`, dan pencadangan ID
> disatukan ke satu tempat)?**

Bila **ya**: batch berikutnya boleh membuat `DS-23` dan mengoreksi satu baris register.
Bila **tidak**: sebutkan penomoran yang Anda inginkan, dan saya kerjakan itu.

**Sampai dijawab, tidak ada yang diubah.**
