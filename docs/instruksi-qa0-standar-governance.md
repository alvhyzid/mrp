# Instruksi QA-0 — Adopsi Standar QA Governance + Audit Kepatuhan

**Untuk:** Claude Code (boleh disampaikan langsung, atau lewat Opus sesuai pipeline —
isi instruksi tidak berubah). Format B.0.2.
**Sumber standar:** `FABRIX_TESTING_QUALITY_ENGINEERING_GOVERNANCE.md` v1.0 (92 bagian)
**Vonis Fable 5:** DIADOPSI sebagai standar proyek, dengan kalibrasi skala §K di bawah.
Sebagian besar isinya meresmikan doktrin yang sudah berlaku (bukti wajib, skenario
negatif, "hijau ≠ benar", larangan menghapus riwayat, staging dulu) — jadi ini
PENYATUAN, bukan sistem kedua.

---

## K. KALIBRASI SKALA (mengikat — memakai izin §11 "adjust frequency based on maturity")

Standar ini ditulis untuk tim; FABRIX dibangun satu orang. Penyesuaian sadar:

| Butir standar | Kalibrasi FABRIX | Alasan |
|---|---|---|
| 6 dokumen kontrol (§6) | Dibuat SEMUA, tapi TEST_MASTER & EXECUTION_LOG diisi/di-update otomatis dari keluaran CI & sesi test sebisanya — bukan prosa yang dirawat tangan | Dokumen yang dirawat manual akan basi dalam sebulan |
| TEST_CALENDAR (§10) | = konfigurasi CI + cron itu sendiri, diekspor ke md; satu sumber | Kalender terpisah dari CI = drift |
| Restore verification weekly (§11) | BULANAN sekarang → mingguan sebelum tenant berbayar pertama | Beban vs risiko fase sekarang; dicatat sebagai ACCEPTED RISK ber-tanggal |
| Load/stress/spike/chaos (§42–44, 68) | PARKIR ke Phase 4 sesuai §85; pemicu: mendekati tenant kedua | |
| Pentest profesional (§69) | Gerbang: sebelum tenant berbayar pertama / data pelanggan eksternal masuk | Standarnya sendiri berkata "before major enterprise production" |
| Accessibility penuh (§66) | Phase 3; yang berlaku sekarang = prinsip UI pabrik yang ada | |
| Coverage target (§35) | Diadopsi sebagai TARGET; sesi ini hanya MENGUKUR baseline, tidak mengejar angka | Coverage dikejar buta = test kosmetik |
| Peran "Fable 5 maintain dokumen" (§74) | Fable menggovern lewat sesi review; PENULISAN file oleh Claude Code dalam sesi | Fable tidak punya tangan di repo |

Semua kalibrasi dicatat di bagian atas TEST_MASTER sebagai penyimpangan sadar ber-alasan.

## 1. TUJUAN
(a) Menjadikan dokumen governance ini standar proyek yang ditegakkan mesin & aturan;
(b) mengaudit kepatuhan kondisi sekarang — 192 test yang ada dipetakan jujur ke standar;
(c) menghasilkan antrean kesenjangan terprioritas (TEST_DEBT) tanpa menghentikan lajur
pengiriman (MLVT, S1–S3).

## 2. KONTEKS WAJIB DIBACA
1. Dokumen standar (utuh — terutama §3 aturan, §4 severity, §5 lifecycle, §76 status,
   §79 larangan, §85 Phase 1).
2. CLAUDE.md saat ini (aturan B.0.2, B.12, PP-1..14, SD-1..13 bila sudah masuk).
3. Konfigurasi CI & daftar test yang ada (192 test — lokasi, jenis, cakupan).
4. Dokumen `review-fable-post-sales-reconciliation.md` (model dua lajur — audit ini
   lajur arsitektur, TIDAK memblokir pengiriman).

## 3. LANGKAH

### Tugas A — Adopsi sebagai standar (perubahan kecil, non-test)
1. Salin dokumen standar ke `docs/governance/qa-governance-v1.md` (sumber kebenaran
   di repo, bukan hanya di chat).
