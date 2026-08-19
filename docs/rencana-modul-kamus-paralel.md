# Modul Kamus — Rencana Kerja Paralel & Instruksi Claude Code

**Masalah yang diselesaikan:** selama Claude Code bekerja, pemilik produk & tim menganggur.
Modul ini mengubah waktu tunggu itu menjadi aset paling bernilai untuk fitur AI —
sekaligus mendistribusikan pertanyaan ke orang yang benar-benar tahu jawabannya.

**Prinsip inti:** pemilik produk tidak harus menjawab semua. Pertanyaan tentang metrik
margin dijawab Finance, arti tahap produksi dijawab SPV Produksi, alur gudang dijawab
kepala gudang. Sistem yang menyarankan ke siapa, bukan menebak sendiri.

---

# BAGIAN 1 — Model kerja

```
Claude Code bekerja  ──►  Anda & tim mengisi kamus (paralel, tidak saling menunggu)
        │                              │
        └──► modul baru selesai        └──► kamus modul itu ikut terisi
                    │                              │
                    └──────────► keduanya masuk repo bersama ◄──┘
```

**Ritme harian yang disarankan**
| Kapan | Siapa | Berapa lama |
|---|---|---|
| Saat Claude Code berjalan | Anda: buka antrean kamus, jawab yang bisa | 10–20 menit |
| Pertanyaan di luar keahlian Anda | Tandai ke departemen terkait, tanyakan langsung | 5 menit |
| Sekali seminggu | Tim menjawab antrean masing-masing | 15 menit/orang |
| Saat Claude Code selesai satu modul | Anda konfirmasi draf AI modul itu | 15 menit |

---

# BAGIAN 2 — Instruksi Claude Code: Sesi K1 (bangun sekarang)

**Format B.0.2. Lingkup sengaja dibatasi ke antrean saja — mode ikon inline ditunda
ke K2 (lihat Bagian 3), karena butuh provenance di banyak komponen.**

## 1. TUJUAN
Membangun modul Kamus internal: sistem menghasilkan daftar pertanyaan makna data dari
skema nyata, menyarankan departemen penjawabnya, dan menyediakan antrean pengisian
supaya pemilik produk & tim bisa menjawab kapan saja secara paralel.

## 2. KONTEKS YANG WAJIB DIBACA DULU
1. Skema nyata seluruh tabel: nama tabel, kolom, tipe, nullable, komentar yang ada.
2. `docs/spesifikasi-aturan-biaya-v1.md` rev. 4 — sumber definisi metrik yang sudah final.
3. `docs/kamus-sementara.md` bila sudah ada — impor sebagai draf awal.
4. Daftar role/departemen yang sudah ada di sistem (16 role) — untuk pemetaan penjawab.
5. Aturan privasi gaji yang berlaku — modul ini TIDAK boleh menampilkan data gaji;
   ia hanya membahas *arti kolom*, bukan isinya.

## 3. LANGKAH

### 3.1 Skema data
```
kamus_terms
  id, tenant_id
  scope enum(FIELD, METRIC, RELATION, RULE)
  entity            -- nama tabel (untuk FIELD/RELATION), null untuk METRIC/RULE
  field             -- nama kolom, null bila bukan FIELD
  key               -- kunci unik: "bom_lines.qty_per" / "metric.margin_kontribusi"
  priority smallint -- 1..5 (lihat 3.2)
  domain            -- uang | kuantitas | status | standar | proses | lainnya
  suggested_role_id -- departemen/role yang disarankan menjawab
  status enum(BELUM, DRAF_AI, DIJAWAB, DIKONFIRMASI, TIDAK_RELEVAN)
  ai_draft text     -- draf jawaban dari Claude Code
  answer_plain text     -- jawaban Q1: penjelasan ke karyawan baru
  answer_pitfall text   -- jawaban Q2: kesalahpahaman yang biasa terjadi
  answer_range text     -- jawaban Q3: nilai wajar vs mencurigakan
  answered_by, answered_at
  confirmed_by, confirmed_at
  assigned_to_role_id, assigned_note
  created_at, updated_at, version

kamus_term_history   -- setiap perubahan jawaban (siapa, kapan, dari apa ke apa)
```
RLS: semua baris ber-`tenant_id`; baca boleh semua role internal; tulis jawaban boleh
role yang ditugaskan atau admin; konfirmasi hanya admin/pemilik produk.

