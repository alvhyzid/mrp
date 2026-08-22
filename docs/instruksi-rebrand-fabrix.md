> Dokumen rencana per ~19-20 Agu 2026. Sebagian isi sudah berubah oleh keputusan sesudahnya — rujuk Daftar Tugas Pembangunan (modul `RBD`, task `RBD-01` s.d. `RBD-07`) sebagai sumber kebenaran status terkini, bukan dokumen ini. Perubahan diketahui (22 Agu 2026): gerbang "setelah 12 September" DICABUT; urutan berubah — transfer kepemilikan (RBD-04) sebelum perapian environment (INF-02).

# Instruksi Rebrand — AMS → FABRIX

**Untuk:** sesi Claude chat (Opus) — pecah menjadi instruksi Claude Code per fase (B.0.2)
dan checklist akun untuk pemilik produk.
**Prinsip keselamatan #1:** ganti nama BERLAPIS, yang berisiko paling akhir. Identitas
tampilan, kepemilikan akun, dan alamat infrastruktur adalah TIGA hal berbeda — jangan
pernah diubah dalam satu langkah.
**Fakta yang meredakan kekhawatiran utama:** memindahkan kepemilikan (transfer repo
GitHub ke organisasi, transfer project Supabase antar organisasi, transfer project
Vercel ke team) **TIDAK mengubah URL, project ref, connection string, atau API key** —
sistem tetap hidup. Yang mengubah alamat adalah MEMBUAT PROJECT BARU, dan itu justru
yang DILARANG di instruksi ini. (Claude Code wajib memverifikasi klaim ini di dokumentasi
resmi masing-masing platform SAAT eksekusi, karena perilaku platform bisa berubah.)

---

## GERBANG WAKTU (tidak bisa ditawar)

| Fase | Boleh kapan |
|---|---|
| R0 Inventaris + R1 tampilan | **Sekarang** — nol risiko infrastruktur |
| R2 Pembuatan akun perusahaan | **Sekarang** — membuat ≠ memindahkan |
| R3 Transfer kepemilikan | **Setelah 12 Sep** (SAS001 & SAS005 terkirim), di akhir pekan, staging dulu |
| R4 Domain cutover & email | Setelah R3 stabil ≥3 hari |
| R5 Bersih-bersih identifier kode | Terakhir, santai |

Alasan gerbang: transfer GitHub memutus sementara integrasi CI/Vercel sampai
disambung ulang — deploy berhenti (aplikasi tetap jalan), dan itu TIDAK BOLEH terjadi
di tengah minggu produksi September.

---

## R0 — Inventaris (Claude Code; sekarang; read-only)

Petakan SEMUA kemunculan identitas lama sebelum menyentuh apa pun:
1. Grep `ams` / `AMS` / nama lama di: repo (kode, package.json, README, CLAUDE.md,
   docs), env vars, konfigurasi Vercel/Supabase, seed data, template email, judul
   halaman, PWA manifest.
2. Daftar semua ALAMAT yang dicetak/tertanam di luar sistem: URL halaman POD di QR
   surat jalan yang SUDAH dicetak, magic link auth, alamat pengirim email.
   → Ini daftar "kontrak eksternal" yang wajib tetap hidup setelah rebrand.
3. Daftar integrasi yang terikat akun pribadi: GitHub (repo, Actions, secrets),
   Supabase (org, project dev+staging+prod... sebutkan semua), Vercel (project,
   domain, env), SMTP/email, Sentry (bila sudah), Anthropic (baru — cek §R2).
4. Keluaran: `docs/rebrand-inventaris.md` — tabel lokasi × jenis × fase penggantian.
   TIDAK ADA PERUBAHAN di fase ini.

## R1 — Rebrand tampilan (Claude Code; sekarang; aman)

Ganti semua yang DILIHAT manusia, nol sentuhan infrastruktur:
- Nama aplikasi di UI, judul tab, logo placeholder, PWA manifest, template email
  (teks, bukan alamat pengirim), dokumen cetak (surat jalan, PO) → FABRIX.
- README, CLAUDE.md, dokumen internal: "FABRIX (sebelumnya AMS-MVP.01)" — jejak nama
  lama dipertahankan satu kali di README untuk arkeologi.
- Kode proyek internal "AMS-MVP.01" di dokumen menjadi "FABRIX-MVP.01".
- JANGAN mengubah: nama repo, package name, env vars, URL, schema DB, nama project
  Supabase/Vercel. Itu fase lain.
- Bukti: grep menunjukkan sisa `AMS` hanya di lokasi yang memang dijadwalkan fase
  R3–R5 (sesuai inventaris R0).

## R2 — Pembuatan akun perusahaan (👤 pemilik produk; sekarang; belum ada transfer)

