-- WS-S05 — AKSI TERKENDALI PO KLIEN: Tahan / Lepas / Batalkan (BD-06).
--
-- INI PENULIS PERTAMA kolom jejak keputusan dari migrasi 20260906100000. Keduanya
-- SENGAJA dikerjakan di giliran yang sama: kolom audit yang lahir tanpa penulis akan
-- selamanya null, dan kolom `reason` di status_transition_log sudah membuktikan itu.
--
-- ============================================================================
-- APA YANG SUDAH ADA DAN TIDAK DIBUAT ULANG
-- ============================================================================
-- Bentuk transisinya SUDAH kanonik di status_transition_rules:
--   new -> on_hold · new -> cancelled · on_hold -> new · on_hold -> cancelled
-- Yang TIDAK ada di sana, dan karena itu terlarang dengan sendirinya:
--   processed -> apa pun  (PO yang sudah jadi Sales Order tidak bisa ditahan/dibatalkan)
--   cancelled -> apa pun  (pembatalan bersifat FINAL)
-- Migrasi ini TIDAK menambah satu pun aturan transisi. Ia hanya memberi PEMICU
-- bagi transisi yang aturannya sudah ada tetapi tidak pernah bisa terjadi.
--
-- ============================================================================
-- WEWENANG — MEMAKAI PEMETAAN KANONIK, BUKAN PEMETAAN BARU
-- ============================================================================
-- Pemetaan departemen -> peran diambil PERSIS dari canApproveDepartment() di
-- src/lib/roles.ts, yang juga dipakai kebijakan customer_po_approvals_update_by_department:
--   finance -> finance_manager · ppic -> ppic_manager · manager -> leadership
--
-- TEMUAN YANG DILAPORKAN, BUKAN DITAMBAL DIAM-DIAM: BD-06 menyebut Sales sebagai salah
-- satu departemen yang boleh menahan. TIDAK ADA peran `sales` di src/lib/roles.ts --
-- enam belas peran, tak satu pun sales. Jadi departemen `sales` SENGAJA TIDAK
-- diimplementasikan di sini; mengarang perannya akan melahirkan model peran kedua,
-- yang dilarang CLAUDE.md. Ini dicatat sebagai keputusan yang perlu diambil.
--
-- PELEPASAN DIJAGA KETAT: BD-06 menyatakan penghalang dari satu departemen tidak boleh
-- dilepas sembarang departemen lain. Ditegakkan dengan MEMBACA departemen penahan dari
-- baris jejak terakhir, lalu mewajibkan pelepasnya berasal dari departemen yang sama.
-- Konsekuensi yang disadari dan sengaja tidak ditambal: bila satu-satunya pemegang peran
-- departemen itu tidak tersedia, PO-nya tertahan. Aksi OVERRIDE untuk keadaan itu BELUM
-- dibangun -- ia butuh wewenang dan alasannya sendiri, dan menambahkannya diam-diam di
-- sini berarti mengarang aturan bisnis.

-- ============================================================================
-- KATALOG KATEGORI ALASAN (§12)
-- ============================================================================
insert into decision_reason_categories (entity, action, department, code, label, requires_note, sort_order) values
  ('customer_purchase_orders', 'hold', 'finance', 'kondisi_pembayaran',      'Kondisi pembayaran belum terpenuhi', false, 10),
  ('customer_purchase_orders', 'hold', 'finance', 'tunggakan',               'Masih ada tunggakan pelanggan',      false, 20),
  ('customer_purchase_orders', 'hold', 'finance', 'verifikasi_pembayaran',   'Menunggu verifikasi pembayaran',     false, 30),
  ('customer_purchase_orders', 'hold', 'ppic',    'kapasitas_tidak_tersedia','Kapasitas produksi tidak tersedia',  false, 40),
  ('customer_purchase_orders', 'hold', 'ppic',    'jadwal_penuh',            'Jadwal produksi penuh',              false, 50),
  ('customer_purchase_orders', 'hold', 'ppic',    'material_belum_ada',      'Material belum tersedia',            false, 60),
  ('customer_purchase_orders', 'hold', 'ppic',    'tanggal_tidak_feasible',  'Tanggal permintaan tidak bisa dipenuhi', false, 70),
  ('customer_purchase_orders', 'hold', 'ppic',    'spesifikasi_belum_lengkap','Spesifikasi belum lengkap',         false, 80),
  ('customer_purchase_orders', 'hold', 'manager', 'risiko_komersial',        'Risiko komersial',                   false, 90),
  ('customer_purchase_orders', 'hold', 'manager', 'risiko_pelanggan',        'Risiko pelanggan',                   false, 100),
  ('customer_purchase_orders', 'hold', null,      'lainnya',                 'Lainnya',                            true,  999),

  ('customer_purchase_orders', 'release', 'finance', 'pembayaran_terverifikasi', 'Pembayaran sudah terverifikasi',  false, 10),
  ('customer_purchase_orders', 'release', 'finance', 'tunggakan_selesai',        'Tunggakan sudah diselesaikan',    false, 20),
  ('customer_purchase_orders', 'release', 'ppic',    'kapasitas_tersedia',       'Kapasitas produksi sudah tersedia', false, 30),
  ('customer_purchase_orders', 'release', 'ppic',    'jadwal_tersedia',          'Jadwal produksi sudah tersedia',  false, 40),
  ('customer_purchase_orders', 'release', 'ppic',    'material_tersedia',        'Material sudah tersedia',         false, 50),
  ('customer_purchase_orders', 'release', 'ppic',    'spesifikasi_lengkap',      'Spesifikasi sudah lengkap',       false, 60),
  ('customer_purchase_orders', 'release', null,      'penghalang_selesai',       'Penghalang sudah diselesaikan',   false, 70),
  ('customer_purchase_orders', 'release', null,      'lainnya',                  'Lainnya',                         true,  999),

  ('customer_purchase_orders', 'cancel', null,      'permintaan_pelanggan',     'Diminta pelanggan',               false, 10),
  ('customer_purchase_orders', 'cancel', null,      'pembatalan_pelanggan',     'Pelanggan membatalkan pesanan',   false, 20),
  ('customer_purchase_orders', 'cancel', 'manager', 'risiko_komersial',         'Risiko komersial',                false, 30),
  ('customer_purchase_orders', 'cancel', 'manager', 'risiko_kapasitas',         'Risiko kapasitas',                false, 40),
  ('customer_purchase_orders', 'cancel', 'manager', 'risiko_pelanggan',         'Risiko pelanggan',                false, 50),
  ('customer_purchase_orders', 'cancel', 'manager', 'keputusan_strategis',      'Keputusan strategis',             false, 60),
  ('customer_purchase_orders', 'cancel', null,      'lainnya',                  'Lainnya',                         true,  999)
