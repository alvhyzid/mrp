# Revisi Fitur KPI — Visibilitas Individu, Model Tanggung Jawab & Ikon Info KPI

**Status:** MENGGANTIKAN §1.3 pada `penyerahan-opus-fitur-kpi.md`; menambah §2 (skema)
dan sesi KPI-1/KPI-4. Opus membaca dokumen ini BERSAMA dokumen penyerahan utama.
**Pemicu:** keputusan pemilik produk — tampilan per individu diperbolehkan sesuai
departemen/tugas, sebagai cermin performa tiap pegawai; setiap KPI menampilkan siapa
yang bertanggung jawab & berpengaruh; ikon kecil di samping angka membuka detail KPI.

---

## 1. Pengganti §1.3 — Visibilitas sebagai kebijakan yang dikonfigurasi, bukan larangan

### 1.1 Empat tingkat visibilitas per KPI (kolom baru di registry)
| Tingkat | Arti |
|---|---|
| `DIRI` | Pegawai melihat angka dirinya sendiri ("KPI Saya") |
| `ATASAN` | Supervisor melihat rincian per anggota timnya |
| `DEPARTEMEN` | Semua anggota departemen melihat agregat + rincian departemennya |
| `PUBLIK_AGREGAT` | Semua role melihat agregat lini/proses (tanpa nama) |

Setiap KPI menetapkan visibilitasnya sendiri; admin tenant boleh mengubah.
**Default konservatif** (bisa dilonggarkan, tercatat siapa mengubah):
- KPI DISIPLIN → `DIRI` + `ATASAN` (per pencatat memang adil diukur individu)
- KPI HASIL → `DIRI` + `ATASAN` **hanya bila** `attribution_level = INDIVIDU` (lihat §2);
  selain itu `DEPARTEMEN`/`PUBLIK_AGREGAT`

### 1.2 Halaman "KPI Saya" (fitur baru, masuk KPI-4)
Setiap pegawai punya halaman pribadi: KPI yang relevan dengan tugasnya, nilai dirinya
vs rata-rata tim (bukan vs individu lain), tren pribadinya, dan tindakan terbuka yang
jadi tanggung jawabnya. **Inilah "reminder performa" yang diminta** — cermin untuk diri
sendiri, bukan papan sorak untuk orang lain.

### 1.3 Yang tetap dipertahankan (dengan persetujuan pemilik produk)
- Tidak ada leaderboard lintas pegawai dan gamifikasi di v1 — bukan karena dilarang
  selamanya, tapi karena dibangun SETELAH kejujuran pencatatan teruji ≥3 bulan.
- Panduan tertulis untuk supervisor (masuk cheat sheet pelatihan): angka individu
  dipakai untuk PERCAKAPAN dan pembinaan, bukan vonis — terutama 3 bulan pertama.
- Risiko yang diterima sadar: begitu angka individu terlihat atasan, insentif memoles
  data ikut lahir. Penangkalnya sudah ada di desain: nilai KPI selalu AUTO dari ledger,
  koreksi ber-audit-trail, dan KPI DISIPLIN memantau kelengkapan pencatatan itu sendiri.

---

## 2. Model tanggung jawab per KPI (tambahan skema)

```
kpi_registry (kolom tambahan)
  attribution_level enum(INDIVIDU, TIM, LINI, PROSES, PERUSAHAAN)
      -- tingkat paling rendah yang ADIL untuk angka ini
  visibility jsonb            -- konfigurasi §1.1
  improvement_levers text[]   -- "apa yang menaikkan KPI ini" (v1: kurasi manual)

kpi_responsibilities
  kpi_registry_id
  role_id (atau user_id untuk penanggung jawab spesifik)
  responsibility enum(PEMILIK, KONTRIBUTOR, PENDUKUNG)
  note text                   -- mis. "Gudang memengaruhi lewat akurasi issue bahan"
```

Aturan pengisian `attribution_level` (kejujuran atribusi — penting):
- **INDIVIDU** hanya untuk KPI yang hasilnya benar-benar dikendalikan satu orang
  (kelengkapan log oleh pencatat, ketepatan absen, akurasi picking).
- Yield, OTD, margin, downtime = **TIM/LINI/PROSES** — dipengaruhi banyak pihak (lot
  bahan, mesin, tahap sebelumnya). Menampilkannya seolah milik satu operator bukan
  ketegasan, melainkan salah alamat — dan pegawai akan kehilangan percaya pada sistem
  yang menyalahkan mereka atas hal di luar kendalinya.
- Nilai default per KPI di-seed dari katalog; admin tenant boleh mengubah, tercatat.

Manfaat langsung `kpi_responsibilities`: menjawab "KPI ini siapa yang bertanggung
jawab?" secara eksplisit di UI, mengisi otomatis kandidat penanggung jawab di
`kpi_actions`, dan memberi tahu tiap pegawai KPI mana saja yang ia pengaruhi
(sumber daftar di halaman "KPI Saya").

---

## 3. Ikon info KPI — SATU keluarga ikon, bukan tiga ikon berjejer

Permintaan: ikon kecil di samping angka penting untuk membuka detail KPI.
Keputusan desain: kita sudah punya dua affordance serupa (ikon kamus di mode kamus,
klik-provenance untuk asal-usul). **Jangan tiga ikon kecil berjejer di tiap angka** —
itu kebisingan visual yang melanggar prinsip UI pabrik.

Bentuk final: **satu affordance per angka** (klik/ikon tunggal) membuka **panel
bertab**, tab tampil sesuai konteks & role:

| Tab | Isi | Sumber |
|---|---|---|
| **Definisi** | Arti bisnis, rumus resmi, salah paham umum | Kamus (K1) |
| **Asal-usul** | Nilai ini dari mana: input, dokumen, riwayat | Provenance (D0/D1) |
| **KPI & Tanggung jawab** | Nilai vs target vs benchmark, tren, PEMILIK & KONTRIBUTOR (§2), tuas perbaikan (`improvement_levers`), tindakan terbuka terkait | Registry + kpi_actions |

Tab ketiga hanya muncul bila angka tersebut adalah/menjadi bagian KPI terdaftar.
"Apa yang harus dilakukan agar KPI berkembang" diisi dari `improvement_levers`
(kurasi manual v1 — pengetahuan produk, boleh dibagikan lintas tenant) + tautan ke
tindakan terbuka; kelak pin SARANKAN Drop-AI menambah lapisan analisis di tab yang sama.

Konsekuensi untuk Opus: sesi KPI-1 membangun panel bertab ini sebagai PERLUASAN panel
asal-usul (0.3), bukan komponen ketiga yang berdiri sendiri — satu komponen, tiga tab,
tiga sumber data.

---

## 4. Perubahan pada skenario negatif sesi KPI-1
Ganti skenario "(c) KPI HASIL tampil per individu → tidak ada jalurnya" menjadi:
- (c1) KPI dengan `attribution_level = LINI` diminta rinciannya per individu via API →
  ditolak (atribusi di bawah tingkat adilnya tidak punya jalur).
- (c2) Pegawai A membuka "KPI Saya" milik pegawai B → ditolak RLS.
- (c3) Perubahan visibilitas & attribution_level oleh admin → tercatat di audit trail.
