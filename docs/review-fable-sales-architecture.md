> **CATATAN KEPALA — DIBACA LEBIH DULU (ditambahkan 24 Agu 2026 saat dokumen ini masuk repo)**
>
> Dokumen ini adalah **potret per 20 Agustus 2026**. Isinya TIDAK diperbarui mengikuti
> keadaan sistem, dan sebagian faktanya **sudah berubah** sejak ditulis:
>
> - Jumlah test bukan lagi 192, melainkan **275 test di 46 berkas** (per 24 Agu 2026).
> - "Routing non-linear" (S3) sudah **diturunkan urgensinya jadi Bisa Menunggu**, bukan lagi
>   dianggap penghalang.
> - Peran alamat & kontak pelanggan (address/contact roles) **SUDAH SELESAI** lewat PMB-07b —
>   di dokumen ini masih tertulis sebagai pekerjaan yang belum ada.
>
> **KEBENARAN STATUS TERKINI ADA DI DAFTAR TUGAS PEMBANGUNAN (`build_tasks`), BUKAN DI SINI.**
> Dokumen ini dipakai sebagai **peta cakrawala** — apa saja yang kelak mungkin dibutuhkan modul
> Sales — bukan sebagai daftar pekerjaan yang sedang berjalan. Sebelum mengerjakan apa pun yang
> disebut di sini, periksa dulu task terkait di Daftar Tugas.
>
> Keputusan strategis yang mengikat dokumen ini tercatat di modul **SLS** pada Daftar Tugas
> (lihat SLS-01 sampai SLS-05 dan SLS-90).

# Tinjauan Arsitektur — FABRIX Sales Domain v0.1 → Arahan v0.2

**Dari:** Claude Fable 5 (peninjau arsitektur, sesuai mandat §40 dokumen sumber)
**Untuk:** sesi Claude chat Opus 5 — dokumen ini adalah HASIL review tahap Fable dalam
pipeline §48/§50. Tugas Opus dijelaskan di Bagian I (bukan menghasilkan 25 keluaran §49
sekaligus — baca alasannya).
**Sumber:** `FABRIX_Sales_Technical_Architecture_Fable5_v0_1.md` (2.215 baris, §1–§51)
**Konteks yang WAJIB dipegang Opus:** FABRIX bukan greenfield. Sistem berjalan dengan
192 test: customer & SO + approval 3 departemen, feasibility/CTP engine teruji kasus
nyata, shipments + surat jalan + POD + tanda tangan, NCR + disposisi, mesin biaya &
margin lulus acceptance literal, Master Dokumen MD-1 selesai, lot genealogy penuh.
Studi kasus MLVT berjalan; antrean koreksi S1–S3 aktif (S1 = duplikat SO/repeat order).

---

# A. PENILAIAN EKSEKUTIF

**Kualitas prinsip: tinggi.** Pemisahan kepemilikan kebenaran per domain (§2, §51),
snapshot komersial yang tak boleh berubah diam-diam (§12, §14, §34, §38), change-request
dengan analisis dampak (§16), reservation vs allocation (§21), batas "konfigurasi
pelanggan tidak boleh memutasi master produksi" (§9) — semuanya benar, dan sebagian
besar SUDAH menjadi hukum FABRIX (audit trail, state machine di database, larangan
edit riwayat, RLS).

**Kelemahan fatalnya bukan isi, tapi asumsi dan skala:**
1. Ditulis seolah greenfield — mengabaikan bahwa separuh arsitekturnya SUDAH DIBANGUN
   dan teruji di FABRIX dengan nama berbeda (§17–18 ATP/CTP = feasibility engine;
   §22–25 delivery/POD = modul shipments; §27 complaint ≈ NCR; §10–11 costing/pricing
   ≈ mesin biaya & margin). Menspesifikasikan ulang dari nol = membangun sistem kembar
   dan membunuh sistem yang hidup.
2. Skala Salesforce+SAP-SD (17 modul: commission, forecast multi-skenario, blanket
   contract, RMA penuh, parent/child accounts, multi-currency) untuk contract
   manufacturer 33 karyawan dengan SATU pembangun. Dijalankan sekaligus = big-bang
   yang tidak akan pernah selesai.
