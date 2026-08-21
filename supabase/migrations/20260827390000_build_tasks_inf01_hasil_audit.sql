-- Halaman Daftar Tugas Pembangunan -- INF-01 (Audit Infrastruktur) DIKERJAKAN
-- 22 Agu 2026 (read-only, docs/audit-infrastruktur-fabrix.md). 2 STOP CONDITION
-- eksplisit task ini TERPICU (backup tidak otomatis, Production Branch Vercel
-- salah) -- task TIDAK ditutup sendiri oleh Claude Code, dipindah ke
-- Menunggu Persetujuan sesuai E.2/E.3.
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- migrasi dilewati (no-op).';
    return;
  end if;

  update build_tasks set
    status = 'menunggu_persetujuan',
    started_at = coalesce(started_at, now()),
    completed_at = now(),
    link_url = null,
    approval_review_steps = 'Baca docs/audit-infrastruktur-fabrix.md (6 bagian: Kondisi Sekarang, Masalah Ditemukan, Tingkat Risiko, Arsitektur Target, Rencana Migrasi, Gerbang Persetujuan). 2 STOP CONDITION dari spesifikasi task ini TERPICU dan perlu keputusan: (1) backup project data nyata TIDAK otomatis -- hanya manual (workflow_dispatch), retensi artifact 7 hari, backup berhasil terakhir 2 hari sebelum audit ini; (2) Production Branch Vercel project mrp-staging ternyata "main" (seharusnya "staging" per rencana Sesi 2B) -- tiap push ke main memicu deployment publik, meski TERBUKTI (diverifikasi lewat bundle JS live) belum tersambung ke data nyata.',
    approval_location = 'File docs/audit-infrastruktur-fabrix.md di repo (bagian 2 "Masalah Ditemukan" dan 6 "Gerbang Persetujuan"). Tidak ada halaman aplikasi terkait -- ini audit infrastruktur, bukan fitur UI.',
    approval_example_case = 'Contoh konkret temuan #1: project Supabase kfvtrwuuqcjfkkuqizxt (berisi 9 companies termasuk PT ITM asli, 30 employees, 2 sales_orders MLVT) punya pitr_enabled=false dan 0 baris di backups[] -- dibuktikan lewat "supabase backups list --project-ref kfvtrwuuqcjfkkuqizxt". Backup manual terakhir yang berhasil: run #4 di GitHub Actions, 20 Agu 2026, retensi artifact 7 hari.',
    approval_if_approved = 'Kalau pemilik produk setuju arah di bagian 4 (Arsitektur Target) dan bagian 5 (Rencana Migrasi): Claude Code lanjut membuat task perbaikan backup otomatis (jadwal cron di backup-db.yml) dan perbaikan Production Branch Vercel SEBELUM melanjutkan ke RBD-03 (pembuatan organisasi baru). Task ini ditutup Selesai.',
    approval_if_rejected = 'Kalau pemilik produk ingin urutan/pendekatan berbeda (mis. Production Branch tidak perlu diperbaiki dulu, atau backup ditangani dengan cara lain seperti native PITR Supabase berbayar): task kembali ke Sedang Dikerjakan, alasan penolakan dicatat di riwayat persetujuan, docs/audit-infrastruktur-fabrix.md diperbarui sesuai arahan baru.',
    approval_options = 'Pilihan untuk temuan #1 (backup): (A) tambah jadwal `schedule` ke backup-db.yml yang sudah ada + naikkan retensi artifact -- murah, cepat, tapi tetap manual-adjacent (bergantung GitHub Actions tidak dimatikan); (B) aktifkan PITR native Supabase (perlu upgrade plan berbayar) -- lebih andal tapi ada biaya. Rekomendasi Claude Code: (A) dulu sebagai mitigasi cepat sebelum transfer kepemilikan, (B) dipertimbangkan setelah organisasi baru (RBD-03) berdiri karena plan/billing akan diatur ulang di sana juga. Untuk temuan #2 (Production Branch): satu pilihan jelas -- perbaiki jadi "staging" sesuai rencana Sesi 2B, tidak ada alternatif yang masuk akal.'
  where company_id = v_company_id and task_code = 'INF-01';

end $$;
