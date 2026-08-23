-- PP.1-PP.6 (23 Agu 2026) -- insiden login production gagal ("Legacy API
-- keys are disabled") setelah penyambungan Bagian 4 dilaporkan selesai.
-- Akar penyebab & pelajaran dicatat; INF-17 diperbarui karena berdampak.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  -- INF-11 dibuka kembali: dilaporkan selesai padahal login belum bisa
  update build_tasks
  set status = 'menunggu',
      completed_at = null,
      detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nDIBUKA KEMBALI 23 Agu 2026 (PP.1) -- dilaporkan SELESAI padahal pemilik produk TIDAK BISA LOGIN: "Legacy API keys are disabled".\n\n' ||
        E'AKAR PENYEBAB (dibuktikan, bukan dugaan): Supabase punya DUA generasi kunci API. Project FABRIX-APP sudah MENONAKTIFKAN kunci generasi lama sejak 2026-08-11T16:25:37Z -- dibuktikan langsung: GET /rest/v1/companies dengan kunci `anon` legacy -> HTTP 401 {"message":"Legacy API keys are disabled","hint":"...were disabled on 2026-08-11..."}; dengan kunci `sb_publishable_*` -> HTTP 200. Yang saya pasang ke Vercel di Bagian 4 adalah kunci generasi LAMA (anon/service_role JWT), sementara `.env.local` di mesin lokal memakai generasi BARU (sb_publishable_/sb_secret_). Karena itu lokal jalan, production mati.\n\n' ||
        E'KENAPA 4 BUKTI DI BAGIAN 4 LOLOS PADAHAL SISTEMNYA MATI: verifikasi "isolasi tenant" dijalankan dari mesin LOKAL memakai kunci `.env.local` -- yaitu kunci yang BERBEDA dari yang di-deploy. Jadi saya menguji kunci yang bukan kunci production. Ketiga bukti lain (bundle, POD, jumlah baris) semuanya memeriksa KONFIGURASI, bukan APAKAH ORANG BISA MASUK. Lihat HANDOFF.md "PELAJARAN TETAP -- Menunjuk Project yang Benar bukan Bisa Masuk".\n\n' ||
        E'PP.2.d -- KODE APLIKASI TIDAK PERLU DIUBAH: `app/api/login/route.ts` membaca `NEXT_PUBLIC_SUPABASE_ANON_KEY ?? NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan pustaka supabase-js menerima kunci generasi baru sebagai pengganti langsung pada nama variabel yang sama. Dibuktikan: `.env.local` SUDAH memakai kunci generasi baru dan seluruh 275 test + server dev lokal jalan normal. Jadi ini murni perbaikan nilai variabel, BUKAN perubahan kode -- besarnya kecil.\n\n' ||
        E'PP.4 -- DAMPAK KE TEMPAT LAIN (diperiksa): (a) CI/fabrix-ci-test -- project BARU dibuat 22 Agu, kunci legacy-nya kemungkinan masih aktif, TAPI supaya tidak mengulang insiden yang sama, INF-17 kini mewajibkan memakai kunci generasi BARU (sb_publishable_/sb_secret_) saat mengisi GitHub Secrets; (b) backup GitHub Actions memakai SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD (jalur CLI/pg_dump), BUKAN anon/service_role key -- TIDAK terpengaruh sama sekali; (c) server dev lokal tetap bisa login karena `.env.local` memang sudah memakai kunci generasi baru -- itu persis sebabnya perbedaan ini tidak ketahuan lebih awal.\n\n' ||
        E'STATUS PERBAIKAN saat migrasi ini ditulis: kunci publishable SUDAH terpasang & TERBUKTI bekerja (pesan "Legacy API keys" hilang; signIn dengan kata sandi salah kini ditolak "Invalid login credentials" secara benar, artinya autentikasi menembus ke project yang tepat). MASIH ADA SISA: `SUPABASE_SERVICE_ROLE_KEY` sisi server -- pencarian baris `users` masih gagal ("Akun tidak valid atau tidak terdaftar di tenant"). Ditemukan sebabnya: Vercel "redeploy" dari deployment lama MEWARISI snapshot env deployment sumber, jadi variabel yang baru diperbarui TIDAK ikut terbawa -- hanya deployment BARU dari git yang membaca nilai terkini. Perbaikan diteruskan lewat push git (deployment segar), BUKAN redeploy.'
  where task_code = 'INF-11' and company_id = v_company_id;

  -- INF-17 -- wajib pakai kunci generasi baru
  update build_tasks
  set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nKOREKSI PENTING 23 Agu 2026 (PP.4a) -- saat mengisi 3 GitHub Secrets, WAJIB memakai kunci GENERASI BARU, bukan yang lama: di Supabase Dashboard -> fabrix-ci-test -> Settings -> API, ambil **Publishable key** (diawali `sb_publishable_`) untuk NEXT_PUBLIC_SUPABASE_ANON_KEY, dan **Secret key** (diawali `sb_secret_`) untuk SUPABASE_SERVICE_ROLE_KEY. JANGAN memakai kunci lama `anon`/`service_role` (bentuk JWT `eyJ...`) -- pada project FABRIX-APP kunci generasi lama sudah DINONAKTIFKAN sejak 11 Agu 2026 dan menyebabkan seluruh login mati (insiden PP, 23 Agu 2026). Nama variabelnya tetap sama, hanya isinya yang generasi baru -- kode tidak perlu diubah.'
  where task_code = 'INF-17' and company_id = v_company_id;

end $$;