Checklist (semua akun BARU, belum memindahkan apa pun):
- [ ] Email perusahaan aktif (mis. admin@fabrix.<tld>) + 2FA.
- [ ] **GitHub Organization** `fabrix-...` — akun pribadi diundang sebagai owner.
- [ ] **Supabase Organization** baru atas email perusahaan — akun pribadi diundang
      sebagai owner juga (dua-duanya owner = kunci keselamatan transfer nanti).
- [ ] **Vercel Team** baru atas email perusahaan.
- [ ] Anthropic: bila akun API sudah terlanjur dibuat dengan email pribadi → buat
      organisasi dengan email perusahaan SEKARANG sebelum ada pemakaian berarti
      (memindahkan riwayat pemakaian lebih sulit daripada memulai benar).
- [ ] DNS domain fabrix: siapkan, JANGAN arahkan apa pun dulu.
- [ ] Password manager perusahaan / vault untuk semua kredensial di atas.
- [ ] **Cek merek**: telusuri "FABRIX" di PDKI (pangkalan data kekayaan intelektual
      Indonesia) & pencarian umum untuk konflik di kelas software — SEBELUM biaya
      branding membesar. (Domain terbeli ≠ merek aman.)

## R3 — Transfer kepemilikan (Claude Code memandu + 👤 eksekusi; SETELAH 12 Sep; akhir pekan)

Urutan per platform, satu per satu, verifikasi penuh sebelum lanjut:

**R3.1 GitHub** — transfer repo akun pribadi → organisasi fabrix.
- Sebelum: catat semua Actions secrets (nilai TIDAK ikut pindah otomatis di semua
  kasus — verifikasi), webhook, deploy keys, integrasi Vercel.
- Transfer → GitHub membuat redirect otomatis dari path lama (remote lama tetap jalan),
  tapi TETAP perbarui remote lokal & referensi CI.
- Sesudah: pasang ulang secrets, sambung ulang integrasi Vercel↔GitHub, jalankan CI
  penuh, deploy staging, uji alur auth penuh di staging.
- Rollback: transfer balik (GitHub mengizinkan) — tapi keputusan rollback dalam 1 jam
  pertama bila CI tidak bisa dipulihkan.

**R3.2 Supabase** — transfer SEMUA project (dev, staging, prod) org pribadi → org fabrix.
- Fakta kunci (verifikasi di docs saat eksekusi): transfer project antar organisasi
  mempertahankan project ref, URL, anon/service key → aplikasi TIDAK terputus.
- Perhatikan: paket/billing org tujuan minimal setara (fitur PITR/backup jangan turun
  kelas diam-diam); anggota & policy org di-review ulang.
- Sesudah: smoke test penuh (auth, query, storage, edge functions, cron) di staging
  lalu prod; verifikasi backup otomatis MASIH berjalan di org baru (jangan sampai
  jadwal backup hilang bersama org lama).

**R3.3 Vercel** — transfer project → team fabrix. Env vars ikut? VERIFIKASI — bila
tidak, salin manual sebelum transfer. Domain vercel.app lama tetap hidup.

**R3.4** Sentry/monitoring & layanan lain: pindahkan/undang ulang dengan pola sama.

Aturan umum R3: satu platform per hari maksimum; tiap selesai → checklist verifikasi
+ 24 jam pengamatan sebelum platform berikutnya; SEMUA dijalankan dulu di staging bila
platform memungkinkan.

## R4 — Domain & email cutover (setelah R3 stabil)

1. Tambahkan domain fabrix ke Vercel **berdampingan** dengan URL lama (dua-duanya hidup).
2. Perbarui Supabase Auth: site URL & redirect URLs memuat domain baru DAN lama.
3. SMTP: alamat pengirim → no-reply@fabrix.<tld>; SPF/DKIM/DMARC dipasang & diuji
   (email tanpa ini masuk spam — uji ke Gmail/Yahoo/Outlook sebelum dipakai).
4. **Kontrak eksternal dijaga:** URL POD di QR surat jalan yang sudah dicetak harus
   tetap hidup → domain/URL lama menjadi redirect permanen ke domain baru,
   dipertahankan MINIMAL 12 bulan. Token POD lama tetap tervalidasi.
5. Setelah 2 minggu stabil: domain baru jadi kanonik; lama tinggal redirect.

## R5 — Bersih-bersih identifier (santai, riding sesi lain)

Nama package, nama repo internal di docs, komentar kode, nama workflow CI → FABRIX.
JANGAN rename schema/tabel database hanya demi branding — nama internal DB bukan
merek, dan migrasi rename massal adalah risiko tanpa nilai pengguna.

---

## Pengelompokan fitur → lini produk FABRIX

