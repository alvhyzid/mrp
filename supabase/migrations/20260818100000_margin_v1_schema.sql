-- Migration: fondasi skema untuk Aturan Biaya v1 (docs/spesifikasi-aturan-biaya-v1.md
-- rev. 3) — GELOMBANG 2 (I5). 3 bagian: (a) production_standards (pola K8, "standar
-- ber-asal-usul"), (b) work_order_assignments.work_date (dibutuhkan supaya tarif PHL
-- bisa tahu hari itu Sabtu atau bukan — K4), (c) fungsi biaya SDM per BATCH (versi
-- production_batch_id, melengkapi get_work_order_labor_cost_total() yang sudah ada di
-- level work_order — batch dibutuhkan karena unit_cost lot dihitung PER BATCH, bukan
-- per WO, dan sekarang 1 WO bisa punya banyak batch).

-- (a) production_standards — pola K8: {value, source, sample_count, last_calculated_at,
-- pinned, pin_reason}. Generik per company+item+metric (bukan tabel per metrik) supaya
-- gampang ditambah metrik baru (yield %, unit-per-batch, durasi aktif per tahap, dst)
-- tanpa migrasi baru tiap kali.
create table if not exists production_standards (
  production_standard_id serial primary key,
  company_id integer not null references companies(company_id),
  item_id integer references items(item_id),
  routing_step_id integer references routing_steps(routing_step_id),
  metric_key text not null check (metric_key in ('yield_percentage', 'unit_per_batch', 'active_duration_minutes')),
  value numeric(14,4) not null,
  source text not null default 'ESTIMASI_MANUAL' check (source in ('ESTIMASI_MANUAL', 'DIPELAJARI')),
  sample_count integer not null default 0,
  last_calculated_at timestamptz,
  pinned boolean not null default false,
  pin_reason text,
  created_at timestamptz not null default now(),
  -- 1 metrik per (item, routing_step) — routing_step_id null utk metrik level-item
  -- (yield_percentage/unit_per_batch), terisi utk metrik level-tahap (active_duration_minutes).
  unique (company_id, item_id, routing_step_id, metric_key)
);

create index if not exists production_standards_company_id_idx on production_standards (company_id);
create index if not exists production_standards_item_id_idx on production_standards (item_id);

alter table if exists production_standards enable row level security;

drop policy if exists production_standards_select_for_company on production_standards;
create policy production_standards_select_for_company on production_standards
  for select using (company_id = public.jwt_company_id());

drop policy if exists production_standards_write_ppic on production_standards;
create policy production_standards_write_ppic on production_standards
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  );

