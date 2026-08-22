-- KOREKSI (23 Agu 2026, ditemukan lewat tests/function_grant_security_audit.test.ts
-- yang MEMANG dirancang menangkap ini): get_employee_cost_category() ditulis
-- SECURITY DEFINER tanpa satu pun pemeriksaan company_id/peran internal --
-- siapa pun yang login (peran apa pun, company mana pun) bisa memanggilnya
-- untuk KARYAWAN PERUSAHAAN LAIN dan mempelajari golongan biayanya. Data yang
-- bocor bukan gaji (tabel employee_cost_category_history memang tidak berisi
-- gaji), tapi tetap kebocoran lintas-tenant dan lintas-peran yang seharusnya
-- tidak terjadi -- RLS pada tabel sengaja dibatasi ke leadership/financial/HR,
-- SECURITY DEFINER pada fungsi ini memotong pembatasan itu tanpa gantinya.
create or replace function public.get_employee_cost_category(p_employee_id integer, p_as_of date default current_date)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_employee_company_id integer;
  v_result text;
begin
  select company_id into v_employee_company_id from employees where employee_id = p_employee_id;

  if v_employee_company_id is null or v_employee_company_id != public.jwt_company_id() then
    return null; -- karyawan tidak ada, atau bukan milik company pemanggil -- pola sama RLS: diam, bukan error yang membocorkan info.
  end if;

  if not (public.jwt_is_company_leadership() or public.jwt_can_view_financial_data() or public.jwt_app_role() = 'hr_manager') then
    return null; -- pemanggil berwenang lihat company yang sama, tapi tidak berwenang lihat golongan biaya -- sama seperti RLS select policy tabel ini.
  end if;

  select cost_category into v_result
  from employee_cost_category_history
  where employee_id = p_employee_id
    and effective_from <= p_as_of
    and (effective_to is null or effective_to >= p_as_of)
  order by effective_from desc
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.get_employee_cost_category(integer, date) from public, anon, authenticated;
grant execute on function public.get_employee_cost_category(integer, date) to authenticated, service_role;
