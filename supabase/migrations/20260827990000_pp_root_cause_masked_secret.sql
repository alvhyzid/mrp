-- PP (lanjutan, 23 Agu 2026) -- AKAR PENYEBAB KEDUA ditemukan setelah kunci
-- legacy diganti: login tetap gagal "Akun tidak valid atau tidak terdaftar di
-- tenant". Dituntaskan lewat route diagnostik sementara (sudah dihapus).
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'PT ITM tidak ditemukan -- dilewati.';
    return;
  end if;

  update build_tasks
  set status = 'selesai',
      completed_at = now(),
      detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDITUTUP 23 Agu 2026 -- LOGIN PRODUCTION TERBUKTI BEKERJA (uji peramban sungguhan, bukan hanya bundle/CLI).\n\n' ||
        E'AKAR PENYEBAB KEDUA (berbeda dari yang pertama, ditemukan setelah kunci legacy diganti): `supabase projects api-keys` MENGEMBALIKAN SECRET KEY DALAM BENTUK TERSAMAR (mis. `sb_secret_LFSCj··························` -- berisi karakter titik-tengah sebagai penyamar), sementara PUBLISHABLE key dikembalikan UTUH. Karena nilai tersamar itu ikut dipasang ke Vercel, sisi server memakai kunci tidak sah -- dibuktikan lewat route diagnostik sementara: raw fetch ke PostgREST mengembalikan HTTP 401 {"message":"Invalid API key","hint":"...might also be owned by another Supabase project"}. Gejalanya MENYESATKAN: `supabase-js` mengembalikan data null TANPA melempar error yang jelas di pemakaian head/count, sehingga tampak seperti "baris tidak ditemukan" (RLS) padahal sebenarnya "kunci tidak sah".\n\n' ||
        E'PERBAIKAN: nilai secret key UTUH diambil dari `.env.local` di mesin kerja (yang sudah terbukti bekerja untuk 275 test + server dev), dipasang ke Vercel lewat API, lalu DIVERIFIKASI BACA-BALIK cocok byte-per-byte. Variabel diubah dari type `sensitive` ke `encrypted` supaya nilainya bisa dibaca ulang untuk verifikasi -- pelajaran tersendiri: variabel yang tidak bisa dibaca-balik tidak bisa diverifikasi, dan yang tidak bisa diverifikasi akan gagal diam-diam.\n\n' ||
        E'PELAJARAN TAMBAHAN (Vercel): "Redeploy" dari deployment lama MEWARISI snapshot env deployment sumber -- variabel yang baru diperbarui TIDAK ikut. Hanya deployment BARU dari git yang membaca nilai terkini. Dua putaran perbaikan sempat terbuang karena ini.\n\n' ||
        E'BUKTI AKHIR: (a) login peramban sungguhan ke https://mrp-staging-zeta.vercel.app -> MASUK ke /dashboard, menu lengkap tampil; (b) isolasi tenant tetap benar (Company B melihat datanya sendiri: 0 karyawan, bukan 30 milik PT ITM); (c) POD tetap terbuka tanpa login Vercel (HTTP 200 dari aplikasi, 0 penanda Vercel SSO) -- kontrak eksternal aman; (d) route diagnostik sementara SUDAH DIHAPUS (dikonfirmasi HTTP 404).'
  where task_code = 'INF-11' and company_id = v_company_id;

  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nPERINGATAN 23 Agu 2026 (dari insiden PP) -- SECRET KEY TIDAK BISA DIAMBIL LEWAT CLI: `supabase projects api-keys` mengembalikan secret key TERSAMAR (berisi karakter penyamar), termasuk untuk project fabrix-ci-test (dikonfirmasi). Kalau nilai tersamar itu dipasang, hasilnya "Invalid API key" yang gejalanya menyesatkan (tampak seperti baris tidak ditemukan/RLS). Jadi untuk mengisi SUPABASE_SERVICE_ROLE_KEY di GitHub Secrets, pemilik produk WAJIB menyalinnya dari Supabase Dashboard -> fabrix-ci-test -> Settings -> API -> Secret key (klik Reveal), BUKAN dari CLI. Publishable key aman diambil lewat CLI (dikembalikan utuh).'
  where task_code = 'INF-17' and company_id = v_company_id;
end $$;
