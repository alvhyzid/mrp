<!--
  DISALIN KE REPO 25 Agu 2026 atas perintah pemilik produk.
  Berkas asal : ~/Downloads/penyerahan-opus-ux-shell-navigasi.md
  Penulis     : Fable 5 (sesi perancangan UX di luar repo ini)
  Status      : DOKUMEN RUJUKAN, bukan keputusan yang sudah berlaku.

  CARA MEMBACANYA, supaya sesi berikutnya tidak salah pakai:
  Isi dokumen ini adalah USULAN. Yang MENGIKAT adalah keputusan pemilik produk yang
  tercatat di CLAUDE.md dan di Daftar Tugas. Beberapa bagian dokumen ini SUDAH DIBATALKAN
  pemilik produk pada 25 Agu 2026 -- terutama aturan 'item parkir tidak muncul di navigasi'.
  Jangan menerapkan isi dokumen ini tanpa memeriksa keputusan yang lebih baru.
-->

# Penyerahan ke Opus — UX Application Shell & Navigation Architecture

**Dari:** Fable 5 (review §42–§43 dokumen sumber dijalankan — hasil & amandemen di sini)
**Untuk:** sesi Claude chat Opus 5 — jalankan §E.
**Sumber:** `FABRIX_UX_Application_Shell_Navigation_Architecture_v1_0.md` (§1–§48)
**Dokumen pendamping wajib:** `review-fable-post-sales-reconciliation.md` (sesi AR-0 &
model dua lajur), `penyerahan-opus-carbon-design.md` (DS-0..DS-3), keputusan rebrand
lini FABRIX, kamus.
**⚠️ Dependensi hilang:** dokumen ini merujuk `FABRIX_UX_Information_Architecture_v1.0.md`
yang BELUM pernah diserahkan ke Fable/Opus. Minta pemilik produk mengunggahnya; sampai
ada, daftar workspace §11 dokumen ini diperlakukan sebagai draf IA.

---

## A. VONIS FABLE 5

**Diterima sebagai baseline shell & navigasi — dengan amandemen §B.** Dokumen ini
sudah menyerap seluruh doktrin proyek: audit sebelum membangun, dilarang mengarang URL,
dilarang membuat halaman palsu demi sitemap terlihat lengkap, "coding the shell is NOT
the next action". Mode-ganda §30–31 (navigasi internal ber-status vs navigasi publik
bersih) adalah ide terbaiknya — pemilik produk mendapat peta kejujuran implementasi
langsung di aplikasi, user biasa tidak pernah melihat menu hantu.

## B. AMANDEMEN (mengikat)

1. **Audit §25/§42 dieksekusi Claude Code, bukan Fable.** Fable tidak punya akses repo.
   Audit navigasi ini DIGABUNG ke sesi **AR-0** yang sudah dispesifikasikan (satu pass
   read-only atas repo, bukan dua): tambahkan ke lingkup AR-0 — inventaris route/pages
   aktual (App Router), konfigurasi navigasi eksisting, halaman yang bisa dicapai,
   verifikasi browser untuk halaman utama (akun company.b@debug.mrp — JANGAN company.a),
   dan daftar fitur-terbangun-yang-tak-terwakili-di-IA (§32). Fable mereview hasilnya,
   bukan menjalankannya.
2. **24 keluaran §43 di-timebox jadi 3 artefak** (pola yang sama dengan rekonsiliasi):
   (1) `docs/ar0-inventaris-as-is.md` diperluas bagian NAV (route registry terverifikasi
   + inventaris halaman + status per item §3); (2) matriks status fitur §26 + peta
   AS-IS vs TO-BE + daftar konflik; (3) arsitektur navigasi final (hasil review Fable +
   keputusan pemilik produk). Nomor 01–24 §43 dipetakan ke tiga artefak itu.
3. **Shell dibangun DI ATAS Carbon — satu sesi dengan DS-1, bukan proyek terpisah.**
   Shell §6/§46 adalah persis komponen Carbon UI Shell (header + left nav). Urutan:
   AR-0(+NAV) sekarang → review → keputusan → **SHELL-1 = bagian dari DS-1** (fondasi
   Carbon + shell + 2 layar pilot). Membangun shell sebelum Carbon = membangun dua kali.
4. **Item yang DIPARKIR tidak muncul di navigasi publik, titik.** Sales Forecast,
   Scenario Planning, Pegging (§13), Maintenance, Report Builder — semuanya berstatus
   parkir/tunda ber-pemicu dalam keputusan terkunci. Mode publik: tidak ada. Mode
   internal: tampil ⚪/🔒 dengan tooltip pemicunya ("menunggu: modul maintenance").
   Dilarang menampilkan menu yang mengiklankan fitur yang keputusannya DITOLAK
   (forecast) — di mode internal pun ia ditandai "DITOLAK — keputusan tercatat", bukan
   "planned".
5. **Terminologi & bahasa:** label navigasi Bahasa Indonesia bersumber kamus; istilah
   eksisting menang (ADR-005: "Batch", bukan "Work Order"; "Kelayakan/feasibility",
   bukan "ATP"). Emoji di contoh dokumen (🏠💼📅) adalah ILUSTRASI — implementasi
   memakai ikon Carbon (governance desain §10 melarang emoji sebagai ikon).
