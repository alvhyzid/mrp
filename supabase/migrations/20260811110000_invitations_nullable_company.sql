-- Migration: Make users.company_id nullable and add invitations table for company invites

alter table if exists users
  alter column company_id drop not null;

alter table if exists users
  alter column password_hash drop not null;

create table if not exists invitations (
  invitation_id serial primary key,
  company_id integer not null references companies(company_id),
  email text not null,
  role text not null default 'production_staff',
  invited_by integer not null references users(user_id),
  status text not null default 'pending',
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

alter table if exists invitations enable row level security;

drop policy if exists invitations_select_for_company on invitations;
create policy invitations_select_for_company on invitations
  for select using (company_id = (auth.jwt() ->> 'company_id')::integer);

drop policy if exists invitations_insert_for_company on invitations;
create policy invitations_insert_for_company on invitations
  for insert with check (company_id = (auth.jwt() ->> 'company_id')::integer);

drop policy if exists invitations_update_for_company on invitations;
create policy invitations_update_for_company on invitations
  for update using (company_id = (auth.jwt() ->> 'company_id')::integer)
  with check (company_id = (auth.jwt() ->> 'company_id')::integer);