### 3.2 Generator backlog (retro seluruh sistem, "awal sampai update terbaru")
Job yang memindai skema nyata dan membuat baris `kamus_terms` untuk setiap kolom yang
layak dijelaskan. Aturan prioritas otomatis:

| Prioritas | Kriteria |
|---|---|
| 1 | Kolom uang & biaya: harga, cost, margin, valuasi |
| 2 | Kuantitas & satuan: qty_*, uom, konversi, basis BOM |
| 3 | Status & alur: kolom status, transisi, approval |
| 4 | Standar terpelajar K8: source, sample_count, nilai standar |
| 5 | Sisanya |

Dikecualikan otomatis: kolom teknis (`id`, `created_at`, `updated_at`, `version`,
`tenant_id`, FK murni tanpa makna bisnis) dan seluruh kolom bermuatan gaji.

Job ini **idempoten**: dijalankan ulang setelah migrasi baru hanya menambah baris untuk
kolom baru, tidak menghapus/menimpa jawaban yang sudah ada.

### 3.3 Pemetaan penjawab (tabel konfigurasi, BUKAN hardcode)
```
kamus_routing_rules
  domain | entity_pattern | suggested_role_id | rationale
```
Aturan awal yang diisi seed (bisa diubah admin lewat UI):

| Domain / entitas | Departemen disarankan |
|---|---|
| Metrik & kolom uang, costing, margin, valuasi | Finance |
| BOM, formulasi, yield, tahap produksi, routing | SPV Produksi (gummy/powder sesuai lini) |
| Stok, lot, lokasi, opname, satuan | Kepala gudang |
| PO supplier, lead time, harga beli | Purchasing |
| Kapasitas, jadwal, feasibility, standar K8 | PPIC |
| Approval, kebijakan dokumen, aturan tak-terlihat | Pemilik produk |
| Kualitas, inspeksi, NCR | QC |

Kalau tidak ada aturan cocok → `suggested_role_id = null`, ditampilkan sebagai
"belum ditentukan" dan bisa ditugaskan manual.

### 3.4 Draf AI
Untuk setiap baris, Claude Code menyusun `ai_draft` dari: nama kolom, tipe, constraint,
komentar skema, pemakaian di kode, dan definisi yang sudah ada di spesifikasi biaya.
Wajib menandai eksplisit bagian yang ditebak. **Dilarang menebak untuk scope METRIC yang
sudah didefinisikan di spesifikasi biaya — kutip definisi resminya.**

### 3.5 UI antrean (`/kamus`)
- **Daftar**: filter status, prioritas, domain, departemen. Default: prioritas 1–2 & belum terisi.
- **Kartu pertanyaan** (satu per layar, alur cepat):
  - Identitas: `tabel.kolom`, prioritas, domain
  - Badge departemen disarankan: mis. "Sebaiknya dijawab: Finance"
  - Draf AI dengan penanda "perlu konfirmasi"
  - Tiga textarea tetap: penjelasan, kesalahpahaman, nilai wajar/mencurigakan
  - Tombol: **Simpan dan lanjut** · **Lewati** · **Saya tidak tahu — tanyakan ke [departemen]**
    (tombol terakhir menugaskan baris itu ke role tersebut + memberi catatan opsional)
  - Contoh nilai nyata dari database (3 baris) untuk membantu penjawab memahami konteks
- **Progres**: "23 dari 68 prioritas 1–2 terisi", per departemen juga.
- **Tampilan per departemen**: setiap user melihat antrean yang ditugaskan ke role-nya.
- **Konfirmasi**: jawaban berstatus DIJAWAB muncul di antrean pemilik produk untuk
  di-DIKONFIRMASI (dua mata, mengurangi risiko jawaban keliru masuk kamus).

### 3.6 Ekspor ke repo
Job/tombol yang mengekspor seluruh kamus berstatus DIKONFIRMASI menjadi
`docs/kamus/{istilah,metrik,relasi,aturan}.md` berversi — inilah yang nanti dibaca AI
sebagai konteks. Database adalah tempat kerja; markdown di repo adalah sumber resmi.

### 3.7 Notifikasi ringan
Saat baris ditugaskan ke sebuah role, muncul di notification bell milik user role itu.
Tidak perlu email di versi ini.

