-- FF.1 (22 Agu 2026) -- akar penyebab CI "Rebuild Schema from Migrations"
-- merah sejak commit f539cd6 ditemukan DENGAN BUKTI (reproduksi lokal
-- lewat `supabase db reset --linked` terhadap project staging
-- mrp-rebuild-test-2A, BUKAN dugaan): migrasi build_tasks 20260827340000
-- (dan seterusnya) SENGAJA memakai pola aman -- cari company_id lewat
-- `select ... where name = 'PT ITM'`, dan NO-OP (skip, raise notice) kalau
-- belum ada baris company sama sekali (rebuild dari nol belum sempat
-- diisi data). Migrasi build_tasks yang saya tulis MULAI 20260827610000
-- TIDAK mengikuti pola itu -- company_id ditulis literal `1` tanpa
-- pengaman -- pada database yang SUDAH lama berjalan (company_id=1 =
-- "PT ITM" sudah ada sejak `scripts/seed-realcase-itm.js` dijalankan
-- manual, DI LUAR migrations/, seperti company_id/users/subscription_plans
-- dari Sesi 2A) ini tidak pernah kelihatan salah -- tapi pada rebuild dari
-- NOL (persis yang dilakukan CI), tabel companies MASIH KOSONG di titik
-- migrasi 20260827610000 dijalankan, dan literal `1` melanggar
-- build_tasks_company_id_fkey. Pesan error PERSIS: "insert or update on
-- table build_tasks violates foreign key constraint
-- build_tasks_company_id_fkey ... Key (company_id)=(1) is not present in
-- table companies."
--
-- Perbaikan: migrasi baru ini (timestamp SEBELUM 20260827610000, jadi
-- jalan lebih dulu di urutan replay) menjamin company_id=1 SELALU ada
-- sebelum migrasi build_tasks manapun yang memakai literal `1` berjalan --
-- baik di rebuild dari nol maupun di database yang sudah berjalan lama
-- (idempoten lewat ON CONFLICT, TIDAK menimpa data company_id=1 yang
-- sudah ada di project data nyata). Sequence company_id dimajukan supaya
-- company baru berikutnya (lewat signup asli) tidak bentrok dengan id=1
-- yang baru saja diisi manual di sini.
insert into public.companies (company_id, name, industry_type, status)
values (1, 'PT ITM', 'manufacturing', 'trial')
on conflict (company_id) do nothing;

select setval(pg_get_serial_sequence('public.companies', 'company_id'), (select max(company_id) from public.companies));
