# Kesiapan AI (Tenant-Facing) — Spesifikasi & Instruksi Claude Code

**Status:** spesifikasi diterima; implementasi setelah modul Kamus (K1) & dashboard internal (K1b)
**Terkait:** `ai-roadmap-adr-ams-rev2.md` (A1–A9), `rencana-modul-kamus-paralel.md`,
`instruksi-dashboard-proyek-ai.md`, `fase-0-fondasi-ai-detail.md`

---

# BAGIAN 1 — SPESIFIKASI

## 1.1 Masalah yang diselesaikan

Kegagalan paling umum produk AI B2B: fitur dinyalakan sejak hari pertama, dicoba di atas
data kosong, hasilnya dangkal, lalu label "AI-nya jelek" menempel permanen. Setelah itu
sebagus apa pun fiturnya berkembang, tidak ada yang mencoba lagi.

Solusinya bukan menyembunyikan keterbatasan, melainkan **menjadikan kesiapan sebagai hal
yang dilihat dan dikendalikan tenant sendiri.**

## 1.2 Tiga pilar

| Pilar | Isi |
|---|---|
| **Halaman Kesiapan AI** | Tenant melihat skor kesiapan per kemampuan + daftar tugas untuk menaikkannya |
| **Gerbang (gating)** | Kemampuan terkunci sampai prasyaratnya terpenuhi — bukan sekadar peringatan |
| **Transparansi per jawaban** | Setiap jawaban AI menyebut dasarnya, dan menyatakan bila dasarnya kurang |

## 1.3 Kenapa gerbang, bukan peringatan

Peringatan diabaikan; orang tetap mencoba, tetap kecewa, tetap menyimpulkan produknya
jelek. Gerbang memaksa urutan yang benar dan menciptakan dorongan positif: tenant mengisi
kamus karena ingin membuka kemampuan, bukan karena diminta vendor.

## 1.4 Model kesiapan — per kemampuan, bukan satu angka global

Prasyarat tiap kemampuan berbeda, jadi skornya juga berbeda. Angka di bawah adalah
**default yang bisa dikonfigurasi per tenant**, bukan konstanta kode.

| Kemampuan | Prasyarat | Sumber pengukuran |
|---|---|---|
| Panel asal-usul | Tidak ada | selalu aktif |
| Process mining | ≥ 90 hari data transaksi & ≥ 200 transisi status | `status_transition_log` |
| Copilot data pabrik | Kamus prioritas 1–2 ≥ 70% DIKONFIRMASI | `kamus_terms` |
| Narasi & laporan | Copilot terbuka + ≥ 30 hari data | gabungan |
| Penjelasan margin & biaya | Kamus scope METRIC keuangan = 100% | `kamus_terms` |
| Anomaly detection | Standar K8 `DIPELAJARI` untuk ≥ 5 item aktif | tabel standar |
| Advisor / saran tindakan | Semua di atas + eval internal lulus ambang | hasil eval |

Setiap prasyarat wajib **terukur dari data**, tidak boleh berupa penilaian subjektif.

## 1.5 Kualitas data ikut dihitung, bukan hanya kelengkapan

Kelengkapan saja bisa menipu (kamus terisi asal-asalan). Tambahkan indikator kualitas
yang juga terukur:

- % downtime terklasifikasi (bukan "unclassified")
- % batch dengan log tahap lengkap
- % NCR dengan akar masalah terisi
- % transaksi stok dengan alasan/reference valid

Ditampilkan sebagai bagian skor kesiapan, karena inilah yang sesungguhnya menentukan
kecerdasan AI tenant tersebut.

## 1.6 Transparansi di titik pemakaian

Setiap jawaban AI wajib menyertakan baris dasar (basis), contoh:

- "Berdasarkan 8 batch tercatat sejak 1 Agustus."
- "Istilah ini belum didefinisikan di kamus Anda — jawaban berdasarkan pemahaman umum,
  bukan definisi pabrik Anda." → dengan tombol **Definisikan sekarang** yang membuka
  antrean kamus pada baris tersebut.
- "Standar kapasitas masih ESTIMASI_MANUAL, belum dipelajari dari produksi nyata."

Ini perluasan prinsip A2: angka wajib bersumber — dan sekarang, **ketiadaan sumber juga
wajib dinyatakan**.

## 1.7 Pemisahan "belum siap" vs "rusak" (pagar antipenyalahgunaan)

