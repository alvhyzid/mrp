# SALES_CRM_BUILD_TASK_RECONCILIATION

**Registry kanonik: `build_tasks`.** Nol registry paralel dibuat. Nol kode task baru dibuat.
Nol status task diubah.

## 31 task menyentuh Sales/CRM

| Kode | Status tercatat | Kenyataan terukur | Vonis |
|---|---|---|---|
| **SLS-00** | `ditunda_sadar` | keputusan strategis, mengikat seluruh SLS | **SESUAI** |
| **SLS-01..05** | `ditunda_sadar` | pemicunya **belum terpenuhi** (0 SO, 0 pengiriman) | **SESUAI** |
| SLS-90 | `ditunda_sadar` | daftar modul diparkir | **SESUAI** |
| **SLS-06** | `menunggu` | pemisahan tugas **sudah ditegakkan** lewat CHECK + UNIQUE + izin | **PERIKSA ULANG** — mungkin sudah selesai sebagian |
| SLS-07 | `menunggu` | nomor dari jumlah baris — **terkonfirmasi masih begitu** | **SESUAI** |
| **PJL-03** | `menunggu` | **terkonfirmasi**: nol kode mengubah status SO | **SESUAI — P1** |
| PJL-01, PJL-02 | `selesai` | alur PO→SO dan halaman SO memang ada | **SESUAI** |
| **AUD-19 (SD-12)** | `menunggu` | harga **disalin** ke SO saat dibuat, dan **nol kode** bisa mengubahnya | **USANG SEBAGIAN** — beku *de facto*, belum beku *de jure* |
| AUD-18 (SD-11) | `menunggu` | konfigurasi pelanggan belum ada, jadi belum bisa memutasi apa pun | **SESUAI** — kosong, bukan terbukti |
| PMB-03 | `menunggu_persetujuan` | CRUD pelanggan & supplier terlihat lengkap | **PERIKSA ULANG** |
| PMB-07a, PMB-07b | `selesai` | snapshot identitas & alamat kirim **ada di skema** | **SESUAI** |
| PMB-08 | `menunggu` | form tambah client masih di dalam modal PO | **SESUAI** |
| PMB-09 | `menunggu` | halaman pelanggan tanpa riwayat order | **SESUAI** |

## Dua yang perlu diperiksa ulang

1. **AUD-19** — rumusannya *"harga belum dibekukan"* tidak lagi menggambarkan keadaan: harga
   **disalin** ke `sales_order_lines` saat SO dibuat, dan penyisiran seluruh repositori
   menemukan **nol** kode yang bisa mengubahnya. Yang tersisa: ketiadaan itu **kebetulan**
   (tidak ada penulis), bukan **dijaga** (tidak ada constraint/versi). Kelas yang sama persis
   dengan `SD-3/4/5` — *"kosong, bukan terbukti"*.
2. **SLS-06** — pemisahan tugas tiga departemen tampak sudah ditegakkan di basis data.
   Perlu diverifikasi apakah task ini masih terbuka karena bagian lain.

**Keduanya keputusan pemilik task, bukan milik saya untuk diubah.**