## 4. BATAS
- **Jangan** membangun mode ikon inline / provenance di komponen UI (itu sesi K2).
- **Jangan** memanggil LLM apa pun — draf AI dibuat Claude Code saat sesi, disimpan sebagai teks.
- **Jangan** menampilkan data gaji dalam contoh nilai nyata; kolom bermuatan gaji dikecualikan total.
- **Jangan** menyentuh modul lain di luar yang dibutuhkan modul ini.
- Jangan menghapus/menimpa jawaban manusia dalam kondisi apa pun.

## 5. KRITERIA SELESAI
- [ ] Tabel + RLS + migrasi ada, reversible, jalan di staging.
- [ ] Generator backlog menghasilkan daftar dari skema nyata, idempoten saat dijalankan ulang.
- [ ] Setiap baris prioritas 1–2 punya `ai_draft` dan `suggested_role_id`.
- [ ] Antrean bisa dipakai penuh: jawab, lewati, tugaskan ke departemen, konfirmasi.
- [ ] Ekspor menghasilkan berkas markdown berversi di `docs/kamus/`.
- [ ] `docs/kamus-sementara.md` (bila ada) terimpor sebagai draf, tidak hilang.

## 6. BUKTI YANG DIMINTA
1. Jumlah baris backlog per prioritas & per domain (query nyata).
2. Contoh 5 baris prioritas 1 lengkap dengan draf AI & departemen sarannya.
3. Bukti idempoten: jalankan generator 2×, tunjukkan jumlah baris tidak bertambah dan
   jawaban tidak berubah.
4. **Skenario negatif 1:** user role gudang mencoba mengonfirmasi jawaban → ditolak.
5. **Skenario negatif 2:** kolom bermuatan gaji tidak muncul di backlog maupun contoh
   nilai — buktikan dengan query.
6. Ekspor markdown: tunjukkan isi berkas hasil.

## 7. STOP CONDITION
- Bila jumlah baris backlog prioritas 1–2 melebihi 200 → berhenti, laporkan; kriteria
  penyaringannya perlu diperketat sebelum UI dibuat (antrean terlalu panjang = tidak dikerjakan).
- Bila ditemukan kolom bermuatan gaji yang lolos filter → berhenti dan laporkan.

---

# BAGIAN 3 — Sesi K2 (setelah SAS001 & SAS005 terkirim)

Ditunda karena butuh perubahan di banyak komponen UI:
- Prop `provenance` pada komponen penampil angka (Fase 0.2)
- Mode kamus: ikon tanda tanya inline pada field yang belum terisi
- Integrasi dengan panel asal-usul (Fase 0.3) — infrastruktur yang sama

**Alasan pemisahan:** antrean (K1) sudah membuka 100% pekerjaan Anda dan tim.
Ikon inline adalah kenyamanan, bukan pembuka jalan — dan ongkosnya jauh lebih besar.

---

# BAGIAN 4 — Panduan menjawab (bagikan ke tim)

**Tiga pertanyaan, selalu sama:**
1. Kalau menjelaskan ke karyawan baru, Anda bilang apa? (satu kalimat, bahasa pabrik)
2. Kesalahpahaman apa yang biasa terjadi? (paling berharga)
3. Berapa nilai wajar, dan berapa yang mencurigakan?

**Aturan main:**
- Tidak tahu = tekan "Saya tidak tahu, tanyakan ke [departemen]". Itu jawaban yang sah
  dan berguna — jauh lebih baik daripada menebak.
- Tidak perlu bahasa formal. Tulis seperti menjelaskan ke rekan kerja.
- Jawaban pertanyaan 3 akan langsung dipakai sistem untuk mendeteksi angka janggal —
  jadi angka kasar pun berguna ("wajar 1 pcs, curiga kalau di bawah 0,1").
- Salah tidak apa-apa: setiap jawaban dikonfirmasi pemilik produk, dan riwayat perubahan
  tersimpan.

---

# BAGIAN 5 — Yang bisa Anda kerjakan HARI INI (sebelum K1 selesai)

Buat `docs/kamus-sementara.md` di repo, isi tiga baris setiap kali ada keputusan makna:
```
## bom_lines.qty_per
- Penjelasan: …
- Salah paham: …
- Nilai wajar: …
- Dijawab oleh: … (nama/departemen)
```
Keputusan yang sedang segar dan layak ditulis sekarang: kenapa batch gummy 10 kg,
kenapa kapasitas 4 batch/hari, kenapa bahan milik klien bernilai nol, kenapa
`sales_order_line_id` boleh null, arti `qty_per` setelah investigasi 1/51 selesai.

Berkas ini akan diimpor otomatis oleh K1 — tidak ada yang terbuang.
