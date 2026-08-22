> Dokumen rencana per 20 Agu 2026. Sebagian isi sudah berubah oleh keputusan sesudahnya — rujuk Daftar Tugas Pembangunan sebagai sumber kebenaran status terkini, bukan dokumen ini. Perubahan diketahui (22 Agu 2026): Supplier & Pelanggan sudah CRUD penuh (Alur 1), snapshot routing/BOM per batch sudah ada, glossary UI sudah ada — baris terkait di tabel bawah TIDAK direvisi ulang di sini, cukup dibaca dengan catatan ini.

# Checklist §43 Implementation Priority — Status FABRIX per Item

**Sumber:** §43 "Manufacturing ERP SaaS Specification" (7 fase)
**Dibandingkan dengan:** kondisi terverifikasi FABRIX per 20 Agu 2026 (192 test, pasca-audit
penghapusan SAS001/005, studi kasus MLVT berjalan)

**Legenda:**
- ✅ **SUDAH** — dibangun & lulus test
- 🟡 **SEBAGIAN** — ada tapi tidak lengkap / ada catatan
- 📋 **DIRANCANG** — spesifikasi selesai, kode belum
- ⏸️ **DITUNDA SADAR** — belum, dengan keputusan tercatat & pemicunya
- ❌ **BELUM / DITOLAK** — belum ada, atau sengaja tidak diadopsi

Satu kejujuran penting yang berlaku untuk banyak tanda ✅ di Phase 3–4: fitur-fitur itu
**dibangun dan lulus test, tapi belum pernah dipakai produksi nyata** — SAS001/005
ternyata tidak pernah diproduksi. MLVT akan menjadi pembuktian pertama. ✅ di sini berarti
"terverifikasi secara teknis", bukan "teruji medan".

---

## Phase 1 — Master Data

| Item | Status | Penjelasan |
|---|---|---|
| Product | 🟡 | Master item ADA (bahan, kemasan, produk jadi, ber-BOM & routing berversi — formula Zala V2/Drinkme V1 tercatat di dalamnya). TAPI keluhan Anda nyata dan penting: **alur repeat PO masih mengetik ulang produk** — artinya yang kurang bukan tabelnya, melainkan *alur pemakaiannya*: profil produk terpadu + tombol "buat SO dari order sebelumnya". Ini kandidat quick-win (lihat catatan di bawah tabel) |
| Product Category | 🟡 | Kategori dasar ada (RAW/PKG/FG, penanda kemasan). Kategori hirarkis/bertingkat belum — belum terasa perlu di jumlah SKU sekarang |
| UOM | 🟡 | Satuan ada & dipakai (kg, pcs, roll). Yang belum mulus: **konversi antar satuan** — kasus nyata sachet Etawa: stok ROLL, pemakaian SACHET (3.333/roll); konversi harus eksplisit agar sistem tidak memotong 1 roll utuh per batch. Sedang ditangani di jalur MLVT |
| Parameter | ❌ | Belum — wilayah Product Configurator. Ditunda dengan pemicu tercatat: saat varian per produk >3–5 dan tim mulai copy-paste BOM |
| Parameter Values | ❌ | Idem — satu paket dengan Parameter |
| BOM | ✅ | Berversi, teruji dengan formula nyata bertanda tangan (Zala V2, Drinkme V1, MLVT menyusul); riwayat versi tersimpan |
| Routing | ✅ | Berversi & terbukti dipakai-ulang lintas produk (routing serbuk 10 tahap → MLVT). Catatan: **linear saja** — kolom paralel/predecessor sudah disepakati sebagai tumpangan skema, engine-nya ditunda |
| Operation | 🟡 | Tahap operasi ada dengan durasi standar (K8). Yang belum: pemecahan setup/run/queue/wait/transfer time ala spec — tidak diadopsi dulu (terlalu granular untuk disiplin pencatatan saat ini). Lubang nyata: `routing_step_standard_crew` masih **0 baris di semua tahap** — standar SDM kosong, sudah jadi tugas PPIC |
| Work Center | 🟡 | Dimodelkan sebagai lini/tahap per plant dengan kapasitas per hari. Entitas work center formal dengan kalender-kapasitas sendiri belum — belum dibutuhkan di 2 lini |
| Machine / Asset | 🟡 | Mesin tercatat (2 unit Filling Sachet Karanglo) dan terhubung ke tahap. Tapi bukan asset register penuh (tanpa merek/serial/tanggal instalasi/jadwal maintenance) — itu wilayah Phase 5 yang ditunda |
| Calendar | ✅ | Kalender kerja ada & benar-benar dipakai (Sen–Jum 08–16, Sab 08–13; jadi dasar hitung kapasitas & pembagi tarif SDM) |
| Shift | 🟡 | Operasi 1 shift, belum ada master shift. Master shift sudah dirancang di dokumen absensi — dibangun bersama modul absensi nanti |

