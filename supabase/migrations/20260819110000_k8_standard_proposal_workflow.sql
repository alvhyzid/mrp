-- Migration: Pengerasan K8 (Fase Produksi Nyata, PEKERJAAN 2 / bagian D) --
-- mencegah standar produksi tercemar oleh 5 batch pertama produksi nyata (kurva
-- belajar) sebelum data itu masuk.
--
-- TEMUAN saat mengerjakan ini (dicatat supaya tidak jadi asumsi keliru sesi
-- depan): public.recompute_production_standard() dari migration 20260818100000
-- TERNYATA TIDAK PERNAH dipanggil dari kode aplikasi mana pun (dicek: grep kosong
-- di seluruh src/ dan app/) -- murni dead code sejak dibuat. Migrasi ini
-- MENGGANTIKANNYA TOTAL (drop), bukan menambal, karena perilaku lamanya (flip
-- otomatis ke DIPELAJARI begitu sample_count>=5, tanpa gerbang kelengkapan, mean
--+ buang-outlier dipakai bahkan di n kecil) persis 3 dari 4 masalah yang instruksi
-- ini minta diperbaiki -- menambal fungsi yang tidak pernah terpakai sama saja
-- dengan menulis ulang.
--
-- Empat penyesuaian (D.1-D.4 dokumen rencana):
-- D.1 Flip butuh persetujuan planner -- propose_production_standard() HANYA
--     menulis ke tabel usulan baru (production_standard_proposals), TIDAK PERNAH
--     menyentuh production_standards.value/source secara langsung. Penerapan
--     nilai baru cuma lewat decide_production_standard_proposal() yang dipanggil
--     endpoint approve/reject (planner: ppic_manager/company_admin/general_manager).
-- D.2 Median untuk sampel kecil -- n<10 pakai percentile_cont(0.5) (median) TANPA
--     buang outlier (tidak bermakna secara statistik di n kecil); n>=10 baru pakai
--     mean dengan buang outlier ±2σ (perilaku lama, sekarang hanya aktif di n>=10).
-- D.3 Gerbang kelengkapan -- BUKAN bagian dari fungsi SQL ini (butuh baca
--     work_order_step_progress + routing_steps, dicek di app layer sebelum
--     memanggil propose_production_standard() sama sekali -- lihat
--     src/features/mrp/server/learnFromBatch.ts). Batch yang gagal gerbang
--     dicatat di production_standard_exclusions (dilaporkan, bukan cuma dilewati
--     diam-diam).
-- D.4 Snapshot standar per rencana -- lihat migration terpisah
--     20260819120000_feasibility_standard_snapshot.sql (butuh tabel sales_order_lines
--     yang levelnya beda, dipisah supaya migration ini fokus di production_standards).
--
-- Perbaikan tambahan yang ditemukan perlu saat wiring (bukan diminta eksplisit,
-- tapi tanpa ini D.2/D.3 tidak bisa benar): production_standard_samples TIDAK
-- PUNYA kolom routing_step_id -- padahal active_duration_minutes levelnya PER
-- TAHAP (production_standards sendiri punya routing_step_id). Tanpa kolom ini,
-- sampel durasi dari tahap BERBEDA pada item yang sama akan tercampur jadi satu
-- rolling window yang salah. Ditambahkan di bawah.

alter table if exists production_standard_samples
  add column if not exists routing_step_id integer references routing_steps(routing_step_id);

drop index if exists production_standard_samples_lookup_idx;
create index if not exists production_standard_samples_lookup_idx
  on production_standard_samples (company_id, item_id, metric_key, routing_step_id, recorded_at desc);

-- Kolom audit "siapa & kapan mengesahkan" langsung di production_standards
-- (selain riwayat lengkap di production_standard_proposals.decided_by/decided_at)
-- supaya tampilan standar saat ini tidak perlu join ke riwayat usulan.
alter table if exists production_standards
  add column if not exists last_approved_by integer references users(user_id);
alter table if exists production_standards
  add column if not exists last_approved_at timestamptz;

