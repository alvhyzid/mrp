# Instruksi Claude Code — Dashboard Proyek AI

**Format:** B.0.2
**Sesi:** K1b — dikerjakan setelah/bersama modul Kamus (K1), karena membaca datanya
**Sifat:** internal (hanya pemilik produk & tim inti), bukan fitur tenant

---

## 1. TUJUAN

Satu halaman yang menjawab tiga pertanyaan kapan saja: **apa tahapan proyek AI ini,
seberapa jauh progresnya, dan apa yang bisa saya kerjakan sekarang** — dengan tugas
yang bisa diklik dan langsung dikerjakan di tempat.

---

## 2. KONTEKS YANG WAJIB DIBACA DULU

1. `docs/ai/langkah-membangun-fitur-ai.md` — struktur fase 0–4 & pembagian kerja
2. `docs/ai/fase-0-fondasi-ai-detail.md` — rincian langkah & definisi selesai Fase 0
3. Skema `kamus_terms` dari sesi K1 — sumber progres otomatis terbesar
4. `PROGRESS.md` — status pekerjaan Claude Code yang sudah berjalan

---

## 3. LANGKAH

### 3.1 Skema data

```
ai_project_phases
  id, code, name, description
  weight_percent numeric      -- bobot fase terhadap SELURUH proyek AI
  sort_order, status enum(BELUM, BERJALAN, SELESAI, DITUNDA)

ai_project_tasks
  id, phase_id, code, name, description
  weight_percent numeric      -- bobot tugas DI DALAM fasenya (jumlah per fase = 100)
  owner_type enum(PEMILIK_PRODUK, TIM, CLAUDE_CODE, CAMPURAN)
  suggested_role_id           -- untuk tugas yang sebaiknya dikerjakan departemen tertentu
  progress_source enum(AUTO_QUERY, CHECKLIST, MANUAL_PERCENT)
  progress_key text           -- kunci rumus untuk AUTO_QUERY
  action_type enum(BUKA_KAMUS, BUKA_CHECKLIST, BUKA_HALAMAN, INFO_SAJA)
  action_target text          -- filter/route yang dibuka saat diklik
  blocked_by uuid[]           -- prasyarat antar tugas
  status, sort_order

ai_project_checklist_items
  id, task_id, label, done bool, done_by, done_at, note

ai_project_progress_snapshots
  id, taken_at, overall_percent, per_phase jsonb
```

### 3.2 Perhitungan progres — WAJIB otomatis, bukan diisi manual

```
progres_tugas   = sesuai progress_source (lihat 3.3)
progres_fase    = Σ (progres_tugas × weight_percent_tugas) / 100
progres_total   = Σ (progres_fase × weight_percent_fase) / 100
```

Aturan keras:
- **Dilarang** ada kolom "persen" yang diketik manusia untuk tugas ber-`AUTO_QUERY`.
  Progres dihitung dari data nyata setiap kali halaman dibuka (atau cache ≤5 menit).
- `MANUAL_PERCENT` hanya untuk tugas yang benar-benar tidak terukur otomatis, dan
  wajib menyimpan siapa yang mengisinya + kapan.
- Snapshot harian disimpan ke `ai_project_progress_snapshots` supaya tren bisa
  ditampilkan ("minggu lalu 4%, sekarang 11%").

### 3.3 Rumus AUTO_QUERY yang harus diimplementasi

| `progress_key` | Rumus |
|---|---|
| `kamus.p12` | baris `kamus_terms` prioritas 1–2 berstatus DIKONFIRMASI ÷ total prioritas 1–2 |
| `kamus.p3` | sama untuk prioritas 3 |
| `kamus.metrik` | scope METRIC DIKONFIRMASI ÷ total scope METRIC |
| `provenance.komponen` | komponen penampil angka yang sudah menerima prop `provenance` ÷ total (hasil pemindaian kode) |
| `baseline.hari` | hari pencatatan KPI baseline terkumpul ÷ 14 |
| `processmining.pertanyaan` | pertanyaan terjawab & terverifikasi ÷ target (6) |
| `panel.uji` | angka yang lulus uji jelaskan ÷ 20 |

Tugas ber-`CHECKLIST` menghitung: item `done` ÷ total item.

### 3.4 Seed struktur (angka bobot adalah USULAN — pemilik produk boleh mengubah)

**Bobot fase terhadap keseluruhan proyek AI**

| Fase | Bobot |
|---|---|
| Fase 0 — Fondasi | 25% |
| Fase 1 — Keputusan & kontrak | 10% |
| Fase 2 — Infrastruktur AI | 25% |
| Fase 3 — Fitur pengguna | 35% |
| Fase 4 — Komersialisasi | 5% |

**Tugas dalam Fase 0 (bobot di dalam fase)**

| Tugas | Bobot | Pemilik | Sumber progres | Aksi klik |
|---|---|---|---|---|
| Kamus prioritas 1–2 | 30 | CAMPURAN | `kamus.p12` | Buka antrean kamus (filter p1–2) |
| Kamus metrik | 10 | TIM (Finance) | `kamus.metrik` | Buka antrean (scope METRIC) |
| Kamus prioritas 3 | 10 | CAMPURAN | `kamus.p3` | Buka antrean (filter p3) |
| Provenance di komponen | 15 | CLAUDE_CODE | `provenance.komponen` | Info saja |
| Panel asal-usul | 15 | CLAUDE_CODE | `panel.uji` | Buka checklist uji 20 angka |
| Process mining | 10 | CAMPURAN | `processmining.pertanyaan` | Buka checklist pertanyaan |
| KPI baseline | 10 | PEMILIK_PRODUK | `baseline.hari` | Buka form pencatatan harian |

