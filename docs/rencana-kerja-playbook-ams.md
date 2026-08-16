# Rencana Kerja Terstruktur — AMS-MVP.01
### Berdasarkan Review Konsultan & Playbook (Claude Fable, 16 Agu 2026)

Dokumen ini menerjemahkan `review-konsultan-playbook-ams.md` (Bagian A §A.4 + Bagian B playbook) menjadi rencana kerja yang bisa dieksekusi langkah demi langkah. Setiap langkah selesai → diverifikasi → dicentang → baru lanjut. Setelah SEMUA langkah tuntas, disusun laporan kondisi baru untuk diserahkan kembali ke Claude Fable.

---

## Header Konteks Standar (dipakai di setiap instruksi ke Claude Code mulai sekarang)

```
KONTEKS PROYEK (baku, jangan tanya ulang):
Proyek AMS-MVP.01 — sistem manufaktur untuk PT Indo Taste Manufacture
(contract manufacturer gummy fungsional & minuman serbuk, 3 plant, Malang).
Stack: Next.js 16 App Router + TypeScript + Supabase (Auth/Postgres/RLS/
Storage/Realtime) + Tailwind + shadcn/ui, visual ala Carbon Design.
Tim: pemilik produk (non-teknis, domain expert) + Claude chat (arsitek) +
Claude Code (eksekutor). Tidak ada developer manusia lain.

INVARIAN YANG TIDAK BOLEH DILANGGAR INSTRUKSI APA PUN:
1. Multi-tenant: semua akses data lewat RLS ber-company_id; tidak ada
   query yang mengandalkan filter aplikasi saja.
2. Stok & status: stok mengikuti prinsip ledger; transisi status ditegakkan
   trigger database, bukan hanya kode.
3. Uang & kuantitas: numeric/Decimal, tidak pernah float.
4. Gaji individual: hanya company_admin + HRD + diri sendiri; akses baca
   employees hanya lewat view employees_secure.
5. Semua perubahan skema lewat FILE MIGRASI di repo — tidak pernah
   dashboard-only.
6. Kolom nullable yang disengaja (mis. work_orders.sales_order_line_id
   untuk WIP di muka) tidak boleh "diperbaiki" jadi wajib.
7. UI berbahasa Indonesia; istilah mengikuti kosakata pabrik.

PROTOKOL BUKTI: setiap klaim "selesai" wajib disertai bukti konkret —
hasil query SQL nyata, skenario negatif yang dicoba dan ditolak dengan
benar, dan test yang bisa dijalankan ulang.
```

---

## Peta 7 Langkah (urutan wajib, dari §A.4)

| # | Langkah | Playbook Dipakai | Status |
|---|---|---|---|
| 1 | Selesaikan & commit pengerasan §6.8 + notification bell | (lanjutan kerja sebelumnya) | ⏳ Perlu dicek status |
| 2 | **Phase Deploy-ability** — staging + CI + uji rebuild-migrations | B.3 (Template A) + B.9 + B.11 | ⬜ Belum mulai |
| 3 | Shipments tahap FISIK (DO, picking FEFO, surat jalan, status) | B.10 → B.5 → B.11 → B.0.2 | ⬜ Menunggu #2 |
| 4 | Sesi ATURAN BIAYA (wawancara pemilik produk, 1 batch dihitung manual) | B.6 | ⬜ Menunggu #3 |
| 5 | Shipments tahap UANG (margin, invoice) | B.5 → B.11 → B.0.2 | ⬜ Menunggu #4 |
| 6 | Audit multi-tenant (R4) | B.8 (bagian multi-tenant) | ⬜ Ditunda — hanya saat tenant kedua nyata |
| 7 | Lanjut siklus domain-per-domain (§9.4 laporan lama) | B.10 → B.5 → B.0.2, berulang | ⬜ Menunggu #5 |

**Prinsip pengerjaan:** vertical slice per sesi (bukan borongan), setiap sesi berakhir dengan aplikasi tetap jalan + commit + `HANDOFF.md` diperbarui (sesuai B.11). Sesi berikutnya selalu mulai dengan verifikasi ulang klaim sesi sebelumnya — klaim lama tidak otomatis dipercaya.

