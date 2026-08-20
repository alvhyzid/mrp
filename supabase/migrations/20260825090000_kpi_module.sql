-- Migration: Modul KPI (KPI-1) -- docs/rencana-kerja-kpi.md +
-- docs/penyerahan-opus-fitur-kpi.md + docs/revisi-kpi-visibilitas-tanggung-jawab.md
-- (dokumen ketiga MENGGANTIKAN §1.3 dokumen kedua).
--
-- PENYIMPANGAN DIDOKUMENTASIKAN DARI INSTRUKSI (dicek nyata sebelum menulis migrasi
-- ini, bukan asumsi):
-- 1. "kpi_snapshots MENYATU dengan snapshot Fase 0.5 & dashboard AI yang sudah ada --
--    JANGAN bikin tabel snapshot ketiga" -- DICEK: tidak ada tabel snapshot Fase 0.5
--    (KPI baseline) sama sekali di skema (grep menyeluruh supabase/migrations/*.sql).
--    3 tabel "snapshot" yang ADA (sales_order_line_feasibility_snapshots,
--    sales_order_line_margin_snapshots, ai_project_progress_snapshots) SEMUANYA
--    berbentuk tetap milik SATU baris pemilik (SO line / dashboard AI internal),
--    BUKAN time-series metric_key/period generik -- tidak ada yang bisa dipakai
--    ulang tanpa penyalahgunaan struktur. kpi_snapshots di bawah ini karenanya
--    tabel PERTAMA berbentuk time-series metrik generik di proyek ini -- kalau
--    kelak Fase 0.5 KPI-baseline dibangun, itu HARUS memakai tabel ini, bukan
--    membuat tabel snapshot keempat.
-- 2. "owner_role_id"/"role_id" di dokumen sumber mengasumsikan tabel `roles`
--    terpisah dengan primary key -- TIDAK ADA tabel roles di proyek ini (role
--    tersimpan sebagai kolom text di users.role dengan CHECK constraint, lihat
--    src/lib/roles.ts baris 1-2). Kolom di bawah memakai `owner_role text` /
--    `role text`, pola SAMA PERSIS dengan kamus_terms.suggested_role (lihat
--    komentar kolom itu di 20260821180000_kamus_module.sql baris 16).

create table if not exists kpi_registry (
  kpi_registry_id serial primary key,
  company_id integer not null references companies(company_id),
  metric_key text not null, -- WAJIB ada di kamus_terms scope METRIC -- rumus TIDAK ditulis ulang di sini
  kind text not null check (kind in ('DISIPLIN', 'HASIL')),
  pillar text not null check (pillar in ('EFISIENSI', 'OPTIMASI', 'TRANSPARANSI', 'IMPROVEMENT', 'RECORD')),
  owner_role text not null,
  frequency text not null check (frequency in ('HARIAN', 'MINGGUAN', 'BULANAN', 'PER_KEJADIAN')),
  -- DISIPLIN: target_value terkunci ideal (100/0), tidak bisa diedit tenant (gerbang
  -- di TypeScript, lihat updateKpiTarget.ts). HASIL: null sampai baseline >=2 bulan,
  -- lalu diisi pemilik KPI lewat alur tercatat (KPI-4, belum dibangun sesi ini).
  target_value numeric,
  target_set_at timestamptz,
  target_set_by integer references users(user_id),
  benchmark_value numeric,
  benchmark_label text,
  benchmark_source text,
  warn_threshold numeric,
  alert_threshold numeric,
  attribution_level text not null check (attribution_level in ('INDIVIDU', 'TIM', 'LINI', 'PROSES', 'PERUSAHAAN')),
  -- jsonb array dari 'DIRI'|'ATASAN'|'DEPARTEMEN'|'PUBLIK_AGREGAT' (revisi §1.1).
  -- Disimpan sesuai spek dokumen untuk dipakai KPI-4; enforcement AKTUAL sesi ini
  -- (KPI-1) memakai aturan lebih sederhana di canViewKpi() -- lihat catatan HANDOFF.
  visibility jsonb not null default '["ATASAN", "DEPARTEMEN"]'::jsonb,
  improvement_levers text[],
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, metric_key),
  foreign key (company_id, metric_key) references kamus_terms (company_id, term_key)
);

create index if not exists kpi_registry_company_id_idx on kpi_registry (company_id, is_active);

-- Time-series generik: SATU baris per metric_key per periode. Dipakai kpi_registry
-- (nilai KPI historis untuk sparkline/delta) DAN (kelak) Fase 0.5 KPI-baseline --
-- lihat catatan di atas kenapa ini tabel snapshot generik PERTAMA, bukan yang ketiga.
create table if not exists kpi_snapshots (
  kpi_snapshot_id serial primary key,
  company_id integer not null references companies(company_id),
  metric_key text not null,
  period_start date not null,
  period_end date not null,
  value numeric, -- null = belum bisa dihitung periode itu (data belum cukup), BUKAN 0
  computed_at timestamptz not null default now(),
  -- hash input yang dipakai (mis. daftar batch/shipment yang masuk hitungan) --
  -- dipakai membuktikan idempotensi & audit "angka ini dari data yang mana".
  inputs_hash text,
  unique (company_id, metric_key, period_start, period_end),
  foreign key (company_id, metric_key) references kamus_terms (company_id, term_key)
);

create index if not exists kpi_snapshots_lookup_idx on kpi_snapshots (company_id, metric_key, period_start desc);

create table if not exists kpi_actions (
  kpi_action_id serial primary key,
  company_id integer not null references companies(company_id),
  kpi_registry_id integer not null references kpi_registry (kpi_registry_id),
  period text not null, -- label periode bebas (format tergantung frequency KPI, mis. "2026-08" bulanan / "2026-W34" mingguan)
  finding text not null,
  action_text text not null,
  owner_role text,
  owner_user_id integer references users (user_id),
  due_date date,
  status text not null default 'TERBUKA' check (status in ('TERBUKA', 'BERJALAN', 'SELESAI', 'BATAL')),
  created_by integer references users (user_id),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check (owner_role is not null or owner_user_id is not null)
);

create index if not exists kpi_actions_registry_idx on kpi_actions (kpi_registry_id, status);

create table if not exists kpi_responsibilities (
  kpi_responsibility_id serial primary key,
  company_id integer not null references companies(company_id),
  kpi_registry_id integer not null references kpi_registry (kpi_registry_id),
  role text,
  user_id integer references users (user_id),
  responsibility text not null check (responsibility in ('PEMILIK', 'KONTRIBUTOR', 'PENDUKUNG')),
  note text,
  created_at timestamptz not null default now(),
  check (role is not null or user_id is not null)
);

create index if not exists kpi_responsibilities_registry_idx on kpi_responsibilities (kpi_registry_id);

-- Audit trail perubahan target/visibility/attribution_level -- pola SAMA PERSIS
-- dengan kamus_term_history (satu-satunya preseden audit-trail di proyek ini,
-- lihat 20260821180000_kamus_module.sql baris 37-45): satu baris per field yang
-- berubah, old_value/new_value sebagai text, changed_by/changed_at.
create table if not exists kpi_registry_history (
  kpi_registry_history_id serial primary key,
  kpi_registry_id integer not null references kpi_registry (kpi_registry_id),
  changed_by integer references users (user_id),
  changed_at timestamptz not null default now(),
  field_changed text not null,
  old_value text,
  new_value text
);

create index if not exists kpi_registry_history_registry_idx on kpi_registry_history (kpi_registry_id);

alter table kpi_registry enable row level security;
alter table kpi_snapshots enable row level security;
alter table kpi_actions enable row level security;
alter table kpi_responsibilities enable row level security;
alter table kpi_registry_history enable row level security;

-- SELECT: dasar (isolasi company) terbuka untuk semua staf ter-otentikasi company
-- yang sama -- pola SAMA dengan kamus_terms (baca boleh luas, gerbang halus per-KPI
-- yang sesungguhnya, termasuk visibility DIRI/ATASAN/DEPARTEMEN, DITEGAKKAN di
-- TypeScript oleh canViewKpi()/getMyKpi.ts, BUKAN oleh RLS ini -- RLS di sini cuma
-- lapisan pertama "tidak bisa lihat company lain", konsisten dengan seluruh modul
-- Kamus/AI-Project/AI-Readiness sesi-sesi sebelumnya.
drop policy if exists kpi_registry_select_for_company on kpi_registry;
create policy kpi_registry_select_for_company on kpi_registry
  for select using (company_id = public.jwt_company_id());

drop policy if exists kpi_snapshots_select_for_company on kpi_snapshots;
create policy kpi_snapshots_select_for_company on kpi_snapshots
  for select using (company_id = public.jwt_company_id());

drop policy if exists kpi_actions_select_for_company on kpi_actions;
create policy kpi_actions_select_for_company on kpi_actions
  for select using (company_id = public.jwt_company_id());

drop policy if exists kpi_responsibilities_select_for_company on kpi_responsibilities;
create policy kpi_responsibilities_select_for_company on kpi_responsibilities
  for select using (company_id = public.jwt_company_id());

-- kpi_registry_history SENGAJA TIDAK ADA policy select untuk authenticated --
-- riwayat perubahan lebih sensitif dari registry-nya sendiri, baca lewat endpoint
-- resmi (belum dibangun UI-nya sesi ini, tabel disiapkan untuk KPI-4).

-- INSERT/UPDATE/DELETE: SENGAJA TIDAK ADA policy untuk authenticated di SEMUA
-- tabel KPI (default deny) -- SEMUA tulis (seed registry, hitung snapshot, ubah
-- target, catat kpi_actions) lewat server function dengan admin client + gerbang
-- role di TypeScript. Ini MENUTUP jalur PostgREST langsung -- kalau seseorang
-- mencoba menulis nilai KPI langsung lewat API publik (skenario negatif (a) sesi
-- ini), tidak ada jalur RLS yang mengizinkannya sama sekali.
