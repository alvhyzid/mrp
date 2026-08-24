-- B.2 / GDG — LOT KEDALUWARSA: penegakan di DATABASE, bukan di lapisan aplikasi.
--
-- MASALAHNYA: status lot 'expired' terdaftar sejak awal dan TIDAK PERNAH BISA TERCAPAI —
-- tidak ada satu pun kode yang menulisnya. Akibatnya bahan yang lewat tanggal kedaluwarsa
-- tetap muncul sebagai stok tersedia dan tetap bisa dipakai produksi. Untuk pabrik
-- ber-NIE BPOM dan bersertifikat halal, itu jalur di mana bahan kedaluwarsa bisa masuk
-- produk yang dikonsumsi orang.
--
-- KENAPA CUKUP SATU PERUBAHAN STATUS: kesembilan tempat yang membaca stok tersedia
-- (ringkasan dashboard, KPI nilai persediaan, ledakan kebutuhan BOM, daftar lot, ringkasan
-- stok, penyesuaian stok, pemakaian produksi, hasil produksi, peringatan stok menipis)
-- SEMUANYA menyaring dengan `status = 'available'`. Memindahkan lot kedaluwarsa keluar
-- dari status itu menutup kesembilan pintu sekaligus — jauh lebih aman daripada menambal
-- sembilan tempat satu per satu, karena tempat KESEPULUH yang lahir bulan depan ikut aman.
--
-- LOT TANPA TANGGAL KEDALUWARSA TIDAK TERSENTUH (keputusan GDG-06): ia BUKAN kedaluwarsa,
-- ia TIDAK DIKETAHUI. `expiry_date is null` sengaja tidak masuk syarat mana pun di bawah.

-- ============================================================================
-- 1) PENANDA: memindahkan lot yang lewat tanggal ke status 'expired'.
--
-- Dijalankan berkala (menumpang jadwal pengawas yang sudah ada, bukan penjadwal baru).
-- Aman dijalankan berkali-kali: hanya menyentuh yang masih 'available'.
-- ============================================================================
create or replace function tandai_lot_kedaluwarsa(p_company_id integer default null)
returns table(lot_id integer, lot_number text, item_id integer, expiry_date date)
language sql
volatile
set search_path = public
as $$
  update lots
  set status = 'expired'
  where status = 'available'
    and expiry_date is not null
    and expiry_date < current_date
    and (p_company_id is null or company_id = p_company_id)
  returning lot_id, lot_number, item_id, expiry_date;
$$;

revoke execute on function tandai_lot_kedaluwarsa(integer) from public, anon, authenticated;
grant execute on function tandai_lot_kedaluwarsa(integer) to service_role;

comment on function tandai_lot_kedaluwarsa(integer) is
  'Memindahkan lot yang melewati tanggal kedaluwarsa dari available ke expired (B.2). Lot TANPA '
  'tanggal TIDAK tersentuh — ia bukan kedaluwarsa, ia tidak diketahui (keputusan GDG-06). '
  'Hanya service_role: menerima company_id sebagai parameter.';

-- ============================================================================
-- 2) PENJAGA KERAS: menolak PEMAKAIAN lot kedaluwarsa, di tingkat database.
--
-- INI YANG MEMBUAT PENEGAKANNYA NYATA. Penanda di atas berjalan berkala, jadi selalu ada
-- jeda antara sebuah lot lewat tanggal dan statusnya berubah. Tanpa penjaga ini, di dalam
-- jeda itu lot kedaluwarsa masih bisa dipakai — dan jeda itu justru terjadi tepat di hari
-- pertama lot kedaluwarsa, hari yang paling mungkin salah pakai.
--
-- Penjaga ini memeriksa TANGGALNYA, bukan statusnya, sehingga tidak bergantung pada
-- penanda sudah berjalan atau belum. Menyembunyikan tombol di layar TIDAK cukup: siapa pun
-- yang memanggil API langsung akan menembusnya.
--
-- Yang DITOLAK hanya pergerakan KELUAR untuk dipakai/dikirim. Penyesuaian (adjustment)
-- SENGAJA tetap diizinkan — justru lewat itulah lot kedaluwarsa dinolkan saat dimusnahkan.
-- ============================================================================
create or replace function tolak_pemakaian_lot_kedaluwarsa()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_expiry date;
  v_lot text;
begin
  if new.movement_type not in ('production_issue', 'shipment') then
    return new;
  end if;

  select expiry_date, lot_number into v_expiry, v_lot from lots where lot_id = new.lot_id;

  if v_expiry is not null and v_expiry < current_date then
    raise exception
      'Lot % sudah KEDALUWARSA (% ) dan tidak boleh dipakai atau dikirim. Bila barangnya akan dimusnahkan, catat lewat penyesuaian stok, bukan pemakaian produksi.',
      coalesce(v_lot, new.lot_id::text), v_expiry
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tolak_pemakaian_lot_kedaluwarsa on stock_movements;
create trigger trg_tolak_pemakaian_lot_kedaluwarsa
  before insert on stock_movements
  for each row execute function tolak_pemakaian_lot_kedaluwarsa();

comment on function tolak_pemakaian_lot_kedaluwarsa() is
  'Menolak pemakaian produksi & pengiriman dari lot yang lewat tanggal kedaluwarsa (B.2). '
  'Memeriksa TANGGAL, bukan status, supaya tidak bergantung pada penanda berkala sudah jalan '
  'atau belum. Penyesuaian stok sengaja TETAP diizinkan — itu jalur pemusnahan.';

-- ============================================================================
-- 3) FEFO: lot kedaluwarsa TIDAK BOLEH ikut disarankan (GDG-05 dikerjakan bersama).
--
-- FEFO yang menyertakan lot kedaluwarsa lebih buruk daripada FEFO yang tidak dipanggil
-- sama sekali: ia AKTIF menyarankan bahan yang tidak boleh dipakai, dengan tampilan yang
-- terlihat resmi.
--
-- Lot TANPA tanggal TETAP MUNCUL (keputusan GDG-06 belum final soal urutannya) — dan
-- kolom penanda ditambahkan supaya layar bisa membedakannya tanpa menebak dari null.
-- ============================================================================
drop function if exists suggest_fefo_lots(integer, integer);

create function suggest_fefo_lots(p_item_id integer, p_production_plant_id integer)
returns table(lot_id integer, lot_number text, expiry_date date, quantity_on_hand numeric, tanggal_belum_diketahui boolean)
language sql
stable
set search_path = public
as $$
  select lot_id, lot_number, expiry_date, quantity_on_hand, (expiry_date is null) as tanggal_belum_diketahui
  from lots
  where item_id = p_item_id
    and production_plant_id = p_production_plant_id
    and status = 'available'
    and quantity_on_hand > 0
    -- Sabuk pengaman kedua: walau status 'available' seharusnya sudah menyingkirkan yang
    -- kedaluwarsa, tanggalnya diperiksa lagi di sini supaya jeda penanda berkala tidak
    -- pernah menghasilkan saran yang salah.
    and (expiry_date is null or expiry_date >= current_date)
  order by expiry_date asc nulls last, lot_id asc;
$$;

revoke execute on function suggest_fefo_lots(integer, integer) from public, anon;
grant execute on function suggest_fefo_lots(integer, integer) to authenticated, service_role;

comment on function suggest_fefo_lots(integer, integer) is
  'Saran FEFO. Lot KEDALUWARSA dikecualikan (B.2). Lot TANPA tanggal tetap muncul dengan penanda '
  'tanggal_belum_diketahui — urutannya masih menunggu keputusan pemilik produk (GDG-06).';
