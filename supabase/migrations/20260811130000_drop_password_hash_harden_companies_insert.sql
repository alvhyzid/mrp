-- 1) Drop password_hash: password sepenuhnya dikelola Supabase Auth, tidak pernah dibaca
--    di kode aplikasi (hanya ditulis '' saat insert). Kolom ini murni sisa dari skema awal.
alter table if exists users
  drop column if exists password_hash;

-- 2) Perketat companies_insert_admin.
--    Catatan: alur registrasi saat ini (app/api/register/route.ts) melakukan insert ke
--    companies lewat service-role client, yang selalu melewati RLS. Jadi policy ini tidak
--    dipakai oleh alur signup yang ada sekarang. Tapi anon key bersifat publik (dipakai di
--    client), jadi selama policy insert masih "to public with check (true)", siapa pun yang
--    tahu anon key bisa insert row companies sembarangan langsung lewat REST API Supabase.
--    Perketat sebagai defense-in-depth: batasi ke role authenticated, dan cegah user yang
--    sudah tergabung di sebuah company (company_id di baris users miliknya sudah terisi)
--    membuat company lain.

drop function if exists public.user_has_no_company(text);

create function public.user_has_no_company(current_auth_uid text)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
as $$
  select not exists (
    select 1
    from public.users
    where auth_uid = current_auth_uid
      and company_id is not null
  );
$$;

grant execute on function public.user_has_no_company(text) to authenticated;

drop policy if exists companies_insert_admin on companies;

create policy companies_insert_admin on companies
  for insert
  to authenticated
  with check (public.user_has_no_company(auth.uid()::text));
