# FABRIX PROJECT STATUS CONTROL
## Single coordination view — not a replacement for the existing build task registry

### Purpose
Provide a stable place for agents to understand project state without relying on conversation memory.

### Required sections
1. Current milestone
2. Current architecture baseline versions
3. Active segment
4. Active tasks
5. Blockers
6. Decisions pending
7. Recently accepted ADRs
8. Recently completed work
9. Known design/technical debt
10. Next recommended sequence

### Rule
The authoritative implementation task status remains the project's existing build task registry. This file summarizes; it does not duplicate it.


---

# KEADAAN PROYEK — 29 Agustus 2026

> Berkas ini mendaftar **10 bagian wajib** dan sebelumnya mengisi **nol**. Berikut isinya,
> seluruhnya dari pengukuran. Registri task resmi tetap `build_tasks`; ini meringkas.

## 1. Milestone berjalan
**Sales & CRM** — delapan gelombang eksekusi dalam satu hari kerja. Sebelum itu: fondasi
SaaS, MRP inti, HR/kehadiran, migrasi Carbon Design System.

## 2. Baseline arsitektur
333 migrasi terpasang di **tiga** proyek Supabase (nyata, staging, CI). Basis data: **96
tabel · 72 fungsi · 161 kebijakan RLS · 28 trigger**. Aplikasi: Next.js 16 + React 19 +
Carbon 1.114, **27 route halaman · 128 route API · 90 berkas test**.

## 3. Segmen aktif
Sales & CRM. Segmen lain **tidak sedang dikerjakan** dan tidak terhalang oleh Sales.

## 4. Task aktif
Dari **352 task** milik PT Indo Taste: **126 selesai · 180 menunggu · 35 ditunda sadar ·
6 menunggu persetujuan · 2 sedang dikerjakan · 3 dibatalkan** (diukur 29 Agu 2026, sesudah
tujuh temuan hari ini dicatat — AUD-51, AUD-52, QA-04, PJL-13, PJL-14, OVR-02, SEC-25 — dan
PJL-04 ditutup).

Khusus **Sales & CRM** (44 task: modul Penjualan ditambah pekerjaan modul lain yang langsung
menyentuhnya): **15 selesai · 20 menunggu · 8 diparkir sadar · 1 menunggu persetujuan**.

## 5. Penghambat

| Kode | Penghambat | Yang terhalang |
|---|---|---|
| **FIN-02** | Domain Finance untuk piutang pelanggan **tidak ada** | BD-10 → status pembayaran, gerbang produksi & pengiriman. **BUKAN** penyelesaian Sales Order (dikoreksi 29 Agu 2026 malam) |
| **AD-03** | Kosakata status Sales Order: baseline 11 vs implementasi 4 | penamaan status, amandemen SO |
| **BD-09** | Toleransi kurang-kirim belum ditetapkan | penyelesaian Sales Order |
| **INF-28** | Pemulihan pencadangan **belum pernah diuji** | klaim "data aman" |
| **QA-04** | Nol skenario jalur emas lintas domain | Gerbang Rilis 5 → sertifikasi rilis |
| **BL-03** | Tombol "Batal" modal bertahap terpotong di 360px | 4 halaman |

## 6. Keputusan menunggu
**AD-03** · **BD-09** · **BD-10** · **DEC-S13** (override) · dasar perhitungan pajak ·
multi-currency · format Quotation (DEC-S02) · nasib kolom alamat lama (BL-04) ·
**AUD-52** (apakah konstitusi tata kelola dinaikkan jadi mengikat, dan hubungannya dengan
`CLAUDE.md`) · **AUD-51** (kosakata status task) · **QA-02** (basis data sekali pakai untuk
test — keputusan biaya).

## 7. Keputusan yang diterima belakangan
**DEC-S02..S12** ditutup pemilik produk · **AD-01** (Sales tidak memiliki status
produksi/pengiriman) · **AD-02** (satu jalur kanonik pembuatan Sales Order) ·
**BD-02/03/06/07** · **DEC-S12** (`admin_staff` **bukan** Sales).

## 8. Pekerjaan yang baru selesai
Peran Sales tersendiri · permintaan pembatalan (mengajukan ≠ membatalkan) · Sales menahan
PO klien · jejak keputusan ber-pelaku dan ber-alasan · jalur kanonik pembuatan Sales Order ·
**dua kerentanan keamanan ditutup** (SEC-21, SEC-23) · termin & kewajiban pembayaran.

## 9. Utang desain / teknis yang diketahui

| Hal | Ukuran |
|---|---|
| **Inti manufaktur belum pernah dipakai** | 0 BOM · 0 routing · 0 Work Order · 0 batch · 0 lot · 0 pengiriman |
| Batas domain tidak tercermin di struktur folder | `mrp` memuat **109 dari 184** modul server |
| Tabel ber-RLS **tanpa kebijakan** | **9** (di luar Sales; SEC-20) |
| `SECURITY DEFINER` terbuka `anon` | **5**, seluruhnya beralasan tertulis (SEC-22) |
| Jejak keputusan belum punya pengisi | **5 dari 6** tabel ber-mesin status (AUD-50) |
| Tiga syarat DEC-S10 belum terpenuhi | pemilik keputusan ≠ pelaku · rujukan versi · bukti pendukung |
| Akun manusia sungguhan | **1 dari 8** — sisanya `@debug.mrp` |

## 10. Urutan yang disarankan

1. **Penutupan Sales Order (PJL-03)** — aturannya **terkunci** 29 Agu 2026 dan **tidak menunggu Finance**: penyelesaian berbasis pemenuhan (diproduksi + dikirim + konfirmasi PPIC + konfirmasi Manager/GM), nol toleransi kurang-kirim.
2. **FIN-02** — membuka BD-10, status pembayaran, dan gerbang produksi/pengiriman. **Milik domain Finance, bukan Sales.** *(Sebelumnya tercatat sebagai pembuka penyelesaian Sales Order — itu keliru dan dikoreksi.)*
3. **AD-03** — keputusan, bukan pembangunan. Membuka amandemen SO.
4. **INF-28** — pemulihan pencadangan. Butuh satu ruang basis data sekali pakai; **keputusan biaya pemilik produk**.
5. **SEC-20 / SEC-22 / AUD-50** — utang keamanan & jejak di luar Sales.
6. Kapabilitas Sales berikutnya: Quotation · Kode produk pelanggan · Amandemen SO · Komplain/Retur · Sample · Contract.

## Cara membaca berkas ini

Angka di sini **diukur**, bukan diingat. "Terbangun" dan "terpakai" **dibedakan sengaja**:
sebagian besar sistem sudah terbangun dan belum terpakai, sehingga setiap klaim "bekerja"
hari ini bersandar pada **test**, bukan pada pemakaian di lantai produksi.