3. Dua modulnya bertentangan dengan keputusan FABRIX yang sudah dikunci (forecast:
   DITOLAK untuk model bisnis order-driven; commission: belum ada tim sales).

**Vonis:** arsitektur ini diterima sebagai **peta cakrawala v1.0** dengan revisi
Bagian E, dan diimplementasikan sebagai **rangkaian bertahap SALES-1..5** (Bagian F)
yang masing-masing menempel pada sistem yang ada — bukan sebagai program tunggal.
Instruksi §47 "jangan menyederhanakan demi mengurangi kompleksitas" saya patuhi dengan
cara yang benar: tidak ada konsep yang dibuang — semuanya diberi disposisi dan pemicu;
yang saya tolak adalah URUTAN dan ASUMSI-nya, bukan arsitekturnya.

## Scorecard singkat (area §40)
| Area | Nilai | Catatan |
|---|---|---|
| Domain boundaries & ownership (§2,3,51) | A | Adopsi penuh — sudah selaras praktik FABRIX |
| State machines & auditability (§15,34) | A− | Pola FABRIX sudah begini; samakan nama status dengan yang ada |
| Data integrity rules (§38) | A | Adopsi verbatim ke CLAUDE.md (13 aturan — lihat E.6) |
| Snapshot & revisi komersial (§12,14,16) | A− | Adopsi; reuse feasibility utk impact analysis |
| ATP/CTP (§17,18) | B | Konsepnya benar TAPI sudah ada — jangan bangun ulang; perluas |
| Event architecture (§33) | C | Bus event penuh prematur utk modular monolith — pakai outbox/tabel event ringan |
| Forecast (§29,30) | D | Bertentangan keputusan terkunci — parkir |
| Commission (§28) | D | Tanpa tim sales = kode mati — parkir |
| Kesadaran kondisi eksisting | F | Cacat utama dokumen — diperbaiki oleh review ini |

---

# B. FAKTA EKSISTING YANG MEMBATALKAN "GREENFIELD"

Peta padanan yang WAJIB dipakai Opus saat menulis spesifikasi (kolom kiri = istilah
dokumen v0.1; kanan = kenyataan FABRIX):

| Dokumen v0.1 | Kenyataan FABRIX | Konsekuensi |
|---|---|---|
| §17 ATP + §18 CTP | Feasibility engine (stok per lot, kapasitas, kalender; terbukti mendeteksi order infeasible) | PERLUAS (multi-gudang, quality-hold exclusion, alokasi) — jangan tulis ulang |
| §22–25 Delivery/Shipment/POD | Modul shipments: surat jalan, tanda tangan, POD berfoto, QR publik | Sudah ada; tambahan = partial/split bila dibutuhkan nyata |
| §27 Complaint | NCR + akar masalah + disposisi + traceability lot→batch→supplier | Komplain pelanggan = NCR tipe baru + tautan SO/shipment — SATU sistem, bukan dua |
| §10 Costing | Mesin biaya (material+SDM, lot-level) + K8 standar ber-asal-usul; cost source persis konsep K8 {ESTIMASI_MANUAL, DIPELAJARI} | Perluas komponen (setup/eksternal) saat K3 dibuka — engine-nya sudah ada |
| §11 Pricing | Mesin margin dua tingkat (kontribusi/order, laba bulanan) lulus 4/4 test | Price waterfall = lapisan tipis di atasnya, bukan engine baru |
| §14–15 SO + state machine | SO + approval 3 departemen + state machine di DB | Samakan; tambah yang kurang (snapshot harga, revisi) |
| §26 Return | Disposisi NCR (RELEASE/REWORK/SCRAP dst) sudah ada | RMA lite = alur masuk barang kembali → NCR |
| §34 Audit, §35 RBAC | Audit trail & 16 role + RLS teruji | Sudah hukum |
| §37 DB principle | Modular monolith Postgres + schema per modul (ADR terkunci) | `sales` schema — BUKAN service terpisah |
| §5 CustomerProduct | BELUM ADA — dan inilah akar keluhan repeat-PO | ADOPSI SEKARANG (S1) |
| §8 Sample workflow | BELUM ADA — padahal ini motor penjualan contract manufacturer | ADOPSI (SALES-3) |
| §12 Quotation | BELUM ADA (penawaran masih di luar sistem) | ADOPSI (SALES-2) |
| §16 Change request + impact | BELUM ADA formalnya | ADOPSI (SALES-4), reuse feasibility |