6. **Pemetaan workspace ↔ lini FABRIX:** navigasi mengikuti model workspace dokumen ini
   (mental model pengguna); nama lini rebrand (FABRIX ERP/MRP/MES/WMS/QMS/Finance/AI)
   adalah lapisan komersial. Keduanya dipetakan eksplisit di artefak-3; bila ada
   tabrakan penamaan menu, pemilik produk memutuskan (pertanyaan D-3).\
7. **Konfigurasi navigasi §5 = file config di repo untuk v1** (TS/JSON, typed), BUKAN
   tabel database — navigasi per-tenant belum dibutuhkan; kolom `implementationStatus`
   diisi DARI hasil audit, dilarang diketik berdasarkan ingatan. Migrasi ke DB kelak
   bila navigasi per-tenant/feature-flag per-tenant nyata dibutuhkan.
8. **Lingkup SHELL-1 dibatasi** (anti-proyek-raksasa): header global + left nav +
   secondary nav + breadcrumb + page header standar + quick-create kontekstual +
   panel notifikasi/tugas yang MENGKONSOLIDASIKAN notifikasi & antrean approval yang
   SUDAH ADA (bukan membangun task engine baru). **Ditunda dengan pemicu:** global
   search lintas-entitas (butuh infra pencarian; v1 = command palette navigasi +
   pencarian per modul yang ada), Right Context Panel §18 (menumpang panel bertab
   info/provenance yang sudah dirancang — jangan dua panel kanan), Control Tower §40
   (halaman kurasi menyusul setelah KPI-1; navigasinya boleh ada menunjuk dashboard
   eksisting).
9. **Deep link & preservasi route (§33–36, §45):** route eksisting yang berfungsi
   DIPERTAHANKAN — dilarang membuat sistem route paralel; perubahan route lama (bila
   arsitektur final menuntut) lewat redirect, dan URL publik tercetak (QR POD) tidak
   boleh putus (aturan rebrand R4 berlaku).

## C. KONVERGENSI YANG MENGHEMAT (supaya tidak dibangun dua kali)
- Mode internal ber-status §30 = versi navigasi dari **dashboard proyek AI** yang sudah
  dirancang (progres AUTO dari bukti) — filosofi sama: status dari kenyataan, bukan
  klaim. Sumber datanya sama-sama hasil audit.
- Task center §19 = konsolidasi UI atas approval & notifikasi eksisting.
- Legend status §3 dipakai juga sebagai kolom di checklist §43-spec sebelumnya —
  SATU taksonomi status implementasi untuk seluruh proyek.

## D. PERTANYAAN WAWANCARA PEMILIK PRODUK (Opus, satu per satu + dampak)
- D-1: Unggah `FABRIX_UX_Information_Architecture_v1.0.md` (dependensi §48) — atau
  konfirmasi daftar workspace §11 sebagai IA final sementara.
- D-2: Mode internal ber-status: siapa yang boleh melihat? (usul: role pemilik produk/
  superadmin saja; toggle di user menu.)
- D-3: Bahasa & penamaan menu final per workspace (Indonesia; mis. "Manufaktur",
  "Perencanaan", "Rantai Pasok", "Mutu") + konfirmasi pemetaan lini FABRIX.
- D-4: Konfirmasi item parkir yang boleh TAMPIL di mode internal sebagai ⚪ (semua?)
  dan yang disembunyikan total.
- D-5: Urutan workspace di left nav (usul: urut frekuensi pakai harian pabrik —
  Manufaktur & Rantai Pasok di atas, bukan urut abjad/arsitektur).
- D-6: Quick-create v1 — daftar aksi per workspace yang benar-benar dipakai harian
  (jangan menyalin daftar §10 yang memuat fitur belum ada).

## E. INSTRUKSI PROSES UNTUK OPUS
1. Minta D-1 dulu; lanjutkan wawancara D-2..D-6.
2. Revisi instruksi AR-0 yang sudah ada: tambahkan lingkup NAV (amandemen B.1) —
   SATU instruksi B.0.2 read-only; kriteria selesai ditambah: route registry
   terverifikasi (§34, hanya route nyata), matriks §26 lengkap untuk SEMUA item §11/§13,
   daftar §32 (fitur terbangun tanpa rumah di IA) dengan rekomendasi per item.
3. Setelah hasil AR-0 kembali → serahkan ke Fable untuk review artefak-2 & putusan
   arsitektur final (artefak-3) bersama pemilik produk.
4. SHELL-1 disusun SETELAH artefak-3 sah, sebagai bagian instruksi DS-1 (Carbon) —
   kriteria selesai memuat §35 (setiap item nav enabled: permission→route→halaman
   termuat→terpakai) + §45 langkah 7–13 + larangan §45 (STOP-DOCUMENT-ESCALATE bila
   route konflik; dilarang route duplikat diam-diam).
5. Prinsip §47 dikutip di artefak-3 sebagai bintang utara: satu sistem operasi
   manufaktur ber-workspace — bukan daftar modul terputus.