-- Job pembelajaran (K8): rata-rata bergulir 10 batch SELESAI terakhir, buang outlier
-- ±2σ, pindah status ke DIPELAJARI setelah >=5 sampel bersih. Dipanggil manual dari
-- app layer saat batch completed (bukan cron — "sederhana saja" sesuai instruksi).
-- TIDAK menimpa baris yang di-pin (pinned=true) — planner yang pin sengaja mengunci
-- nilai itu, job pembelajaran harus menghormatinya.
create or replace function public.recompute_production_standard(
  p_company_id integer,
  p_item_id integer,
  p_metric_key text,
  p_new_sample numeric
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_pinned boolean;
  v_samples numeric[];
  v_mean numeric;
  v_stddev numeric;
  v_clean numeric[];
  v_avg numeric;
  v_count integer;
begin
  select pinned into v_pinned
  from production_standards
  where company_id = p_company_id and item_id = p_item_id and routing_step_id is null and metric_key = p_metric_key;

  if v_pinned then
    return;
  end if;

  -- Simpan sampel di kolom terpisah (production_standard_samples) supaya rolling
  -- window 10-batch-terakhir tidak butuh scan tabel history lain (work_order_outputs
  -- polanya beda-beda tiap metrik: yield dari qty output, unit_per_batch dari qty
  -- juga tapi basis beda, active_duration dari work_order_step_progress) — histori
  -- sampel MENTAH disimpan di sini, generik lintas metrik.
  insert into production_standard_samples (company_id, item_id, metric_key, sample_value)
  values (p_company_id, p_item_id, p_metric_key, p_new_sample);

  select array_agg(sample_value order by recorded_at desc) into v_samples
  from (
    select sample_value, recorded_at from production_standard_samples
    where company_id = p_company_id and item_id = p_item_id and metric_key = p_metric_key
    order by recorded_at desc
    limit 10
  ) recent;

  if array_length(v_samples, 1) is null or array_length(v_samples, 1) < 1 then
    return;
  end if;

  select avg(v), stddev_pop(v) into v_mean, v_stddev from unnest(v_samples) as v;

  -- Buang outlier ±2σ (kalau stddev null/0, semua sampel dianggap bersih — tidak
  -- ada variasi untuk dibuang).
  select array_agg(v) into v_clean
  from unnest(v_samples) as v
  where v_stddev is null or v_stddev = 0 or abs(v - v_mean) <= 2 * v_stddev;

  if v_clean is null or array_length(v_clean, 1) = 0 then
    return;
  end if;

  select avg(v), count(*) into v_avg, v_count from unnest(v_clean) as v;

  -- Update-atau-insert manual (BUKAN "on conflict") karena routing_step_id nullable —
  -- unique constraint multi-kolom memperlakukan tiap NULL sebagai berbeda, jadi
  -- "on conflict" tidak akan pernah cocok untuk baris level-item (routing_step_id
  -- null) dan akan menumpuk duplikat kalau dipaksakan.
  update production_standards
  set value = v_avg,
      source = case when v_count >= 5 then 'DIPELAJARI' else 'ESTIMASI_MANUAL' end,
      sample_count = v_count,
      last_calculated_at = now()
  where company_id = p_company_id and item_id = p_item_id and routing_step_id is null and metric_key = p_metric_key
    and pinned = false;

  if not found then
    insert into production_standards (company_id, item_id, metric_key, value, source, sample_count, last_calculated_at)
    values (p_company_id, p_item_id, p_metric_key, v_avg, case when v_count >= 5 then 'DIPELAJARI' else 'ESTIMASI_MANUAL' end, v_count, now());
  end if;
end;
$$;

create table if not exists production_standard_samples (
  production_standard_sample_id serial primary key,
  company_id integer not null references companies(company_id),
  item_id integer not null references items(item_id),
  metric_key text not null,
  sample_value numeric(14,4) not null,
  recorded_at timestamptz not null default now()
);
create index if not exists production_standard_samples_lookup_idx on production_standard_samples (company_id, item_id, metric_key, recorded_at desc);
alter table if exists production_standard_samples enable row level security;
drop policy if exists production_standard_samples_select_for_company on production_standard_samples;
create policy production_standard_samples_select_for_company on production_standard_samples
  for select using (company_id = public.jwt_company_id());
drop policy if exists production_standard_samples_write_ppic on production_standard_samples;
create policy production_standard_samples_write_ppic on production_standard_samples
  for insert with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'ppic_staff', 'production_manager'))
  );

grant execute on function public.recompute_production_standard(integer, integer, text, numeric) to authenticated, service_role;

-- (b) work_date — tanggal kalender jam ini dikerjakan, dibutuhkan utk menentukan tarif
-- PHL/harian yang benar (K4: hari biasa ÷7 jam vs Sabtu ÷5 jam, spec §2). Nullable +
-- default current_date supaya baris lama (sebelum kolom ini ada) tetap valid.
alter table if exists work_order_assignments
  add column if not exists work_date date not null default current_date;

-- (c) Biaya SDM per BATCH (bukan per WO) — versi TOTAL, dipanggil saat costing lot
-- output & saat tampilan Margin Kontribusi (GM/finance_manager lihat TOTAL saja).
create or replace function public.get_production_batch_labor_cost_total(p_production_batch_id integer)
returns numeric
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id integer;
  v_weekday_hours numeric;
  v_saturday_hours numeric;
  v_hours_per_month numeric;
  v_total numeric;
