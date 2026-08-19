# Rancangan Fitur — Absensi Web/Mobile dengan Geo-Tagging & QR Pabrik

**Untuk:** ditempel ke sesi Claude chat (Opus) sebagai bahan perancangan
**Alur kerja:** Opus membaca dokumen ini → mengajukan pertanyaan terbuka (§10) ke pemilik
produk → menyusun instruksi Claude Code format B.0.2 per gelombang (§11)
**Terkait:** aturan biaya K1/K4 (SDM langsung, tarif per jam), aturan privasi karyawan,
pola offline PWA yang sudah ada, kalender & shift master

---

## 1. Posisi dalam lingkup — dibaca dulu

Absensi dulu masuk **non-goal** ("hanya labor tracking untuk order"). Keputusan itu
berubah dengan alasan yang harus dipegang saat merancang, karena menentukan bentuknya:

1. **Absensi adalah pintu masuk biaya SDM.** PHL dibayar harian (Rp50.000/hari); biaya
   SDM langsung batch dihitung dari jam tercatat × tarif (K1, K4). Kehadiran adalah data
   dasar yang selama ini diisi manual/di luar sistem.
2. **Kehadiran = kapasitas.** Perencanaan (4 batch/hari, kelak APS ringan) berasumsi
   operator tersedia. Siapa hadir hari ini adalah input kapasitas nyata.
3. **BUKAN payroll.** Sistem mencatat kehadiran & menghasilkan rekap; perhitungan gaji,
   THR, BPJS, PPh21 tetap di luar lingkup. Absensi menghasilkan **ekspor** untuk payroll,
   tidak menghitung payroll.

**Rekomendasi waktu:** dikerjakan SETELAH SAS001 & SAS005 terkirim. Fitur ini menyentuh
33 karyawan sekaligus — salah rilis di tengah bulan produksi kritis menambah kekacauan,
bukan mengurangi. (Opus: konfirmasi urutan ini ke pemilik produk sebelum menjadwalkan.)

## 2. Keputusan desain utama (usulan konsultan — Opus validasi ke pemilik produk)

### 2.1 Dua mode scan, satu sistem
| Mode | Perangkat | Cara |
|---|---|---|
| **Tablet gerbang** | Tablet pabrik terpasang di tiap plant | Layar menampilkan **QR dinamis**; karyawan memindai dengan HP, ATAU karyawan menunjukkan QR/ID dan tablet yang memindai (pilih satu arah — pertanyaan terbuka Q1) |
| **HP pribadi** | Smartphone karyawan (PWA, bukan app store) | Buka halaman absen → sistem cek geofence plant → tekan hadir |

Kedua mode menulis ke tabel yang sama; perbedaannya hanya `method` dan bukti yang direkam.

### 2.2 QR dinamis, bukan cetakan
QR di tablet gerbang **berganti tiap 30–60 detik** (token bertanda-waktu, TOTP-style).
QR cetak statis bisa difoto dan dipakai absen dari rumah — itu celah nomor satu sistem
absensi QR. Tablet offline tetap bisa menghasilkan token (seed lokal), divalidasi saat
sinkron.

### 2.3 Geo-tagging: titik saat scan, BUKAN pelacakan
- Lokasi direkam **hanya pada momen clock-in/out** — sistem ini bukan pelacak karyawan.
  (Prinsip privasi; juga pembeda saat menjual: "kami tidak melacak karyawan Anda".)
- Geofence per plant: titik pusat + radius (default 150 m, konfigurabel per plant —
  3 plant punya kondisi berbeda).
- Di luar geofence → tetap boleh absen tapi berstatus `DI_LUAR_AREA`, masuk antrean
  review HRD (bukan ditolak buta — ada kasus sah: tugas luar, antar barang).
- Akurasi GPS < ambang (mis. > 100 m) dicatat sebagai flag, bukan penolakan.

### 2.4 Offline-first
Pola yang sudah ada di proyek: PWA + antrean lokal + `client_event_id` idempoten.
Tablet gerbang menyimpan scan saat internet putus, sinkron otomatis. Jam perangkat yang
menyimpang > toleransi ditandai untuk review.

### 2.5 Identitas & anti-titip-absen (buddy punching)
Berjenjang, mulai sederhana:
- **v1:** QR dinamis + geofence + satu perangkat per karyawan (device binding ringan:
  HP pertama yang dipakai terdaftar; ganti perangkat perlu approval HRD).
- **Opsional v1.1 (pertanyaan terbuka Q2):** foto selfie saat scan di HP pribadi —
  disimpan sebagai bukti, TIDAK ada face recognition (mahal, rawan, berlebihan untuk 33
  orang; supervisor yang mengecek sampel, bukan algoritma).

## 3. Alur pengguna