Halaman kesiapan bisa berubah menjadi alasan. Cegah dengan definisi tegas:

| Kategori | Definisi | Tanggung jawab |
|---|---|---|
| **Belum siap** | Prasyarat terukur belum terpenuhi | Tenant (dengan panduan dari kita) |
| **Rusak** | Prasyarat terpenuhi tetapi jawaban tetap salah | Kita, sepenuhnya |

Pembeda objektifnya adalah **eval suite**: bila kesiapan tinggi tetapi eval lulus rendah,
masalahnya bukan di data tenant. Wajib ada tombol **"jawaban ini salah"** di setiap
jawaban AI, dan laporannya ditinjau berkala oleh pemilik produk — jangan biarkan halaman
kesiapan menjadi tameng yang menghalangi umpan balik.

## 1.8 Implikasi komersial

Tagihan tier AI dimulai **saat kesiapan tercapai**, bukan saat kontrak ditandatangani.
Masa pengisian kamus & pembenahan data diperlakukan sebagai onboarding. Kehilangan sedikit
pendapatan awal, mendapat sesuatu yang jauh lebih mahal: pengalaman pertama tenant dengan
AI adalah pengalaman yang bagus.

---

# BAGIAN 2 — INSTRUKSI CLAUDE CODE

**Format B.0.2.** Dikerjakan setelah K1 (Kamus) dan K1b (dashboard internal) selesai.

## 1. TUJUAN
Membangun halaman Kesiapan AI untuk tenant beserta mekanisme gerbang per kemampuan,
sehingga tenant tahu apa yang harus dikerjakan agar fitur AI berfungsi baik — dan fitur
tidak menyala sebelum layak dipakai.

## 2. KONTEKS YANG WAJIB DIBACA DULU
1. Skema `kamus_terms` & `ai_project_*` dari sesi sebelumnya.
2. `status_transition_log`, tabel standar K8, tabel downtime & NCR — sumber pengukuran.
3. Bagian 1 dokumen ini (model kesiapan, kualitas data, transparansi).
4. Aturan RLS & role — halaman ini dilihat tenant, bukan hanya tim internal.

## 3. LANGKAH

### 3.1 Skema
```
ai_capabilities                  -- katalog kemampuan (seed, bukan buatan tenant)
  id, code, name, description, tier enum(CORE, INSIGHT, COPILOT), sort_order

ai_capability_requirements       -- prasyarat terukur per kemampuan
  id, capability_id, code, label
  metric_key                     -- kunci rumus pengukuran
  threshold numeric, comparator enum(GTE, LTE)
  weight numeric                 -- kontribusi ke skor kesiapan kemampuan itu
  is_blocking bool               -- true = mengunci kemampuan bila belum terpenuhi

ai_capability_status             -- hasil evaluasi per tenant (dihitung, di-cache)
  tenant_id, capability_id, readiness_percent, is_unlocked,
  blocking_reasons jsonb, computed_at

ai_capability_overrides          -- pengecualian sadar
  tenant_id, capability_id, unlocked_by, reason, expires_at
```

### 3.2 Mesin pengukuran
Implementasi tiap `metric_key` sebagai fungsi terdaftar yang mengembalikan angka nyata
dari data tenant. Minimal:
```
kamus.p12_confirmed_ratio      kamus.metric_finance_ratio
data.days_of_history           data.status_transitions_count
quality.downtime_classified    quality.batch_stage_complete
quality.ncr_root_cause         quality.stock_txn_with_reason
k8.learned_items_count         eval.pass_rate
```
Perhitungan dijadwalkan (harian) + dihitung ulang saat event relevan; hasil disimpan di
`ai_capability_status` dengan `computed_at`. **Dilarang** menghitung di render halaman
(mahal) dan **dilarang** ada nilai yang bisa diketik manual.

### 3.3 Gerbang
- Middleware/guard tunggal: setiap endpoint & UI kemampuan AI memeriksa
  `is_unlocked` untuk tenant tersebut. Satu titik penegakan, bukan tersebar.
- Kemampuan terkunci tampil sebagai kartu terkunci berisi: apa yang dilakukannya,
  prasyarat yang belum terpenuhi (dengan angka saat ini vs ambang), dan tombol menuju
  tugas yang menaikkannya.
- `ai_capability_overrides` hanya boleh dipakai admin internal (bukan admin tenant),
  wajib beralasan dan berbatas waktu — untuk demo atau uji coba.

