-- Migration: Update RLS to use company_id from custom access token JWT claims

alter table if exists companies enable row level security;
alter table if exists users enable row level security;

drop policy if exists companies_select_for_company on companies;
drop policy if exists users_select_for_company on users;
drop policy if exists companies_insert_admin on companies;
drop policy if exists users_insert_for_company on users;

drop policy if exists companies_update_for_company on companies;
drop policy if exists users_update_for_company on users;

create policy companies_select_for_company on companies
  for select using (company_id = (auth.jwt() ->> 'company_id')::integer);

create policy companies_update_for_company on companies
  for update using (company_id = (auth.jwt() ->> 'company_id')::integer)
  with check (company_id = (auth.jwt() ->> 'company_id')::integer);

create policy companies_insert_admin on companies
  for insert with check (true);

create policy users_select_for_company on users
  for select using (company_id = (auth.jwt() ->> 'company_id')::integer);

create policy users_update_for_company on users
  for update using (company_id = (auth.jwt() ->> 'company_id')::integer)
  with check (company_id = (auth.jwt() ->> 'company_id')::integer);

create policy users_insert_for_company on users
  for insert with check (company_id = (auth.jwt() ->> 'company_id')::integer);
