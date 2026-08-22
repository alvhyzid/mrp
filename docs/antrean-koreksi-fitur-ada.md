> Dokumen rencana per ~19-20 Agu 2026. Sebagian isi sudah berubah oleh keputusan sesudahnya — rujuk Daftar Tugas Pembangunan (task `PJL-06`, `PRD-06`, `PRD-11`, `MST-13`, `RDM-02`) sebagai sumber kebenaran status terkini, bukan dokumen ini. Perubahan diketahui (22 Agu 2026): S2 bagian konversi UOM sachet/roll SUDAH SELESAI (faktor 3.333); sisa S2 (konversi UOM generik + standar kru) masih berlaku.

# Antrean Koreksi — Perbaiki yang Sudah Ada Dulu

**Untuk:** sesi Claude chat (Opus) — pecah tiap sesi jadi instruksi B.0.2 dan jalankan
BERURUTAN mulai sekarang. Tidak menunggu MLVT terkirim.
**Keputusan pemilik produk:** prioritas diberikan pada KOREKSI/PENYEMPURNAAN fitur yang
sudah ada, di atas pembangunan fitur baru. Fitur baru besar (KPI, absensi, MD-2/3, AI)
tetap di antrean belakang sesuai gerbangnya masing-masing.
**Syarat pengaman untuk semua sesi (bukan penundaan, tapi tali pengaman):**
setiap perubahan wajib kompatibel-mundur — perilaku yang ada tidak berubah bila fitur
baru tidak disentuh; lulus staging + test penuh sebelum menyentuh data PT ITM; dan
batch MLVT pertama SELALU punya jalur mundur ke perilaku lama.

---

## Sesi S1 — Alur Repeat Order: profil produk + duplikat SO (keluhan harian)

**Masalah:** setiap repeat PO dari klien yang sama untuk produk yang sama, produk harus
diketik ulang manual. Repeat order adalah norma contract manufacturer — ini gesekan
harian di fitur inti yang sudah ada.

**Lingkup:**
1. **Audit alur dulu (read-only):** telusuri klik-demi-klik alur PO klien→approval→SO
   hari ini; laporkan di titik mana pengetikan ulang terjadi dan data apa saja yang
   sebenarnya sudah tersedia di order lama. (Temuan menentukan bentuk final — jangan
   asumsikan.)
2. Tombol **"Duplikat sebagai order baru"** dari riwayat order klien:
   - Menyalin INPUT: produk, spesifikasi, catatan, harga terakhir SEBAGAI DRAF berlabel
     "harga order sebelumnya — periksa".
   - TIDAK menyalin HASIL: feasibility, kekurangan bahan, jadwal, biaya, margin
     dihitung BARU dari kondisi hari ini (stok, harga lot, versi BOM berlaku).
   - Rantai approval 3 departemen tetap berjalan penuh — tanpa jalan pintas.
3. Halaman **profil produk** ringkas (satu layar per produk jadi): BOM aktif, routing
   aktif, riwayat order & harga, margin terakhir — pintu masuk alami untuk duplikat.

**Bukti minimum:** duplikat order lama saat harga bahan sudah berubah → margin baru
BERBEDA dari margin lama (angka acuan literal); skenario negatif: duplikat tidak
melompati approval; user tanpa akses klien itu tidak bisa menduplikat ordernya.

## Sesi S2 — Kejujuran angka MLVT: konversi UOM + standar kru

**Masalah:** dua lubang yang membuat angka MLVT pertama akan BOHONG bila dibiarkan:
(a) stok sachet dicatat per ROLL tapi pemakaian per SACHET (3.333/roll) — tanpa konversi
eksplisit sistem memotong 1 roll utuh per batch; (b) `routing_step_standard_crew` = 0
baris di semua tahap → biaya SDM batch = nol → margin MLVT tampak lebih bagus dari
kenyataan, tepat saat dipakai untuk keputusan break-even Rp23.000/box.

**Lingkup:**
1. Konversi satuan per item (stok-UOM ↔ pakai-UOM dengan faktor eksplisit, contoh
   nyata: PKG-SACHET-ROLL-ETAWA-FIT 1 ROLL = 3.333 SACHET): pemakaian di BOM/batch
   dalam satuan pakai, pengurangan stok dalam satuan stok, sisa parsial roll tercatat.
2. UI pengisian standar kru per tahap routing (jumlah orang + peran per tahap) +
   validasi: batch tidak bisa dinyatakan selesai biayanya bila standar kru tahapnya
   masih kosong (gerbang lunak: tampil peringatan "biaya SDM = 0, standar belum diisi").
3. Seed standar kru routing serbuk 10 tahap BERSAMA pemilik produk/PPIC (angka dari
   mereka, bukan dikarang — [PERLU KONFIRMASI] per tahap).

**Bukti minimum:** batch simulasi memakai 25.000 sachet mengurangi stok 7,5 roll (bukan
25.000 roll / bukan 8 roll bulat tanpa sisa tercatat); biaya batch MLVT simulasi memuat
komponen SDM > 0 dengan rincian per tahap.

## Sesi S3 — Routing non-linear Tahap R-A (upgrade fitur routing yang ada)

Rujukan penuh: `rencana-routing-nonlinear.md`. Ringkas: skema graf
(`routing_step_dependencies`), builder tiga-field berbahasa manusia (mulai setelah /
cara mulai / jeda tunggu), paralel lahir dari graf, validasi DAG + peringatan
mesin-sama-paralel, penegakan urutan di MES ("menunggu: Batch Mixing ≥ 200 kg"),
Gantt berlajur, estimasi dari jalur terpanjang. Penjadwalan otomatis (R-B) TETAP tidak
dibangun.

**Penyesuaian karena maju lebih awal:**
- Routing lama & routing MLVT v1 linear TIDAK berubah perilakunya (dependency = opsional).
- Bila R-A lulus penuh SEBELUM batch MLVT pertama mulai → buat routing MLVT v2 paralel
  dan jalankan batch pertama dengannya (uji nyata langsung). Bila belum lulus → batch
  pertama pakai v1 linear, v2 menyusul di batch kedua. Keputusan di tangan pemilik
  produk saat harinya tiba — dua-duanya aman.

## Urutan & alasan urutannya
S1 dulu (gesekan harian, risiko teknis paling kecil) → S2 (wajib beres sebelum margin
MLVT dipakai mengambil keputusan) → S3 (upgrade terbesar, butuh ruang uji paling luas).
Aturan lama tetap berlaku di ketiganya: format B.0.2, kriteria selesai + ≥2 skenario
negatif, jalan di staging, review adversarial B.12, kamus terisi untuk field baru,
dan "hijau ≠ benar".
