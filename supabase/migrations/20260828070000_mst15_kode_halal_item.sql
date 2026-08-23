-- MST-15 / B.3 — Kode Halal pada master item.
--
-- Alasan bisnis (dari pemilik produk): saat mengurus BPOM, dokumen yang diminta
-- selalu sepasang — nomor registrasi BPOM DAN nomor sertifikat halal. Selama ini
-- hanya nomor BPOM yang punya tempat di sistem, sehingga nomor halal disimpan di
-- luar sistem dan harus dicari ulang tiap kali dibutuhkan.
--
-- Bentuknya kolom teks biasa, BUKAN tabel sertifikat tersendiri: yang dibutuhkan
-- sekarang cuma satu nomor per item, sama persis seperti nomor BPOM yang sudah ada
-- di sebelahnya. Bila kelak perlu menyimpan masa berlaku, lembaga penerbit, atau
-- riwayat perpanjangan, barulah pindah ke tabel sendiri — jangan dibangun sekarang
-- untuk kebutuhan yang belum ada.
--
-- OPSIONAL (nullable): item tetap bisa disimpan tanpa nomor halal. Banyak bahan baku
-- tidak punya sertifikat halal sendiri, dan memaksa kolom ini terisi akan membuat
-- master item tidak bisa dipakai.

alter table items add column if not exists halal_certificate_number text;

comment on column items.halal_certificate_number is
  'Nomor sertifikat halal item ini (MST-15/B.3). Opsional — banyak bahan tidak punya sertifikat sendiri. Sepasang dengan bpom_registration_number untuk keperluan pengurusan BPOM.';
