# Rencana Kerja — Fase Produksi Nyata

**Untuk:** ditempel ke sesi Claude chat (Opus) sebagai rencana kerja menggantikan sisa
rencana lama (Langkah 5–7)
**Basis:** laporan kondisi 18 Agu 2026 + review konsultan
**Konteks yang mengubah segalanya:** sistem memegang 2 order nyata (SAS001 kirim 10 Sep —
tidak feasible penuh; SAS005 kirim 12 Sep — ketat) + stok riil senilai ±Rp233 juta.
Fase ini selesai bukan saat fitur rampung, tetapi saat **dua order itu terkirim dan
tercatat penuh di dalam sistem**.

---

## 0. Keputusan prioritas (menjawab pertanyaan #1 laporan)

Siklus domain-per-domain terhadap paket referensi **dijeda**. Prioritas tunggal fase ini:
**sistem dipakai sungguhan oleh staf pabrik selama SAS001 & SAS005 berjalan.**

Alasan (untuk dipegang saat tergoda menambah fitur): data produksi nyata dari dua order
ini adalah (a) bahan belajar pertama K8, (b) prasyarat seluruh roadmap AI, (c) bukti
jualan before/after pertama, dan (d) tidak bisa diulang — kalau pabrik menjalankannya di
kertas/Excel, momennya hilang permanen.

Fase ini dikerjakan sebagai TIGA track paralel. Track A bukan pekerjaan kode — jangan
biarkan ia tenggelam di bawah diskusi teknis.

---

## TRACK A — Tindakan bisnis MINGGU INI (pemilik produk, bukan Claude Code)

| # | Tindakan | Deadline | Catatan |
|---|---|---|---|
| A1 | Negosiasi pengiriman parsial SAS001 dengan client, **berbekal angka sistem** (kapasitas 4 batch/hari, botol tiba 22 Agu, X botol bisa dikirim tanggal Y) | Minggu ini | Setiap hari menunda memperkecil ruang negosiasi. Hasil negosiasi dicatat sebagai revisi SO di sistem |
| A2 | **Pesan kemasan Drinkme** (sachet & box, lead cetak 2 minggu) | HARI INI bila belum | Jalur kritis nyata deadline 12 Sep. Plastic wrap & karton isi 42 belum pernah ada stoknya |
| A3 | Kejar dokumen opname Plant Ruko Dieng | ≤ 3 hari | Tanpa ini daftar kekurangan bahan SAS001 tidak akurat |
| A4 | Putuskan daftar belanja SAS005 (yang membengkak karena Maltodextrin ganda) → jadikan PO supplier lewat sistem | Minggu ini | Lead time bahan 2–5 hari masih aman bila diputuskan sekarang |
| A5 | Tinjau harga Drinkme untuk order BERIKUTNYA (margin 16,9% dengan PMFL sebagai biaya terbesar — apakah harga Rp33.000 masih layak?) | Sebelum quotation berikutnya | Wawasan pertama dari mesin margin — pakai untuk keputusan bisnis nyata |

---

## TRACK B — Kesiapan pemakaian harian (pekerjaan sesi, urut)

### B-1. Fitur create/edit Karyawan lewat UI
Satu-satunya utang teknis di jalur kritis. Cakupan: CRUD karyawan level HRD sesuai aturan
privasi gaji yang SUDAH ada (akses lewat `employees_secure`, jalur tulis diuji per role,
skenario negatif: GM mencoba melihat/mengubah gaji → gagal). JANGAN membangun modul HR
penuh — cukup yang dibutuhkan mengelola 33 karyawan secara mandiri.

### B-2. Audit jalan kaki alur harian per peran (pola B.10, tapi terhadap ALUR bukan kode)
Instruksikan Claude Code menyusun skenario, lalu PEMILIK PRODUK berjalan kaki di staging
sebagai tiap peran, untuk satu hari kerja penuh:
- **Gudang**: terima barang PO → buat lot → issue bahan ke batch → opname harian
- **Produksi (SPV & operator)**: lihat jadwal hari ini → mulai batch → catat input/output
  per tahap → catat downtime → selesai batch → hasil masuk stok