**Peringatan arsitektur:** ini pengelompokan NAMA (kemasan produk & navigasi), BUKAN
pemecahan kode. Modular monolith + schema-per-modul tetap; enam nama ini adalah label
di atasnya. Rebrand ≠ re-arsitektur.

| Lini | Isi (fitur yang sudah ada/direncanakan) |
|---|---|
| **FABRIX ERP** (core) | Master data (item, supplier, customer, karyawan), Sales Order, Purchasing/PO + approval, Shipments + surat jalan + tanda tangan + POD, notifikasi, Master Dokumen (registry), audit trail |
| **FABRIX MRP** | BOM & routing, kalkulasi kebutuhan bahan, feasibility/CTP, penjadwalan & kapasitas, standar-terpelajar K8, saran pembelian |
| **FABRIX MES** ⚠️ *(lini ke-7 — WAJIB ditambah, lihat catatan)* | Eksekusi batch & tahap, log input/output, downtime + klasifikasi, labor log, mode lantai produksi (PIN/badge), serah terima shift |
| **FABRIX WMS** | Lot & traceability, stock movements, multi-gudang/plant, opname & saldo awal, alokasi/issue bahan, penerimaan barang |
| **FABRIX QMS** | NCR + akar masalah + disposisi, hold/release, COA per lot, sertifikat & masa berlaku (lapisan kepatuhan Master Dokumen), paket audit per batch/lot, SOP terkendali |
| **FABRIX Finance** | Mesin biaya & margin (kontribusi + laba bulanan), valuasi persediaan, tarif SDM, overhead, invoice & AR (roadmap), ekspor akuntansi |
| **FABRIX AI** | Kamus/ontology, panel asal-usul & Drop-AI, process mining, copilot & narasi, anomaly, Kesiapan AI, konsol tata kelola, metering |

### Yang ambigu — keputusan pemilik produk (dengan rekomendasi)

| Fitur | Kandidat | Rekomendasi & alasan |
|---|---|---|
| **Eksekusi produksi (MES)** | MRP? berdiri sendiri? | **Tambah FABRIX MES.** Daftar 6 lini Anda melewatkan jantung sistem ini — MRP itu perencanaan, sedangkan kekuatan terbesar yang sudah dibangun adalah eksekusi & pencatatan lantai produksi. Alternatif bila ingin tetap 6: gabung jadi "FABRIX MFG" (plan+execute) |
| KPI & dashboard | AI? per-lini? | **Milik semua lini** — tiap lini punya KPI-nya; kartu & registry = layanan platform. "FABRIX AI" hanya untuk lapisan analitik/narasi di atasnya (selaras tier Insight) |
| Master Dokumen | ERP? QMS? | **Registry = ERP core; lapisan kepatuhan (COA, sertifikat, expiry, paket audit) = QMS.** Satu modul, dua wajah |
| Shipments | ERP? WMS? | **ERP** (pemenuhan order/order-to-cash). WMS hanya pergerakan stok fisiknya |
| Absensi & HRD | tidak ada lininya | **FABRIX HR** kelak bila modul membesar; untuk sekarang parkir di ERP (master karyawan) — jangan buat lini untuk satu fitur |
| Kamus/ontology | AI? platform? | Ditampilkan di **FABRIX AI** (fondasinya), meski secara teknis layanan platform |
| Platform (auth, tenant, RBAC, billing SaaS) | — | **FABRIX Platform** — internal, tidak dijual sebagai lini |

Konsekuensi UI (masuk instruksi R1): navigasi dikelompokkan per lini dengan label ini;
konsekuensi komersial: harga per lini/bundel dibahas TERPISAH nanti (jangan dicampur
dengan rebrand).

---

## Pembagian kerja

| Fase | Claude Code | Pemilik produk |
|---|---|---|
| R0 | Inventaris lengkap | Review daftar |
| R1 | Eksekusi rename tampilan + grouping navigasi | Setujui nama tampilan & urutan menu |
| R2 | — | Semua pembuatan akun + cek merek |
| R3 | Menyusun runbook per platform + verifikasi pasca | Eksekusi transfer (butuh kepemilikan akun) |
| R4 | Konfigurasi domain/redirect/auth URLs + uji email | DNS & keputusan tanggal cutover |
| R5 | Bersih-bersih bertahap | — |

Instruksi Opus: pecah R0, R1, R3-runbook, R4 masing-masing jadi B.0.2 penuh (kriteria
selesai + skenario negatif: mis. R4 wajib membuktikan token POD lama + QR lama masih
membuka halaman yang benar via redirect; R3 wajib membuktikan CI hijau + auth jalan
sebelum dinyatakan selesai). Review B.12 untuk laporan tiap fase.
