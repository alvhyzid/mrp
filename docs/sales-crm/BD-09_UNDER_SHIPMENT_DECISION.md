<!-- Dipindahkan dari SALES_CRM_DECISION_PROPOSALS.md pada 29 Agu 2026 atas permintaan
     §30 perintah eksekusi, yang meminta berkas bernama sendiri per keputusan.
     ISINYA DIPINDAHKAN, bukan disalin -- supaya tidak lahir dua sumber untuk satu keputusan. -->

# BD-09 — Toleransi kurang-kirim

## Problem
BD-01 mensyaratkan "kuantitas terpenuhi sesuai aturan pemenuhan". **Aturan itu belum ada.**

## Evidence
`sales_order_lines` punya `qty_ordered` dan `qty_shipped`. **Nol kolom toleransi**, nol
setelan, nol aturan di mana pun. `turunkanEksekusiSo()` hari ini memakai perbandingan
kaku: `qty_shipped >= qty_ordered` → penuh.

## Pilihan

| | Aturan | Untung | Rugi |
|---|---|---|---|
| **A** | kurang kirim = **belum selesai** | paling sederhana; nol data baru | order tersangkut selamanya karena selisih 0,5 kg |
| **B** | toleransi **satu angka** berlaku umum | menutup kasus nyata dengan satu setelan | tidak bisa berbeda antar produk |
| **C** | toleransi **per produk / pelanggan / order** | paling luwes | butuh tabel/kolom baru + layar pengaturannya |
| **D** | sisa jadi **komitmen terbuka** | jujur secara komersial | butuh entitas komitmen; paling berat |

## Dampak lintas domain
Sales (kapan order tutup) · Logistics (kapan berhenti mengirim) · PPIC (apakah sisa masih
dijadwalkan) · Finance (apa yang ditagih) · pelaporan (arti "selesai" pada seluruh grafik).

## Yang WAJIB diketahui sebelum memilih
Opsi C dan D **menambah struktur data**; opsi A dan B tidak. Dan menurut pengalaman proyek
ini, setelan yang tidak punya layar pengaturannya **tidak akan pernah bisa diubah tenant
kedua** — jadi opsi C berarti sekaligus membangun layarnya.

## Rekomendasi
**Tidak diberikan.** Ini murni aturan bisnis: berapa selisih yang PT Indo Taste anggap
"sudah terkirim". **MENUNGGU KEPUTUSAN PEMILIK PRODUK.**

---
