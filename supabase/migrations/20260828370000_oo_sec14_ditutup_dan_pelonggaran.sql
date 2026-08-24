-- OO (24 Agu 2026) — SEC-14 DITUTUP, asal-usulnya dicatat, dan penyisiran kelas yang sama.

do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- pencatatan task di migrasi ini dilewati (no-op).';
    return;
  end if;

-- ============================================================================
-- SEC-14 — DITUTUP, dengan bukti yang punya pembanding.
-- ============================================================================
update build_tasks set
  status = 'selesai',
  completed_at = now(),
  notes = coalesce(notes || E'\n\n', '') ||
    E'DIPERBAIKI PEMILIK PRODUK 24 Agu 2026: variabel lama dihapus, ditambahkan ulang lewat ' ||
    E'"Add Environment Variable" dengan penanda Sensitive menyala. Nilainya disalin langsung dari ' ||
    E'dashboard Supabase, TIDAK pernah lewat percakapan. Tombol Redeploy dari notifikasi sengaja ' ||
    E'TIDAK ditekan -- Redeploy pernah mewarisi variabel deployment lama.\n\n' ||
    E'BUKTI PERBAIKANNYA, dan sengaja TIDAK disimpulkan dari tampilan dashboard:\n' ||
    E'  1. Daftar variabel lewat baris perintah: keenam variabel kini "Hidden / Sensitive". Yang baru ' ||
    E'     tercatat dibuat 3 menit sebelum diperiksa.\n' ||
    E'  2. UJI YANG SEBENARNYA -- MENARIK nilainya keluar lewat `vercel env pull` ke berkas di luar ' ||
    E'     repo. Ketiga variabel Supabase hanya mengirim PENANDA 11 karakter, bukan kunci.\n' ||
    E'  3. PEMBANDING YANG MEMBUAT UJI ITU MEYAKINKAN: di berkas yang SAMA, VERCEL_OIDC_TOKEN tertarik ' ||
    E'     UTUH 1.150 karakter. Jadi mekanisme penarikannya memang bekerja -- yang ditolak khusus ' ||
    E'     variabel bertanda Sensitive. Tanpa pembanding ini, "nilainya pendek" bisa saja berarti ' ||
    E'     penarikannya yang gagal, bukan penyamarannya yang bekerja.\n' ||
    E'  4. Lingkungan Preview: ketiganya juga hanya mengirim penanda. Lingkungan Development: NIHIL ' ||
    E'     variabel Supabase sama sekali.\n' ||
    E'  5. Berkas env lokal (.env.local, .env.staging.local) terkonfirmasi diabaikan git.\n' ||
    E'  Berkas uji dihapus setelah diperiksa; nilai apa pun tidak pernah ditampilkan atau disalin.\n\n' ||
    E'ASAL-USULNYA -- INI BUKAN TEMUAN TANPA SEBAB. Kunci itu diubah dari tipe tersamar menjadi tipe ' ||
    E'yang bisa dibaca-balik saat perbaikan 23 Agu, supaya nilainya bisa diverifikasi setelah DUA KALI ' ||
    E'salah salin. Alasannya sah. Yang tidak terjadi adalah pengembaliannya: arsitek menanyakan ' ||
    E'konsekuensinya (siapa yang sekarang bisa membacanya, perlu dikembalikan atau tidak) dan ' ||
    E'PERTANYAAN ITU TIDAK PERNAH DIJAWAB. Terbuka 1 HARI, dan ditemukan audit INF-01 secara kebetulan ' ||
    E'-- bukan oleh proses yang memang mencarinya.\n\n' ||
    E'PELAJARAN (dinaikkan ke HANDOFF): pelonggaran yang dilakukan demi MEMERIKSA sesuatu WAJIB punya ' ||
    E'langkah pengembalian yang dicatat sebagai task SAAT ITU JUGA -- bukan diingat. Yang membuat kelas ' ||
    E'ini berbahaya: TIDAK ADA GEJALANYA. Sistem berjalan normal, tidak ada yang gagal, tidak ada yang ' ||
    E'merah. Satu-satunya cara menemukannya adalah mencarinya dengan sengaja.'
where task_code = 'SEC-14';

