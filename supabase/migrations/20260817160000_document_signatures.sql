-- Migration: Tanda Tangan Digital (Sesi 1, rencana-kerja-playbook-ams.md) — fondasi
-- GENERIK dipakai ulang lintas jenis dokumen (dimulai dari Surat Jalan Sesi 2), lihat
-- docs/rancangan-skema-database-mrp.md > users.signature_url & document_signatures.
--
-- Pola upload MENYIMPANG SENGAJA dari users.avatar_url/companies.logo_url (migration
-- 20260814160000): avatar/logo pakai path TETAP + upsert:true (file lama TERTIMPA di
-- storage, cuma query-string cache-bust yang berubah) — untuk signature ini SALAH,
-- karena dokumen yang SUDAH ditandatangani harus tetap menunjukkan tanda tangan yang
-- berlaku SAAT itu meski user ganti tanda tangan belakangan. Jadi bucket ini pakai path
-- UNIK per upload (lihat uploadSignature.ts di app-layer), file lama TIDAK PERNAH ditimpa.

alter table if exists users add column if not exists signature_url text;

create table if not exists document_signatures (
  document_signature_id serial primary key,
  company_id integer not null references companies(company_id),
  document_type text not null,
  document_id integer not null,
  signed_by integer not null references users(user_id),
  signer_role_at_signing text not null,
  signature_url_snapshot text not null,
  confirmation_text text not null,
  signed_at timestamptz not null default now()
);

create index if not exists document_signatures_company_id_idx on document_signatures (company_id);
create index if not exists document_signatures_document_idx on document_signatures (document_type, document_id);

alter table if exists document_signatures enable row level security;

-- Baca: siapa saja di company yang sama (jejak audit, bukan data rahasia per-user) —
-- konsisten dengan status_transition_log yang juga select-only company-scoped.
drop policy if exists document_signatures_select_for_company on document_signatures;
create policy document_signatures_select_for_company on document_signatures
  for select using (company_id = public.jwt_company_id());

-- TIDAK ADA policy insert/update/delete untuk role authenticated biasa — semua
-- baris ditulis lewat service-role client di server (pola yang sama dipakai SETIAP
-- mutation lain di aplikasi ini, lihat createShipment.ts dkk), sekaligus mencegah
-- baris audit ini diubah/dihapus lewat jalur biasa.

-- user-signatures: bucket TERPISAH dari user-avatars (kebijakan retensi beda —
-- avatar boleh ditimpa, signature TIDAK BOLEH). Public read (sama seperti
-- avatar/logo — dipakai langsung lewat <img src> tanpa signed URL, termasuk nanti
-- dirender ke PDF Surat Jalan Sesi 2), write dibatasi ke folder milik auth.uid()
-- sendiri, pola sama persis dengan user-avatars.
insert into storage.buckets (id, name, public)
values ('user-signatures', 'user-signatures', true)
on conflict (id) do nothing;

drop policy if exists user_signatures_public_read on storage.objects;
create policy user_signatures_public_read on storage.objects
  for select using (bucket_id = 'user-signatures');

drop policy if exists user_signatures_owner_write on storage.objects;
create policy user_signatures_owner_write on storage.objects
  for insert to authenticated with check (
    bucket_id = 'user-signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists user_signatures_owner_update on storage.objects;
create policy user_signatures_owner_update on storage.objects
  for update to authenticated using (
    bucket_id = 'user-signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'user-signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- TIDAK ADA policy delete — sengaja, supaya file lama secara teknis TIDAK BISA
-- dihapus lewat jalur RLS authenticated biasa sama sekali (baik oleh pemiliknya
-- sendiri maupun orang lain), memaksa retensi permanen kecuali lewat service-role.