**Catatan khusus "Product" (keluhan repeat PO):** ini temuan UX paling berharga dari
checklist ini. Repeat order adalah NORMA bisnis contract manufacturer — klien yang sama,
produk yang sama, berulang. Alur yang benar: buka riwayat klien → pilih order lama →
"duplikat sebagai SO baru" → sistem menyalin produk, spesifikasi, harga terakhir →
Anda hanya mengubah qty & tanggal. Usulan: jadikan instruksi kecil terpisah ke Claude
Code (audit alur PO→SO sekarang + fitur duplikat) — nilainya harian, biayanya kecil.

## Phase 2 — Product Configuration

| Item | Status | Penjelasan |
|---|---|---|
| Product Configurator | ❌ | Belum, keputusan sadar. BOM berversi per produk masih memadai di jumlah SKU sekarang |
| Parameter Rules | ❌ | Idem |
| Matrix BOM | ❌ | Idem. Jalan tengah yang akan lebih dulu masuk akal bila varian bertambah: "BOM turunan" (clone + selisih tercatat) sebelum rule engine penuh |
| Configuration Validation | ❌ | Idem — meski *semangatnya* sudah ada: SO tidak bisa jalan tanpa BOM+routing valid (gerbang feasibility) |

## Phase 3 — Production Planning

| Item | Status | Penjelasan |
|---|---|---|
| MPS | 🟡 | Tidak ada lapisan MPS formal (horizon 52 minggu, bucket, frozen period) — **dan sebagian memang ditolak**: perencanaan FABRIX order-driven dari PO klien, bukan forecast. Yang setara sudah ada: feasibility & penjadwalan per SO. Frozen period versi ringan (ubah jadwal H-2 butuh approval) masuk backlog kecil |
| Capacity Check | ✅ | Terbukti bekerja pada kasus nyata — mendeteksi SAS001 infeasible (353 batch vs 21 hari kerja) lengkap dengan alasannya |
| Material Requirement | ✅ | Shortage engine: netting kebutuhan vs stok per lot, hasilnya daftar kekurangan (seluruh bahan MLVT muncul sebagai kekurangan = perilaku benar). Field safety_stock belum ada — sudah disepakati sebagai tumpangan murah |
| Production Planning | ✅ | APS ringan: jadwal batch, Gantt drag-drop, dashboard kapasitas. Batasnya sadar: linear, tanpa optimasi otomatis |

## Phase 4 — Production Execution

| Item | Status | Penjelasan |
|---|---|---|
| Production Order | ✅ | WO/batch dengan state machine ditegakkan di database (nama status beda dari spec, substansi setara) |
| Operation Execution | ✅* | Log per tahap (input/output/operator/waktu) dibangun & lulus test. *Tanda bintang kejujuran: belum pernah dipakai di produksi sungguhan — MLVT jadi yang pertama, dan di situlah UX lantai produksi baru benar-benar teruji |
| Parallel Operation | ❌ | Belum — dan routing MLVT adalah kasus hidupnya (persiapan kemasan box sebenarnya bisa paralel dengan tahap sachet). Kesiapan skema (parallel_group) = tumpangan; engine = ditunda |
| Operation Dependency | 🟡 | Urutan linear ditegakkan (tahap tidak bisa loncat). Dependency graph FS/SS/FF/lag ❌ — ditunda bersama keputusan APS ringan |
| Overlap | ❌ | Belum, ditunda sadar (fitur APS berat) |
| Actual Production | ✅* | Mekanisme lengkap (aktual vs standar per tahap — fondasi K8). *Data nyata belum ada; standar masih ESTIMASI_MANUAL menunggu produksi pertama |
| Material Consumption | ✅ | Konsumsi per lot + genealogy lot (telusur bahan→batch→hasil) — salah satu bagian terkuat sistem |

## Phase 5 — Maintenance

| Item | Status | Penjelasan |
|---|---|---|
| Asset | ⏸️ | Ditunda sadar — mesin tercatat minimal (lihat Phase 1), register penuh menunggu modul maintenance |
| Maintenance Schedule | ⏸️ | Ditunda — 2 lini, mesin relatif baru, tim 33 orang; belum sebanding biayanya |
| Maintenance Request | ⏸️ | Idem |
| Maintenance Work Order | ⏸️ | Idem |
| Downtime | 🟡 | **Satu-satunya yang jalan duluan:** log downtime produksi + klasifikasi ada di MES (dan jadi KPI DISIPLIN "100% terklasifikasi"). Yang belum: downtime maintenance yang memotong kapasitas terjadwal |
| Machine Availability | ⏸️ | Menunggu modul maintenance |
| MTBF | ⏸️ | Sudah diberi gerbang di rencana KPI: jangan dihitung sebelum modul maintenance & disiplin data ada — angka dari data setengah matang menyesatkan |
| MTTR | ⏸️ | Idem |

