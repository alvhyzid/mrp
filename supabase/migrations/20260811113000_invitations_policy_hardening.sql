-- Harden invitations RLS policies:
-- 1) company_admin can manage invitations only within their own company_id
-- 2) invitee can read only their own pending invitation by matching token header

alter table if exists invitations enable row level security;

drop policy if exists invitations_select_for_company on invitations;
drop policy if exists invitations_insert_for_company on invitations;
drop policy if exists invitations_update_for_company on invitations;

drop policy if exists invitations_select_for_company_admin on invitations;
create policy invitations_select_for_company_admin on invitations
  for select
  to authenticated
  using (
    (auth.jwt() ->> 'app_role') = 'company_admin'
    and company_id = (auth.jwt() ->> 'company_id')::integer
  );

drop policy if exists invitations_insert_for_company_admin on invitations;
create policy invitations_insert_for_company_admin on invitations
  for insert
  to authenticated
  with check (
    (auth.jwt() ->> 'app_role') = 'company_admin'
    and company_id = (auth.jwt() ->> 'company_id')::integer
  );

drop policy if exists invitations_update_for_company_admin on invitations;
create policy invitations_update_for_company_admin on invitations
  for update
  to authenticated
  using (
    (auth.jwt() ->> 'app_role') = 'company_admin'
    and company_id = (auth.jwt() ->> 'company_id')::integer
  )
  with check (
    (auth.jwt() ->> 'app_role') = 'company_admin'
    and company_id = (auth.jwt() ->> 'company_id')::integer
  );

drop policy if exists invitations_select_for_invitee_by_token on invitations;
create policy invitations_select_for_invitee_by_token on invitations
  for select
  to authenticated
  using (
    lower(email) = lower(coalesce(auth.email(), ''))
    and status = 'pending'
    and token = (
      coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-invitation-token'
    )
  );
