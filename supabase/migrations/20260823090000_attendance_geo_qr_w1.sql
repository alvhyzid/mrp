-- Migration: Absensi Geo-QR — GELOMBANG 1 SAJA (docs/rancangan-absensi-geo-qr.md §11).
-- Skema + RLS + state machine (ledger append-only) + geofence + rekap harian.
-- W2 (tablet QR dinamis+offline), W3 (PWA karyawan), W4 (konsol HRD penuh),
-- W5 (integrasi kapasitas/labor log/notifikasi) DITUNDA -- lihat HANDOFF.
--
-- PENYIMPANGAN JUJUR dari dokumen sumber (dicatat, bukan diam-diam):
-- 1. TIDAK membuat tabel attendance_days baru -- tabel employee_attendance
--    (SUDAH ADA sejak 20260813120000, dipakai HR dashboard) diperluas
--    menjadi rekap harian yang dimaksud §6 dokumen (menghindari 2 tabel
--    yang bersaing menjawab pertanyaan sama "status kehadiran hari ini").
-- 2. TIDAK membuat qr_token_log -- QR dinamis tablet adalah W2 (belum
--    dikerjakan), jadi belum ada yang menerbitkan/memvalidasi token. Kolom
--    qr_token_id di attendance_events tetap disiapkan (nullable) supaya W2
--    tidak perlu migrasi skema baru lagi.
-- 3. plant_geofences BUKAN tabel tersendiri -- 1 plant = 1 geofence (relasi
--    1:1), jadi 3 kolom ditambahkan langsung ke production_plants
--    (center_lat/center_lng/geofence_radius_meters) -- prinsip "kolom
--    sederhana lebih baik dari tabel baru kalau relasinya 1:1".
-- 4. Toleransi keterlambatan (Q4, BELUM dijawab pemilik produk) memakai
--    default 15 menit -- PERLU KONFIRMASI HRD, ditandai di HANDOFF, TIDAK
--    menunggu jawaban (sesuai instruksi "jangan menunggu jawaban apa pun").
-- 5. Status employee_attendance.status DIPERLUAS (union), bukan diganti --
--    5 nilai lama ('present','late','absent','on_leave','sick') masih valid
--    (dipakai scripts/seed-debug-employees.js) + nilai baru sesuai state
--    machine dokumen (uppercase, konsisten dgn istilah dokumen).

alter table if exists production_plants
  add column if not exists center_lat numeric,
  add column if not exists center_lng numeric,
  add column if not exists geofence_radius_meters numeric not null default 150;

alter table if exists employee_attendance
  drop constraint if exists employee_attendance_status_check;
alter table if exists employee_attendance
  add constraint employee_attendance_status_check check (status in (
    'present', 'late', 'absent', 'on_leave', 'sick',
    'BELUM_HADIR', 'HADIR', 'ISTIRAHAT', 'PULANG', 'TERLAMBAT', 'DI_LUAR_AREA',
    'IZIN', 'SAKIT', 'CUTI', 'ALPA', 'KOREKSI_PENDING'
  ));

alter table if exists employee_attendance
  add column if not exists production_plant_id integer references production_plants(production_plant_id),
  add column if not exists work_minutes integer,
  add column if not exists late_minutes integer,
  add column if not exists overtime_minutes integer,
  add column if not exists source_event_ids integer[] not null default '{}',
  add column if not exists geofence_status text check (geofence_status in ('DALAM', 'LUAR', 'TANPA_GPS')),
  add column if not exists flags jsonb not null default '{}'::jsonb;

