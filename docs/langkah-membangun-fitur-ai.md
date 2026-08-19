# Langkah Membangun Fitur AI — Pembagian Kerja Manusia vs AI

**Untuk:** pemilik produk AMS
**Prasyarat masuk:** fase produksi nyata selesai (SAS001 & SAS005 terkirim & tercatat,
pilot lulus, backup otomatis + restore teruji, K8 menerima data nyata pertama)
**Referensi:** `ai-roadmap-adr-ams-rev2.md`, `fitur-drop-ai-spec.md`

---

## Legenda pembagian kerja

| Kode | Arti |
|---|---|
| 👤 **ANDA** | Hanya bisa dikerjakan pemilik produk — keputusan bisnis, penilaian benar/salah, kontrak, kurasi. Tidak bisa didelegasikan ke AI |
| 🧠 **OPUS** | Claude chat sebagai arsitek: merancang, menganalisis, menyusun instruksi |
| ⚙️ **CODE** | Claude Code: implementasi, test, migrasi |
| 👤+🧠 | Dikerjakan bersama — Opus memandu, Anda memutuskan |

**Aturan yang tidak berubah:** setiap instruksi ke Claude Code memakai format B.0.2;
setiap laporan selesai direview adversarial (B.12); "selesai" = jalan di staging.

---

# FASE 0 — Fondasi (sebelum satu pun panggilan model)

Seluruh fase ini **tanpa LLM**. Tujuannya: menyiapkan tanah supaya fitur AI tumbuh benar.

### Langkah 0.1 — Ontology: kamus istilah, metrik, relasi, aturan
| Bagian | Siapa |
|---|---|
| Draf awal dari skema & kode yang ada | ⚙️ CODE |
| Deskripsi bisnis tiap kolom penting ("`qty_input` artinya apa bagi orang pabrik") | 👤 ANDA |
| Definisi resmi tiap metrik (yield, margin kontribusi, OTIF) | 👤+🧠 |
| Aturan tak-terlihat (kenapa approval 3 dept, kenapa bahan klien nol) | 👤 ANDA |
| Format & versioning dokumen di repo | ⚙️ CODE |

> **Ini pekerjaan terpenting Anda di seluruh proyek AI.** Kualitas jawaban AI = kualitas
> kamus ini. AI bisa menebak bentuk data; hanya Anda yang tahu artinya.
> Cara termurah mengerjakannya: setiap kali Claude Code menyentuh satu modul, minta ia
> menyusun draf kamus untuk modul itu, lalu Anda koreksi 15 menit. Jangan dikerjakan
> sekaligus dalam satu sesi maraton.

### Langkah 0.2 — Prop `provenance` di komponen UI (D0 Drop-AI)
| Bagian | Siapa |
|---|---|
| Audit komponen penampil angka yang sudah ada | ⚙️ CODE |
| Desain tipe `ProvenanceEnvelope` | 🧠 OPUS |
| Implementasi + pasang di komponen baru | ⚙️ CODE |
| Keputusan: retrofit komponen lama sekarang atau bertahap | 👤+🧠 |

### Langkah 0.3 — Panel asal-usul (D1) — fitur pertama yang terlihat pengguna
Klik angka → lihat rumus, nilai input, dokumen sumber, riwayat perubahan, status K8.
**Tanpa LLM.** Seluruhnya ⚙️ CODE, dengan 👤 ANDA menguji jalan kaki di staging.

### Langkah 0.4 — Process mining (fitur AI-1, tanpa LLM)
| Bagian | Siapa |
|---|---|
| Query & agregasi atas `status_transition_log` | ⚙️ CODE |
| Menentukan pertanyaan bisnis yang layak dijawab | 👤+🧠 |
| Dashboard hasil | ⚙️ CODE |
| Menilai apakah temuannya benar & berguna | 👤 ANDA |

> Ini pembuktian nilai pertama: wawasan operasional nyata dengan biaya token nol.

### Langkah 0.5 — Kebiasaan KPI baseline
Snapshot KPI sebelum fitur AI dirilis (durasi tugas, frekuensi, akurasi).
🧠 OPUS merancang apa yang diukur · ⚙️ CODE mengimplementasi · 👤 ANDA memilih KPI mana
yang benar-benar mewakili nilai bisnis.

---

# FASE 1 — Keputusan & kontrak (murni pekerjaan Anda)