on conflict (entity, action, code) do nothing;

-- ============================================================================
-- PENOLONG: departemen pengguna yang sedang login, menurut PERANNYA
-- ============================================================================
-- MENYALIN canApproveDepartment() di src/lib/roles.ts. Nol departemen baru dikarang.
create or replace function public.jwt_decision_department()
returns text
language sql
stable
as $$
  select case
    when public.jwt_app_role() = 'finance_manager' then 'finance'
    when public.jwt_app_role() = 'ppic_manager' then 'ppic'
    when public.jwt_is_company_leadership() then 'manager'
    else null
  end;
$$;

comment on function public.jwt_decision_department() is
  'Departemen keputusan pengguna yang login, diturunkan dari perannya. MENYALIN canApproveDepartment() di src/lib/roles.ts -- bila salah satunya berubah, keduanya wajib ikut.';

-- ============================================================================
-- PENOLONG: memasang konteks keputusan untuk dibaca trigger
-- ============================================================================
create or replace function public.pasang_konteks_keputusan(
  p_entity text,
  p_action text,
  p_reason_category text,
  p_reason_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user users%rowtype;
  v_kategori decision_reason_categories%rowtype;
  v_departemen text;
begin
  select * into v_user from users where auth_uid = auth.uid()::text;
  if v_user.user_id is null then
    raise exception 'Pengguna tidak dikenali.';
  end if;

  v_departemen := public.jwt_decision_department();

  select * into v_kategori from decision_reason_categories
  where entity = p_entity and action = p_action and code = p_reason_category and active;

  if v_kategori.decision_reason_category_id is null then
    raise exception 'Kategori alasan tidak dikenali untuk tindakan ini.';
  end if;

  -- Kategori yang terikat departemen hanya boleh dipakai orang departemen itu --
  -- supaya alasan yang tercatat benar-benar mencerminkan siapa yang memutuskan,
  -- bukan sekadar pilihan yang kebetulan tersedia di layar.
  if v_kategori.department is not null and v_kategori.department is distinct from v_departemen then
    raise exception 'Kategori alasan ini hanya boleh dipakai departemen %.', v_kategori.department;
  end if;

  if v_kategori.requires_note and coalesce(btrim(p_reason_note), '') = '' then
    raise exception 'Kategori "%" mewajibkan catatan tambahan.', v_kategori.label;
  end if;

  perform set_config('fabrix.reason_category', p_reason_category, true);
  perform set_config('fabrix.reason_note', coalesce(btrim(p_reason_note), ''), true);
  perform set_config('fabrix.actor_user_id', v_user.user_id::text, true);
  perform set_config('fabrix.actor_name', coalesce(v_user.name, ''), true);
  perform set_config('fabrix.actor_role', coalesce(v_user.role, ''), true);
  perform set_config('fabrix.actor_department', coalesce(v_departemen, ''), true);
end;
$$;

-- ============================================================================
-- AKSI 1 — TAHAN
-- ============================================================================
create or replace function public.tahan_po_klien(
  p_customer_purchase_order_id integer,
  p_reason_category text,
  p_reason_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_po customer_purchase_orders%rowtype;
begin
  select * into v_po from customer_purchase_orders where customer_purchase_order_id = p_customer_purchase_order_id;
  if v_po.customer_purchase_order_id is null or v_po.company_id <> public.jwt_company_id() then
    raise exception 'PO client tidak ditemukan di perusahaan Anda.';
  end if;

  if public.jwt_decision_department() is null then
    raise exception 'Peran Anda tidak mewakili departemen yang boleh menahan PO client.';
  end if;

  if v_po.status <> 'new' then
    raise exception 'PO client hanya bisa ditahan saat berstatus baru (status saat ini: %).', v_po.status;
  end if;

  perform public.pasang_konteks_keputusan('customer_purchase_orders', 'hold', p_reason_category, p_reason_note);

  update customer_purchase_orders set status = 'on_hold'
  where customer_purchase_order_id = p_customer_purchase_order_id;
end;
$$;

-- ============================================================================
-- AKSI 2 — LEPAS
-- ============================================================================
create or replace function public.lepas_po_klien(
  p_customer_purchase_order_id integer,
  p_reason_category text,
  p_reason_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_po customer_purchase_orders%rowtype;
  v_departemen_penahan text;
  v_departemen_saya text;
begin
  select * into v_po from customer_purchase_orders where customer_purchase_order_id = p_customer_purchase_order_id;
  if v_po.customer_purchase_order_id is null or v_po.company_id <> public.jwt_company_id() then
    raise exception 'PO client tidak ditemukan di perusahaan Anda.';
  end if;

  if v_po.status <> 'on_hold' then
    raise exception 'PO client ini tidak sedang ditahan (status saat ini: %).', v_po.status;
  end if;

  v_departemen_saya := public.jwt_decision_department();
  if v_departemen_saya is null then
    raise exception 'Peran Anda tidak mewakili departemen mana pun.';
  end if;

  -- BD-06: penghalang dari satu departemen tidak boleh dilepas departemen lain.
  -- Departemen penahan dibaca dari jejak keputusan -- inilah alasan kolom
  -- actor_department_snapshot ada, dan buktinya ia benar-benar dipakai.
  select actor_department_snapshot into v_departemen_penahan
  from status_transition_log
  where table_name = 'customer_purchase_orders'
    and record_id = p_customer_purchase_order_id
    and to_status = 'on_hold'
  order by status_transition_log_id desc
  limit 1;

  if v_departemen_penahan is not null and v_departemen_penahan <> v_departemen_saya then
    raise exception 'PO client ini ditahan oleh departemen %. Hanya departemen itu yang boleh melepasnya.', v_departemen_penahan;
  end if;

  perform public.pasang_konteks_keputusan('customer_purchase_orders', 'release', p_reason_category, p_reason_note);

  update customer_purchase_orders set status = 'new'
  where customer_purchase_order_id = p_customer_purchase_order_id;
end;
$$;

-- ============================================================================
-- AKSI 3 — BATALKAN
-- ============================================================================
create or replace function public.batalkan_po_klien(
  p_customer_purchase_order_id integer,
  p_reason_category text,
  p_reason_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_po customer_purchase_orders%rowtype;
begin
  select * into v_po from customer_purchase_orders where customer_purchase_order_id = p_customer_purchase_order_id;
  if v_po.customer_purchase_order_id is null or v_po.company_id <> public.jwt_company_id() then
    raise exception 'PO client tidak ditemukan di perusahaan Anda.';
  end if;

  -- BD-06: wewenang AKHIR pembatalan ada di Manager/General Manager.
  -- Alur "Sales mengajukan permintaan pembatalan" BELUM dibangun -- ia butuh entitas
  -- permintaan tersendiri. Sampai itu ada, pembatalan dilakukan langsung oleh
  -- pemegang wewenang akhir, dan itu TIDAK melanggar BD-06: yang belum ada adalah
  -- jalur pengajuannya, bukan wewenangnya.
  if not public.jwt_is_company_leadership() then
    raise exception 'Hanya Manager atau General Manager yang boleh membatalkan PO client.';
  end if;

  if v_po.status not in ('new', 'on_hold') then
    raise exception 'PO client berstatus % tidak bisa dibatalkan.', v_po.status;
  end if;

  perform public.pasang_konteks_keputusan('customer_purchase_orders', 'cancel', p_reason_category, p_reason_note);

  update customer_purchase_orders set status = 'cancelled'
  where customer_purchase_order_id = p_customer_purchase_order_id;
end;
$$;

grant execute on function public.tahan_po_klien(integer, text, text) to authenticated;
grant execute on function public.lepas_po_klien(integer, text, text) to authenticated;
grant execute on function public.batalkan_po_klien(integer, text, text) to authenticated;
grant execute on function public.jwt_decision_department() to authenticated;
