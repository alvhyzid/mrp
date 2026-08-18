-- Data-fix (BUKAN perubahan skema): shipment_id 181 (SJ-007/8-ITM/2026) sempat
-- "kotor" akibat pengujian keamanan upload POD (Sesi 3 lanjutan) — sengaja mengirim
-- file teks yang menyamar sebagai foto lewat endpoint publik /api/pod/[token]/confirm
-- untuk membuktikan gap validasi Content-Type (sebelum diperbaiki di confirmDelivery.ts
-- dengan pengecekan magic bytes). Uji itu berhasil lolos (sebelum fix) dan membuat
-- shipment ini benar-benar berpindah ke 'delivered' dengan bukti penerimaan palsu.
--
-- Baris delivery_confirmations palsu sudah dihapus lewat service-role (bukan di sini).
-- Migrasi ini HANYA mengembalikan shipments.status ke 'shipped' dan MENERBITKAN
-- pod_token BARU (bukan reuse token lama) — token lama sudah "terbakar" karena sempat
-- terpakai, sesuai desain confirm_delivery() sendiri yang menolak token yang sudah
-- tidak berstatus 'shipped'. Dilingkupi seketat mungkin (1 shipment_id spesifik).
--
-- Trigger enforce_status_transition menolak delivered->shipped secara sengaja (status
-- machine searah untuk kebutuhan traceability BPOM/halal) — dinonaktifkan SEMENTARA,
-- hanya untuk 1 statement koreksi ini, lalu diaktifkan kembali (CLI supabase db push
-- sudah membungkus tiap file migrasi dalam 1 transaksi sendiri, jadi tidak perlu
-- begin/commit eksplisit di sini — mengikuti pola semua migrasi lain di repo ini).
alter table shipments disable trigger enforce_status_transition;

update shipments
set status = 'shipped', pod_token = gen_random_uuid()::text
where shipment_id = 181 and shipment_number = 'SJ-007/8-ITM/2026';

alter table shipments enable trigger enforce_status_transition;
