# SALES_CRM_RISK_REGISTER

| ID | Risiko | Kemungkinan | Dampak | Bukti | Mitigasi |
|---|---|---|---|---|---|
| **RS-01** | Sales Order tampak "dikonfirmasi" selamanya; orang berhenti mempercayai statusnya | **TINGGI** | **TINGGI** | nol kode mengubah status | PJL-03 + penjaga |
| **RS-02** | Audit komersial tanpa data historis — perilaku nyata hanya bisa disimpulkan dari kode | TINGGI | SEDANG | 0 SO, 0 pengiriman | sebutkan batasnya di tiap kesimpulan |
| **RS-03** | Kompensasi manual gagal → Sales Order tanpa baris, dan `UNIQUE` menolak percobaan ulang | RENDAH | **TINGGI** | `processCustomerPurchaseOrder.ts:169` | jadikan satu transaksi |
| **RS-04** | Harga SO beku **kebetulan**, bukan dijaga — fitur ubah SO di masa depan akan membukanya tanpa ada yang berbunyi | SEDANG | **TINGGI** | nol penulis `unit_price` | constraint/versi + penjaga (AUD-19) |
| **RS-05** | SD-3/4/5 "kosong, bukan terbukti" — begitu peran `sales` atau reservasi lahir, aturannya langsung berlaku tanpa penjaga | SEDANG | TINGGI | `CLAUDE.md` §SD | penjaga lahir bersama fiturnya |
| **RS-06** | `sales_order_lines` RLS tanpa kebijakan — pembacaan langsung dari klien akan gagal diam-diam kelak | RENDAH | SEDANG | pg_policy = 0 | samakan dengan sembilan tabel lain |
| **RS-07** | Dua dokumen arsitektur (v0.1 & tinjauan) bisa dibaca terbalik oleh sesi berikutnya | SEDANG | TINGGI | dua berkas | hierarki ditulis di rencana kerja |
| **RS-08** | Membangun lapisan Sales baru sebelum satu order tuntas berarti membangun di atas alur yang belum pernah terbukti | **TINGGI** | **TINGGI** | pemicu SLS-01 | BL-01 / DEC-S01 |