- **PPIC**: pantau progres vs rencana → reaksi terhadap batch blocked
- **Purchasing**: kekurangan bahan → PR/PO → tracking kedatangan
Setiap langkah yang TIDAK bisa dilakukan lewat UI (atau butuh >3 menit / bantuan teknis)
dicatat sebagai blocker. Hasil audit = daftar kerja B-3. Ini menjawab pertanyaan
"kelengkapan alur harian" dengan bukti, bukan asumsi.

### B-3. Tutup blocker hasil B-2
Hanya blocker — bukan penyempurnaan. Sorting kolom & pola expand-baris TIDAK termasuk
kecuali muncul sebagai blocker nyata di B-2.

### B-4. Materi pelatihan: 1 halaman per peran
Cheat sheet per peran (gudang, operator, SPV, PPIC, purchasing): langkah harian dengan
screenshot, ditulis bahasa pabrik. Plus 1 halaman "kalau sistem bermasalah": langkah 1-2-3
dan siapa yang dihubungi (eksplisit: pemilik produk, dengan nomor).

### B-5. Protokol pilot (2 minggu pertama pemakaian nyata)
- Sistem = pencatat UTAMA; kertas = cadangan (bukan sebaliknya).
- Rekonsiliasi tiap sore: qty sistem vs kertas per batch & per gudang; selisih diusut
  hari itu juga.
- Kriteria lulus pilot: 5 hari kerja berturut-turut selisih rekonsiliasi = 0 dan tidak
  ada blocker baru → kertas dilepas.

---

## TRACK C — Pengamanan data nyata (paralel dengan Track B, sesi terpisah)

### C-1. Backup otomatis + restore teruji
- Backup terjadwal harian otomatis (bukan manual seperti sekarang), retensi ≥ 14 hari.
- SATU kali uji restore penuh ke project kosong, aplikasi jalan di atasnya, durasi dicatat.
- Verifikasi isi backup memakai pelajaran yang sudah didapat ("hijau ≠ benar"):
  cocokkan jumlah baris tabel-tabel kunci, bukan sekadar status job.

### C-2. Error tracking & monitoring minimum
- Sentry (atau setara) di web + edge functions; alert ke email/WA pemilik produk.
- Satu halaman status internal: error rate, antrian job, waktu backup terakhir.

### C-3. Mini-audit permukaan publik (BUKAN audit R4 penuh — R4 tetap ditunda)
Dipicu oleh kenyataan baru: halaman POD publik adalah permukaan tanpa-login pertama, dan
kerentanan magic-bytes ditemukan di 5 endpoint. Cakupan terbatas:
- Token POD: entropi cukup (≥128 bit acak), kedaluwarsa, sekali-guna sesuai desain —
  verifikasi dengan test.
- Rate limiting pada semua endpoint publik (POD upload dsb.) — cegah abuse & spam storage.
- Storage policy diuji seperti policy tabel: upload/baca lintas tenant & lintas token
  harus GAGAL (buktikan gagalnya).
- Regression test permanen untuk validasi magic-bytes di modul `imageUpload.ts` bersama.
- Sapu bersih fixture uji dari data nyata sebelum pilot: validasi & hapus
  `E2E RealSMTP Co` di staging → produksi; `Company B` boleh hidup di CI/staging tetapi
  TIDAK ikut ke database produksi.

### C-4. Klarifikasi multi-tenant (jawaban pertanyaan #2 laporan)
Bahan milik klien lain di gudang (RAW Fixlim, QS Collagen, kemasan bermerek) **bukan isu
multi-tenant** — itu client-supplied material di dalam satu tenant, konsep yang memang
sudah dirancang (terlacak, biaya nol, dikecualikan dari margin per aturan biaya).
Pastikan saja lot-lot itu DITANDAI kepemilikan kliennya di sistem sehingga: tidak masuk
valuasi persediaan milik perusahaan, tidak bisa terpakai untuk order klien lain, dan
muncul benar di laporan. Audit R4 penuh tetap menunggu tenant kedua nyata.

---

## D. Pengerasan K8 sebelum data nyata masuk (jawaban pertanyaan #4)

Empat penyesuaian WAJIB sebelum batch produksi nyata pertama tercatat — semuanya kecil:

