-- Migration: Create companies, users, subscription_plans tables for multi-tenant MRP

create table if not exists subscription_plans (
  subscription_plan_id serial primary key,
  name text not null,
  price numeric(12,2) not null,
  billing_cycle text not null,
  max_users integer not null,
  max_items integer not null,
  created_at timestamptz not null default now()
);

create table if not exists companies (
  company_id serial primary key,
  name text not null,
  industry_type text not null,
  subscription_plan_id integer references subscription_plans(subscription_plan_id),
  status text not null default 'trial',
  created_at timestamptz not null default now()
);

create table if not exists users (
  user_id serial primary key,
  company_id integer references companies(company_id),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'company_admin',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table if exists companies enable row level security;
alter table if exists users enable row level security;

create policy if not exists companies_select_for_company on companies
  for select using (company_id = current_setting('app.current_company_id')::integer);

create policy if not exists users_select_for_company on users
  for select using (company_id = current_setting('app.current_company_id')::integer);

create policy if not exists companies_insert_admin on companies
  for insert with check (true);

create policy if not exists users_insert_for_company on users
  for insert with check (company_id = current_setting('app.current_company_id')::integer);