---

# C. TEMUAN (klasifikasi §41)

## CRITICAL

**C1. Asumsi greenfield.**
Masalah: v0.1 tidak menyebut satu pun komponen eksisting. Kenapa penting: spesifikasi
yang lahir darinya akan menduplikasi ATP/CTP, delivery, complaint, costing — dua sumber
kebenaran untuk hal yang sama = korupsi data yang §42 sendiri peringatkan.
Rekomendasi: v0.2 ditulis SEBAGAI PERLUASAN codebase; setiap paket implementasi diawali
audit modul eksisting (sesuai §46 dokumen — yang ironisnya sudah mensyaratkan ini untuk
Claude Code tapi tidak dilakukan penulisnya). Dampak: semua entitas Bagian B.

**C2. Big-bang untuk satu pembangun.**
Masalah: 17 modul sekaligus. Kenapa penting: FABRIX hidup dari orderan nyata (MLVT) dan
antrean koreksi berjalan; program raksasa membekukan keduanya. Rekomendasi: rangkaian
SALES-1..5 (Bagian F), tiap tahap bernilai sendiri & rilis sendiri. Dampak: seluruh §49.

**C3. Modul forecast bertentangan dengan keputusan terkunci.**
Masalah: §29–30 membangun forecast multi-versi multi-skenario. FABRIX sudah MEMUTUSKAN
(roadmap AI + analisis spec ERP): contract manufacturer = demand dari PO klien; forecast
pasar ditolak. Rekomendasi: parkir seluruh §29–30; satu-satunya yang diambil = konsep
*forecast consumption* DISIMPAN sebagai catatan untuk masa depan bila kelak ada kontrak
blanket dengan komitmen volume (pemicunya tercatat). Dampak: hapus dari v0.2 core.

**C4. Event bus penuh prematur.**
Masalah: §33 menyiratkan arsitektur event antar-domain. Kenapa penting: modular monolith
satu database — bus event eksternal menambah moving part tanpa nilai di skala ini, dan
§33 sendiri berkata "transport must be reviewed". Rekomendasi: **outbox ringan** — tabel
`domain_events` (append-only, sudah setengah ada lewat status_transition_log) yang
dikonsumsi worker internal; kontraknya event names §33 dipertahankan supaya migrasi ke
bus sungguhan kelak mekanis. Dampak: §33, integrasi semua modul.

## HIGH — adopsi dengan penyesuaian

**H1. CustomerProduct (§5)** — permata dokumen ini. Kode produk milik pelanggan ↔ kode
FABRIX + spesifikasi + MOQ + kemasan. Langsung menyelesaikan akar keluhan repeat-PO
(PO klien memakai kode MEREKA). Masuk sesi S1 yang sudah berjalan. 

**H2. Quotation bersnapshot + revisi terkendali (§12)** — penawaran hari ini hidup di
luar sistem; jejak nego hilang. Adopsi dengan state machine pola FABRIX; snapshot harga
& syarat; revisi = baris baru. SALES-2.

**H3. Sample Request workflow (§8)** — motor penjualan contract manufacturer yang belum
punya rumah. Adopsi dengan penyederhanaan: satu entitas SampleRequest ber-state
(DIMINTA→DIKEMBANGKAN→DIKIRIM→FEEDBACK→DIKONVERSI/DITOLAK), versi sampel, biaya sampel
tercatat (masuk profitabilitas pelanggan), approval pola eksisting. R&D "domain" = role,
bukan modul baru. SALES-3.

**H4. SO Change-Request + impact analysis (§16)** — adopsi; analisis dampaknya MEMANGGIL
feasibility engine yang ada (bahan/kapasitas/tanggal-terdekat sudah dihitung sistem
untuk kasus SAS001). Empat respons (§16) dipertahankan. SALES-4.

**H5. Batas kandidat-BOM (§9)** — konfigurasi/spesifikasi pelanggan menghasilkan
KANDIDAT; master BOM produksi hanya berubah lewat approval (di FABRIX: pemilik/R&D).
Adopsi sebagai ATURAN sekarang (CLAUDE.md), entitas configurator tetap ditunda sesuai
pemicu varian yang sudah tercatat.