Fase ini tidak bisa dimulai Claude Code. Kalau Anda menundanya, seluruh Fase 2 tertahan.

### Langkah 1.1 — 👤 Pilih penyedia model & buka akun
- Pilih 2–3 kandidat, buat akun berbayar, dapatkan API key.
- **Baca & simpan ketentuan data**: apakah data dipakai melatih model, berapa lama
  disimpan, diproses di wilayah mana. Simpan salinannya — ini yang akan ditanyakan
  calon tenant.
- Tetapkan batas anggaran bulanan di dashboard penyedia (pagar biaya pertama).

### Langkah 1.2 — 👤 Susun 30–50 pertanyaan eval
Pertanyaan nyata dari pabrik + jawaban yang Anda anggap benar. Contoh kategori:
- Faktual: "berapa stok gelatin bloom di Karanglo?"
- Asal-usul: "angka `qty_per` outer box ini artinya apa?"
- Analitis: "kenapa margin Drinkme lebih tipis dari Zala?"
- Prosedural: "bagaimana cara mencatat penerimaan barang?"
- **Jebakan** (paling penting): pertanyaan yang jawabannya TIDAK ADA di data —
  AI harus bilang tidak tahu, bukan mengarang.
- **Izin**: pertanyaan yang harus GAGAL untuk role tertentu (gaji individual).

> 🧠 OPUS bisa membantu menyusun format & mengusulkan kandidat pertanyaan, tapi
> **jawaban benarnya harus dari Anda** — kalau AI yang menentukan benar-salah, evalnya
> tidak menguji apa pun.

### Langkah 1.3 — 👤 Putuskan kebijakan data tenant
- Apakah fitur AI menyala default atau opt-in? (rekomendasi: opt-in)
- Data apa yang boleh keluar ke penyedia model (rekomendasi: hasil query spesifik saja,
  tidak pernah dump tabel)
- Kalimat yang akan Anda ucapkan ke calon tenant saat ditanya soal ini.

### Langkah 1.4 — 👤 Kurasi Rak 2 (korpus otoritatif)
Kumpulkan & beri versi: regulasi BPOM/CPOB yang relevan, dokumen SJPH, SOP internal,
paket referensi manufaktur, ADR proyek. **Bisa dimulai hari ini**, tidak perlu menunggu
apa pun. Tanpa ini, jawaban regulasi AI tidak punya sumber.

---

# FASE 2 — Infrastruktur AI (mulai memakai model)

### Langkah 2.1 — `llmClient` (lapisan abstraksi penyedia)
🧠 OPUS merancang antarmuka · ⚙️ CODE implementasi.
Wajib ada sejak awal: pencatatan token per tenant per fitur, timeout, retry, batas biaya,
dan **routing dua model** (murah untuk tugas volume, frontier untuk penalaran).

### Langkah 2.2 — Definisi tools + MCP
| Bagian | Siapa |
|---|---|
| Daftar tools pertama (`jelaskanAngka`, `cariStok`, `hitungFeasibility`, `analisisProses`) | 👤+🧠 |
| Skema input/output tiap tool | 🧠 OPUS |
| Implementasi tool + eksposur lewat MCP | ⚙️ CODE |
| Uji izin: tiap tool berjalan dengan RLS user, bukan service_role | ⚙️ CODE (bukti) + 👤 verifikasi |

> Daftar tools menentukan apa yang bisa & tidak bisa dilakukan AI Anda — jauh lebih
> menentukan daripada pilihan model. Ini keputusan produk, bukan keputusan teknis.

### Langkah 2.3 — Orchestrator
⚙️ CODE, dengan pagar yang dirancang 🧠 OPUS: batas langkah maksimum, tool yang boleh
dipanggil per peran, timeout, penanganan gagal, dan pencatatan audit tiap langkah.

### Langkah 2.4 — Harness eval
⚙️ CODE membangun runner-nya; 👤 ANDA mengisi soal & jawaban benar (dari 1.2).
Jalankan pada 2–3 penyedia kandidat → 👤 ANDA memutuskan pemenangnya berdasarkan:
berapa benar, berapa **mengarang angka**, berapa biaya.

### Langkah 2.5 — Konsol tata kelola agen
Daftar kemampuan aktif + kartu kemampuan, saklar per peran, riwayat usulan & persetujuan,
batas anggaran token per tenant. ⚙️ CODE · 👤 ANDA menentukan default kebijakannya.

---