```
CLOCK IN  : scan/tekan hadir → validasi token+geofence → tercatat, tampil jam & shift
ISTIRAHAT : (opsional, pertanyaan terbuka Q3 — terkait pembagi gaji 195 vs 173 jam!)
CLOCK OUT : sama; lupa clock-out → auto-close di akhir hari + flag review
LEMBUR    : clock-out melewati jam shift → sistem mencatat menit lembur sebagai DATA;
            status lembur DIBAYAR/TIDAK butuh approval supervisor (aturan bayar di payroll,
            bukan di sini)
KOREKSI   : karyawan ajukan koreksi (lupa absen, salah jam) → approval HRD → tercatat
            di riwayat dengan alasan; data asli tidak ditimpa (append + status)
IZIN/SAKIT/CUTI : pengajuan sederhana dengan lampiran → approval → memengaruhi rekap
```

State machine harian per karyawan:
`BELUM_HADIR → HADIR → (ISTIRAHAT ⇄) → PULANG` + status khusus
`TERLAMBAT`, `DI_LUAR_AREA`, `IZIN`, `SAKIT`, `CUTI`, `ALPA`, `KOREKSI_PENDING` —
ditegakkan di database seperti state machine dokumen lain.

## 4. Aturan bisnis

1. Jadwal acuan = **shift & kalender master yang sudah ada** (Sen–Jum 08–16, Sab 08–13) —
   jangan membuat master jam kerja kedua. Karyawan ber-shift khusus merujuk shift-nya.
2. Terlambat = clock-in > (jam mulai shift + toleransi). Toleransi konfigurabel
   (pertanyaan terbuka Q4). Terlambat adalah **fakta yang dicatat**, bukan hukuman —
   kebijakan konsekuensinya urusan HRD di luar sistem.
3. Satu karyawan satu status per hari per plant; pindah plant di tengah hari dicatat
   sebagai perpindahan, bukan dua kehadiran.
4. PHL: kehadiran = dasar upah harian → rekap PHL per hari wajib akurat & mudah diekspor.
5. Rekap bulanan per karyawan: hadir, terlambat, izin/sakit/cuti, alpa, menit lembur —
   diekspor CSV/Excel untuk payroll eksternal.
6. **Jam istirahat**: keputusan di sini menuntaskan pertanyaan lama G4 (pembagi gaji
   195 vs 173,3 jam/bulan). Satu keputusan, dua konsumen: absensi & tarif biaya.

## 5. Privasi & keamanan (tidak bisa ditawar)

1. Data lokasi: hanya titik saat scan; **dilarang** menyimpan riwayat posisi lain.
   Retensi konfigurabel (default 90 hari koordinat mentah; rekap kehadiran permanen).
2. Akses: karyawan melihat riwayat sendiri; supervisor melihat kehadiran (bukan lokasi
   presisi) anggota timnya; HRD & admin melihat semua; **aturan privasi gaji tidak
   berubah sedikit pun** — absensi tidak membuka jalan baru ke data gaji.
3. RLS sejak migrasi pertama; foto selfie (bila dipakai) di storage ber-policy ketat,
   bukan public bucket.
4. Halaman absen HP pribadi tanpa login penuh? TIDAK — tetap sesi karyawan (PIN/badge
   ringan seperti mode lantai produksi yang sudah dirancang), karena inilah identitasnya.
5. Audit trail untuk semua koreksi & approval.

## 6. Sketsa model data (Opus sempurnakan)

```
attendance_events        -- append-only, sumber kebenaran
  id, tenant_id, plant_id, employee_id, type(IN|OUT|BREAK_START|BREAK_END),
  occurred_at, method(QR_TABLET|GEO_PHONE|MANUAL_HRD),
  lat, lng, accuracy_m, geofence_status(DALAM|LUAR|TANPA_GPS),
  device_id, qr_token_id, client_event_id (idempoten), photo_url NULL,
  flags jsonb (late, clock_drift, out_of_area, auto_closed)

attendance_days          -- agregat harian per karyawan (dihitung, bukan diedit)
  employee_id, date, status, first_in, last_out, work_minutes, late_minutes,
  overtime_minutes, source_events uuid[]

attendance_corrections   -- pengajuan koreksi + approval (state machine)
leave_requests           -- izin/sakit/cuti + lampiran + approval
attendance_devices       -- perangkat terdaftar per karyawan / tablet per plant
plant_geofences          -- pusat + radius per plant
qr_token_log             -- token yang diterbitkan tablet (validasi & audit)
```
Prinsip yang sama dengan stok: **event adalah ledger; rekap harian adalah agregat** —
koreksi menambah event/penyesuaian, tidak mengedit sejarah.

## 7. Integrasi dengan yang sudah ada