---

## LANGKAH 1 — Cek Status & Tuntaskan yang Sedang Berjalan

Perintah untuk Claude Code:
```
Laporkan status NYATA (query database + cek kode langsung, bukan dari ingatan sesi sebelumnya) untuk 2 hal yang terakhir diinstruksikan:

1. Notification bell/badge terpusat (system_alerts.target_department, UI bell icon, Supabase Realtime, suara notifikasi) — sejauh mana ini selesai? Kalau ada bagian yang belum, lanjutkan sampai tuntas sesuai instruksi asli.

2. Konfirmasi ketiga BAGIAN pengerasan fondasi (state machine trigger, audit trail, idempotency, penyesuaian stok manual) benar-benar sudah ter-commit ke git — tunjukkan git log dengan hash commit-nya.

Setelah keduanya dikonfirmasi tuntas dengan bukti, baru kita lanjut ke Langkah 2.
```

---

## LANGKAH 2 — Phase Deploy-ability (BARU, prioritas tertinggi menurut konsultan)

**Kenapa ini didahulukan:** deploy belum pernah dilakukan sama sekali, dan modul berikutnya (Shipments) menyentuh uang. Men-debug jurang dev↔production BERSAMAAN dengan meluncurkan fitur finansial = menggabungkan 2 risiko terbesar sekaligus (R1). Ditambah: disiplin migrasi belum pernah dibuktikan bisa direproduksi dari nol (R2).

**Aturan baru setelah langkah ini:** *"selesai" = jalan di staging, bukan cuma di lokal.*

Dipecah 3 sesi sesuai prinsip B.11 (tiap sesi berakhir dengan aplikasi jalan + commit + `HANDOFF.md`):

### Sesi 2A — Uji Rebuild-from-Migrations (B.3 Template A)

```
1. TUJUAN — Membuktikan seluruh skema (tabel, kolom, constraint, trigger,
   RLS policy, view, function) benar-benar bisa dibangun ulang HANYA dari
   file migrasi di repo — bukan campuran migrasi + perubahan manual lewat
   Supabase Dashboard yang belum tercatat.

2. KONTEKS YANG WAJIB DIBACA DULU — seluruh isi folder migrasi Supabase
   (urutan lengkap, dari file paling awal), daftar lengkap tabel/trigger/
   policy/view yang ada di database dev SEKARANG (query pg_catalog/
   information_schema langsung, bukan dari dokumentasi manapun).

3. LANGKAH:
   a. Buat Supabase project BARU (kosong) khusus untuk uji ini.
   b. Jalankan SELURUH file migrasi repo dari awal, urut, ke project
      kosong itu.
   c. Bandingkan hasilnya dengan database dev nyata: daftar tabel, kolom,
      constraint, trigger, RLS policy, view, function — pakai query
      information_schema/pg_catalog, hasilkan diff eksplisit.
   d. Setiap objek yang ada di dev tapi TIDAK tercipta dari migrasi
      (berarti pernah dibuat manual lewat dashboard) → buatkan migrasi
      susulan untuk itu.

4. BATAS — jangan ubah/hapus apa pun di project Supabase DEV yang sekarang
   dipakai aplikasi berjalan. Project baru untuk uji ini terpisah total.

5. KRITERIA SELESAI:
   - [ ] pg_dump --schema-only dari project dev vs project hasil rebuild
         menghasilkan diff KOSONG (atau seluruh selisih sudah ditambal
         migrasi susulan dan diverifikasi ulang sampai kosong)
   - [ ] Semua migrasi susulan (kalau ada) sudah ter-commit

6. BUKTI YANG DIMINTA — output diff pg_dump --schema-only kedua database
   ditunjukkan penuh (bukan ringkasan "sudah cocok").

7. STOP CONDITION — kalau ditemukan LEBIH DARI 10 objek yang "liar"
   (dibuat manual, tidak ada migrasinya), BERHENTI, laporkan daftar
   lengkapnya ke saya dulu sebelum membuat migrasi susulan massal —
   jangan borongan diam-diam.
```