-- Ledger append-only (§6, §3.6 dokumen: "event adalah ledger; rekap harian
-- adalah agregat"). employee_attendance DIHITUNG ULANG dari sini, tidak
-- pernah diedit manual field-per-field oleh kode aplikasi.
create table if not exists attendance_events (
  attendance_event_id serial primary key,
  company_id integer not null references companies(company_id),
  employee_id integer not null references employees(employee_id),
  production_plant_id integer references production_plants(production_plant_id),
  event_type text not null check (event_type in ('IN', 'OUT', 'BREAK_START', 'BREAK_END')),
  occurred_at timestamptz not null,
  method text not null check (method in ('QR_TABLET', 'GEO_PHONE', 'MANUAL_HRD')),
  lat numeric,
  lng numeric,
  accuracy_m numeric,
  geofence_status text not null check (geofence_status in ('DALAM', 'LUAR', 'TANPA_GPS')),
  device_id text,
  qr_token_id text, -- disiapkan utk W2, belum ada penerbit token
  client_event_id text,
  photo_url text,
  flags jsonb not null default '{}'::jsonb,
  recorded_by integer references users(user_id), -- diisi kalau method=MANUAL_HRD
  created_at timestamptz not null default now(),
  unique (company_id, client_event_id)
);
create index if not exists attendance_events_company_id_idx on attendance_events (company_id);
create index if not exists attendance_events_employee_date_idx on attendance_events (employee_id, occurred_at);

-- Append-only murni disiplin aplikasi -- pola SAMA PERSIS dgn
-- status_transition_log di proyek ini: TIDAK ada trigger keras yang
-- memblokir UPDATE/DELETE (itu akan menyulitkan pembersihan data test/admin
-- lewat service role tanpa manfaat nyata), TIDAK ADA policy authenticated
-- utk insert/update/delete (RLS default-deny di bawah), dan TIDAK ADA satu
-- pun server function di src/features/attendance/server/ yang memanggil
-- .update()/.delete() pada tabel ini -- koreksi selalu MENAMBAH event baru
-- (lihat attendanceCorrections.ts), dibuktikan tests/attendance_geo_qr_w1.test.ts.
-- (Percobaan pertama migrasi ini memakai trigger keras BEFORE UPDATE/DELETE --
-- diperbaiki migration 20260823100000 karena ternyata lebih ketat dari pola
-- yang sudah berlaku dan menyulitkan test cleanup tanpa manfaat tambahan.)

-- Device binding ringan v1 (§2.5): HP pertama yang dipakai employee terdaftar
-- otomatis; ganti perangkat butuh approval HRD (status kembali PENDING_APPROVAL).
create table if not exists attendance_devices (
  attendance_device_id serial primary key,
  company_id integer not null references companies(company_id),
  employee_id integer not null references employees(employee_id),
  device_fingerprint text not null,
  device_type text not null check (device_type in ('EMPLOYEE_PHONE', 'GATE_TABLET')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PENDING_APPROVAL', 'REVOKED')),
  registered_at timestamptz not null default now(),
  approved_by integer references users(user_id),
  approved_at timestamptz,
  unique (employee_id, device_fingerprint)
);
create index if not exists attendance_devices_company_id_idx on attendance_devices (company_id);
create index if not exists attendance_devices_employee_id_idx on attendance_devices (employee_id);

-- Koreksi (lupa absen/salah jam) -- state machine PENDING/APPROVED/REJECTED,
-- disetujui HRD baru menambah event baru (lihat catatan trigger di atas).
create table if not exists attendance_corrections (
  attendance_correction_id serial primary key,
  company_id integer not null references companies(company_id),
  employee_id integer not null references employees(employee_id),
  attendance_date date not null,
  requested_event_type text not null check (requested_event_type in ('IN', 'OUT')),
  requested_occurred_at timestamptz not null,
  reason text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by integer not null references users(user_id),
  decided_by integer references users(user_id),
  decided_at timestamptz,
  resulting_event_id integer references attendance_events(attendance_event_id),
  created_at timestamptz not null default now()
);
create index if not exists attendance_corrections_company_id_idx on attendance_corrections (company_id);

-- Izin/sakit/cuti -- TIDAK lewat attendance_events (tidak ada scan utk
-- ketidakhadiran), langsung menimpa status hari itu di employee_attendance
-- setelah disetujui (§6: leave_requests terpisah dari ledger event).
create table if not exists leave_requests (
  leave_request_id serial primary key,
  company_id integer not null references companies(company_id),
  employee_id integer not null references employees(employee_id),
  leave_type text not null check (leave_type in ('IZIN', 'SAKIT', 'CUTI')),
  start_date date not null,
  end_date date not null,
  reason text,
  attachment_url text,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by integer not null references users(user_id),
  decided_by integer references users(user_id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists leave_requests_company_id_idx on leave_requests (company_id);

alter table attendance_events enable row level security;
alter table attendance_devices enable row level security;
alter table attendance_corrections enable row level security;
alter table leave_requests enable row level security;

-- SELECT: sama pola scoping employee_attendance (company_admin/HR -> semua,
-- manager department -> stafnya, karyawan -> baris miliknya sendiri) TAPI
-- diterapkan di TypeScript (service-role client) seperti listAttendanceByDate
-- yang sudah ada -- BUKAN di RLS langsung, supaya konsisten satu pola di
-- seluruh domain attendance (satu tempat mengubah aturan, bukan dua).
-- RLS di sini HANYA batas company (isolasi tenant), gerbang per-role yang
-- lebih halus tetap TypeScript.
drop policy if exists attendance_events_select_for_company on attendance_events;
create policy attendance_events_select_for_company on attendance_events
  for select using (company_id = public.jwt_company_id());
drop policy if exists attendance_devices_select_for_company on attendance_devices;
create policy attendance_devices_select_for_company on attendance_devices
  for select using (company_id = public.jwt_company_id());
drop policy if exists attendance_corrections_select_for_company on attendance_corrections;
create policy attendance_corrections_select_for_company on attendance_corrections
  for select using (company_id = public.jwt_company_id());
drop policy if exists leave_requests_select_for_company on leave_requests;
create policy leave_requests_select_for_company on leave_requests
  for select using (company_id = public.jwt_company_id());

-- TIDAK ADA policy INSERT/UPDATE utk authenticated di keempat tabel --
-- SEMUA tulis lewat server function pakai admin client (pola konsisten
-- Kamus/Kesiapan AI/dst sepanjang proyek ini), gerbang role di TypeScript.