2. Tambahkan blok **QA-RULES** ke CLAUDE.md (ringkas, merujuk dokumen penuh):
   - 10 status test §76/§90 dipakai persis — dilarang menyatukan status.
   - P0 FAIL = release diblokir (§83, daftar gerbang lengkap).
   - PASS tanpa bukti ≠ CERTIFIED; struktur bukti `test-results/<ID>/` (§9).
   - 11 larangan §79 verbatim (jangan mengklaim test jalan, jangan melemahkan assert,
     jangan menurunkan severity demi rilis, dst.).
   - Penyatuan istilah: "bukti ≥2 skenario negatif" pada format B.0.2 = bagian dari
     evidence standar ini — SATU sistem QA, bukan dua.
3. Buat kerangka 6 dokumen kontrol §6 di `docs/governance/` dengan header, kolom §7,
   dan catatan kalibrasi §K.
4. CI: pastikan pipeline PR/merge/deploy memetakan kalender §10 (lint, typecheck, unit,
   dependency scan di PR; integrasi+API di merge; migrasi+E2E+smoke di staging deploy).
   Yang belum ada di CI → JANGAN dibangun diam-diam di sesi ini; catat sebagai TEST_DEBT.
5. Secret scanning di CI (§31) — bila belum ada, pasang (kecil, dan sejarah proyek
   punya insiden kredensial; ini pengecualian yang BOLEH dibangun sekarang).

### Tugas B — Audit kepatuhan (read-only terhadap kode aplikasi; bukti nyata, bukan klaim)
1. Inventarisasi 192 test: per test → kategori standar (§13–§69), modul, prioritas
   P0–P3, status §76 APA ADANYA (banyak akan berstatus PASS-tanpa-bukti-terarsip →
   tulis begitu, jangan dipoles jadi CERTIFIED).
2. Isi `FABRIX_TEST_MASTER.md` dari inventaris — kolom §7 lengkap; jangan mengarang
   tanggal eksekusi yang tidak tercatat (tulis UNKNOWN).
3. Bangun `FABRIX_TEST_COVERAGE_MATRIX.md` per modul nyata (SO/approval, PO/penerimaan,
   inventory/lot, batch/MES, shipments/POD, biaya/margin, Master Dokumen, auth/RBAC/RLS,
   platform) × jenis test §12 — titik buta akan TERLIHAT, itu tujuannya.
4. Periksa khusus daftar **Phase 1 Critical Safety (§85)** satu per satu dan laporkan
   SUDAH / SEBAGIAN / BELUM dengan bukti:
   - DB integrity & constraint tests (§13) — termasuk uji penolakan qty negatif,
     status ilegal, FK yatim.
   - Migration testing (§14–15) — adakah fresh-migration test di CI? rekonsiliasi
     angka sebelum/sesudah pernah dilakukan? (opname 37 lot = baseline bagus).
   - Tenant isolation (§24) — test RLS yang ada dipetakan ke daftar vektor §24
     (ID/URL/API/export/cache/storage manipulation); vektor yang belum teruji = DEBT P0.
   - Auth (§22) & RBAC di level API (§23) — "menyembunyikan tombol bukan keamanan":
     buktikan penolakan terjadi di server, bukan UI.
   - Concurrency (§13) — uji ganda-reservasi stok (contoh 70+50 dari stok 100) ADA
     atau belum? Dugaan kuat: BELUM → DEBT P0 dengan skenario persis itu.
   - Idempotency (§49) — pola client_event_id ada di POD/absensi; audit endpoint tulis
     kritis lain (PO, SO, movement) yang belum idempoten.
   - Backup & restore (§56–57) — backup Supabase aktif ≠ terverifikasi; kapan terakhir
     restore DIBUKTIKAN? Kemungkinan: belum pernah → DEBT P0 paling penting sesi depan.
   - Secrets (§31) & dependency scan (§36) — status nyata di CI.
   - Critical E2E (§37–38) — golden path yang ada (uji browser company.b) berstatus
     manual; catat sebagai SEBAGIAN, otomasi = DEBT.
   - Number precision (§55) — verifikasi tipe kolom uang/qty (numeric, bukan float) —
     satu query information_schema.
