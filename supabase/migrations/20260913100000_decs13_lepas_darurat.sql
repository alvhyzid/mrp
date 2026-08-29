-- DEC-S13 — PELEPASAN DARURAT PENGHALANG PO KLIEN.
--
-- KEPUTUSAN ARSITEKTUR: FABRIX WAJIB punya pelepasan darurat.
-- YANG BUKAN: melewati wewenang. Pelepasan darurat adalah WEWENANG LAIN yang lebih tinggi,
-- dengan alasan wajib dan jejak wajib -- bukan pintu belakang untuk wewenang yang sama.
--
-- MASALAH YANG DIPECAHKAN, terukur di kode yang sudah ada:
--   lepas_po_klien() mewajibkan pelepas berasal dari DEPARTEMEN YANG SAMA dengan penahan.
--   Konsekuensinya sudah disadari dan sengaja dibiarkan saat itu: bila satu-satunya pemegang
--   peran departemen itu tidak tersedia, PO-nya tertahan tanpa jalan keluar.
--
-- YANG SENGAJA TIDAK DILAKUKAN DI SINI:
--   nol tabel penghalang baru, nol tabel log baru, nol sistem persetujuan kedua,
--   nol peran baru. Yang ditambah: dua kolom pada log kanonik, satu katalog alasan,
--   satu penolong wewenang, dan satu fungsi.

-- =============================================================================================
-- 1. DUA KOLOM PADA LOG KANONIK
-- =============================================================================================
-- MEMPERLUAS status_transition_log, BUKAN membuat emergency_override_log.
-- Keduanya null untuk seluruh transisi biasa -- hanya pelepasan darurat yang mengisinya.
alter table status_transition_log
  add column if not exists authority_basis text,
  add column if not exists overridden_department text;

comment on column status_transition_log.authority_basis is
  'Dasar wewenang saat sebuah keputusan MELAMPAUI jalur normal (DEC-S13). Null untuk keputusan biasa.';
comment on column status_transition_log.overridden_department is
  'Departemen yang penghalangnya dilampaui (DEC-S13). Null untuk keputusan biasa. Baris penahanan ASLI tidak pernah disentuh -- ini baris BARU.';

-- =============================================================================================
-- 2. PENOLONG WEWENANG -- EKSPLISIT, BUKAN DISIMPULKAN DARI "is_manager"
-- =============================================================================================
-- MENYALIN EMERGENCY_HOLD_RELEASE_ROLES di src/lib/roles.ts. Bila salah satunya berubah,
-- keduanya wajib ikut -- pola yang sama dipakai jwt_decision_department().
--
-- KENAPA PUNYA NAMA SENDIRI padahal isinya sama dengan kepemimpinan: supaya mempersempitnya
-- kelak (misal hanya General Manager) mengubah SATU tempat, dan supaya di tempat pemakaian
-- terbaca "wewenang darurat", bukan "kebetulan dia pimpinan".
create or replace function public.jwt_boleh_lepas_darurat()
returns boolean
language sql
stable
as $$
  select coalesce(public.jwt_is_company_leadership(), false);
$$;

comment on function public.jwt_boleh_lepas_darurat() is
  'Wewenang PELEPASAN DARURAT (DEC-S13). Menyalin EMERGENCY_HOLD_RELEASE_ROLES di src/lib/roles.ts.';

-- =============================================================================================
-- 3. KATALOG ALASAN
-- =============================================================================================
-- Terikat departemen `manager`: kategori ini hanya boleh dipakai pemegang wewenang darurat,
-- ditegakkan pasang_konteks_keputusan() yang sudah ada.
insert into decision_reason_categories (entity, action, department, code, label, requires_note, sort_order)
select v.entity, v.action, v.department, v.code, v.label, v.requires_note, v.sort_order
from (values
  ('customer_purchase_orders', 'emergency_release', 'manager', 'pemegang_wewenang_tidak_tersedia', 'Pemegang wewenang departemen tidak tersedia', true,  10),
  ('customer_purchase_orders', 'emergency_release', 'manager', 'penghalang_sudah_tidak_berlaku',   'Penghalang sudah tidak berlaku dan tidak bisa dikonfirmasi departemennya', true, 20),
  ('customer_purchase_orders', 'emergency_release', 'manager', 'keputusan_pimpinan',               'Keputusan pimpinan atas pertimbangan komersial', true, 30),
  ('customer_purchase_orders', 'emergency_release', 'manager', 'lainnya',                          'Lainnya', true, 999)
) as v(entity, action, department, code, label, requires_note, sort_order)
where not exists (
  select 1 from decision_reason_categories d
  where d.entity = v.entity and d.action = v.action and d.code = v.code
);

-- CATATAN: KEEMPATNYA requires_note = true, dan itu disengaja. Pelepasan darurat tanpa
-- kalimat penjelas tidak bisa dipertanggungjawabkan berbulan-bulan kemudian, sekalipun
-- kategorinya sudah dipilih.