| Konsumen | Apa yang dipakai |
|---|---|
| Biaya SDM (K1/K4) | Jam hadir → validasi silang labor log batch; PHL hadir = dasar upah harian; jam kerja standar bulan (setelah Q3 jam istirahat diputuskan) |
| Kapasitas/PPIC | Operator hadir hari ini per plant → kapasitas realistis hari itu; ketidakhadiran mendadak → peringatan ke rencana batch |
| Kamus (K1) | Semua field baru masuk backlog kamus otomatis (generator idempoten sudah ada) |
| Dashboard & Kesiapan AI | % hari dengan data absensi lengkap = metrik kualitas data baru |
| Notifikasi | Terlambat massal / tablet offline > N jam → supervisor & HRD |

## 8. Acceptance criteria inti (Opus lengkapi per gelombang)

- [ ] QR statis hasil foto/screenshot token lama DITOLAK (uji eksplisit).
- [ ] Scan di luar geofence tercatat `DI_LUAR_AREA` dan masuk antrean review, bukan hilang.
- [ ] Tablet offline 2 jam: semua scan tersinkron tanpa duplikat (uji dengan client_event_id sama dikirim 2×).
- [ ] Karyawan tidak bisa melihat riwayat karyawan lain (uji per role).
- [ ] Koreksi tidak mengubah event asli; rekap terhitung ulang dari event.
- [ ] Rekap bulanan cocok dengan penghitungan manual pada data uji (angka acuan literal).
- [ ] Lupa clock-out ter-auto-close + flag, dan muncul di antrean HRD.
- [ ] Ekspor payroll menghasilkan file yang kolomnya disepakati (Q6).

## 9. Edge cases yang wajib ditangani

- Dua scan IN beruntun (double tap) → idempoten, satu event.
- Karyawan shift Sabtu (5 jam) — perhitungan terlambat/lembur mengikuti shift, bukan default.
- Pindah plant di tengah hari (antar Karanglo ↔ Ruko Dieng).
- HP karyawan tanpa GPS/GPS mati → mode `TANPA_GPS`, wajib QR tablet.
- Ganti HP → proses pendaftaran ulang perangkat via HRD.
- Tanggal merah/libur nasional → status hari mengikuti kalender master.
- Jam perangkat sengaja dimundurkan → deteksi clock drift vs waktu server.
- PHL yang datang tapi tidak jadi dipekerjakan hari itu (hadir ≠ dibayar? — Q5).

## 10. Pertanyaan terbuka — Opus wawancarai pemilik produk SEBELUM menyusun instruksi

| # | Pertanyaan | Kenapa menentukan |
|---|---|---|
| Q1 | Arah scan di gerbang: tablet menampilkan QR (karyawan pindai dengan HP) atau tablet yang memindai QR/kartu karyawan? | Menentukan kebutuhan perangkat & alur; karyawan tanpa smartphone butuh arah kedua |
| Q2 | Perlu foto selfie saat absen via HP pribadi? | Trade-off privasi vs anti-titip-absen |
| Q3 | **Jam istirahat resmi** — sekali ini harus final | Menentukan pembagi gaji (195 vs 173,3 jam) DAN status BREAK di absensi |
| Q4 | Toleransi terlambat berapa menit, dan siapa yang boleh melihat rekap keterlambatan? | Aturan & sensitivitas |
| Q5 | PHL yang hadir tapi tidak dipekerjakan: tercatat hadir? dibayar? | Menentukan relasi kehadiran ↔ upah harian |
| Q6 | Format ekspor payroll yang dipakai sekarang (kolom apa saja)? | Supaya ekspor langsung terpakai, bukan perkiraan |
| Q7 | Berapa karyawan yang TIDAK punya smartphone? | Menentukan bobot mode tablet |

## 11. Instruksi untuk Opus

1. Wawancarai Q1–Q7 satu per satu (pola B.6), dengan contoh dampak konkret tiap jawaban.
2. Setelah terjawab, susun instruksi Claude Code format B.0.2 dalam gelombang:
   - **W1** Skema + RLS + state machine + geofence + event ledger + rekap harian
   - **W2** Tablet gerbang: QR dinamis + mode offline + pendaftaran perangkat
   - **W3** PWA karyawan: absen HP, riwayat sendiri, pengajuan koreksi & izin
   - **W4** Konsol HRD: antrean review, approval, rekap, ekspor payroll
   - **W5** Integrasi: kapasitas harian, validasi silang labor log, notifikasi
   Tiap gelombang: kriteria selesai + ≥2 skenario negatif + jalan di staging.
3. Terapkan aturan yang sudah berlaku: kamus terisi untuk field baru (draf + konfirmasi),
   angka acuan literal untuk perhitungan rekap, review adversarial B.12 tiap laporan.
4. Ingatkan pemilik produk: keputusan Q3 (jam istirahat) harus dipropagasi ke tarif
   biaya K4 dalam commit yang sama — dua konsumen, satu kebenaran.