**H6. Reservation vs Allocation (§21)** — konsep benar; versi FABRIX: alokasi lot/batch
ke SO saat penjadwalan (setengah ada lewat alokasi bahan). Formalisasi menyusul di
SALES-4/5; aturan §38.5 (reservasi ≠ mengurangi stok fisik) berlaku sejak sekarang.

**H7. Credit profile (§5)** — versi lite: payment terms + flag piutang bermasalah +
blokir-lunak saat buat SO. Credit engine penuh menunggu modul invoice/AR (roadmap
Finance). 

## MEDIUM

**M1. Lead/Opportunity (§6–7)** — CRM-lite saja: satu entitas Prospek dengan stage
sederhana; funnel penuh (probability, weighted pipeline) ditunda — pipeline Indo Taste
dikelola pemilik langsung. Pemicu upgrade: ada orang sales dedicated.
**M2. Contract/Blanket (§13)** — relevan kelak (klien besar dengan komitmen volume);
pemicu: klien pertama yang meminta harga kontrak. Sampai itu: field `contract_ref` di SO.
**M3. Return/RMA (§26)** — alur masuk-kembali lite → NCR (H di atas); RMA formal saat
frekuensi retur membuktikan perlunya.
**M4. Parent/child account (§5)** — satu kolom `group_name` dulu; hirarki penuh saat ada
grup nyata.
**M5. Pick/Pack states (§23)** — subset (ALLOCATED→PACKED→SHIPPED) bila gudang
membutuhkannya; alur shipments sekarang sudah memadai untuk volume saat ini.
**M6. Analytics (§31–32)** — JANGAN modul analytics sendiri: KPI registry (rencana KPI
yang sudah diserahkan) adalah rumahnya; customer profitability §32 = definisi
kontribusi/pelanggan yang mesin margin sudah bisa hitung + biaya sampel (H3) + retur.
Masuk katalog KPI, bukan modul baru.

## LOW / parkir dengan pemicu tercatat
Commission (§28 — pemicu: karyawan sales pertama), multi-currency & multi-company
(§40.23–24 — pemicu: tenant/klien ekspor pertama; skema sudah menyimpan tenant_id),
duplicate-merge engine (§5 — sekarang: warning nama/NPWP mirip saat create; merge tool
nanti), forecast (C3), address/contact roles (§5 — adopsi trivial saat menyentuh
customer master di S1).

---

# D. PETA DISPOSISI LENGKAP §1–§51 (tidak ada yang terlewat)

