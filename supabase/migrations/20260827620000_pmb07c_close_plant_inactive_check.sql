-- PMB-07c ditutup. Arkeologi (22 Agu 2026) menemukan sebagian besar sudah
-- ada sejak awal: production_plant_id SUDAH kolom wajib di purchase_orders,
-- SUDAH divalidasi ada & satu company di createPurchaseOrder.ts, SUDAH
-- ditampilkan di kolom "Lokasi" pada daftar PO Supplier. Satu-satunya celah
-- nyata: plant yang is_active=false MASIH BISA dipilih & lolos ke server.
-- Ditambal 2 lapis: (1) server createPurchaseOrder.ts menolak dengan pesan
-- jelas menyebut nama plant kalau is_active=false; (2) dropdown Lokasi
-- Pabrik di modal Buat PO (PurchasingPage.tsx) memfilter plant nonaktif
-- supaya tidak bisa dipilih sama sekali di UI (bukan cuma ditolak belakangan).
-- BUKTI: tests/pmb07a_identity_snapshot.test.ts ("PMB-07c: PO Supplier ke
-- plant yang tidak aktif") -> 400, pesan menyebut nama plant persis + kata
-- "tidak aktif". Diverifikasi juga visual di company.b@debug.mrp: 1 plant
-- aktif + 1 nonaktif dibuat, dropdown modal Buat PO HANYA menampilkan yang
-- aktif (screenshot dicek), fixture dibersihkan total sesudahnya (0 sisa
-- dikonfirmasi lewat debug_company_residual_scan).
-- CATATAN JUJUR (bukan bagian scope task ini): aplikasi belum punya halaman
-- cetak/dokumen PO Supplier tersendiri (beda dari Surat Jalan yang sudah
-- ada) -- "dicetak jelas di dokumen PO" di deskripsi awal task masih
-- aspirasional, bukan sesuatu yang bisa dibuktikan hari ini karena dokumen
-- cetaknya sendiri belum ada. Nama plant sudah tampil jelas di kolom
-- "Lokasi" pada daftar PO Supplier.
update public.build_tasks
set status = 'selesai', completed_at = now(),
    detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDITUTUP 22 Agu 2026: production_plant_id sudah wajib+tervalidasi+tertampil sejak sebelumnya (arkeologi). Celah nyata satu-satunya (5.3, plant nonaktif bisa dipilih) ditambal server (createPurchaseOrder.ts) + UI (dropdown difilter). Bukti test + visual company.b@debug.mrp, fixture dibersihkan. Dokumen cetak PO Supplier sendiri belum ada di aplikasi -- di luar cakupan task ini, dicatat jujur bukan diklaim selesai.'
where task_code = 'PMB-07c';
