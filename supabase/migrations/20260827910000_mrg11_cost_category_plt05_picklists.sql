-- MRG-11 (Bagian 6) -- lapisan DATA & SERVER untuk penggolongan biaya tenaga
-- kerja (DIRECT / MANUFACTURING_OVERHEAD / GENERAL_ADMINISTRATIVE), bertanggal
-- berlaku (terkait HR-05), riwayat append-only. TIDAK ADA layar dibangun --
-- menunggu cetakan UX. TIDAK ADA golongan karyawan mana pun ditetapkan di
-- migrasi ini -- itu keputusan pemilik produk (Finance), bukan Claude Code.
create table if not exists employee_cost_category_history (
  employee_cost_category_history_id serial primary key,
  company_id integer not null references companies(company_id),
  employee_id integer not null references employees(employee_id),
  cost_category text not null check (cost_category in ('direct', 'manufacturing_overhead', 'general_administrative')),
  effective_from date not null,
  effective_to date,
  set_by integer references users(user_id),
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists employee_cost_category_history_lookup_idx
  on employee_cost_category_history (employee_id, effective_from desc);

alter table employee_cost_category_history enable row level security;

-- Baca (6.1/C.4): Finance & leadership baca lengkap; HRD baca golongan saja
-- lewat kolom yang sama (tabel ini TIDAK memuat gaji/data pribadi sama sekali
-- -- cuma employee_id+golongan+tanggal+alasan, jadi aman dibaca siapa pun yang
-- berwenang lihat data kepegawaian).
drop policy if exists employee_cost_category_history_select on employee_cost_category_history;
create policy employee_cost_category_history_select on employee_cost_category_history
  for select using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_can_view_financial_data() or public.jwt_app_role() = 'hr_manager')
  );

-- Tulis (C.4 final): HANYA Finance yang menetapkan langsung -- TIDAK ADA
-- jalur "HRD mengusulkan" (ditolak eksplisit, lihat catatan build_tasks
-- MRG-11). insert-only lewat RLS (riwayat APPEND-ONLY, C.2/6.6) -- baris lama
-- ditutup lewat UPDATE effective_to (satu-satunya UPDATE yang diizinkan,
-- TIDAK BOLEH mengubah kolom lain).
drop policy if exists employee_cost_category_history_insert on employee_cost_category_history;
create policy employee_cost_category_history_insert on employee_cost_category_history
  for insert with check (
    company_id = public.jwt_company_id()
    and (public.jwt_can_view_financial_data() or public.jwt_is_company_leadership())
  );

drop policy if exists employee_cost_category_history_close_period on employee_cost_category_history;
create policy employee_cost_category_history_close_period on employee_cost_category_history
  for update using (
    company_id = public.jwt_company_id()
    and (public.jwt_can_view_financial_data() or public.jwt_is_company_leadership())
  ) with check (
    company_id = public.jwt_company_id()
    and (public.jwt_can_view_financial_data() or public.jwt_is_company_leadership())
  );

revoke all on employee_cost_category_history from public, anon, authenticated;
grant select, insert, update on employee_cost_category_history to authenticated;
grant all on employee_cost_category_history to service_role;

-- Fungsi bantu: golongan biaya karyawan PADA TANGGAL TERTENTU (default hari
-- ini) -- dipakai perhitungan biaya SDM (MRG-10/MRG-06) begitu direkonsiliasi,
-- BUKAN dipanggil di migrasi ini.
create or replace function public.get_employee_cost_category(p_employee_id integer, p_as_of date default current_date)
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select cost_category
  from employee_cost_category_history
  where employee_id = p_employee_id
    and effective_from <= p_as_of
    and (effective_to is null or effective_to >= p_as_of)
  order by effective_from desc
  limit 1;
$$;

revoke all on function public.get_employee_cost_category(integer, date) from public, anon, authenticated;
grant execute on function public.get_employee_cost_category(integer, date) to authenticated, service_role;

-- PLT-05 -- Daftar Pilihan Milik Tenant, lapisan DATA saja. Generik lintas
-- konteks (Produksi/Gudang/Dokumen/dst) -- satu tabel menutup semua daripada
-- lahir tabel enum terpisah tiap kali ada kebutuhan baru.
create table if not exists tenant_picklists (
  tenant_picklist_id serial primary key,
  company_id integer not null references companies(company_id),
  context text not null,
  code text not null,
  display_name text not null,
  sort_order integer not null default 0,
  archived_at timestamptz,
  archived_by integer references users(user_id),
  created_at timestamptz not null default now(),
  unique (company_id, context, code)
);

create index if not exists tenant_picklists_context_idx on tenant_picklists (company_id, context, sort_order) where archived_at is null;

alter table tenant_picklists enable row level security;

drop policy if exists tenant_picklists_select on tenant_picklists;
create policy tenant_picklists_select on tenant_picklists
  for select using (company_id = public.jwt_company_id());

-- Hak akses tulis SENGAJA BELUM digerbang per-konteks (7.2/pertanyaan
-- terbuka F "siapa boleh menambah/mengubah" -- kemungkinan beda per konteks,
-- menunggu keputusan pemilik produk) -- untuk sekarang leadership+admin bisa
-- kelola SEMUA konteks; penyempitan per-konteks menyusul begitu dijawab.
drop policy if exists tenant_picklists_write on tenant_picklists;
create policy tenant_picklists_write on tenant_picklists
  for all using (
    company_id = public.jwt_company_id() and public.jwt_is_company_leadership()
  ) with check (
    company_id = public.jwt_company_id() and public.jwt_is_company_leadership()
  );

revoke all on tenant_picklists from public, anon, authenticated;
grant select, insert, update, delete on tenant_picklists to authenticated;
grant all on tenant_picklists to service_role;
