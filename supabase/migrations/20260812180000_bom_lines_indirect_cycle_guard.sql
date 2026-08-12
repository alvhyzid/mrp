-- Migration: perluas guard bom_lines supaya juga menolak siklus TIDAK LANGSUNG
-- (BOM A pakai komponen B, lalu BOM B pakai komponen A — atau rantai lebih panjang
-- A->B->C->A), bukan cuma referensi diri langsung. Ditemukan lewat pengujian manual:
-- migration 20260812170000 cuma menutup kasus item = komponen dirinya sendiri,
-- kasus tidak langsung tembus (dibuktikan: BOM A pakai B, lalu BOM B pakai A,
-- keduanya berhasil dibuat tanpa ditolak).
--
-- Pendekatan: recursive CTE menelusuri "apa saja yang dibutuhkan p_component_item_id
-- secara transitif" (lewat SEMUA BOM yang sudah ada, semua status draft/active/
-- archived — supaya aman biarpun draft nanti diaktifkan). Kalau p_parent_item_id ada
-- di situ, berarti component_item_id sudah (langsung/tidak langsung) butuh
-- parent_item_id — menjadikannya komponen parent_item_id akan menutup lingkaran.

drop function if exists public.bom_component_creates_cycle(integer, integer);
create function public.bom_component_creates_cycle(p_parent_item_id integer, p_component_item_id integer)
returns boolean
language sql
stable
as $$
  with recursive reachable(item_id) as (
    select bl.component_item_id
    from bom_lines bl
    join boms b on b.bom_id = bl.bom_id
    where b.parent_item_id = p_component_item_id
    union
    select bl.component_item_id
    from bom_lines bl
    join boms b on b.bom_id = bl.bom_id
    join reachable r on b.parent_item_id = r.item_id
  )
  select exists (select 1 from reachable where item_id = p_parent_item_id);
$$;

drop trigger if exists bom_lines_guard_self_reference on bom_lines;
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

  if v_parent_item_id is not null and public.bom_component_creates_cycle(v_parent_item_id, new.component_item_id) then
    raise exception 'Komponen ini (item_id %) sudah membutuhkan item induk BOM ini (item_id %) lewat resep lain — akan membuat siklus tidak langsung.', new.component_item_id, v_parent_item_id;
  end if;

  return new;
end;
$$;

create trigger bom_lines_guard_self_reference
  before insert or update on bom_lines
  for each row
  execute function public.guard_bom_line_not_self_referencing();
