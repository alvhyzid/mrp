-- Konsolidasi production_plants (PT ITM, company_id dicari dari nama) — 27 Agu 2026.
--
-- KONFIRMASI PEMILIK PRODUK (26 Agu 2026): kondisi lapangan sebenarnya hanya 3
-- plant: (1) Ruko Dieng - Gummy, (2) Puncak Dieng - Gummy, BELUM BEROPERASI,
-- (3) KL Bizhub (Karanglo) - Minuman Serbuk. "KL Bizhub" dan "Karanglo" adalah
-- LOKASI FISIK YANG SAMA dengan tiga sebutan berbeda di lapangan: "KL Bizhub"
-- (homebase payroll), "Gudang KL BIZ" (dokumen stock opname), "Karanglo"
-- (sebutan sehari-hari). Sistem sebelum migrasi ini punya 4 baris:
-- Pabrik Utama PT ITM (11) / Karanglo (471) / Ruko Dieng (472) / KL Bizhub (1052).
--
-- Investigasi referensi (dijalankan sebelum migrasi ini, dilaporkan ke pemilik
-- produk, dikonfirmasi via 2 pertanyaan Y/T sebelum eksekusi):
--   - Karanglo (471): 10 karyawan (semua wage_type=daily, "Operator Produksi" —
--     inilah "10 PHL" yang dimaksud pemilik produk), 1 work_center (Mesin
--     Filling Sachet / WC-FILLING-SACHET, 2 unit — cocok dengan
--     docs/routing-serbuk-10-tahap-referensi.md).
--   - KL Bizhub (1052): 2 karyawan (Sandra Wedi Pradika, Angga Ade Mahendra),
--     keduanya wage_type=monthly, aktif. Pemilik produk hanya menyebut eksplisit
--     "Angga Ade" di instruksi awal; dikonfirmasi terpisah bahwa Sandra IKUT
--     pindah ke plant gabungan (satu lokasi fisik yang sama).
--   - Pabrik Utama PT ITM (11): pemilik produk menyatakan ini "sisa nama demo
--     lama, BUKAN plant nyata". Investigasi menemukan 33 baris employees + 2
--     work_centers MENUNJUK ke sini — secara harfiah "ada yang menunjuk", jadi
--     dilaporkan dulu sebelum dihapus sesuai instruksi eksplisit. Detail yang
--     dilaporkan: SELURUH 33 karyawan berstatus is_active=false (nonaktif),
--     nama-namanya nama depan generik (Alvan, Bayu, Dimas, Mega, Asni, Dina,
--     Miasih, dst.) yang persis jadi "cikal bakal" nama lengkap yang sekarang
--     tercatat aktif di Ruko Dieng (mis. Alvan -> Alvan Handyka Yudha, Bayu ->
--     Bayu Oktavian Wibowo) — pola data demo lama yang sudah digantikan entri
--     asli, bukan digantikan-tapi-baris-lama-dibiarkan. 2 work_centers-nya
--     (WC-01/WC-02 "Line Produksi 1/2") 0 baris di routing_steps. 0 baris di
--     employee_attendance/attendance_events/attendance_corrections/
--     leave_requests/work_order_assignments untuk ke-33 employee_id ini — nol
--     jejak operasional. Pemilik produk mengonfirmasi: hapus total.
--
-- Kenapa migrasi (bukan script ad-hoc): sama seperti Bagian A/B sesi ini,
-- migrasi = satu transaksi atom (all-or-nothing), portable lintas project
-- (dev/staging) via `select ... where name = 'PT ITM'` yang no-op halus kalau
-- perusahaan tidak ditemukan (lihat pola raise notice di migrasi 20260826210000).
--
-- INI WAKTU TERBAIK untuk migrasi ini: stok = NOL di seluruh sistem (Bagian B
-- baru saja mengosongkan total studi kasus), jadi TIDAK ADA lot yang perlu
-- dipindah antar plant.

-- Kolom kecil baru (bukan tabel/subsistem baru) untuk menyimpan sebutan lain
-- di lapangan untuk plant yang sama -- sesuai prinsip "kolom sederhana untuk
-- kebutuhan nyata", bukan abstraksi generik untuk kebutuhan yang belum ada.
alter table if exists production_plants
  add column if not exists alias_notes text;