-- ============================================================================
-- OO.3 — PENYISIRAN KELAS YANG SAMA: nol utang lain.
-- ============================================================================
insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan
) values (
  v_company_id, 'SEC-16', 'Penyisiran Pelonggaran yang Belum Dikembalikan (hasil: nol)', 'SEC', 'Keamanan',
  'Penyisiran seluruh pelonggaran yang dilakukan selama seminggu perbaikan infrastruktur: pengawas yang dimatikan, hak akses yang dilonggarkan, setelan diagnosis yang tertinggal.',
  'Kelas ini tidak punya gejala. Sesuatu berhenti dijaga, tidak ada yang gagal, dan tidak ada sinyal bahwa perlindungannya hilang -- persis seperti kunci layanan Vercel yang tertinggal terbuka satu hari.',
  'bisa_menunggu', array['keamanan','audit','pelonggaran'], 'Claude Code', 'selesai', 'temuan_claude',
  E'HASIL: NOL pelonggaran lain yang belum dikembalikan. Yang diperiksa dan temuannya:\n\n' ||
  E'  - Flag pelolos test di CI: SUDAH DICABUT dari workflow (nihil di .github/workflows/).\n' ||
  E'  - Test yang dilewati: 2 berkas ber-skipIf(!isRealDataProject()) -- DISENGAJA, itu pengawas data ' ||
  E'    nyata (AUD-13), hidup otomatis begitu dijalankan terhadap FABRIX-APP. Bukan utang.\n' ||
  E'  - `if: always()` di CI: ADA, tapi disengaja dan berkomentar -- supaya artefak debug tetap ' ||
  E'    terunduh meski langkah sebelumnya gagal. Bukan langkah gagal yang dibiarkan lolos.\n' ||
  E'  - Izin EXECUTE fungsi SECURITY DEFINER: yang terbuka SELURUHNYA ada di allowlist bertuliskan ' ||
  E'    alasan, dijaga tests/function_grant_security_audit.ts yang GAGAL untuk fungsi baru di luar daftar.\n' ||
  E'  - Ambang pengawas test: MAX_RETRIES = 40 memang longgar terhadap patokan sehat 0-2 -- longgar ' ||
  E'    BY DESIGN dengan alasan tertulis di berkasnya, bukan utang.\n' ||
  E'  - session_replication_role: hanya di dua migrasi historis yang sudah berjalan (penyebab AUD-31). ' ||
  E'    Tidak ada pemakaian aktif.\n\n' ||
  E'BATAS PENYISIRAN INI: ia mencari di KODE dan di setelan yang bisa dibaca lewat API. Pelonggaran ' ||
  E'yang dilakukan langsung di dashboard sebuah layanan dan tidak meninggalkan jejak di kode berada ' ||
  E'di luar jangkauannya -- dan justru dari sanalah SEC-14 berasal. Jadi hasil "nol" ini berarti ' ||
  E'"nol yang bisa ditemukan dengan cara ini", bukan "nol secara mutlak".'
) on conflict (company_id, task_code) do nothing;

-- ============================================================================
-- OO.5 — INF-18: bukti tambahan untuk tiket dukungan Vercel.
-- ============================================================================
update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'BUKTI TAMBAHAN UNTUK TIKET DUKUNGAN (24 Agu 2026, dari potret INF-01): enam deployment terakhir ' ||
    E'SELURUHNYA bertarget Production. TIDAK ADA satu pun deployment Preview, padahal variabel ' ||
    E'lingkungan Preview (branch `staging`) sudah lengkap disiapkan sejak 8 hari lalu.\n\n' ||
    E'Artinya keluhannya bukan sekadar "setelan tidak bisa disimpan", melainkan AKIBATNYA: setiap ' ||
    E'perubahan langsung terbit ke publik, dan jalur Preview yang seharusnya jadi tempat mencoba ' ||
    E'TIDAK PERNAH TERPAKAI SEKALI PUN. Konfigurasi Preview yang tidak pernah dijalankan juga berarti ' ||
    E'tidak ada yang tahu apakah ia benar -- bila kelak branch produksi berhasil dipindah, jalur ' ||
    E'Preview itu praktis belum teruji.'
where task_code = 'INF-18';

end $$;
