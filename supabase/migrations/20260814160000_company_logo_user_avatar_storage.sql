-- Migration: companies.logo_url, users.avatar_url + Supabase Storage bucket untuk
-- keduanya (lihat docs/rancangan-skema-database-mrp.md > companies & users).
-- Dua bucket TERPISAH (bukan 1 bucket campur) supaya kebijakan akses beda bisa
-- dipisah jelas: logo dikelola company_admin (sama seperti Data Perusahaan lain,
-- lihat updateCompany.ts yang sudah restrict company_admin-only, BUKAN termasuk
-- general_manager), avatar dikelola user itu sendiri untuk foto dirinya sendiri.
-- Kedua bucket PUBLIC (read) karena logo & foto profil bukan data sensitif dan
-- dipakai untuk ditampilkan langsung lewat <img src> tanpa signed URL — tapi
-- WRITE (insert/update/delete) tetap dibatasi RLS di storage.objects, konsisten
-- dengan prinsip #1 CLAUDE.md (RLS di database, bukan cuma filter di kode).

alter table if exists companies add column if not exists logo_url text;
alter table if exists users add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('user-avatars', 'user-avatars', true)
on conflict (id) do nothing;

-- company-logos: path wajib berformat "{company_id}/nama-file", supaya folder
-- pertama bisa dicocokkan ke jwt_company_id() milik uploader.
drop policy if exists company_logos_public_read on storage.objects;
create policy company_logos_public_read on storage.objects
  for select using (bucket_id = 'company-logos');

drop policy if exists company_logos_admin_write on storage.objects;
create policy company_logos_admin_write on storage.objects
  for insert to authenticated with check (
    bucket_id = 'company-logos'
    and public.jwt_app_role() = 'company_admin'
    and (storage.foldername(name))[1] = public.jwt_company_id()::text
  );

drop policy if exists company_logos_admin_update on storage.objects;
create policy company_logos_admin_update on storage.objects
  for update to authenticated using (
    bucket_id = 'company-logos'
    and public.jwt_app_role() = 'company_admin'
    and (storage.foldername(name))[1] = public.jwt_company_id()::text
  ) with check (
    bucket_id = 'company-logos'
    and public.jwt_app_role() = 'company_admin'
    and (storage.foldername(name))[1] = public.jwt_company_id()::text
  );

drop policy if exists company_logos_admin_delete on storage.objects;
create policy company_logos_admin_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'company-logos'
    and public.jwt_app_role() = 'company_admin'
    and (storage.foldername(name))[1] = public.jwt_company_id()::text
  );

-- user-avatars: path wajib berformat "{auth.uid()}/nama-file", supaya folder
-- pertama bisa dicocokkan ke identitas auth Supabase si uploader sendiri saja.
drop policy if exists user_avatars_public_read on storage.objects;
create policy user_avatars_public_read on storage.objects
  for select using (bucket_id = 'user-avatars');

drop policy if exists user_avatars_owner_write on storage.objects;
create policy user_avatars_owner_write on storage.objects
  for insert to authenticated with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists user_avatars_owner_update on storage.objects;
create policy user_avatars_owner_update on storage.objects
  for update to authenticated using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists user_avatars_owner_delete on storage.objects;
create policy user_avatars_owner_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