### Sesi 2B — Setup Staging (Vercel + Supabase Project Terpisah)

```
1. TUJUAN — Punya lingkungan kedua yang jalurnya identik dengan produksi
   nanti (bukan go-live, cuma lingkungan uji yang realistis), supaya fitur
   baru diverifikasi di kondisi mendekati nyata, bukan cuma localhost.

2. KONTEKS — hasil Sesi 2A (project Supabase yang skemanya sudah terbukti
   bisa direbuild bersih dari migrasi — pakai project INI untuk staging,
   bukan bikin project ketiga), struktur .env.local yang ada sekarang
   (nama variabel, BUKAN isinya).

3. LANGKAH:
   a. Deploy aplikasi ke Vercel, environment "staging", terhubung ke
      Supabase project dari Sesi 2A.
   b. Setup environment variables staging (terpisah dari dev/production).
   c. Jalankan alur auth dasar di staging: signup, login, undang anggota
      tim, terima undangan.

4. BATAS — jangan sentuh konfigurasi Vercel/Supabase project DEV yang
   sekarang berjalan.

5. KRITERIA SELESAI:
   - [ ] Aplikasi bisa diakses lewat URL Vercel staging
   - [ ] Terhubung ke Supabase project staging (BUKAN project dev)
   - [ ] Alur signup → login → invite → accept jalan normal di staging

6. BUKTI YANG DIMINTA:
   - Screenshot aplikasi berjalan di URL staging
   - Screenshot berhasil signup+login di staging
   - Skenario negatif: coba masukkan kredensial project DEV ke staging,
     buktikan aplikasi staging TIDAK bisa connect (isolasi environment
     benar-benar terpisah, bukan kebetulan sama)

7. STOP CONDITION — kalau proses deploy Vercel meminta keputusan yang
   berdampak biaya berlangganan (upgrade plan, dst), berhenti dan
   tanyakan dulu.
```

### Sesi 2C — CI GitHub Actions (mitigasi R5 + B.9 fondasi test)

```
1. TUJUAN — Otomatiskan lapisan verifikasi paling dasar (typecheck, test,
   cek rebuild-migrasi) supaya tidak 100% bergantung pada satu orang
   ingat untuk memintanya setiap saat (R5 — bus factor 1 pada verifikasi).

2. KONTEKS — hasil Sesi 2A (cara uji rebuild-migrations), 18 test yang
   sudah ada sekarang (kumpulkan jadi 1 command test suite kalau belum).

3. LANGKAH:
   a. Setup GitHub Actions: jalan otomatis di setiap push.
   b. Workflow mencakup: typecheck, jalankan seluruh test suite yang ada,
      DAN uji rebuild-from-migrations (dari Sesi 2A, dijadikan bagian
      permanen CI — bukan sekali jalan manual saja).
   c. Sekalian terapkan kerangka Lapis 1 dari B.9 (test database: matriks
      role × tabel sensitif untuk RLS — minimal employees/gaji, isolasi
      antar company) kalau belum tercakup di 18 test yang ada.

4. BATAS — jangan ubah test yang sudah ada kalau cuma untuk "merapikan",
   fokus ke menyatukannya jadi 1 command CI-ready.

5. KRITERIA SELESAI:
   - [ ] CI aktif, terlihat jalan otomatis di tab Actions GitHub
   - [ ] Mencakup typecheck + test suite + rebuild-migration check
   - [ ] Total waktu jalan < 5 menit (target dari B.9)

6. BUKTI YANG DIMINTA:
   - Screenshot 1 run CI yang SUKSES (hijau)
   - Buat 1 perubahan yang SENGAJA merusak sesuatu (mis. typo di test),
     push, tunjukkan CI menangkapnya (MERAH) — lalu perbaiki, tunjukkan
     hijau lagi. Ini membuktikan CI benar-benar mendeteksi kegagalan,
     bukan selalu hijau tanpa makna.

7. STOP CONDITION — tidak ada yang diperkirakan berisiko tinggi di sesi
   ini; kalau GitHub Actions minta konfigurasi billing, berhenti &
   tanyakan dulu.

SETELAH SESI 2C SELESAI: tulis/update HANDOFF.md — ringkasan Langkah 2
seluruhnya tuntas, siap lanjut ke Langkah 3 (Shipments tahap fisik).
```

