-- Migration: Dashboard Proyek AI (K1b, docs/instruksi-dashboard-proyek-ai.md)
-- -- alat internal (leadership only) menjawab "apa tahapan proyek AI, seberapa
-- jauh progresnya, apa yang bisa dikerjakan sekarang". Progres tugas AUTO_QUERY
-- WAJIB dihitung dari data nyata setiap dibuka -- TIDAK ADA kolom persen yang
-- diketik manusia utk jenis ini (dijaga di app layer, parseAiProjectTaskInput).
create table if not exists ai_project_phases (
  ai_project_phase_id serial primary key,
  company_id integer not null references companies(company_id),
  code text not null,
  name text not null,
  description text,
  weight_percent numeric(5,2) not null,
  sort_order integer not null,
  status text not null default 'BELUM' check (status in ('BELUM', 'BERJALAN', 'SELESAI', 'DITUNDA')),
  unique (company_id, code)
);

create table if not exists ai_project_tasks (
  ai_project_task_id serial primary key,
  company_id integer not null references companies(company_id),
  ai_project_phase_id integer not null references ai_project_phases(ai_project_phase_id),
  code text not null,
  name text not null,
  description text,
  weight_percent numeric(5,2) not null, -- bobot DI DALAM fase, jumlah per fase = 100
  owner_type text not null check (owner_type in ('PEMILIK_PRODUK', 'TIM', 'CLAUDE_CODE', 'CAMPURAN')),
  suggested_role text,
  progress_source text not null check (progress_source in ('AUTO_QUERY', 'CHECKLIST', 'MANUAL_PERCENT')),
  progress_key text, -- kunci rumus utk AUTO_QUERY
  action_type text not null check (action_type in ('BUKA_KAMUS', 'BUKA_CHECKLIST', 'BUKA_HALAMAN', 'INFO_SAJA')),
  action_target text,
  blocked_by integer[], -- ai_project_task_id prasyarat (pakai integer sesuai konvensi PK proyek ini, spesifikasi asli menyebut uuid[] tapi seluruh skema proyek ini pakai serial int)
  status text not null default 'BELUM' check (status in ('BELUM', 'BERJALAN', 'SELESAI', 'DITUNDA')),
  sort_order integer not null,
  manual_percent numeric(5,2), -- HANYA dipakai kalau progress_source=MANUAL_PERCENT
  manual_percent_set_by integer references users(user_id),
  manual_percent_set_at timestamptz,
  unique (company_id, code)
);

create table if not exists ai_project_checklist_items (
  ai_project_checklist_item_id serial primary key,
  ai_project_task_id integer not null references ai_project_tasks(ai_project_task_id),
  label text not null,
  done boolean not null default false,
  done_by integer references users(user_id),
  done_at timestamptz,
  note text,
  sort_order integer not null default 0
);

create table if not exists ai_project_progress_snapshots (
  ai_project_progress_snapshot_id serial primary key,
  company_id integer not null references companies(company_id),
  taken_at timestamptz not null default now(),
  overall_percent numeric(5,2) not null,
  per_phase jsonb not null
);

create index if not exists ai_project_tasks_phase_id_idx on ai_project_tasks (ai_project_phase_id);
create index if not exists ai_project_checklist_items_task_id_idx on ai_project_checklist_items (ai_project_task_id);
create index if not exists ai_project_progress_snapshots_company_id_idx on ai_project_progress_snapshots (company_id, taken_at);

alter table ai_project_phases enable row level security;
alter table ai_project_tasks enable row level security;
alter table ai_project_checklist_items enable row level security;
alter table ai_project_progress_snapshots enable row level security;

-- "Jangan menampilkan dashboard ini ke role di luar tim inti" -- alat internal
-- proyek AI, BUKAN fitur tenant biasa. Ditafsirkan SEMPIT (leadership saja:
-- company_admin/general_manager) -- bukan "semua staf" seperti Kamus, karena
-- ini soal roadmap internal proyek AI, bukan pekerjaan operasional harian
-- yang relevan utk semua departemen. SENGAJA TIDAK ADA policy utk authenticated
-- (default deny) -- SEMUA baca/tulis lewat server function dgn admin client +
-- gerbang isCompanyLeadership() di TypeScript, pola sama modul Kamus.
comment on table ai_project_phases is 'Internal, leadership-only -- akses diperiksa di server function (isCompanyLeadership), BUKAN lewat RLS authenticated (sengaja default-deny, sama pola modul Kamus).';