# FASE 3 — Fitur berhadapan pengguna

Urutan sengaja: yang paling murah & paling sulit ditiru lebih dulu.

| # | Fitur | Utama | Peran Anda |
|---|---|---|---|
| 3.1 | Narasi & laporan otomatis (briefing pagi, serah terima shift) | ⚙️ CODE | Menilai apakah ringkasannya benar & berguna; menyusun template awal per peran |
| 3.2 | Drop-AI tahap JELASKAN (D3) | ⚙️ CODE | Uji jalan kaki; koreksi jawaban yang salah arti |
| 3.3 | Order promising menjelaskan diri (F1) | ⚙️ CODE | Validasi bahwa alasan & opsinya masuk akal secara bisnis |
| 3.4 | Copilot dalam alur kerja (F5) | ⚙️ CODE | Uji per peran, terutama uji izin |
| 3.5 | Utas pin kolaborasi (D2) | ⚙️ CODE | — |
| 3.6 | Anomaly detection (F4) — butuh ≥2–3 bulan data | ⚙️ CODE | Menilai mana anomali nyata vs derau |
| 3.7 | Drop-AI SARANKAN (D4) + scenario planning (F6) | ⚙️ CODE | Validasi rekomendasi; ini paling rawan salah arah |
| 3.8 | Agen sempit: parser PO, auditor cerewet (F7–F8) | ⚙️ CODE | Menyetujui/menolak usulan agen selama masa uji |

Setiap fitur: rilis ke staging → 👤 uji jalan kaki → eval dijalankan ulang → baru produksi.

---

# FASE 4 — Komersialisasi

| Langkah | Siapa |
|---|---|
| Hitung biaya token nyata per tenant per bulan | ⚙️ CODE (data) |
| Tetapkan harga tier Insight & Copilot | 👤 ANDA |
| Susun materi jualan dengan angka before/after dari pabrik sendiri | 👤+🧠 |
| Halaman kebijakan AI untuk calon tenant (apa yang AI tidak boleh lakukan) | 👤+🧠 |
| Uji keamanan eksternal oleh manusia sebelum tenant berbayar kedua | 👤 ANDA (sewa pihak ketiga) |

---

## Ringkasan: apa yang HANYA bisa Anda kerjakan

Kalau Anda hanya punya waktu terbatas, lima hal ini yang tidak boleh didelegasikan:

1. **Kamus arti data** (0.1) — AI tahu bentuk data, hanya Anda tahu maknanya.
2. **Jawaban benar untuk eval** (1.2) — kalau AI menilai dirinya sendiri, tidak ada mutu.
3. **Kurasi korpus otoritatif** (1.4) — hanya Anda yang tahu dokumen mana yang sah & berlaku.
4. **Kontrak & kebijakan data** (1.1, 1.3) — tanggung jawab hukum ada di Anda.
5. **Penilaian "ini benar secara bisnis"** — di setiap fase, di setiap fitur.

Sisanya — perancangan, implementasi, test, migrasi, dokumentasi teknis — bisa dikerjakan
Opus + Claude Code dengan pola kerja yang sudah terbukti di proyek ini.

## Perkiraan beban waktu Anda

| Fase | Waktu Anda | Sifat |
|---|---|---|
| 0 | 15 menit per modul, tersebar | Koreksi draf kamus |
| 1 | 2–3 hari terfokus | Tidak bisa dicicil — ini gerbang |
| 2 | ±1 hari (keputusan tools + eval) | Terkonsentrasi di awal |
| 3 | 1–2 jam per fitur | Uji jalan kaki & validasi |
| 4 | Beberapa hari | Keputusan komersial |

## Yang paling sering menggagalkan proyek seperti ini

1. **Melewati Fase 0 karena tidak terlihat seperti "fitur AI".** Tanpa ontology &
   provenance, semua fitur di atasnya jadi dangkal — dan memperbaikinya belakangan mahal.
2. **Tidak punya eval.** Kualitas turun diam-diam saat model diperbarui; baru ketahuan
   saat pengguna mengeluh.
3. **Membangun banyak fitur sekaligus.** Empat fitur dalam mengalahkan sepuluh dangkal —
   dan angka Gartner (>40% proyek agentic batal) sebagian besar dari pola ini.
4. **AI menilai pekerjaannya sendiri.** Verifikasi empiris tetap berlaku, sekarang juga
   untuk lapisan AI.