---

## LANGKAH 3 — Shipments Tahap FISIK

*(Instruksi detail disusun SETELAH Langkah 2 tuntas — akan memakai B.10 Codebase Archaeology dulu untuk cek kondisi nyata tabel `shipments`/`shipment_lines` yang sudah ada di skema tapi nol implementasi, lalu B.5 Design Review sebelum implementasi, mengacu ke `13-shipping-invoicing.md` dari paket 24 dokumen untuk pola DO → picking FEFO → surat jalan → status.)*

**Batasan tegas dari konsultan:** JANGAN gabungkan dengan kalkulasi margin/invoice (itu Langkah 5, terpisah) — alur fisik dulu, uang belakangan, supaya asumsi biaya yang belum matang tidak "menular" ke fitur yang datanya penting untuk operasional harian (gudang perlu Delivery Order jalan duluan, terlepas dari margin sudah pasti atau belum).

---

## LANGKAH 4 — Sesi Aturan Biaya (Wawancara, Bukan Kode)

*(Ini sesi INTERAKTIF antara Claude chat dan pemilik produk — BUKAN instruksi ke Claude Code. Dipicu risiko R3: paket 24 dokumen referensi eksplisit MENGECUALIKAN process costing, padahal ini persis yang dibutuhkan bisnis Anda — penyusutan per tahap, premix dipakai sebagian-sebagian, bahan milik client, multi-output. Kalau margin dibangun dengan asumsi "biaya = Σ harga bahan standar" tanpa sesi ini dulu, angkanya akan TERLIHAT benar tapi SALAH — bug paling berbahaya karena tidak memunculkan error apa pun.)*

**Akan dijalankan sebagai wawancara skenario nyata** (bukan definisi abstrak), mencakup minimal 5 pertanyaan dari playbook B.6 — disiapkan saat Langkah 3 mendekati selesai, dengan **1 data batch produksi nyata** dari Anda sebagai bahan hitung manual.

---

## LANGKAH 5 — Shipments Tahap UANG (Margin & Invoice)

*(Instruksi detail disusun SETELAH Langkah 4 menghasilkan Spesifikasi Aturan Biaya v1 dengan 3 contoh perhitungan manual — itu jadi acceptance test literal yang harus lulus persis di implementasi ini.)*

---

## LANGKAH 6 — Audit Multi-Tenant (DITUNDA)

*(Sesuai rekomendasi konsultan: TIDAK dikerjakan sekarang — hanya saat tenant kedua benar-benar mulai nyata/serius dipertimbangkan. Daftar celah yang perlu diaudit saat itu tiba sudah dicatat di §A.2 R4 dokumen playbook: JWT claim basi, konfigurasi ter-hardcode, isolasi storage bucket, security_invoker vs definer pada view, number sequence per tenant, proses onboarding tenant baru. Ditambah: 1× pentest eksternal oleh manusia sebelum benar-benar menagih tenant kedua.)*

---

## LANGKAH 7 — Lanjut Siklus Domain-per-Domain

*(Setelah Langkah 5 tuntas, kembali ke pola kerja domain-per-domain terhadap paket 24 dokumen referensi seperti yang sudah berjalan sebelumnya — tiap domain baru dibuka pakai B.10 (arkeologi kondisi nyata) → B.5 (design review) → B.0.2 (instruksi implementasi), disaring sesuai skala PT Indo Taste, bukan diadopsi penuh.)*

---

## Setelah SEMUA Langkah Tuntas

Susun ulang `laporan-kondisi-proyek-ams-mvp.md` (format sama seperti versi 16 Agustus), mencerminkan kondisi terbaru pasca 7 langkah ini, untuk diserahkan kembali ke Claude Fable guna arahan berikutnya — sesuai rencana pemilik produk.