| § | Isi | Disposisi |
|---|---|---|
| 1–3 | Tujuan, ownership, boundary | ✅ ADOPSI sebagai prinsip v0.2 (sudah selaras) |
| 4 | 17 modul sales/ | 🔁 REVISI: schema `sales` dalam monolith; modul = folder logis, pembangunan bertahap F |
| 5 | Customer/Account lengkap | 🟡 SEBAGIAN ada (customer master); ADOPSI: CustomerProduct (S1), address/contact roles (S1), status; TUNDA: parent-child penuh, dedupe-merge, credit engine (lite dulu) |
| 6–7 | Lead/Opportunity | 🔽 LITE (M1) |
| 8 | Sample | ✅ ADOPSI (SALES-3, disederhanakan) |
| 9 | Product Configuration | ⏸️ entitas TUNDA (pemicu varian >3–5, sudah tercatat); ✅ ADOPSI aturan kandidat-BOM sekarang |
| 10 | Costing | 🟡 Engine ADA; perluas komponen saat K3; cost-source ≈ K8 (samakan istilah, jangan dua taksonomi) |
| 11 | Pricing | ✅ ADOPSI waterfall LITE di atas mesin margin (SALES-2) |
| 12 | Quotation | ✅ ADOPSI (SALES-2) |
| 13 | Contract/Blanket | ⏸️ TUNDA + pemicu (M2) |
| 14–15 | SO + state machine | 🟡 ADA; lengkapi snapshot & revisi (SALES-2/4); JANGAN ganti nama status yang sudah dipakai |
| 16 | Change management | ✅ ADOPSI (SALES-4) reuse feasibility |
| 17–18 | ATP/CTP | 🟡 ADA (feasibility); perluas: exclude quality-hold, multi-gudang, earliest-availability |
| 19 | Demand interface | 🔁 REVISI: SO terkonfirmasi = demand (sudah begitu); tabel demand terpisah + pegging menyusul BERSAMA alokasi formal (H6) |
| 20–21 | Fulfillment, reservation/allocation | ✅ konsep ADOPSI; formalisasi bertahap (H6) |
| 22–25 | Delivery/Pick-Pack/Shipment/POD | ✅ SUDAH ADA; tambah partial/split saat kasus nyata; pick-pack subset (M5) |
| 26 | Return/RMA | 🔽 LITE → NCR (M3) |
| 27 | Complaint | 🔁 REVISI: NCR tipe KOMPLAIN_PELANGGAN + tautan SO/shipment — satu sistem mutu |
| 28 | Commission | ⏸️ PARKIR + pemicu |
| 29–30 | Forecast | ❌ PARKIR (bertentangan keputusan terkunci); simpan konsep consumption utk blanket kelak |
| 31 | Analytics | 🔁 ke KPI registry (M6) |
| 32 | Customer profitability | ✅ ADOPSI sebagai KPI + perluasan mesin margin (biaya sampel, retur, freight) |
| 33 | Events | 🔁 REVISI: outbox ringan, nama event dipertahankan (C4) |
| 34 | Auditability | ✅ sudah hukum |
| 35 | Permission | ✅ pakai 16 role eksisting; JANGAN buat set role baru paralel |
| 36 | API draft | 🔁 REVISI: ikuti pola API eksisting; command/query & idempotency ditetapkan per paket |
| 37 | DB principle | ✅ selaras ADR monolith; projections = view/materialized view dulu |
| 38 | 13 aturan integritas | ✅ ADOPSI VERBATIM → CLAUDE.md (E.6) |
| 39 | Skenario end-to-end | ✅ ADOPSI sebagai skenario uji arsitektur; versi FABRIX-nya: alur MLVT nyata |
| 40–47 | Mandat review Fable | ✅ DIPENUHI oleh dokumen ini (dengan koreksi C1–C2 atas asumsinya) |
| 44 | 19 edge case komersial | ✅ ADOPSI sebagai bank skenario uji — didistribusikan per tahap SALES-1..5 (bukan dijawab sekaligus) |
| 45 | Failure & concurrency | ✅ ADOPSI pola: idempotency key di semua endpoint tulis (sudah pola POD/absensi), optimistic locking via versi baris, transaksi DB per agregat, retry dgn backoff di worker; per-paket dirinci Opus |
| 48–50 | Pipeline & metodologi | 🟡 DITERIMA dengan koreksi: tahap "Opus Specifier" TIDAK menghasilkan 25 artefak §49 sekaligus — per paket SALES-N (Bagian I); format paket §49 akhir ≈ B.0.2 yang sudah dipakai — SATUKAN, jangan dua format |
| 51 | Prinsip kepemilikan & digital thread | ✅ ADOPSI sebagai pembuka v0.2 |

---

# E. ARSITEKTUR REVISI v0.2 — RINGKASAN PERUBAHAN WAJIB

1. **Konteks eksisting menjadi bagian dokumen** (peta Bagian B disalin ke v0.2).
2. **Modular monolith dipertahankan**: schema `sales`, service internal, outbox events;
   tidak ada microservice/bus eksternal di v0.2.
3. **Reuse eksplisit**: ATP/CTP→feasibility, complaint→NCR, delivery→shipments,
   costing→mesin biaya, analytics→KPI registry. Setiap duplikasi = cacat review.
4. **Modul diparkir keluar dari core**: forecast, commission, configurator penuh,
   contract/blanket, parent-child, multi-currency — masing-masing dengan pemicu tertulis.
5. **Snapshot & revisi** jadi pola baku entitas komersial (quotation, SO) —
   selaras prinsip "hapus=arsip, edit=versi" yang sudah berlaku.
6. **13 aturan §38 masuk CLAUDE.md verbatim** (dengan penomoran SD-1..SD-13) — berlaku
   untuk SEMUA sesi sejak sekarang, termasuk S1 yang sedang berjalan.
7. **Terminologi**: istilah eksisting menang (feasibility, NCR, shipments, K8) —
   §47 "preserve existing terminology" berlaku dua arah.

# F. URUTAN IMPLEMENTASI (menggantikan §43-nya dokumen)

