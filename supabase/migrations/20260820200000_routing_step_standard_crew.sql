-- Migration: Margin Watch Lapis 1 lanjutan — komposisi kru standar produksi
-- (20 Agu 2026, keputusan pemilik produk). SATU baris AGREGAT PER ROUTING
-- (routing_step_id nullable, BUKAN wajib per-tahap) -- keputusan sadar setelah
-- ditemukan basis akuntansi kru (jam BAYAR penuh per hari) beda dari basis
-- durasi tahap routing (menit AKTIF proses) — memaksakan alokasi per-tahap
-- tanpa data siapa mengerjakan tahap mana akan mengarang, bukan menghitung.
-- Kalau nanti ada data siapa-mengerjakan-tahap-mana, routing_step_id tinggal
-- diisi tanpa migrasi struktur baru.
create table if not exists routing_step_standard_crew (
  routing_step_standard_crew_id serial primary key,
  company_id integer not null references companies(company_id),
  routing_id integer not null references routings(routing_id),
  routing_step_id integer references routing_steps(routing_step_id),
  role_label text not null,
  wage_type text not null check (wage_type in ('hourly', 'daily', 'monthly', 'piece_rate')),
  headcount integer not null check (headcount > 0),
  hours_per_day numeric(6,2) not null check (hours_per_day > 0),
  -- true (kontrak/PHL lini ini) = kru DIKHUSUSKAN penuh utk lini ini, biaya harian
  -- PENUH (PHL dibayar 1 hari penuh terlepas jam; kontrak bulanan diperlakukan
  -- setara "penuh 1 hari" karena memang bertugas di lini ini sepanjang hari).
  -- false (mis. SPV yang mengawasi BANYAK lini) = biaya dialokasikan PROPORSIONAL
  -- ke jam yang benar-benar dihabiskan di lini ini, bukan 1 hari penuh --
  -- supaya biayanya tidak dobel-hitung ke tiap lini yang diawasi.
  is_full_day_dedicated boolean not null default true,
  source text not null default 'ESTIMASI_MANUAL' check (source in ('ESTIMASI_MANUAL', 'DIPELAJARI')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists routing_step_standard_crew_routing_id_idx on routing_step_standard_crew (routing_id);

alter table if exists routing_step_standard_crew enable row level security;

drop policy if exists routing_step_standard_crew_select on routing_step_standard_crew;
create policy routing_step_standard_crew_select on routing_step_standard_crew
  for select using (company_id = public.jwt_company_id());

drop policy if exists routing_step_standard_crew_write on routing_step_standard_crew;
create policy routing_step_standard_crew_write on routing_step_standard_crew
  for all using (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'production_manager', 'hr_manager'))
  )
  with check (
    company_id = public.jwt_company_id()
    and (public.jwt_is_company_leadership() or public.jwt_app_role() in ('ppic_manager', 'production_manager', 'hr_manager'))
  );