do $$
declare
  v_company_id integer;
  v_karanglo_id integer;
  v_kl_bizhub_id integer;
  v_pabrik_utama_id integer;
  v_ruko_dieng_id integer;
  v_moved_employees integer;
  v_deleted_pu_employees integer;
  v_deleted_pu_workcenters integer;
  v_new_puncak_dieng_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan di project ini -- migrasi konsolidasi plant dilewati (no-op).';
    return;
  end if;

  select production_plant_id into v_karanglo_id from production_plants where company_id = v_company_id and name = 'Karanglo';
  select production_plant_id into v_kl_bizhub_id from production_plants where company_id = v_company_id and name = 'KL Bizhub';
  select production_plant_id into v_pabrik_utama_id from production_plants where company_id = v_company_id and name = 'Pabrik Utama PT ITM';
  select production_plant_id into v_ruko_dieng_id from production_plants where company_id = v_company_id and name = 'Ruko Dieng';

  if v_karanglo_id is null or v_kl_bizhub_id is null then
    raise notice 'Baris plant Karanglo/KL Bizhub tidak ditemukan (mungkin sudah dikonsolidasi sebelumnya) -- bagian merge dilewati.';
  else
    -- Tugas 1: gabung Karanglo + KL Bizhub -> satu baris "KL Bizhub (Karanglo)".
    -- Karanglo (471) dipertahankan sebagai baris kanonik karena sudah punya
    -- work_center yang benar (Mesin Filling Sachet) dan product_focus terisi.
    update production_plants
    set name = 'KL Bizhub (Karanglo)',
        address = 'Gudang KL BIZ, Karanglo',
        product_focus = 'Minuman Serbuk',
        alias_notes = 'Nama lain yang dipakai di lapangan untuk lokasi fisik yang sama: "KL Bizhub" (homebase payroll), "Gudang KL BIZ" (dokumen stock opname), "Karanglo" (sebutan sehari-hari). Digabung dari 2 baris terpisah (Karanglo id=471 + KL Bizhub id=1052) pada 27 Agu 2026.'
    where production_plant_id = v_karanglo_id;

    -- Pindahkan seluruh karyawan KL Bizhub (termasuk Sandra Wedi Pradika,
    -- dikonfirmasi ikut pindah) ke plant gabungan -- tidak ada yang yatim.
    update employees set production_plant_id = v_karanglo_id where production_plant_id = v_kl_bizhub_id;
    get diagnostics v_moved_employees = row_count;
    raise notice 'Karyawan dipindah dari KL Bizhub (1052) ke KL Bizhub (Karanglo) (471): % baris', v_moved_employees;

    -- KL Bizhub (1052) tidak punya work_center (dicek saat investigasi) --
    -- tidak ada yang perlu dipindah selain employees di atas.
    delete from production_plants where production_plant_id = v_kl_bizhub_id;
  end if;

  if v_pabrik_utama_id is null then
    raise notice 'Baris plant Pabrik Utama PT ITM tidak ditemukan (mungkin sudah dihapus sebelumnya) -- bagian ini dilewati.';
  else
    -- Tugas 2: "Pabrik Utama PT ITM" dikonfirmasi pemilik produk sebagai sisa
    -- demo lama. 33 karyawan (semua nonaktif) + 2 work_centers (0 dipakai di
    -- routing_steps) dihapus total, bukan cuma dilepas relasinya.
    delete from employees where production_plant_id = v_pabrik_utama_id;
    get diagnostics v_deleted_pu_employees = row_count;

    delete from work_centers where production_plant_id = v_pabrik_utama_id;
    get diagnostics v_deleted_pu_workcenters = row_count;

    delete from production_plants where production_plant_id = v_pabrik_utama_id;
    raise notice 'Pabrik Utama PT ITM dihapus total: % karyawan nonaktif + % work_center ikut terhapus.', v_deleted_pu_employees, v_deleted_pu_workcenters;
  end if;

  -- Tugas 3: tambah "Puncak Dieng" -- Gummy, BELUM BEROPERASI (is_active=false
  -- supaya otomatis dikecualikan dari kalkulasi kapasitas/perencanaan).
  if not exists (select 1 from production_plants where company_id = v_company_id and name = 'Puncak Dieng') then
    insert into production_plants (company_id, name, address, product_focus, is_active)
    values (v_company_id, 'Puncak Dieng', 'Alamat belum diisi', 'Gummy', false)
    returning production_plant_id into v_new_puncak_dieng_id;
    raise notice 'Plant baru "Puncak Dieng" dibuat (id=%), is_active=false.', v_new_puncak_dieng_id;
  else
    raise notice 'Plant "Puncak Dieng" sudah ada -- dilewati (idempoten).';
  end if;

  -- Tugas 4: verifikasi ringkas (dicek lebih detail di test otomatis).
  raise notice 'Jumlah plant company_id=% setelah migrasi: %', v_company_id, (select count(*) from production_plants where company_id = v_company_id);
end $$;