### 3.4 Halaman `/ai-readiness` (tenant)
- Ringkasan: skor kesiapan keseluruhan + jumlah kemampuan terbuka dari total.
- Daftar kemampuan: nama, tier, status (terbuka/terkunci), skor, prasyarat dengan
  progres masing-masing.
- **"Yang bisa Anda kerjakan"**: daftar tugas berdampak terbesar, mengikuti pola dashboard
  internal (dampak per menit), dengan badge departemen yang disarankan menjawab.
- Klik tugas → membuka antrean kamus / halaman kualitas data terkait dengan filter tepat.
- Tren: grafik kesiapan 8 minggu terakhir dari snapshot.

### 3.5 Transparansi jawaban (siapkan sekarang, dipakai saat fitur AI hidup)
Bangun komponen `AnswerBasis` yang menerima: jumlah data pendasar, status kamus istilah
terkait, status standar K8, lalu menampilkan baris basis sesuai §1.6 — termasuk tombol
"Definisikan sekarang" yang membuka antrean kamus pada baris terkait.

### 3.6 Umpan balik
Tombol "jawaban ini salah" pada setiap jawaban AI → tabel `ai_answer_feedback`
(tenant, capability, pertanyaan, jawaban, alasan, snapshot kesiapan saat itu).
Snapshot kesiapan penting: itu yang membedakan "belum siap" dari "rusak" saat ditinjau.

## 4. BATAS
- **Jangan** memanggil LLM apa pun di sesi ini.
- **Jangan** membuat prasyarat yang bersifat penilaian subjektif — semua harus terukur.
- **Jangan** menyebar pengecekan gerbang ke banyak tempat; satu guard tunggal.
- **Jangan** menampilkan skor kesiapan tenant lain (isolasi tenant tetap mutlak).
- **Jangan** menambahkan gamifikasi.
- Jangan mengubah modul Kamus selain menambah filter yang dibutuhkan.

## 5. KRITERIA SELESAI
- [ ] Katalog kemampuan + prasyarat ter-seed sesuai §1.4 dan bisa dikonfigurasi per tenant.
- [ ] Semua `metric_key` terimplementasi dan menghasilkan angka dari data nyata.
- [ ] Kemampuan terkunci benar-benar tidak bisa diakses lewat UI maupun API.
- [ ] Halaman kesiapan menampilkan prasyarat dengan angka saat ini vs ambang.
- [ ] Klik tugas membuka antrean/halaman yang tepat; menyelesaikannya menaikkan skor
      (dibuktikan sebelum/sesudah).
- [ ] Komponen `AnswerBasis` siap dipakai + tabel umpan balik ada.
- [ ] Override hanya bisa oleh admin internal, beralasan, berbatas waktu.

## 6. BUKTI YANG DIMINTA
1. Query nyata tiap `metric_key` beserta hasilnya untuk tenant Indo Taste hari ini.
2. Sebelum/sesudah: konfirmasi 5 baris kamus → tunjukkan skor kemampuan Copilot naik
   sesuai perhitungan.
3. **Skenario negatif 1:** panggil endpoint kemampuan terkunci langsung lewat API →
   ditolak dengan alasan jelas.
4. **Skenario negatif 2:** admin tenant mencoba membuat override → ditolak.
5. **Skenario negatif 3:** user tenant A mencoba membaca kesiapan tenant B → ditolak.
6. Isi tabel `ai_capability_status` setelah job dijalankan 2×, tunjukkan idempoten.

## 7. STOP CONDITION
- Bila ada `metric_key` yang tidak bisa dihitung dari data yang ada, **berhenti dan
  laporkan** — jangan membuat angka pengganti atau nilai default yang menyesatkan.
- Bila jumlah prasyarat per kemampuan melebihi 5, berhenti & laporkan: daftar prasyarat
  yang terlalu panjang membuat tenant menyerah, bukan bertindak.

## 8. CATATAN UNTUK PEMILIK PRODUK
Ambang di §1.4 (70% kamus, 90 hari data, dst.) adalah usulan. Tinjau sebelum di-seed:
terlalu longgar → tenant mendapat pengalaman buruk; terlalu ketat → fitur tidak pernah
terbuka dan nilai jualnya tidak pernah terasa. Setelah tenant pertama berjalan beberapa
bulan, kalibrasi ulang dengan data nyata — dan catat perubahannya, karena mengubah ambang
mengubah makna grafik tren.