5. Setiap kesenjangan → entri `FABRIX_TEST_DEBT.md` format §70 (ID, modul, risiko,
   prioritas, target). Urutkan memakai §89.

### Tugas C — Rekomendasi penerapan
Laporan akhir memuat: (a) tabel Phase-1 §85 dengan status per item; (b) 10 DEBT
teratas berurut risiko dengan estimasi ukuran sesi masing-masing; (c) usulan pemetaan
DEBT ke antrean kerja (mana yang menumpang sesi S1–S3, mana sesi QA tersendiri,
mana menunggu); (d) daftar keputusan yang butuh pemilik produk (lihat §5.3).

## 4. BATAS
- Sesi ini TIDAK menulis test baru (kecuali secret-scanning CI §3.A.5) — audit dulu,
  pembangunan test mengikuti antrean DEBT di sesi berikutnya.
- TIDAK mengubah kode aplikasi, skema, atau data.
- TIDAK menurunkan/menaikkan status test yang ada tanpa bukti eksekusi.
- Lajur pengiriman (S1–S3, MLVT) tidak menunggu sesi ini.

## 5. KRITERIA SELESAI
- [ ] Dokumen standar di repo + QA-RULES di CLAUDE.md + 6 kerangka dokumen kontrol.
- [ ] TEST_MASTER terisi 192 test dengan status jujur (tanpa CERTIFIED baru).
- [ ] Coverage matrix memperlihatkan titik buta per modul.
- [ ] Checklist Phase-1 §85 terjawab per item dengan bukti/lokasi.
- [ ] TEST_DEBT terisi & terprioritas; 10 teratas beranalisis risiko.
- [ ] Secret scanning aktif di CI (bukti: satu commit uji berisi dummy secret tertangkap).
- [ ] 3 keputusan kalibrasi diajukan ke pemilik produk: jadwal restore-test pertama
      (usul: minggu ini juga, sekali, sebagai baseline), target coverage per §35
      (adopsi/ubah), tanggal mulai pemberlakuan gerbang sertifikasi rilis §82–83
      (usul: mulai rilis berikutnya setelah sesi ini).

## 6. BUKTI
1. Tautan/isi 6 dokumen kontrol + diff CLAUDE.md.
2. TEST_MASTER: cuplikan 10 baris pertama + statistik status (berapa PASS, berapa
   PASS-tanpa-bukti, berapa UNKNOWN).
3. Tabel Phase-1 §85 lengkap.
4. Skenario negatif 1: commit dengan dummy secret → CI menolak.
5. Skenario negatif 2: satu test yang GAGAL dijalankan sengaja → tercatat FAIL di
   EXECUTION_LOG dengan klasifikasi §80, TIDAK dihapus/di-skip.

## 7. STOP CONDITION
- Menemukan indikasi kelas-P0 hidup (kebocoran lintas tenant, endpoint tanpa auth,
  backup tidak bisa dibaca) → HENTIKAN audit, laporkan segera dengan bukti — jangan
  perbaiki diam-diam, jangan lanjut seolah temuan biasa.
- Jumlah DEBT P0 > 15 → berhenti menulis entri baru, laporkan pola besarnya dulu —
  daftar terlalu panjang berarti butuh keputusan strategi, bukan antrean.

## 8. CATATAN UNTUK PEMILIK PRODUK
Dua hal di audit ini yang hampir pasti muncul sebagai temuan terpenting: (1) **restore
backup yang belum pernah dibuktikan** — backup yang tak teruji restore secara praktis
tidak ada; jadwalkan satu kali baseline restore-test segera setelah sesi ini; (2) **uji
konkurensi reservasi stok** — jenis bug yang tidak terlihat saat satu orang memakai
sistem dan meledak tepat saat dua orang bekerja bersamaan di bulan produksi. Keduanya
murah dicegah sekarang dan sangat mahal ditemukan nanti.
