-- Migration SUSULAN (ditulis 16 Agu 2026, Sesi 2A "Uji Rebuild-from-Migrations")
-- untuk companies/users/subscription_plans + fungsi terkait — objek-objek ini
-- SUDAH ADA dan dipakai sejak migrasi paling awal yang tercatat di repo
-- (20260811110000 sudah langsung ALTER TABLE users dan mereferensikan companies),
-- tapi TIDAK PERNAH ada file migrasi yang benar-benar membuatnya. Berarti dibuat
-- manual lewat Supabase Dashboard saat fondasi SaaS pertama kali disiapkan
-- (CLAUDE.md "Tugas Pertama — Fase 3 Roadmap"), sebelum disiplin migrasi-lewat-
-- file diterapkan konsisten.
--
-- Ditempatkan dengan timestamp SEBELUM 20260811110000 (bukan di akhir daftar
-- migrasi) supaya urutan eksekusi migrasi dari nol benar secara dependency —
-- migrasi 20260811110000 dan seterusnya butuh companies/users sudah ada.
--
-- Bentuk kolom di sini adalah bentuk AWAL/BASELINE (sebelum migrasi-migrasi
-- berikutnya mengubahnya) — logo_url/avatar_url, drop password_hash, dst SUDAH
-- ditangani migrasi yang sudah ada (20260811110000, 20260811130000,
-- 20260814160000) dan TIDAK diduplikasi di sini. Definisi diambil APA ADANYA
-- dari query pg_catalog/information_schema langsung ke database dev yang
-- sedang berjalan (bukan tebakan/rekonstruksi dari dokumentasi).
--
-- Urutan statement di bawah SENGAJA tabel dulu baru fungsi/policy yang
-- merujuknya — function berbahasa SQL (bukan plpgsql) divalidasi Postgres
-- terhadap katalog SAAT DIBUAT, jadi is_super_admin_user() gagal dibuat kalau
-- ditulis sebelum tabel users ada (ditemukan lewat percobaan langsung).

create table if not exists subscription_plans (
  subscription_plan_id serial primary key,
  name text not null,
  price numeric(12,2) not null,
  billing_cycle text not null,
  max_users integer not null,
  max_items integer not null,
  created_at timestamptz not null default now()
);

alter table if exists subscription_plans enable row level security;

create table if not exists companies (
  company_id serial primary key,
  name text not null,
  industry_type text not null,
  subscription_plan_id integer references subscription_plans(subscription_plan_id),
  status text not null default 'trial',
  created_at timestamptz not null default now()
);

alter table if exists companies enable row level security;

drop policy if exists companies_select_for_company on companies;
create policy companies_select_for_company on companies
  for select using (company_id = (auth.jwt() ->> 'company_id')::integer);

drop policy if exists companies_update_for_company on companies;
create policy companies_update_for_company on companies
  for update using (company_id = (auth.jwt() ->> 'company_id')::integer)
  with check (company_id = (auth.jwt() ->> 'company_id')::integer);

-- companies_insert_admin: versi AWAL yang longgar ("to public with check (true)"),
-- sesuai jejak komentar di 20260811130000 ("selama policy insert masih 'to public
-- with check (true)'...") — migrasi itu (yang sudah ada, tidak diubah di sini)
-- langsung memperketatnya begitu jalan.
drop policy if exists companies_insert_admin on companies;
create policy companies_insert_admin on companies
  for insert with check (true);

-- users: bentuk AWAL termasuk password_hash NOT NULL (skema awal sebelum auth
-- sepenuhnya diserahkan ke Supabase Auth) — migrasi 20260811110000 langsung
-- melonggarkannya jadi nullable, lalu 20260811130000 menghapusnya total. Kedua
-- migrasi itu SUDAH ADA dan tidak diduplikasi di sini.
create table if not exists users (
  user_id serial primary key,
  company_id integer not null references companies(company_id),
  name text not null,
  email text not null unique,
  password_hash text not null,
  auth_uid text,
  role text not null default 'company_admin',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create unique index if not exists users_auth_uid_idx on users (auth_uid);

alter table if exists users enable row level security;

drop policy if exists users_select_for_company on users;
create policy users_select_for_company on users
  for select using (company_id = (auth.jwt() ->> 'company_id')::integer);

drop policy if exists users_insert_for_company on users;
create policy users_insert_for_company on users
  for insert with check (company_id = (auth.jwt() ->> 'company_id')::integer);

drop policy if exists users_update_for_company on users;
create policy users_update_for_company on users
  for update using (company_id = (auth.jwt() ->> 'company_id')::integer)
  with check (company_id = (auth.jwt() ->> 'company_id')::integer);

drop function if exists public.is_super_admin_user(text);
create function public.is_super_admin_user(current_auth_uid text)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.users
    where auth_uid = current_auth_uid
      and role = 'super_admin'
      and status = 'active'
  );
$$;

grant execute on function public.is_super_admin_user(text) to authenticated;

drop policy if exists subscription_plans_select_auth on subscription_plans;
create policy subscription_plans_select_auth on subscription_plans
  for select using (auth.role() = 'authenticated');

drop policy if exists subscription_plans_insert_super_admin on subscription_plans;
create policy subscription_plans_insert_super_admin on subscription_plans
  for insert with check (public.is_super_admin_user(auth.uid()::text));

drop policy if exists subscription_plans_update_super_admin on subscription_plans;
create policy subscription_plans_update_super_admin on subscription_plans
  for update using (public.is_super_admin_user(auth.uid()::text))
  with check (public.is_super_admin_user(auth.uid()::text));

drop policy if exists subscription_plans_delete_super_admin on subscription_plans;
create policy subscription_plans_delete_super_admin on subscription_plans
  for delete using (public.is_super_admin_user(auth.uid()::text));

-- Event trigger keamanan: paksa RLS otomatis aktif untuk SETIAP tabel baru yang
-- dibuat di schema public, bahkan kalau migrasi/pembuat tabel lupa menulis
-- "enable row level security" secara eksplisit — lapisan pertahanan tambahan
-- konsisten dengan Prinsip Arsitektur #1 (RLS di database, bukan cuma filter
-- aplikasi). Ditemukan sudah aktif di database dev, tapi belum pernah tercatat
-- sebagai migrasi.
drop function if exists public.rls_auto_enable();
create function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();
