> Dokumen rencana per ~19-20 Agu 2026. Sebagian isi sudah berubah oleh keputusan sesudahnya — rujuk Daftar Tugas Pembangunan (task `RDM-02`) sebagai sumber kebenaran status terkini, bukan dokumen ini. Perubahan diketahui (22 Agu 2026): mekanisme ambang overlap kuantitas/persen DIBATALKAN (acuan kelayakan sekarang batch produksi, bukan ambang kuantitas); gerbang "R-A setelah batch MLVT pertama" sudah diganti — turun ke Bisa Menunggu.

# Rencana Kerja — Routing Non-Linear (Dependency, Paralel, Overlap)

**Untuk:** sesi Claude chat (Opus) — susun instruksi Claude Code format B.0.2 untuk
Tahap R-A setelah pertanyaan §7 terjawab.
**Pemicu:** keputusan pemilik produk mengadopsi §8–14 spec ERP sebagai kemampuan produk —
proses produksi berbeda per produk & per pabrik (mandat generalisasi), dan routing MLVT
sendiri adalah kasus hidupnya (tahap sachet ∥ persiapan kemasan box → bertemu di
Filling Box).
**Gerbang waktu:** Tahap R-A dibangun SETELAH batch MLVT pertama selesai dengan routing
linear v1 yang ada. Jangan mengubah mesin routing di tengah studi kasus pertama —
routing MLVT v2 (paralel) justru menjadi UJI NYATA pertama fitur ini.

---

## 1. Prinsip desain

1. **Model data penuh, engine bertahap.** Skema menyimpan graf lengkap sejak awal;
   yang dicicil adalah seberapa pintar sistem MEMAKAI graf itu.
2. **Default tetap sederhana.** Routing baru lahir sebagai rantai berurutan — pabrik
   berproses linear tidak pernah melihat kerumitan ini. Opsi non-linear muncul hanya
   saat user menyentuhnya. (Prinsip UI pabrik: kerumitan opt-in.)
3. **Tanpa jargon PM.** User tidak akan pernah melihat istilah FS/SS/FF. Bahasa UI:
   "mulai setelah…", "boleh menyusul setelah sebagian", "jeda tunggu".
4. **Paralel LAHIR dari graf, bukan dikelola manual.** Dua tahap dengan predecessor
   sama otomatis paralel — user tidak mengurus "Parallel Group ID" seperti di spec.
   Titik temu (join) selalu menunggu SEMUA pendahulunya selesai (tanpa OR-join — 
   penyederhanaan sadar).
5. Lingkup dependency yang diadopsi: **selesai-dulu (FS)**, **FS + jeda tunggu (lag,
   menit)**, **FS + boleh-menyusul-sebagian (overlap ambang qty/%)**. SS & FF dari spec
   TIDAK diadopsi — jarang dipakai, membingungkan, dan bisa didekati dengan overlap.

## 2. Pengalaman pengguna (builder routing)

Saat menambah/mengedit tahap, tiga field baru (semua berdefault aman):

| Field | Default | Opsi |
|---|---|---|
| **Mulai setelah** | tahap sebelumnya (rantai) | multi-pilih satu/lebih tahap pendahulu — memilih 2+ tahap berbeda sebagai pendahulu tahap lain otomatis menggambar cabang |
| **Cara mulai** | setelah pendahulu selesai penuh | "boleh menyusul setelah sebagian: [ambang qty ATAU %]" — contoh MLVT: Filling Sachet boleh mulai setelah Batch Mixing melapor ≥ X kg |
| **Jeda tunggu** | 0 menit | N menit setelah pendahulu (kasus nyata: cooling/curing sebelum tahap berikut) |

Pratinjau mini-graf tampil langsung di builder (cabang & titik temu terlihat), dan
routing tetap berversi seperti sekarang — mengubah pola = versi baru.

## 3. Skema (melengkapi kolom tumpangan yang sudah disepakati)

