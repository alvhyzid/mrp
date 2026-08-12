-- Migration: cegah BOM merujuk ke item yang sama sebagai komponen dirinya sendiri
-- (circular reference langsung). CHECK constraint tidak bisa membandingkan kolom
-- lintas tabel, jadi dipakai trigger. Ini menutup celah yang sama di level DB kalau
-- validasi di aplikasi terlewat — konsisten dengan prinsip defense-in-depth yang
-- sudah dipakai di seluruh migration sesi ini.
--
-- Catatan: ini HANYA menutup referensi diri langsung (BOM item A punya baris
-- komponen = item A juga). Siklus tidak langsung (A perlu B, B perlu A lewat BOM
-- masing-masing) TIDAK dideteksi di sini — di luar cakupan yang diminta.

drop function if exists public.guard_bom_line_not_self_referencing();
create function public.guard_bom_line_not_self_referencing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_parent_item_id integer;
begin
  select parent_item_id into v_parent_item_id from boms where bom_id = new.bom_id;

  if v_parent_item_id is not null and v_parent_item_id = new.component_item_id then
    raise exception 'BOM tidak boleh memakai item yang sama (item_id %) sebagai komponen dirinya sendiri.', v_parent_item_id;
  end if;

  return new;
end;
$$;

drop trigger if exists bom_lines_guard_self_reference on bom_lines;
create trigger bom_lines_guard_self_reference
  before insert or update on bom_lines
  for each row
  execute function public.guard_bom_line_not_self_referencing();
