# Penyerahan ke Opus — Penerapan FABRIX Carbon Design Governance

**Dari:** Fable 5 (review governance selesai — vonis di §A)
**Untuk:** sesi Claude chat Opus — wawancarai §D, lalu susun instruksi Claude Code
format B.0.2 per sesi §C. 
**Sumber standar:** `FABRIX_CARBON_DESIGN_GOVERNANCE.md` v1.0 (66 bagian) — disalin ke
`docs/governance/carbon-design-v1.md` pada sesi pertama.
**Aturan yang tetap berlaku:** dua lajur (lajur pengiriman MLVT + S1–S3 TIDAK PERNAH
menunggu lajur desain), B.0.2, review B.12, QA governance (UI regression §40-QA merujuk
standar ini).

---

## A. VONIS FABLE 5

**Diadopsi penuh sebagai standar desain proyek** — dengan satu keputusan besar yang
harus disahkan pemilik produk (D-1) dan kalibrasi §B.

Alasan adopsi penuh, bukan "terinspirasi Carbon":
1. Dokumen ini menyelesaikan masalah nyata FABRIX: layar-layar lahir dari sesi berbeda
   dengan gaya berbeda; tanpa sistem, kian banyak modul = kian terasa "dibuat orang
   berbeda" — persis anti-tujuan §66.
2. Carbon adalah design system enterprise yang teruji untuk UI padat-data (lahir dari
   produk IBM) — cocok untuk ERP, bukan sistem estetika landing-page.
3. **Momen adopsi termurah adalah SEKARANG**: UI baru ±20% jadi (§55 dokumen — sesuai
   kenyataan). Migrasi 20% layar itu murah; migrasi 80% layar tahun depan itu proyek
   penderitaan. Menunda keputusan ini = memilih opsi mahal secara diam-diam.
4. Setengah isi dokumen sudah selaras doktrin proyek: larangan improvisasi ≈ mandat
   generalisasi; design debt register ≈ TEST_DEBT; "jangan desain dari ingatan, cek
   dokumentasi" ≈ aturan verifikasi kita; checklist §50 ≈ pola review B.12.

## B. KALIBRASI & REKONSILIASI DENGAN KEPUTUSAN YANG ADA (mengikat)

1. **Mode lantai produksi** (tombol besar, PIN, tablet bersarung tangan) = **FABRIX
   Domain Pattern** resmi (Layer 3, §41–43): dibangun dari token & komponen Carbon
   dengan ukuran sentuh diperbesar — deviasi didokumentasikan lewat format §42, BUKAN
   pelanggaran. Kebutuhan pabrik menang atas ukuran default desktop, caranya lewat
   jalur yang standar sediakan.
2. **KpiCard tiga-garis + aturan Zebra BI** (tanpa pie/3D, sparkline) = domain pattern;
   grafik memakai pustaka chart ekosistem Carbon bila lolos verifikasi DS-0 — aturan
   Zebra BI TETAP berlaku (keduanya kompatibel: semantic color, tanpa dekorasi).
3. **Panel info bertab** (Definisi|Asal-usul|KPI — keputusan terdahulu) = domain
   pattern; affordance ikonnya mengikuti aturan ikon & tooltip Carbon (§10, §22).
4. **Kosakata status global §18** disatukan dengan state machine & kamus: SATU file
   pemetaan status→token semantik untuk seluruh sistem; kamus menjadi sumber label
   Bahasa Indonesianya. Dilarang modul memetakan warna sendiri.
5. **Bahasa UI = Indonesia.** Prinsip content design §46 diterapkan dalam Bahasa
   Indonesia; istilah mengikuti kamus (K1) — "Rilis", "Setujui", "Buat Order" —
   konsisten lintas modul. Ini perluasan §46 yang dokumen aslinya tidak bahas.
6. **Navigasi §34** dipetakan ke penamaan lini rebrand FABRIX (ERP/MRP/MES/WMS/QMS/
   Finance/AI) — keputusan yang sudah diambil; menu modul yang belum ada TIDAK tampil.
7. **Checklist §50 & DoD §62** menjadi bagian review B.12 untuk sesi ber-UI — satu
   proses review, bukan dua.
8. Aksesibilitas §30: target praktis fase ini = keyboard + fokus terlihat + label +
   kontras (diuji otomatis); audit screen-reader penuh masuk Phase 3 QA governance —
   selaras kalibrasi QA yang sudah disepakati.

## C. RANGKAIAN SESI (Opus pecah jadi B.0.2)

### DS-0 — Kelayakan teknis + audit UI (read-only; boleh SEKARANG)
1. Inventaris stack UI aktual: pustaka komponen yang dipakai sekarang, sistem styling,
   font, tema, jumlah layar & komponen bersama.
2. **Verifikasi kompatibilitas dari dokumentasi resmi Carbon SAAT sesi** (aturan §63
   "jangan desain dari ingatan" berlaku juga untuk versi pustaka): @carbon/react vs
   versi Next.js/React proyek, cara theming, font IBM Plex, pustaka chart ekosistemnya,
   ukuran bundle. Laporkan temuan APA ADANYA — bila ada ketidakcocokan versi, itu
   temuan utama, bukan alasan improvisasi.
