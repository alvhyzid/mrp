# FABRIX RELEASE GATES

### Gate 0 — Architecture
No unresolved critical ownership/contract conflict.

### Gate 1 — Data
Schema, migrations, referential integrity, transaction/concurrency safety verified.

### Gate 2 — Security
Authentication, authorization, tenant isolation, IDOR, secret/configuration controls verified.

### Gate 3 — Business
Critical calculations and state transitions verified.

### Gate 4 — UX
Critical workflows, accessibility, Carbon consistency, route/navigation behavior verified.

### Gate 5 — E2E
Golden-path cross-domain scenarios pass.

### Gate 6 — Operational
Observability, backup/restore expectations, deployment health, smoke tests verified.

### Gate 7 — Certification
Evidence linked; known risks explicitly accepted or resolved.

P0 failures block release. The project already defines its detailed QA taxonomy and schedules; this document is the release gate, not a replacement for the detailed QA governance.

---

# KEADAAN GERBANG — 29 Agustus 2026

> Gerbang tanpa keadaan yang tercatat sama dengan gerbang yang tidak pernah dijaga.
> Nilai di bawah **diukur**, dan **belum ada gerbang yang dinyatakan LULUS SEPENUHNYA**
> untuk seluruh proyek — yang dinilai di sini adalah domain yang benar-benar dikerjakan.

| Gerbang | Keadaan | Dasar |
|---|---|---|
| **0 · Arsitektur** | **TERHALANG** | **AD-03 terbuka** (kosakata status SO: baseline 11 vs implementasi 4). Kontrak Sales↔Finance **tidak ada** (FIN-02) |
| **1 · Data** | **LULUS untuk yang dikerjakan** | 333 migrasi · penjaga kurung migrasi · penjaga `company_id` ter-hardcode · idempotensi jalur SO diuji ulang-jalan |
| **2 · Keamanan** | **LULUS setelah dua lubang ditutup** | SEC-21 & SEC-23. Serangan asli diulang: `anon` kini ditolak `42501`, **0 Sales Order** lahir. Utang tersisa: SEC-20 (9 tabel), SEC-22 (5 fungsi, beralasan) |
| **3 · Bisnis** | **SEBAGIAN** | Perhitungan kewajiban pembayaran punya penjaga rekonsiliasi. **BD-01 & BD-09 kini TERKUNCI** (29 Agu 2026): penyelesaian order berbasis **pemenuhan**, nol toleransi kurang-kirim — aturannya jelas, **implementasinya belum ada**. **BD-10 tetap terbuka**, tapi **tidak lagi menahan penyelesaian order** |
| **4 · UX** | **SEBAGIAN** | Enam lebar + tiga arah tepi diperiksa untuk layar yang disentuh. Cacat terbuka: **BL-03** (tombol "Batal" modal bertahap terpotong di 360px, 4 halaman) |
| **5 · E2E** | **TIDAK LULUS** | **Tidak ada satu pun skenario jalur emas lintas domain** PO klien → SO → Work Order → batch → pengiriman → POD. Sebabnya bukan kelalaian pengujian: **datanya belum pernah ada** (0 BOM, 0 routing, 0 WO, 0 batch, 0 pengiriman di tenant nyata). Dicatat **QA-04** |
| **6 · Operasional** | **TIDAK LULUS** | **INF-28**: pemulihan pencadangan **belum pernah diuji sekali pun**. Pencadangan yang belum pernah dipulihkan bukan pencadangan, melainkan **asumsi** |
| **7 · Sertifikasi** | **BELUM** | Gerbang 0, 5, dan 6 belum lulus |

## Yang paling penting dibaca dari tabel ini

**Gerbang 5 dan 6 tidak bisa ditutup dengan menulis kode lagi.**

- Gerbang 5 butuh **inti manufaktur benar-benar dipakai satu kali** — satu BOM, satu
  routing, satu Work Order, satu batch, satu pengiriman. Semua kapabilitasnya sudah
  terbangun dan **belum pernah dijalankan pada data sungguhan**.
- Gerbang 6 butuh **satu ruang basis data sekali pakai** untuk mencoba pemulihan. Itu
  keputusan biaya, milik pemilik produk.

## Aturan yang berlaku maju

1. Gerbang **tidak dinyatakan lulus dari dokumentasi** — hanya dari menjalankan.
2. Gerbang yang lulus **untuk satu domain** ditulis begitu, bukan "lulus".
3. Kegagalan P0 memblokir rilis; risiko yang diterima **ditulis beserta penerimanya**.
