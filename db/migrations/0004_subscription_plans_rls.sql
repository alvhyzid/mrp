-- Migration: Add RLS policies for subscription_plans with super_admin enforcement

alter table if exists subscription_plans enable row level security;

-- Drop existing plans policies so the migration is safely repeatable.
drop policy if exists subscription_plans_select_auth on subscription_plans;
drop policy if exists subscription_plans_insert_super_admin on subscription_plans;
drop policy if exists subscription_plans_update_super_admin on subscription_plans;
drop policy if exists subscription_plans_delete_super_admin on subscription_plans;

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

grant execute on function public.is_super_admin_user(text) to public;

create policy subscription_plans_select_auth on subscription_plans
  for select using (auth.role() = 'authenticated');

create policy subscription_plans_insert_super_admin on subscription_plans
  for insert with check (public.is_super_admin_user(auth.uid()::text));

create policy subscription_plans_update_super_admin on subscription_plans
  for update using (public.is_super_admin_user(auth.uid()::text))
  with check (public.is_super_admin_user(auth.uid()::text));

create policy subscription_plans_delete_super_admin on subscription_plans
  for delete using (public.is_super_admin_user(auth.uid()::text));
