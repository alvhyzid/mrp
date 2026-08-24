-- TT (25 Agu 2026) — AUD-21 disapu tuntas + pengawasnya, dan bukti nilai pengawas ambang.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'DIBUKA KEMBALI LALU DITUTUP TUNTAS 25 Agu 2026 — perbaikan pertamanya ternyata MENYISIR SEBAGIAN.\n\n' ||
    E'Perbaikan 24 Agu mengganti 15 titik rapuh di 10 berkas lalu dinyatakan selesai. Penyisiran ulang ' ||
    E'menemukan 24 pemanggilan `auth.admin.createUser` LANGSUNG yang tersisa di 23 berkas. Satu di ' ||
    E'antaranya (margin_watch.test.ts:358) tidak memeriksa error SAMA SEKALI dan meledak persis seperti ' ||
    E'kejadian aslinya: "TypeError: Cannot read properties of null (reading id)". Itu penyebab TIGA CI ' ||
    E'merah berturut-turut yang sempat dikira kemunduran menyeluruh.\n\n' ||
    E'PEMILAHAN 24 TITIK ITU (supaya terlihat kenapa penyisiran mata gagal):\n' ||
    E'  - 1 AKUT: error tidak diperiksa sama sekali, lalu tanda seru non-null. Ini yang meledak.\n' ||
    E'  - 9 GAGAL BERISIK: error diperiksa, tapi "sudah terdaftar" tetap menggagalkan test.\n' ||
    E'  - 14 "AMAN": menangani "sudah terdaftar", TAPI lewat cadangan lama yang rapuh — listUsers ' ||
    E'    berbatas 100 baris satu halaman, ditutup tanda seru non-null. Rapuh, hanya belum menggigit.\n' ||
    E'Seluruh 24 diganti ensureAuthUser. Bentuk hasilnya sengaja dipertahankan supaya kode di bawahnya ' ||
    E'tidak ikut berubah -- perubahan sekecil mungkin untuk cakupan seluas mungkin.\n\n' ||
    E'PENGAWAS DIBANGUN: tests/auth_user_lewat_helper_watchdog.test.ts GAGAL KERAS bila ada pemanggilan ' ||
    E'createUser langsung di tests/. Dibuktikan merah (satu pemanggilan dikembalikan) lalu hijau.\n\n' ||
    E'ATURAN YANG LAHIR: perbaikan atas sebuah KELAS cacat belum selesai sampai ada pengawas yang ' ||
    E'menjamin tidak ada yang tersisa DAN tidak ada yang lahir baru. Menyisir dengan mata bukan penutup. ' ||
    E'Perbaikan yang menyisir sebagian lalu dinyatakan selesai LEBIH BERBAHAYA daripada yang belum ' ||
    E'dimulai, karena orang berhenti mencurigainya.'
where task_code = 'AUD-21';

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'AUD-34', 'Pengawas Ambang Terbukti Bekerja di Keadaan Sungguhan', 'AUD', 'Audit Kualitas',
  'scripts/check-test-threshold.js menangkap kegagalan CI sungguhan pada 24-25 Agu 2026 dan menyebut angkanya: 317 lulus, 1 gagal, 7 dilewati, 52 berkas berjalan.',
  'Tanpa angka itu, "CI merah" terbaca sebagai kemunduran menyeluruh. Dengan angka itu, ia terbaca sebagai 1 dari 318 — dan pekerjaan lain tidak perlu ditahan selama itu.',
  'bisa_menunggu', array['audit','test','bukti'], 'Claude Code', 'selesai', 'temuan_claude',
  E'PERTAMA KALINYA pengawas ini berbunyi di luar pengujian sengaja. Ia dipasang setelah temuan bahwa ' ||
  E'berkas yang seluruh isinya dilewati tetap dihitung LULUS -- artinya CI bisa hijau sementara hampir ' ||
  E'tidak ada yang benar-benar diuji.\n\n' ||
  E'YANG IA LAKUKAN DI KEJADIAN NYATA: menyebut angka persisnya, sehingga kegagalan bisa ditimbang. ' ||
  E'Dugaan pertama ("ada kemunduran nyata") TERLALU BESAR, dan angka itu yang mengoreksinya.\n\n' ||
  E'PELAJARAN YANG DICATAT BERSAMANYA: membaca "CI merah" tanpa melihat BERAPA yang gagal menghasilkan ' ||
  E'kecemasan yang tidak sebanding dengan kenyataannya, dan menahan pekerjaan lain lebih lama dari ' ||
  E'perlunya. Angka lebih berguna daripada warna.'
) on conflict (company_id, task_code) do nothing;

end $$;