| Tahap | Isi | Kaitan |
|---|---|---|
| **SALES-1** | CustomerProduct + address/contact roles + profil produk + duplikat SO + warning duplikat pelanggan | = perluasan sesi S1 yang SUDAH di antrean — gabungkan |
| **SALES-2** | Quotation (snapshot, revisi, approval, expiry) + pricing waterfall lite + snapshot harga di SO | setelah S2/S3 antrean koreksi |
| **SALES-3** | Sample Request workflow + biaya sampel → profitabilitas pelanggan | motor penjualan |
| **SALES-4** | SO Change-Request + impact (reuse feasibility) + alokasi formal lot/batch↔SO + ATP quality-hold | |
| **SALES-5** | Komplain pelanggan (NCR tipe baru + tautan SO/shipment/batch) + return lite + KPI sales (OTD per pelanggan, kontribusi/pelanggan, win-rate sederhana) | |
| Parkir | forecast, commission, blanket, configurator, parent-child, multi-currency, dedupe-merge, pick-pack penuh | pemicu tercatat di C/M |

Gerbang: SALES-1 menumpang S1 sekarang; SALES-2..5 masuk antrean SETELAH antrean
koreksi S2–S3 selesai, satu tahap satu rilis, tiap tahap dipakai nyata sebelum tahap
berikut dimulai.

# G. KEPUTUSAN DIKUNCI vs KONFIGURABEL

**Dikunci (AA):** kepemilikan kebenaran §51; 13 aturan §38; snapshot komersial;
monolith+schema; reuse engine eksisting; RLS & role eksisting; hapus=arsip.
**Konfigurabel per tenant (AB):** ambang approval diskon/margin, payment terms default,
MOQ, jenis alamat/kontak, taksonomi komplain, kebijakan partial delivery, expiry
quotation.

# H. PERTANYAAN UNTUK PEMILIK PRODUK (AC — Opus wawancarai SEBELUM paket pertama)

1. Bagaimana penawaran harga dibuat HARI INI (WhatsApp? Excel?) dan apa saja isinya —
   supaya quotation SALES-2 memformalkan kebiasaan nyata, bukan mengarang alur baru.
2. Alur sampel hari ini: siapa minta, siapa buat, siapa bayar, berapa lama, di mana
   macetnya? (SALES-3)
3. Klien mana yang memakai kode produk mereka sendiri di PO? Contoh nyata 2–3 PO. (S1)
4. Payment terms yang berlaku per klien + pernah ada masalah piutang? (H7 lite)
5. Pernah ada permintaan kontrak harga/volume komitmen? (pemicu M2)
6. Seberapa sering retur/komplain setahun terakhir, dan bentuknya apa? (M3/SALES-5)
7. Perubahan order oleh klien: seberapa sering qty/tanggal berubah setelah konfirmasi?
   (memvalidasi prioritas SALES-4)

# I. INSTRUKSI PROSES UNTUK OPUS

1. Baca dokumen v0.1 + review ini + `antrean-koreksi-fitur-ada.md`. Bila bertentangan,
   review ini menang; bila review ini bertentangan dengan keputusan pemilik produk,
   pemilik produk menang.
2. Wawancarai Bagian H satu per satu (pola B.6 — satu pertanyaan, contoh dampak).
3. Susun **hanya paket SALES-1** dulu (gabung dengan S1), format B.0.2 penuh — bukan
   25 artefak §49. Artefak §49 dihasilkan PER PAKET, secukupnya paket itu.
4. Wajibkan Claude Code memulai tiap paket dengan audit modul eksisting (§46 dokumen
   sumber — kali ini sungguh dijalankan) dan melaporkan komponen yang di-reuse.
5. Ambil skenario uji dari bank §44/§45 yang relevan dengan paket tersebut sebagai
   skenario negatif; tiap paket minimal 2 dari §44 + 1 dari §45.
6. 13 aturan SD masuk CLAUDE.md pada paket pertama.
7. Review adversarial B.12 untuk setiap laporan selesai — "hijau ≠ benar" berlaku.

---
*Fable 5 — tinjauan selesai. Tidak ada bagian §1–§51 tanpa disposisi; tidak ada konsep
yang dibuang tanpa pemicu tertulis; tidak ada yang dibangun dua kali.*