begin
  select pb.company_id into v_company_id
  from production_batches pb
  where pb.production_batch_id = p_production_batch_id;

  if v_company_id is null then
    return 0;
  end if;

  if v_company_id <> public.jwt_company_id() then
    raise exception 'Batch produksi tidak ditemukan di perusahaan Anda.';
  end if;

  if not (public.jwt_can_view_financial_data() or public.jwt_can_view_wages()) then
    raise exception 'Anda tidak punya akses ke biaya SDM.';
  end if;

  select coalesce(nullif(cs.setting_value, '')::numeric, 7) into v_weekday_hours
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'work_calendar_weekday_hours';
  v_weekday_hours := coalesce(v_weekday_hours, 7);

  select coalesce(nullif(cs.setting_value, '')::numeric, 5) into v_saturday_hours
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'work_calendar_saturday_hours';
  v_saturday_hours := coalesce(v_saturday_hours, 5);

  select coalesce(nullif(cs.setting_value, '')::numeric, 173.3333) into v_hours_per_month
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'standard_hours_per_month';
  v_hours_per_month := coalesce(v_hours_per_month, 173.3333);

  select coalesce(sum(
    case e.wage_type
      when 'hourly' then coalesce(a.actual_hours, 0) * e.wage_rate
      -- harian: dibagi jam terjadwal HARI ITU (Sabtu=6 -> saturday_hours, else weekday_hours)
      when 'daily' then coalesce(a.actual_hours, 0) * (e.wage_rate / (case when extract(dow from a.work_date) = 6 then v_saturday_hours else v_weekday_hours end))
      when 'monthly' then coalesce(a.actual_hours, 0) * (e.wage_rate / v_hours_per_month)
      when 'piece_rate' then coalesce(a.qty_produced, 0) * e.wage_rate
      else 0
    end
  ), 0) into v_total
  from work_order_assignments a
  join employees e on e.employee_id = a.employee_id
  where a.production_batch_id = p_production_batch_id
    and a.status not in ('absent', 'replaced');

  return v_total;
end;
$$;

grant execute on function public.get_production_batch_labor_cost_total(integer) to authenticated, service_role;

-- Rincian PER-ORANG — sengaja LEBIH KETAT dari versi total (K1 "Aturan tampilan":
-- general_manager/finance_manager cuma boleh lihat TOTAL, rincian per-orang HANYA
-- company_admin). Return kosong (bukan exception) kalau bukan company_admin, supaya
-- app layer bisa tetap render halaman (cuma tabel rincian yang kosong) tanpa 500.
create or replace function public.get_production_batch_labor_cost_detail(p_production_batch_id integer)
returns table (employee_id integer, employee_name text, wage_type text, hours numeric, cost numeric)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id integer;
  v_weekday_hours numeric;
  v_saturday_hours numeric;
  v_hours_per_month numeric;
begin
  select pb.company_id into v_company_id
  from production_batches pb
  where pb.production_batch_id = p_production_batch_id;

  if v_company_id is null then
    return;
  end if;

  if v_company_id <> public.jwt_company_id() then
    raise exception 'Batch produksi tidak ditemukan di perusahaan Anda.';
  end if;

  if public.jwt_app_role() <> 'company_admin' then
    return;
  end if;

  select coalesce(nullif(cs.setting_value, '')::numeric, 7) into v_weekday_hours
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'work_calendar_weekday_hours';
  v_weekday_hours := coalesce(v_weekday_hours, 7);

  select coalesce(nullif(cs.setting_value, '')::numeric, 5) into v_saturday_hours
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'work_calendar_saturday_hours';
  v_saturday_hours := coalesce(v_saturday_hours, 5);

  select coalesce(nullif(cs.setting_value, '')::numeric, 173.3333) into v_hours_per_month
  from company_settings cs where cs.company_id = v_company_id and cs.setting_key = 'standard_hours_per_month';
  v_hours_per_month := coalesce(v_hours_per_month, 173.3333);

  return query
  select
    e.employee_id,
    e.name,
    e.wage_type,
    coalesce(a.actual_hours, 0) as hours,
    case e.wage_type
      when 'hourly' then coalesce(a.actual_hours, 0) * e.wage_rate
      when 'daily' then coalesce(a.actual_hours, 0) * (e.wage_rate / (case when extract(dow from a.work_date) = 6 then v_saturday_hours else v_weekday_hours end))
      when 'monthly' then coalesce(a.actual_hours, 0) * (e.wage_rate / v_hours_per_month)
      when 'piece_rate' then coalesce(a.qty_produced, 0) * e.wage_rate
      else 0
    end as cost
  from work_order_assignments a
  join employees e on e.employee_id = a.employee_id
  where a.production_batch_id = p_production_batch_id
    and a.status not in ('absent', 'replaced');
end;
$$;

grant execute on function public.get_production_batch_labor_cost_detail(integer) to authenticated, service_role;