1. **Flip butuh persetujuan, bukan otomatis.** Transisi ESTIMASI_MANUAL → DIPELAJARI
   diusulkan sistem tetapi disahkan planner (tampilkan nilai lama vs baru vs dampak).
   Alasan: 5 batch pertama produksi nyata hampir pasti tidak tipikal (kurva belajar) —
   ambang "≥5 sampel" otomatis akan meresmikan justru data paling kacau.
2. **Median, bukan mean, untuk sampel kecil.** Aturan buang-outlier ±2σ tidak bermakna
   secara statistik pada n=5. Pakai median sampai n≥10, baru mean dengan trim.
3. **Gerbang kelengkapan.** Hanya batch berstatus selesai DENGAN log tahap lengkap yang
   boleh menjadi bahan belajar. Batch berlubang datanya dikecualikan dan dilaporkan
   (sekaligus jadi indikator disiplin pengisian).
4. **Snapshot standar per rencana.** Perhitungan feasibility/kebutuhan sebuah order
   menyimpan salinan standar yang dipakainya. Saat standar berubah (belajar), sistem
   MEMBERI TAHU dampaknya ke rencana berjalan — tidak pernah mengubah angka rencana lama
   diam-diam. (SAS001 dihitung dengan 4 batch/hari; kalau realita 3,2/hari, itu alert,
   bukan mutasi senyap.)

---

## E. Triage utang teknis (jawaban pertanyaan #5)

| Utang | Keputusan | Alasan |
|---|---|---|
| Fitur create Karyawan | **KERJAKAN SEKARANG** (B-1) | Satu-satunya utang di jalur kritis pemakaian harian |
| 2 item orphan ber-FK dari BOM lama | **JANGAN HAPUS** — tandai item & BOM arsipnya OBSOLETE | Menghapus master yang direferensikan melanggar prinsip sendiri; OBSOLETE = tersembunyi dari pilihan baru, sejarah utuh |
| `E2E RealSMTP Co` | Validasi di staging → hapus | Sampah uji tidak boleh hidup berdampingan dengan data nyata |
| `Company B` (CI) | Pertahankan di CI/staging; **larang ada di produksi** | Fixture uji ≠ data produksi |
| Sorting kolom & expand-baris | **TUNDA** tanpa rasa bersalah | Kosmetik; hanya naik prioritas bila muncul sebagai blocker di B-2 |
| Overhead mesin/listrik v1.1 | **TETAP TUNDA** (sesuai K3) | Keputusan yang benar; jangan buka sebelum 2–3 bulan data |

---

## F. Definisi selesai fase ini

- [ ] SAS001: kesepakatan parsial tercatat sebagai revisi SO; seluruh batch, pemakaian
      bahan, dan pengiriman tercatat lewat UI oleh staf (bukan seed/SQL).
- [ ] SAS005: terkirim penuh sebelum/pada 12 Sep, tercatat penuh, margin aktual terhitung
      dan dibandingkan dengan margin rencana (selisihnya = pelajaran pertama).
- [ ] Pilot lulus: 5 hari berturut-turut rekonsiliasi nol selisih, kertas dilepas.
- [ ] K8 menerima data nyata pertama: minimal yield & durasi 2 produk mulai terisi,
      flip pertama disahkan planner dengan sadar.
- [ ] Backup otomatis berjalan + 1 restore terbukti; Sentry aktif; permukaan publik
      teraudit (C-3 lulus).
- [ ] Laporan retro singkat: rencana vs aktual (batch, durasi, biaya, margin) — dokumen
      before/after pertama untuk penjualan.

Setelah F tercapai, kembali ke siklus domain-per-domain — dengan posisi jauh lebih kuat:
sistem yang TERBUKTI menjalankan dua order nyata, plus data pembelajaran pertama untuk
fondasi AI.

## Aturan main yang tetap berlaku

Semua instruksi ke Claude Code memakai format baku B.0.2 (tujuan, konteks-baca-dulu,
langkah, batas, kriteria selesai, bukti termasuk ≥2 skenario negatif, stop condition).
Setiap laporan selesai direview adversarial (B.12). "Selesai" = jalan di staging.
Dan pelajaran sesi lalu dipertahankan sebagai doktrin: **hijau tidak berarti benar —
periksa sampai ke isi.**
