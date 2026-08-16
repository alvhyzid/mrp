-- Migration: debug_schema_snapshot() (migrasi 20260817130000) tidak mencakup
-- event trigger (mekanisme terpisah dari pg_trigger biasa) — ketahuan saat
-- verifikasi Sesi 2A menemukan event trigger rls_auto_enable yang tidak ada di
-- migration manapun, tapi tidak ikut terdeteksi kategori 'trigger' yang sudah
-- ada. Ditambah kategori 'event_trigger'.

create or replace function public.debug_schema_snapshot()
returns table (category text, object_name text, detail text)
language sql
security definer
set search_path = public, pg_catalog
as $$
  -- tables + RLS enabled/disabled
  select 'table'::text, c.relname::text, ('rls_enabled=' || c.relrowsecurity::text)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'

  union all

  -- columns: nama + tipe + nullable + default
  select 'column'::text,
    (col.table_name || '.' || col.column_name)::text,
    (col.data_type
      || case when col.character_maximum_length is not null then '(' || col.character_maximum_length || ')' else '' end
      || ' nullable=' || col.is_nullable
      || ' default=' || coalesce(col.column_default, 'NULL'))
  from information_schema.columns col
  where col.table_schema = 'public'

  union all

  -- constraints (PK/FK/unique/check) — definisi persis via pg_get_constraintdef
  select 'constraint'::text,
    (rel.relname || '.' || con.conname)::text,
    (con.contype::text || ': ' || pg_get_constraintdef(con.oid))
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public'

  union all

  -- indexes (termasuk index dari PK/unique constraint, definisi lengkap)
  select 'index'::text,
    (rel.relname || '.' || ic.relname)::text,
    pg_get_indexdef(ic.oid)
  from pg_index idx
  join pg_class ic on ic.oid = idx.indexrelid
  join pg_class rel on rel.oid = idx.indrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public'

  union all

  -- triggers: timing+event+fungsi yang dipanggil, definisi lengkap
  select 'trigger'::text,
    (rel.relname || '.' || tg.tgname)::text,
    pg_get_triggerdef(tg.oid)
  from pg_trigger tg
  join pg_class rel on rel.oid = tg.tgrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public' and not tg.tgisinternal

  union all

  -- RLS policies: per role, per command, ekspresi USING dan WITH CHECK lengkap
  select 'policy'::text,
    (p.tablename || '.' || p.policyname)::text,
    ('cmd=' || p.cmd || ' roles=' || p.roles::text || ' using=' || coalesce(p.qual, 'NULL') || ' with_check=' || coalesce(p.with_check, 'NULL'))
  from pg_policies p
  where p.schemaname = 'public'

  union all

  -- views: definisi lengkap
  select 'view'::text,
    v.viewname::text,
    v.definition
  from pg_views v
  where v.schemaname = 'public'

  union all

  -- functions: signature + BODY lengkap (mencakup security definer/invoker, dst)
  select 'function'::text,
    (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')::text,
    pg_get_functiondef(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'

  union all

  -- sequences: nama + kolom pemilik (owned_by) — biasanya dari kolom serial
  select 'sequence'::text,
    s.relname::text,
    coalesce(owner_tbl.relname || '.' || owner_col.attname, 'unowned')
  from pg_class s
  join pg_namespace n on n.oid = s.relnamespace
  left join pg_depend d on d.objid = s.oid and d.deptype = 'a'
  left join pg_class owner_tbl on owner_tbl.oid = d.refobjid
  left join pg_attribute owner_col on owner_col.attrelid = d.refobjid and owner_col.attnum = d.refobjsubid
  where n.nspname = 'public' and s.relkind = 'S'

  union all

  -- storage.objects RLS policies (bucket-scoped write policies dari migrasi
  -- 20260814160000_company_logo_user_avatar_storage) — di luar schema public,
  -- tapi bagian nyata dari skema yang harus konsisten hasil rebuild-nya juga.
  select 'storage_policy'::text,
    ('storage.objects.' || p.policyname)::text,
    ('cmd=' || p.cmd || ' roles=' || p.roles::text || ' using=' || coalesce(p.qual, 'NULL') || ' with_check=' || coalesce(p.with_check, 'NULL'))
  from pg_policies p
  where p.schemaname = 'storage' and p.tablename = 'objects'

  union all

  -- storage buckets yang dibuat lewat migrasi (company-logos, user-avatars)
  select 'storage_bucket'::text,
    b.id::text,
    ('public=' || b.public::text)
  from storage.buckets b

  union all

  -- event triggers (mekanisme BEDA dari trigger biasa di pg_trigger, gampang
  -- terlewat kalau cuma cek pg_trigger — ditemukan saat verifikasi Sesi 2A
  -- ternyata ada 1 yang tidak tercakup di kategori 'trigger' di atas)
  select 'event_trigger'::text,
    et.evtname::text,
    ('event=' || et.evtevent || ' function=' || et.evtfoid::regproc::text || ' enabled=' || et.evtenabled::text)
  from pg_event_trigger et

  order by 1, 2;
$$;

revoke all on function public.debug_schema_snapshot() from public;
grant execute on function public.debug_schema_snapshot() to service_role;
