-- Migration: keterangan asal-usul standard_yield_qty di boms -- pemilik produk
-- bingung membaca "56.6667 pcs" tanpa konteks (terlihat seperti salah hitung,
-- padahal itu rata-rata standar yang benar). Perbaikan TERTARGET (bukan sistem
-- provenance generik untuk semua angka -- itu inisiatif terpisah/lebih besar),
-- ongkosnya kecil: 2 kolom nullable, pola sama persis dengan production_standards.source.
alter table boms add column if not exists standard_yield_basis_note text;
alter table boms add column if not exists standard_yield_source text check (standard_yield_source in ('ESTIMASI_MANUAL', 'DIPELAJARI'));

comment on column boms.standard_yield_basis_note is 'Penjelasan asal angka standard_yield_qty, mis. "10.000 g adonan x yield 85% / 2,5 g per gummy / 60 gummy per botol" -- nullable, diisi manual saat BOM dibuat/diedit lewat form resmi.';
comment on column boms.standard_yield_source is 'ESTIMASI_MANUAL (dihitung manual, belum dari data batch nyata) atau DIPELAJARI (dari rata-rata N batch aktual) -- pola sama dengan production_standards.source (K8).';