3. Audit inkonsistensi UI per klasifikasi §55 (A visual / B komponen / C interaksi /
   D UX / E aksesibilitas) → seed **Design Debt Register** §56 di
   `docs/governance/design-debt.md`, prioritas E→C→B→A sesuai §55.
4. Susun tabel pemetaan kanonik §57 versi FABRIX: kebutuhan nyata → komponen Carbon →
   komponen eksisting yang akan digantikannya.
5. Estimasi upaya migrasi 2 layar pilot (§DS-1) berdasarkan temuan.
STOP condition: bila DS-0 menemukan hambatan teknis besar (inkompatibilitas versi tanpa
jalan resmi), berhenti & laporkan — keputusan lanjut/tunda kembali ke pemilik produk.

### DS-1 — Fondasi + pilot (setelah D-1 disahkan; di jendela tenang, BUKAN minggu batch MLVT)
1. Pasang fondasi: @carbon/react (versi terverifikasi DS-0), tema terpilih (D-2),
   IBM Plex, lapisan token, Carbon UI Shell untuk kerangka aplikasi (§33).
2. Migrasi **2 layar pilot** (D-3; usulan: satu layar tabel — daftar item/lot — dan
   satu layar form — buat SO) sampai lolos checklist §50 penuh.
3. Tulis spesifikasi domain pattern pertama lewat format §42: mode lantai produksi.
4. Bukti: sebelum/sesudah 2 layar; checklist §50 tercentang dengan bukti; keyboard
   walkthrough terekam; TIDAK ada regresi fungsi (test suite hijau).

### DS-2 — Aturan "UI baru = Carbon-first" berlaku
1. Master prompt §64 (disesuaikan kalibrasi §B) + daftar larangan §54 masuk CLAUDE.md
   sebagai blok **DS-RULES**.
2. Sejak sesi ini: SEMUA UI baru (termasuk sesi S1–S3 & SALES bila menyentuh UI)
   dibangun Carbon-first; komponen kustom wajib format §42.
3. Decision tree §58 + hierarki sumber kebenaran §4 dikutip di DS-RULES.

### DS-3+ — Remediasi bertahap (berjalan menumpang, bukan proyek raksasa)
1. Aturan pramuka: layar yang disentuh sesi fitur apa pun dimigrasikan sekalian
   (dicatat lunas di Design Debt Register).
2. Sesi remediasi khusus hanya untuk debt prioritas E (aksesibilitas) dan C (interaksi)
   yang tidak tersentuh alamiah — dijadwalkan di sela antrean, maksimal satu sesi
   per beberapa minggu supaya lajur pengiriman tidak terganggu.
3. Layar yang sudah kanonik di-"freeze" (§55); perubahan pola kanonik = change control §59.

## D. PERTANYAAN WAWANCARA UNTUK PEMILIK PRODUK (Opus, pola B.6 — satu per satu dengan dampak)

- **D-1 (keputusan kunci):** Sahkan adopsi penuh pustaka Carbon — termasuk konsekuensi
  tampilannya: wajah FABRIX akan bergaya IBM enterprise (font IBM Plex, estetika
  fungsional-datar, bukan gaya SaaS modern membulat). Tunjukkan carbondesignsystem.com
  sebagai referensi visual sebelum menjawab. Alternatif bila ditolak: adopsi
  governance+token di atas stack sekarang — lebih murah hari ini, konsistensi lebih
  lemah, dan menyimpang dari mandat dokumen (harus dicatat sebagai deviasi sadar).
- **D-2:** Tema terang mana (nuansa putih vs abu terang) untuk ERP harian? Mode gelap =
  backlog, bukan v1.
- **D-3:** Konfirmasi 2 layar pilot (usulan: daftar lot + form SO — satu padat-data,
  satu form; keduanya representatif).
- **D-4:** Sahkan deviasi ukuran mode lantai (target sentuh lebih besar dari default).
- **D-5:** Jendela waktu DS-1 relatif terhadap jadwal batch MLVT (jangan bentrok).
- **D-6:** Konfirmasi bahasa UI Indonesia penuh + istilah dari kamus (label tombol,
  status, pesan error).

## E. INSTRUKSI PROSES UNTUK OPUS
1. Wawancara D-1..D-6 dulu; D-1 menentukan segalanya — jangan menyusun DS-1 sebelum
   D-1 sah.
2. DS-0 boleh langsung dipecah jadi B.0.2 sekarang (read-only, tidak tergantung D-1;
   justru hasilnya memperkaya keputusan D-1).
3. Setiap instruksi UI sejak DS-2 menyertakan: pemetaan Carbon per elemen (pola §51
   Phase B), daftar state §45 yang relevan, checklist §50 sebagai kriteria selesai,
   dan larangan §54.
4. Konflik antara standar ini dan kenyataan teknis → pola §53: STOP, laporkan, usulkan
   solusi Carbon-compliant — jangan improvisasi diam-diam.
5. Design Debt Register & TEST_DEBT adalah dua register berbeda dengan pola yang sama;
   jangan digabung, tapi item aksesibilitas boleh muncul di keduanya dengan rujukan silang.