## Phase 6 — Integration

| Item | Status | Penjelasan |
|---|---|---|
| Inventory | ✅ | Ledger stok + lot + valuasi (37 lot, Rp270.766.422 tercatat) — teruji opname nyata |
| Warehouse | ✅ | Multi-plant/multi-gudang, opname, saldo awal. Catatan data (bukan fitur): seluruh stok tercatat di Karanglo, Ruko Dieng masih nol — pekerjaan opname, bukan pekerjaan kode |
| Quality | 🟡 | NCR + akar masalah + disposisi ada; tahap QC ada di routing. Yang menyusul: tautan COA→lot & sertifikat ber-masa-berlaku (lapisan kepatuhan MD-2 — registry MD-1 sudah selesai) |
| Costing | ✅ | Mesin biaya material+SDM & margin dua tingkat lulus 4/4 acceptance test literal. Biaya mesin & overhead ⏸️ ditunda sadar (K3: buka setelah 2–3 bulan data) |
| Finance | 🟡 | Costing/margin ada. Invoice & AR = roadmap FABRIX Finance. Akuntansi penuh ❌ **by design** — FABRIX mengekspor ke software akuntansi, tidak menggantikannya |
| Reporting | 🟡 | Dashboard operasional ada (kapasitas, margin, stok). Registry KPI + kartu tiga garis + dashboard per peran = rencana KPI-1..4 yang sudah diserahkan ke Opus, dibangun pasca-MLVT |

## Phase 7 — Advanced Intelligence

| Item | Status | Penjelasan |
|---|---|---|
| Optimization | ❌ | Optimasi jadwal otomatis tidak diadopsi — keputusan APS ringan; manusia menggeser Gantt, sistem memvalidasi |
| AI Planning | 📋 | Dirancang lengkap (F1 order-promising-menjelaskan-diri, simulasi skenario) di roadmap AI rev.2 — kode belum, menunggu fondasi Fase 0 |
| Predictive Maintenance | ⏸️ | Ditunda eksplisit di roadmap AI (butuh sensor & riwayat kerusakan yang belum ada) |
| Production Forecast | ❌ | **Ditolak** — contract manufacturer menerima demand dari PO klien; forecasting pasar bukan masalah Anda |
| Anomaly Detection | 📋 | Dirancang (F4), digerbang: butuh standar K8 DIPELAJARI + 2–3 bulan data — tanpa itu anomaly detector hanya mendeteksi kekacauan pencatatan |
| Agentic AI | 📋 | Paling matang desainnya: A1–A9, plafon L3 propose-only, konsol tata kelola, MCP — melampaui §42 spec. Kode belum; urutan pembangunan sudah ditetapkan |

---

## Rekap angka

| Status | Jumlah | Keterangan |
|---|---|---|
| ✅ Sudah | 12 | Terkonsentrasi di eksekusi, inventory, costing — jantung sistem |
| 🟡 Sebagian | 11 | Umumnya "data model ada, pelengkapnya menyusul" |
| 📋 Dirancang | 3 | Seluruhnya di Phase 7 (AI) — spec selesai, menunggu giliran |
| ⏸️ Ditunda sadar | 9 | Maintenance (8) + biaya mesin/overhead — semua punya pemicu tercatat |
| ❌ Belum/ditolak | 8 | Configurator (4, tunggu pemicu varian), paralel/overlap (2, APS ringan), optimization & forecast (2, ditolak) |

**Bacaan jujurnya:** fase yang oleh spec disebut terakhir (6 — Integration) justru bagian
paling selesai di FABRIX, dan fase awal spec (2 — Configuration) sengaja kosong. Itu bukan
salah urutan — spec itu menyusun urutan untuk pabrik ber-varian-banyak; FABRIX menyusun
urutan berdasarkan kebutuhan nyata Indo Taste. Dua lubang yang benar-benar perlu tindakan
dekat: **alur repeat-PO/duplikat SO** (quick-win, keluhan harian Anda) dan **standar kru
per tahap yang masih 0 baris** (tanpa ini biaya SDM batch MLVT = nol, dan margin MLVT
akan tampak lebih bagus dari kenyataan).