create table if not exists production_standard_proposals (
  production_standard_proposal_id serial primary key,
  company_id integer not null references companies(company_id),
  item_id integer not null references items(item_id),
  routing_step_id integer references routing_steps(routing_step_id),
  metric_key text not null,
  old_value numeric(14,4),
  old_source text,
  proposed_value numeric(14,4) not null,
  calculation_method text not null check (calculation_method in ('median', 'mean_trimmed')),
  sample_count integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_by integer references users(user_id),
  decided_at timestamptz
);

create index if not exists production_standard_proposals_company_idx on production_standard_proposals (company_id);
-- Safeguard integritas data (bukan dipakai lewat ON CONFLICT -- fungsi di bawah
-- pakai update-atau-insert manual, pola sama dgn recompute_production_standard
-- lama, karena routing_step_id nullable bikin ON CONFLICT dgn unique constraint
-- biasa tidak pernah cocok utk baris level-item).
create unique index if not exists production_standard_proposals_one_pending
  on production_standard_proposals (company_id, item_id, coalesce(routing_step_id, -1), metric_key)
  where status = 'pending';

alter table if exists production_standard_proposals enable row level security;

drop policy if exists production_standard_proposals_select on production_standard_proposals;
create policy production_standard_proposals_select on production_standard_proposals
  for select using (company_id = public.jwt_company_id());

-- Tidak ada policy INSERT/UPDATE untuk role authenticated biasa -- SEMUA tulis
-- lewat fungsi security definer di bawah (dipanggil dari API route dengan
-- service-role client + pengecekan role di app layer, pola yang sama dipakai
-- semua endpoint tulis lain di aplikasi ini). GRANT EXECUTE fungsi-fungsi itu
-- SENGAJA hanya ke service_role (bukan authenticated) supaya tidak bisa dipanggil
-- langsung lewat RPC oleh sembarang role dari client, melewati gerbang role di
-- app layer.

create table if not exists production_standard_exclusions (
  production_standard_exclusion_id serial primary key,
  company_id integer not null references companies(company_id),
  production_batch_id integer not null references production_batches(production_batch_id),
  item_id integer references items(item_id),
  reason text not null,
  missing_routing_step_ids integer[],
  created_at timestamptz not null default now()
);

create index if not exists production_standard_exclusions_company_idx on production_standard_exclusions (company_id);

alter table if exists production_standard_exclusions enable row level security;

drop policy if exists production_standard_exclusions_select on production_standard_exclusions;
create policy production_standard_exclusions_select on production_standard_exclusions
  for select using (company_id = public.jwt_company_id());

drop function if exists public.recompute_production_standard(integer, integer, text, numeric);

