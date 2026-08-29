# INF-28 — PENCADANGAN & PEMULIHAN

**Tanggal:** 29 Agustus 2026 · **Menjawab:** §21, §22 perintah eksekusi
**Status:** **EXPORT TERVERIFIKASI · RESTORE TIDAK TERVERIFIKASI · RECOVERY TIDAK TERVERIFIKASI**

> §22 menuntut ketiganya dibedakan. Berkas ini membedakannya, dan **hanya yang pertama
> yang boleh diklaim**.

---

## 1. EXPORT — TERVERIFIKASI

Ekspor sungguhan dijalankan untuk **seluruh 92 tabel** di `backup-table-list.txt`:
**nol yang gagal**. Hasil pencadangan nyata di mesin ini (24 Agu 2026) diperiksa isinya:

```
92 berkas · 90 tabel tercatat di _SUMMARY.json · 2.360 baris · 0 tabel ber-ERROR
Storage: 4 dari 4 berkas tersalin (company-logos 1, user-signatures 3)
```

**Terverifikasi.** Data keluar, dan berkas Storage ikut keluar.

---

## 2. Apa yang ADA dan TIDAK ADA di dalam cadangan

Diperiksa langsung pada hasil pencadangan, bukan dari membaca skrip:

| Isi | Ada? |
|---|---|
| Data tiap tabel (JSON per tabel) | **ya** |
| Berkas Storage (isinya, bukan hanya nama) | **ya** |
| Ringkasan jumlah baris | **ya** |
| **Skema** (DDL tabel, kolom, tipe) | **TIDAK** |
| **Kekangan** (FK, unique, check) | **TIDAK** |
| **Sequence beserta nilainya** | **TIDAK** |
| **Fungsi** basis data | **TIDAK** |
| **Kebijakan RLS** | **TIDAK** |
| **Trigger** | **TIDAK** |
| **Hak akses** (grant) | **TIDAK** |

**Ini bukan cacat — ini pembagian tugas.** Struktur hidup di `supabase/migrations/`
(319 migrasi, ada di git). Cadangan menyimpan **data**; git menyimpan **bentuknya**.

**Yang menjadi cacat adalah ketiadaan jalur yang menyatukan keduanya kembali.**

---

## 3. RESTORE — TIDAK TERVERIFIKASI, dan ini alasannya, bukan sekadar pernyataan

**Nol skrip pemulihan ada.** `scripts/backup-export-json.js` hanya menulis; tidak ada yang
membacanya kembali. Jadi pemulihan hari ini berarti seseorang menulis skripnya saat panik —
yaitu saat paling buruk untuk menulis skrip.

Hambatan yang **terukur**, bukan diduga:

| # | Hambatan | Angka terukur | Kenapa menggigit |
|---|---|---|---|
| 1 | **Urutan insert** | **239** foreign key | Memasukkan baris sebelum induknya = penolakan FK. **Kabar baik: nol siklus dua-arah**, jadi urutan topologis **memang bisa** disusun; **2 FK menunjuk tabel sendiri**, yang perlu penanganan khusus |
| 2 | **Sequence** | **92 sequence** | Baris dimasukkan dengan id eksplisit **tidak** menggeser sequence. Tanpa penyelarasan ulang, insert BERIKUTNYA setelah pemulihan akan menabrak id yang sudah ada — dan gagalnya terjadi **nanti**, bukan saat memulihkan |
| 3 | **Trigger ikut menyala** | **15 trigger** memakai `log_data_change` / `enforce_status_transition` | **Ini yang paling licin.** Memasukkan ulang 2.360 baris akan **menulis 2.360 baris audit palsu** ke `data_change_audit_log`, seolah seseorang mengubah data hari itu. Jejak auditnya **rusak justru oleh proses pemulihannya** |
| 4 | **Storage** | 4 berkas | Ada skrip menyalin **keluar**, nol skrip mengunggah **kembali** |
| 5 | **Urutan struktur vs data** | 69 fungsi · 157 kebijakan · 28 trigger | Seluruhnya harus dibangun dari migrasi **lebih dulu**; memulihkan data ke basis data kosong tanpa itu akan berhasil sebagian lalu gagal di RLS |

---

## 4. Kenapa uji pemulihan TIDAK dijalankan di giliran ini

§21 mengizinkan menjalankan uji pemulihan **bila aman dan bukan production**. Diperiksa,
dan **tidak ada tempat yang aman hari ini**:

- **Proyek nyata** — dilarang mutlak.
- **Staging** — dipakai seluruh suite regresi; menimpanya memutus satu-satunya tempat
  pengujian yang ada.
- **CI** — dipakai pemeriksaan otomatis; menimpanya memutus gerbang rilis.

Uji pemulihan yang benar butuh **proyek Supabase keempat yang sekali pakai**. Membuatnya
adalah keputusan biaya & kredensial milik pemilik produk, bukan keputusan teknis yang boleh
diambil sendiri.

> **RESTORE NOT VERIFIED**, sesuai §21.

---

## 5. RECOVERY — TIDAK TERVERIFIKASI

Karena pemulihan belum pernah dijalankan, **pemulihan yang menghasilkan sistem yang benar-
benar berfungsi** jelas belum terbukti. §22 melarang mengklaimnya.

**Kalimat yang TIDAK boleh dipakai sampai uji itu dijalankan:** *"data aman karena sudah
dicadangkan."* Yang benar hari ini: **"data sudah disalin keluar; mengembalikannya belum
pernah dicoba."**

---

## 6. Yang dibutuhkan agar INF-28 bisa ditutup

1. Proyek Supabase sekali pakai (**keputusan pemilik produk**).
2. Skrip pemulihan: bangun struktur dari migrasi → matikan trigger audit → masukkan data
   menurut urutan topologis → **selaraskan 92 sequence** → nyalakan kembali trigger →
   unggah ulang berkas Storage.
3. Pembuktian dengan **membandingkan**, bukan dengan melihat skripnya selesai: jumlah baris
   per tabel sama, kekangan tidak ada yang dilanggar, dan **`data_change_audit_log` tidak
   bertambah 2.360 baris palsu**.

**Butir 3 adalah inti INF-28.** Pemulihan yang "berhasil" tetapi menghasilkan jejak audit
palsu adalah pemulihan yang merusak hal yang paling tidak boleh rusak.