Fase 1–4 di-seed sebagai tugas berstatus BELUM dengan checklist dari dokumen rujukan,
supaya peta lengkap terlihat sejak awal meski belum dikerjakan.

### 3.5 UI dashboard (`/ai-project`)

**Bagian atas — ringkasan**
- Progres total (angka besar + bar), plus delta sejak minggu lalu dari snapshot.
- Lima kartu fase: nama, bobot, progres, status.

**Bagian tengah — daftar tugas fase aktif**
Setiap baris menampilkan:
- Nama tugas + pemilik (badge: Anda / Tim / Claude Code)
- **Kontribusi**: "12 dari 68 terjawab · 18% dari tugas ini · bobot 30% fase · **+1,9% total bila selesai**"
- Bar progres kecil
- Badge departemen bila `suggested_role_id` terisi
- Tombol aksi sesuai `action_type`

**Bagian bawah — "Bisa dikerjakan sekarang"**
Daftar 5 tugas teratas yang: tidak terblokir, pemiliknya Anda/tim, dan progresnya < 100%.
Diurutkan berdasarkan **dampak per menit** (bobot ÷ perkiraan sisa pekerjaan) — supaya
saat punya 15 menit luang, sistem langsung menunjuk pekerjaan yang paling berdampak.

**Perilaku klik**
- `BUKA_KAMUS` → antrean kamus dengan filter yang sudah disetel; setelah menjawab,
  tombol "kembali ke dashboard" tersedia dan progres langsung terbarui.
- `BUKA_CHECKLIST` → panel checklist inline, centang langsung di dashboard.
- `BUKA_HALAMAN` → route terkait (mis. form pencatatan baseline).
- `INFO_SAJA` → tampilkan detail & tautan ke `PROGRESS.md`; tidak bisa dicentang manusia.

**Tampilan per orang**: setiap anggota tim melihat "tugas saya" berdasarkan role-nya.

### 3.6 Integrasi dengan pekerjaan Claude Code
Tugas ber-`owner_type = CLAUDE_CODE` progresnya dari checklist definisi selesai yang
dicentang saat sesi selesai (oleh Claude Code, tercatat di audit). Dashboard menampilkan
tanggal sesi terakhir dan ringkasan dari `PROGRESS.md`.

---

## 4. BATAS

- **Jangan** membuat progres bisa diketik manual untuk tugas AUTO_QUERY — sekali itu
  dibuka, angkanya berhenti bermakna.
- **Jangan** menampilkan dashboard ini ke role di luar tim inti (ini alat internal).
- **Jangan** memanggil LLM apa pun.
- **Jangan** mengubah modul Kamus di luar penambahan filter dari dashboard.
- Jangan menambahkan gamifikasi (lencana, poin, papan peringkat) — bobot mewakili nilai,
  bukan skor.

---

## 5. KRITERIA SELESAI

- [ ] Struktur fase & tugas ter-seed lengkap untuk Fase 0–4.
- [ ] Progres total & per fase terhitung otomatis dari data nyata, bukan input manual.
- [ ] Setiap tugas menampilkan kontribusinya terhadap fase DAN terhadap total.
- [ ] Klik tugas kamus membuka antrean dengan filter benar; menjawab satu pertanyaan
      menaikkan angka progres saat kembali (dibuktikan).
- [ ] Snapshot harian tersimpan; tren minggu-ke-minggu tampil.
- [ ] Panel "bisa dikerjakan sekarang" mengurutkan berdasarkan dampak per menit.
- [ ] Bobot fase & tugas bisa diubah admin lewat UI tanpa deploy ulang.

---

## 6. BUKTI YANG DIMINTA

1. Query nyata perhitungan progres satu fase, dibandingkan angka yang tampil di UI.
2. Sebelum/sesudah: jawab 3 pertanyaan kamus → tunjukkan angka progres berubah sesuai
   perhitungan (bukan sekadar "berubah").
3. **Skenario negatif 1:** coba set progres tugas AUTO_QUERY lewat API langsung →
   harus ditolak.
4. **Skenario negatif 2:** user role produksi membuka `/ai-project` → ditolak.
5. Isi tabel snapshot setelah 2 kali dijalankan.

---

## 7. STOP CONDITION

- Bila jumlah tugas hasil seed melebihi 40, berhenti & laporkan — dashboard yang terlalu
  rinci tidak akan dipakai.
- Bila ada rumus AUTO_QUERY yang tidak bisa dihitung dari data nyata (mis. `provenance.komponen`
  butuh pemindaian kode yang belum ada), laporkan dan usulkan menjadikannya CHECKLIST
  sementara — jangan memalsukan angka.

---

## 8. CATATAN UNTUK PEMILIK PRODUK

**Bobot adalah pernyataan nilai, bukan estimasi waktu.** Kamus diberi bobot 30% bukan
karena paling lama, tapi karena paling menentukan kualitas seluruh fitur AI. Tinjau ulang
angka-angka di 3.4 sebelum di-seed — kalau Anda tidak setuju, ubah sekarang, karena
mengubahnya nanti membuat grafik tren tidak sebanding.

**Persentase bisa menipu.** Progres 80% dengan definisi selesai yang tidak terpenuhi tetap
berarti belum selesai. Dashboard ini alat orientasi harian, bukan pengganti kriteria
kelulusan di dokumen fase.
