-- MST-17 — Dokumen pada Item (COA, Sertifikat Halal, BPOM). KETIGANYA OPSIONAL.
--
-- Alasan bisnis (pemilik produk): seluruh dokumen ini diminta saat proses pengurusan
-- BPOM, jadi harus bisa dilampirkan ke bahannya. Bukan syarat — item tetap bisa
-- disimpan tanpa dokumen apa pun, karena banyak bahan memang tidak punya.
--
-- ============================================================================
-- TIDAK ADA KOLOM BARU, DAN ITU DISENGAJA.
--
-- Versi pertama migrasi ini menambahkan `documents.related_item_id`. Itu SALAH:
-- tabel `document_links` (document_id, entity_type, entity_id, link_role) SUDAH ADA,
-- sudah punya kebijakan RLS, dan `uploadDocument` bahkan SUDAH menuliskan barisnya
-- bila pemanggil mengirim entity_type/entity_id/link_role. Menambah kolom sendiri
-- berarti membuat JALUR KEDUA untuk hubungan yang sama — dan begitu ada dua jalur,
-- cepat atau lambat keduanya berselisih dan tidak ada yang tahu mana yang benar.
--
-- Jadi MST-17 memakai yang sudah ada:
--   entity_type = 'items', entity_id = item_id, link_role = 'COA' | 'SERTIFIKAT_HALAL' | 'BPOM'
--
-- Ketahuan sebelum kolomnya sempat dibuat, dengan membaca uploadDocument.ts sampai
-- habis alih-alih berhenti di bagian yang kelihatan relevan.
-- ============================================================================

-- Satu indeks supaya "dokumen apa saja yang menempel di item ini" tidak memindai
-- seluruh tabel begitu jumlah dokumennya bertambah.
create index if not exists document_links_entity_idx on document_links(company_id, entity_type, entity_id);

-- ============================================================================
-- Mendaftarkan jenis dokumen untuk PT ITM.
--
-- TEMUAN YANG DITEMUKAN SAAT MEMBANGUN MST-17, dan ini sebabnya bagian ini ada:
-- ke-9 jenis dokumen yang terdaftar semuanya milik company_id = 2 (Company B, tenant
-- uji), sementara PT ITM (company_id = 1) — pemilik SELURUH 9 item nyata — tidak punya
-- satu pun. Karena uploadDocument menolak doc_type yang tidak terdaftar di perusahaan
-- pemanggil, fitur dokumen sudah terbangun tapi TIDAK BISA DIPAKAI oleh tenant yang
-- sebenarnya. Tanpa baris di bawah, MST-17 akan selesai dibangun dan tetap gagal
-- dipakai pada percobaan pertama.
--
-- Yang didaftarkan HANYA tiga yang diminta pemilik produk untuk item. Jenis lain
-- (SOP, kontrak, surat jalan) TIDAK ikut didaftarkan di sini — itu keputusan terpisah
-- yang belum diminta, dan menebaknya berarti mengarang kebijakan dokumen perusahaan.
--
-- requires_expiry: sertifikat halal dan izin BPOM memang punya masa berlaku dan harus
-- diperbarui; COA melekat pada satu batch bahan dan tidak "kedaluwarsa" dengan cara
-- yang sama, jadi tidak diwajibkan.
--
-- CATATAN PENTING soal dua kolom yang SENGAJA dikosongkan:
--
-- `retention_months` (berapa lama dokumen disimpan sebelum boleh dimusnahkan) adalah
-- KEBIJAKAN PERUSAHAAN, bukan keputusan teknis. Versi pertama migrasi ini mengisinya
-- 60 dan 120 bulan — angka yang saya karang sendiri. Itu salah: retensi dokumen
-- kepatuhan punya konsekuensi hukum, dan jenis dokumen yang sudah ada di perusahaan
-- lain pun membiarkannya kosong. Dibiarkan NULL sampai pemilik produk menentukannya.
--
-- `reminder_days_before` bertipe LARIK angka (mis. {90,60,30} = diingatkan 90, 60, dan
-- 30 hari sebelum kedaluwarsa), bukan satu angka. Ketahuan saat migrasi versi pertama
-- ditolak database. Nilainya mengikuti pola yang sudah dipakai Sertifikat Halal di
-- perusahaan lain, bukan angka baru.
insert into document_types (company_id, code, name, owner_role, sensitivity_default, requires_expiry, retention_months, reminder_days_before)
select 1, d.code, d.name, d.owner_role, 'UMUM', d.requires_expiry, null::integer, d.reminder
from (values
  ('COA', 'COA Bahan (Vendor)', 'purchasing', false, null::integer[]),
  ('SERTIFIKAT_HALAL', 'Sertifikat Halal', 'purchasing', true, array[90, 60, 30]),
  ('BPOM', 'Izin Edar BPOM', 'purchasing', true, array[90, 60, 30])
) as d(code, name, owner_role, requires_expiry, reminder)
where not exists (
  select 1 from document_types dt where dt.company_id = 1 and dt.code = d.code
);