create or replace function public.propose_production_standard(
  p_company_id integer,
  p_item_id integer,
  p_routing_step_id integer,
  p_metric_key text,
  p_new_sample numeric
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_pinned boolean;
  v_old_value numeric;
  v_old_source text;
  v_samples numeric[];
  v_count integer;
  v_mean numeric;
  v_stddev numeric;
  v_clean numeric[];
  v_proposed numeric;
  v_method text;
begin
  select value, source, pinned into v_old_value, v_old_source, v_pinned
  from production_standards
  where company_id = p_company_id and item_id = p_item_id
    and routing_step_id is not distinct from p_routing_step_id
    and metric_key = p_metric_key;

  -- Standar yang di-pin planner dikunci sengaja -- job pembelajaran tidak boleh
  -- bahkan MENGUSULKAN perubahan untuk baris itu.
  if v_pinned then
    return;
  end if;

  insert into production_standard_samples (company_id, item_id, metric_key, sample_value, routing_step_id)
  values (p_company_id, p_item_id, p_metric_key, p_new_sample, p_routing_step_id);

  select array_agg(sample_value order by recorded_at desc) into v_samples
  from (
    select sample_value, recorded_at from production_standard_samples
    where company_id = p_company_id and item_id = p_item_id and metric_key = p_metric_key
      and routing_step_id is not distinct from p_routing_step_id
    order by recorded_at desc
    limit 10
  ) recent;

  v_count := coalesce(array_length(v_samples, 1), 0);
  if v_count = 0 then
    return;
  end if;

  if v_count < 10 then
    -- D.2: median, TANPA buang outlier -- ±2σ tidak bermakna statistik di n<10.
    select percentile_cont(0.5) within group (order by v) into v_proposed from unnest(v_samples) as v;
    v_method := 'median';
  else
    select avg(v), stddev_pop(v) into v_mean, v_stddev from unnest(v_samples) as v;
    select array_agg(v) into v_clean
    from unnest(v_samples) as v
    where v_stddev is null or v_stddev = 0 or abs(v - v_mean) <= 2 * v_stddev;
    select avg(v) into v_proposed from unnest(coalesce(v_clean, v_samples)) as v;
    v_method := 'mean_trimmed';
  end if;

  -- D.1: TULIS SEBAGAI USULAN, bukan langsung ke production_standards. Baris
  -- pending yang sama di-refresh (bukan menumpuk duplikat) supaya planner selalu
  -- lihat angka usulan TERBARU sampai mereka memutuskan.
  update production_standard_proposals
  set proposed_value = v_proposed,
      calculation_method = v_method,
      sample_count = v_count,
      old_value = v_old_value,
      old_source = coalesce(v_old_source, 'ESTIMASI_MANUAL'),
      updated_at = now()
  where company_id = p_company_id and item_id = p_item_id
    and routing_step_id is not distinct from p_routing_step_id
    and metric_key = p_metric_key
    and status = 'pending';

  if not found then
    insert into production_standard_proposals (
      company_id, item_id, routing_step_id, metric_key, old_value, old_source, proposed_value, calculation_method, sample_count
    ) values (
      p_company_id, p_item_id, p_routing_step_id, p_metric_key, v_old_value, coalesce(v_old_source, 'ESTIMASI_MANUAL'), v_proposed, v_method, v_count
    );
  end if;
end;
$$;

grant execute on function public.propose_production_standard(integer, integer, integer, text, numeric) to service_role;

create or replace function public.decide_production_standard_proposal(
  p_proposal_id integer,
  p_decision text,
  p_user_id integer
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_proposal record;
  v_pinned boolean;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Keputusan tidak valid: %', p_decision;
  end if;

  select * into v_proposal from production_standard_proposals
  where production_standard_proposal_id = p_proposal_id and status = 'pending';

  if not found then
    raise exception 'Usulan tidak ditemukan atau sudah diputuskan sebelumnya.';
  end if;

  update production_standard_proposals
  set status = p_decision, decided_by = p_user_id, decided_at = now(), updated_at = now()
  where production_standard_proposal_id = p_proposal_id;

  if p_decision = 'approved' then
    select pinned into v_pinned
    from production_standards
    where company_id = v_proposal.company_id and item_id = v_proposal.item_id
      and routing_step_id is not distinct from v_proposal.routing_step_id
      and metric_key = v_proposal.metric_key;

    if v_pinned then
      raise exception 'Standar ini sudah di-pin planner setelah usulan dibuat -- tidak bisa diterapkan lewat usulan lama. Batalkan pin dulu kalau memang ingin diperbarui.';
    end if;

    update production_standards
    set value = v_proposal.proposed_value,
        source = 'DIPELAJARI',
        sample_count = v_proposal.sample_count,
        last_calculated_at = now(),
        last_approved_by = p_user_id,
        last_approved_at = now()
    where company_id = v_proposal.company_id and item_id = v_proposal.item_id
      and routing_step_id is not distinct from v_proposal.routing_step_id
      and metric_key = v_proposal.metric_key;

    if not found then
      insert into production_standards (
        company_id, item_id, routing_step_id, metric_key, value, source, sample_count, last_calculated_at, last_approved_by, last_approved_at
      ) values (
        v_proposal.company_id, v_proposal.item_id, v_proposal.routing_step_id, v_proposal.metric_key,
        v_proposal.proposed_value, 'DIPELAJARI', v_proposal.sample_count, now(), p_user_id, now()
      );
    end if;
  end if;
end;
$$;

grant execute on function public.decide_production_standard_proposal(integer, text, integer) to service_role;