```
routing_step_dependencies        -- eksplisit, banyak-ke-banyak
  routing_version_id, step_id, predecessor_step_id
  dependency_kind enum(SETELAH_SELESAI, MENYUSUL_SEBAGIAN)
  overlap_threshold_qty numeric NULL / overlap_threshold_pct numeric NULL
  lag_minutes int default 0
```
Tahap tanpa baris dependency = mengikuti urutan sequence lama (kompatibel mundur penuh;
routing lama tidak tersentuh). `parallel_group` TIDAK dipakai user — diturunkan dari graf
untuk tampilan.

## 4. Validasi (di database + builder)

1. Graf harus DAG — siklus ditolak dengan pesan menunjuk tahap pembentuk siklus.
2. Tepat satu tahap akhir; semua tahap terjangkau dari tahap awal (tanpa yatim).
3. Ambang overlap wajib > 0 dan ≤ qty/100% pendahulu.
4. **Peringatan (bukan blokir):** dua tahap paralel memakai MESIN atau KRU yang sama —
   paralel di kertas tapi antre di kenyataan; sistem memberi tahu, planner memutuskan.
5. Routing berversi: batch berjalan memakai snapshot versinya (aturan lama tetap).

## 5. Tahap R-A — yang DIBANGUN (satu-dua sesi)

1. Skema §3 + migrasi kompatibel-mundur + validasi §4.
2. Builder UI §2 dengan pratinjau graf.
3. **Penegakan eksekusi di MES** — inti nilai R-A: tombol "mulai tahap" hanya aktif bila
   semua pendahulu memenuhi syaratnya (selesai / lapor ≥ ambang / jeda terlewati),
   dengan pesan jelas "menunggu: Batch Mixing ≥ 200 kg (baru 120 kg)".
4. Gantt menampilkan lajur paralel; **penjadwalan tetap manual** (planner menggeser,
   sistem memvalidasi konflik urutan — konsisten keputusan APS ringan).
5. Feasibility: durasi kritis dihitung dari jalur terpanjang graf (critical path
   sederhana), bukan jumlah semua tahap — estimasi selesai jadi realistis untuk routing
   bercabang. (Hitung jalur terpanjang saja; TANPA optimasi.)
6. Kamus otomatis: semua field baru masuk backlog kamus; contoh MLVT jadi definisi.

## 6. Tahap R-B — yang SENGAJA DITUNDA
Mesin penjadwalan otomatis (menghitung earliest start seluruh tahap, menata ulang saat
meleset, optimasi muatan mesin). Tetap di belakang garis APS-ringan; dibuka hanya bila
tenant nyata membutuhkannya dan membayarnya.

## 7. Pertanyaan untuk pemilik produk (Opus wawancarai)
1. Routing serbuk nyata: setelah cabang sachet ∥ kemasan-box bertemu di Filling Box —
   adakah jeda tunggu nyata (menit) di titik mana pun? (kalibrasi fitur lag)
2. Ambang overlap yang realistis untuk Filling Sachet menyusul Batch Mixing: berbasis
   kg atau %? berapa?
3. Siapa role yang boleh MENGABAIKAN penegakan urutan di lantai (override darurat) —
   dan setuju bahwa setiap override tercatat + wajib alasan?
4. Konfirmasi urutan: R-A dikerjakan setelah batch MLVT pertama tuntas (routing v1
   linear), lalu routing MLVT v2 paralel jadi uji nyata pertama?

## 8. Dampak ke sistem lain (dipetakan supaya tidak ada kejutan)
- **K8/standar:** tidak berubah — standar tetap per tahap; graf hanya mengatur URUTAN.
- **Kapasitas:** cabang paralel memakai kru/mesin berbeda → beban per lini dihitung per
  tahap seperti sekarang; validasi §4.4 menjaga kejujuran paralel.
- **Biaya:** tidak berubah — biaya per tahap dijumlahkan, urutan tidak memengaruhi rupiah.
- **KPI:** cycle time per batch justru membaik terukur setelah paralel dipakai — jadikan
  before/after MLVT v1 vs v2 sebagai bukti nilai fitur (bahan jualan).
- **Drop-AI/provenance:** estimasi selesai kini berasal dari jalur kritis — panel
  asal-usul harus bisa menjawab "kenapa estimasi 6 hari" dengan menunjuk jalur terpanjang.
