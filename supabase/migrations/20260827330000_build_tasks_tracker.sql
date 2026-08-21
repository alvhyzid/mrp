-- Halaman Daftar Tugas Pembangunan (21 Agu 2026) — satu tempat pemilik produk
-- memantau SELURUH pekerjaan pembangunan sistem: selesai, sedang dikerjakan,
-- menunggu, beserta PIC, jenis pekerjaan, urgensi, dan rekaman permanen semua
-- permintaan fitur. Keputusan struktur (kolom, enum, constraint) di bawah ini
-- adalah keputusan TEKNIS Claude Code (dicatat sesuai aturan tetap baru di
-- CLAUDE.md), BUKAN aturan bisnis — bisa dikoreksi kapan saja.

create table if not exists build_tasks (
  build_task_id serial primary key,
  company_id integer not null references companies(company_id),
  -- Kode singkat modul + nomor urut (FND-01, PMB-04, dst) -- TETAP, tidak
  -- pernah dipakai ulang walau task dibatalkan. Unik PER PERUSAHAAN (bukan
  -- global) supaya kompatibel multi-tenant sejak awal.
  task_code text not null,
  name text not null,
  -- module_code = kode singkat (FND/MST/PMB/dst), module_name = label bahasa
  -- manusia yang ditampilkan ("Fondasi SaaS") -- dipisah supaya pengurutan &
  -- pengelompokan tidak tergantung terjemahan.
  module_code text not null,
  module_name text not null,
  description text not null,
  effect_description text not null,
  urgency text not null check (urgency in ('super_urgent', 'mendesak', 'penting', 'bisa_menunggu', 'ditunda_sadar')),
  -- Tag JENIS pekerjaan, boleh lebih dari satu -- text[] (bukan tabel junction
  -- terpisah): daftar tag kecil & jarang berubah, tidak butuh normalisasi penuh
  -- (YAGNI, sesuai preferensi "jangan bangun abstraksi untuk kebutuhan yang
  -- belum nyata"). Nilai AWAL: Visual, Teks/Bahasa, Fungsi, Database, Formula,
  -- Keamanan, Data, Integrasi, Dokumentasi -- boleh nambah kalau menemukan
  -- jenis yang genuinely berbeda (catat penambahannya di HANDOFF).
  tags text[] not null default '{}',
  -- PIC: teks bebas ("Claude Code" / "Pemilik Produk" / "PPIC" / nama pihak
  -- luar) -- BUKAN enum, karena pihak luar (mis. nama konsultan) tidak
  -- terbatas ke daftar tertutup.
  pic text not null,
  status text not null check (status in ('menunggu', 'sedang_dikerjakan', 'menunggu_persetujuan', 'selesai', 'ditunda_sadar', 'dibatalkan')),
  link_url text,
  origin text not null check (origin in ('pemilik_produk', 'temuan_claude', 'perencanaan_awal')),
  detail_pekerjaan text not null,
  notes text,
  -- Pemicu tercatat untuk "Ditunda Sadar" (D.1: harus punya pemicu, bukan
  -- ditunda tanpa alasan).
  ditunda_pemicu text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  approved_at timestamptz,
  -- Sejak kapan status urgency SAAT INI jadi super_urgent (D.4: "tampilkan
  -- sejak kapan"). NULL kalau urgency bukan super_urgent.
  super_urgent_since timestamptz,
  -- E.3 -- WAJIB terisi kalau status = menunggu_persetujuan, ditegakkan lewat
  -- CHECK constraint di bawah (bukan cuma validasi UI).
  approval_review_steps text,
  approval_location text,
  approval_example_case text,
  approval_if_approved text,
  approval_if_rejected text,
  approval_options text,
  unique (company_id, task_code),
  -- E.3: task TIDAK BOLEH masuk status menunggu_persetujuan dengan kolom
  -- persetujuan kosong.
  constraint build_tasks_approval_fields_required check (
    status <> 'menunggu_persetujuan' or (
      approval_review_steps is not null and
      approval_location is not null and
      approval_example_case is not null and
      approval_if_approved is not null and
      approval_if_rejected is not null
    )
  )
);

create index if not exists build_tasks_company_id_idx on build_tasks (company_id);
create index if not exists build_tasks_status_idx on build_tasks (company_id, status);
create index if not exists build_tasks_tags_idx on build_tasks using gin (tags);

-- D.4: riwayat perubahan urgensi -- nilai lama, nilai baru, kapan, atas
-- permintaan siapa.
create table if not exists build_task_urgency_history (
  build_task_urgency_history_id serial primary key,
  build_task_id integer not null references build_tasks(build_task_id),
  old_urgency text,
  new_urgency text not null,
  changed_at timestamptz not null default now(),
  requested_by text not null
);
create index if not exists build_task_urgency_history_task_id_idx on build_task_urgency_history (build_task_id);

-- E.4: riwayat persetujuan/penolakan -- TIDAK PERNAH ditimpa, berapa kali
-- sebuah task ditolak adalah informasi berguna.
create table if not exists build_task_approval_history (
  build_task_approval_history_id serial primary key,
  build_task_id integer not null references build_tasks(build_task_id),
  action text not null check (action in ('submitted', 'approved', 'rejected')),
  note text,
  at timestamptz not null default now(),
  by_whom text
);
create index if not exists build_task_approval_history_task_id_idx on build_task_approval_history (build_task_id);

-- A.2: halaman HANYA BACA. Tidak ada policy insert/update/delete untuk
-- authenticated/anon SAMA SEKALI -- satu-satunya cara menulis adalah lewat
-- migrasi/skrip service-role, TIDAK ADA endpoint aplikasi yang menulis ke
-- tabel ini. Ini pola default-deny yang sama dipakai document_types/kamus_terms
-- (tulis lewat service-role, baca lewat RLS select biasa).
alter table build_tasks enable row level security;
alter table build_task_urgency_history enable row level security;
alter table build_task_approval_history enable row level security;

drop policy if exists build_tasks_select_for_company on build_tasks;
create policy build_tasks_select_for_company on build_tasks
  for select using (company_id = public.jwt_company_id());

drop policy if exists build_task_urgency_history_select_for_company on build_task_urgency_history;
create policy build_task_urgency_history_select_for_company on build_task_urgency_history
  for select using (
    exists (select 1 from build_tasks bt where bt.build_task_id = build_task_urgency_history.build_task_id and bt.company_id = public.jwt_company_id())
  );

drop policy if exists build_task_approval_history_select_for_company on build_task_approval_history;
create policy build_task_approval_history_select_for_company on build_task_approval_history
  for select using (
    exists (select 1 from build_tasks bt where bt.build_task_id = build_task_approval_history.build_task_id and bt.company_id = public.jwt_company_id())
  );