-- =============================================================================================
-- 4. KONTEKS TAMBAHAN
-- =============================================================================================
-- Memanggil pasang_konteks_keputusan() yang sudah ada lebih dulu -- seluruh pemeriksaan
-- kategori/departemen/catatan tetap berlaku -- lalu MENAMBAH dua nilai.
create or replace function public.pasang_konteks_darurat(
  p_entity text,
  p_action text,
  p_reason_category text,
  p_reason_note text,
  p_authority_basis text,
  p_overridden_department text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public.pasang_konteks_keputusan(p_entity, p_action, p_reason_category, p_reason_note);
  perform set_config('fabrix.authority_basis', coalesce(p_authority_basis, ''), true);
  perform set_config('fabrix.overridden_department', coalesce(p_overridden_department, ''), true);
end;
$$;

-- =============================================================================================
-- 5. TRIGGER IKUT MEMBACA DUA NILAI BARU
-- =============================================================================================
-- BADAN FUNGSI DIAMBIL APA ADANYA DARI BASIS DATA (pg_get_functiondef), lalu DITAMBAH dua
-- kolom. Versi pertama migrasi ini sempat menulis ulang trigger dari ingatan dan diam-diam
-- MENGHILANGKAN: gerbang tiga persetujuan PO klien, kewajiban foto bukti pengiriman,
-- penentuan record_id per tabel, kode galat 23514, dan fallback changed_by.
-- Ditangkap sebelum diterapkan dengan membandingkan ke definisi sungguhan.
create or replace function public.enforce_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_allowed boolean;
  v_record_id integer;
  v_company_id integer;
  v_changed_by integer;
  v_approved_count integer;
  v_reason_category text;
  v_reason text;
  v_actor_name text;
  v_actor_role text;
  v_actor_department text;
  v_approval_ref integer;
  v_authority_basis text;
  v_overridden_department text;
begin
  if new.status = old.status then
    return new;
  end if;

  select exists (
    select 1 from status_transition_rules
    where table_name = TG_TABLE_NAME and from_status = old.status and to_status = new.status
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Transisi status % -> % tidak valid untuk tabel %.', old.status, new.status, TG_TABLE_NAME
      using errcode = '23514';
  end if;

  if TG_TABLE_NAME = 'customer_purchase_orders' and new.status = 'processed' then
    select count(*) into v_approved_count
    from customer_po_approvals
    where customer_purchase_order_id = new.customer_purchase_order_id and status = 'approved';
    if v_approved_count < 3 then
      raise exception 'customer_purchase_orders % belum disetujui ketiga department (baru % dari 3) -- tidak boleh diproses.', new.customer_purchase_order_id, v_approved_count
        using errcode = '23514';
    end if;
  end if;

  -- shipments draft->shipped WAJIB sudah ada foto bukti pengiriman
  -- (dispatch_photo_url, migration 20260817190000) -- ditegakkan di sini supaya
  -- tidak bisa dilewati lewat jalur mana pun selain endpoint aplikasi yang benar.
  if TG_TABLE_NAME = 'shipments' and old.status = 'draft' and new.status = 'shipped' then
    if new.dispatch_photo_url is null then
      raise exception 'Foto bukti pengiriman wajib sebelum status diubah ke Di Proses.'
        using errcode = '23514';
    end if;
  end if;

  if TG_TABLE_NAME = 'customer_purchase_orders' then
    v_record_id := new.customer_purchase_order_id;
    v_company_id := new.company_id;
    v_changed_by := new.processed_by;
  elsif TG_TABLE_NAME = 'sales_orders' then
    v_record_id := new.sales_order_id;
    v_company_id := new.company_id;
  elsif TG_TABLE_NAME = 'work_orders' then
    v_record_id := new.work_order_id;
    v_company_id := new.company_id;
  elsif TG_TABLE_NAME = 'production_batches' then
    v_record_id := new.production_batch_id;
    v_company_id := new.company_id;
  elsif TG_TABLE_NAME = 'customer_po_approvals' then
    v_record_id := new.customer_po_approval_id;
    v_changed_by := new.approved_by;
    select company_id into v_company_id from customer_purchase_orders where customer_purchase_order_id = new.customer_purchase_order_id;
  elsif TG_TABLE_NAME = 'shipments' then
    v_record_id := new.shipment_id;
    v_company_id := new.company_id;
  end if;

  -- Konteks keputusan dititipkan RPC pemanggil lewat setelan sesi ber-lingkup
  -- transaksi. Bila perpindahan status datang dari jalur yang TIDAK menitipkan
  -- konteks, seluruh nilai di bawah null -- dan itu DISENGAJA. Baris tanpa pelaku
  -- adalah baris yang JUJUR mengatakan pelakunya tidak diketahui; mengarang
  -- pelakunya jauh lebih berbahaya daripada mengakui tidak tahu.
  v_reason_category  := nullif(current_setting('fabrix.reason_category', true), '');
  v_reason           := nullif(current_setting('fabrix.reason_note', true), '');
  v_actor_name       := nullif(current_setting('fabrix.actor_name', true), '');
  v_actor_role       := nullif(current_setting('fabrix.actor_role', true), '');
  v_actor_department := nullif(current_setting('fabrix.actor_department', true), '');
  v_approval_ref     := nullif(current_setting('fabrix.approval_reference_id', true), '')::integer;

  -- DEC-S13 -- hanya terisi pada keputusan yang MELAMPAUI jalur normal.
  v_authority_basis       := nullif(current_setting('fabrix.authority_basis', true), '');
  v_overridden_department := nullif(current_setting('fabrix.overridden_department', true), '');

  if v_changed_by is null then
    v_changed_by := nullif(current_setting('fabrix.actor_user_id', true), '')::integer;
  end if;

  insert into status_transition_log (
    company_id, table_name, record_id, from_status, to_status, changed_by, reason,
    reason_category, actor_name_snapshot, actor_role_snapshot, actor_department_snapshot, approval_reference_id,
    authority_basis, overridden_department
  )
  values (
    v_company_id, TG_TABLE_NAME, v_record_id, old.status, new.status, v_changed_by, v_reason,
    v_reason_category, v_actor_name, v_actor_role, v_actor_department, v_approval_ref,
    v_authority_basis, v_overridden_department
  );

  return new;
end;
$$;

-- =============================================================================================
-- 6. PELEPASAN DARURAT
-- =============================================================================================
create or replace function public.lepas_darurat_po_klien(
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
  v_user users%rowtype;
begin
  perform public.wajib_identitas_tenant();

  select * into v_user from users where auth_uid = auth.uid()::text;
  if v_user.user_id is null then
    raise exception 'Pengguna tidak dikenali.';
  end if;

  -- WEWENANG DARURAT -- coalesce WAJIB: `not NULL` bernilai NULL dan cabangnya tidak
  -- dieksekusi, sehingga gerbangnya DILEWATI alih-alih menolak (kelas cacat SEC-23).
  if not coalesce(public.jwt_boleh_lepas_darurat(), false) then
    raise exception 'Peran Anda tidak berwenang melakukan pelepasan darurat.';
  end if;

  select * into v_po from customer_purchase_orders
  where customer_purchase_order_id = p_customer_purchase_order_id for update;
  if v_po.customer_purchase_order_id is null or v_po.company_id is distinct from public.jwt_company_id() then
    raise exception 'PO client tidak ditemukan di perusahaan Anda.';
  end if;

  if v_po.status <> 'on_hold' then
    raise exception 'PO client ini tidak sedang ditahan (status saat ini: %).', v_po.status;
  end if;

  select actor_department_snapshot into v_departemen_penahan
  from status_transition_log
  where table_name = 'customer_purchase_orders'
    and record_id = p_customer_purchase_order_id
    and to_status = 'on_hold'
  order by status_transition_log_id desc
  limit 1;

  v_departemen_saya := public.jwt_decision_department();

  -- PELEPASAN DARURAT BUKAN JALAN PINTAS UNTUK WEWENANG YANG SAMA.
  -- Bila penahannya departemen Anda sendiri, jalur normal terbuka dan wajib dipakai --
  -- supaya jejaknya tidak menyebut "darurat" untuk keputusan yang biasa saja.
  if v_departemen_penahan is not null and v_departemen_penahan = v_departemen_saya then
    raise exception 'Penghalang ini milik departemen Anda sendiri. Pakai pelepasan biasa, bukan pelepasan darurat.';
  end if;

  perform public.pasang_konteks_darurat(
    'customer_purchase_orders', 'emergency_release', p_reason_category, p_reason_note,
    format('Wewenang darurat DEC-S13 — %s (%s)', coalesce(v_user.name, '-'), coalesce(v_user.role, '-')),
    coalesce(v_departemen_penahan, 'tidak tercatat')
  );

  -- SATU kolom yang berubah. Baris penahanan ASLI di status_transition_log tidak disentuh:
  -- trigger MENAMBAH baris baru, sehingga siapa yang menahan, kapan, dan alasannya tetap utuh.
  update customer_purchase_orders set status = 'new'
  where customer_purchase_order_id = p_customer_purchase_order_id;
end;
$$;

revoke execute on function public.jwt_boleh_lepas_darurat() from public, anon;
revoke execute on function public.pasang_konteks_darurat(text, text, text, text, text, text) from public, anon;
revoke execute on function public.lepas_darurat_po_klien(integer, text, text) from public, anon;
grant execute on function public.jwt_boleh_lepas_darurat() to authenticated;
grant execute on function public.pasang_konteks_darurat(text, text, text, text, text, text) to authenticated;
grant execute on function public.lepas_darurat_po_klien(integer, text, text) to authenticated;
