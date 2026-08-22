-- Halaman Daftar Tugas Pembangunan -- 22 Agu 2026, tambahan kecil T.2/T.3
-- sebelum lanjut ke Bagian 2-6 blok kerja paralel.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- T.2 -- INF-09
  insert into build_tasks (
    company_id, task_code, name, module_code, module_name, description, effect_description,
    urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes
  ) values (
    v_company_id, 'INF-09', 'Tinjau Ulang Service Role Key di Lingkungan Preview',
    'INF', 'Infrastruktur & Environment',
    'Kunci yang melewati SELURUH RLS (SUPABASE_SERVICE_ROLE_KEY) terpasang di lingkungan Preview Vercel.',
    'Hari ini aman karena Preview menunjuk Supabase kosong (dibuktikan INF-01/INF-07). Setelah perapian environment (INF-02), Preview bisa menunjuk tempat lain -- dan lingkungan percobaan tidak seharusnya memegang kunci yang bisa membaca-tulis SEMUA tenant kecuali memang benar-benar dibutuhkan.',
    'penting', ARRAY['Keamanan']::text[], 'Claude Code', 'menunggu', null, 'pemilik_produk',
    'PRASYARAT: INF-02 selesai. Tinjau: apakah kode yang jalan di lingkungan Preview benar-benar butuh SUPABASE_SERVICE_ROLE_KEY, atau cukup NEXT_PUBLIC_SUPABASE_ANON_KEY (RLS tetap berlaku, lebih aman untuk lingkungan percobaan). Kalau ditemukan jalur yang tidak benar-benar butuh service role, hapus variabelnya dari environment Preview di Vercel.',
    'Ditemukan sebagai kelanjutan INF-07 (22 Agu 2026, poin 1.4c).'
  )
  on conflict (company_id, task_code) do nothing;

  -- T.3 -- catatan cara verifikasi 1.4b lewat label, bukan nilai, di INF-02
  update build_tasks set
    detail_pekerjaan = detail_pekerjaan || E'\n\nPRASYARAT BELUM TERPENUHI (T.3, 22 Agu 2026): perbandingan nilai variabel environment antar lingkungan (poin 1.4b INF-07) BELUM tuntas -- pengaman otomatis Claude Code MEMBLOKIR penarikan nilai environment variable untuk dibandingkan, dan itu keputusan yang BENAR, TIDAK dicari jalan memutarnya. Cara verifikasi yang benar untuk INI: PEMILIK PRODUK memeriksa lewat Vercel Dashboard -> Settings -> Environment Variables, lihat KOLOM LABEL LINGKUNGAN pada tiap variabel (bukan membuka nilainya) -- bila satu variabel (mis. SUPABASE_SERVICE_ROLE_KEY) berlabel "Production, Preview, Development" SEKALIGUS, artinya seluruh lingkungan memakai NILAI YANG SAMA, dan itu harus dipisah (nilai per-lingkungan berbeda) SEBELUM task INF-02 mulai dikerjakan. Menunggu dashboard Vercel pulih dari error Save (lihat catatan lain di task ini) sebelum pemilik produk bisa memeriksa/memperbaiki ini.'
  where company_id = v_company_id and task_code = 'INF-02';

end $$;
