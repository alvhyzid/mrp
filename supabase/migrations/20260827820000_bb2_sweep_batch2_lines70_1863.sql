-- BB.2 (putaran 3, lanjutan dari posisi berhenti baris 1863) -- sapu HANDOFF.md
-- dari baris ~70 (akhir cakupan yang sudah tersapu di ronde sebelumnya) sampai
-- baris 1894 ("ATURAN BAKU MIGRASI", batas ronde putaran 1). Metodologi sama
-- seperti AA.1/H.4: cocokkan tiap temuan/utang teknis ke build_tasks lewat
-- pencarian kata kunci, bukan asumsi; tandai kedaluwarsa dengan alasan kalau
-- sudah dibatalkan/diganti keputusan sesudahnya.
--
-- HASIL: rentang ini padat dengan riwayat Sesi 0/0B/0C/5/6/6A/7 dan studi kasus
-- MLVT -- TAPI hampir SELURUH temuan di dalamnya SUDAH tercakup sebagai task
-- master per-sesi (BSL-01/02/03, AUD-01/02/03, MLV-01/02/03, MRG-01..09,
-- MST-05..08, SEC-04, dst) atau sudah SUPERSEDED oleh keputusan sesudahnya
-- (studi kasus Gummy Zala/Drinkme dibuang total oleh MLV-01, gerbang waktu
-- SAS001/SAS005 sudah dicabut, dst). HANYA 3 temuan genap belum pernah jadi
-- task -- direkam di sini:
do $$
declare
  v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then
    raise notice 'Perusahaan PT ITM tidak ditemukan -- seed build_tasks (migrasi ini) dilewati (no-op).';
    return;
  end if;

insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, link_url, origin, detail_pekerjaan, notes)
values
(
  v_company_id, 'PRV-03', 'Keputusan Struktur Panel Asal-Usul vs Rencana Konsultan Lain', 'PRV', 'Provenance',
  '`docs/instruksi-d0-provenance.md` (dari konsultan lain, disampaikan lewat pemilik produk) meminta fondasi provenance dengan STRUKTUR BERBEDA (metadata identitas-mesin tersembunyi: entity/entityId/field/rawValue/parentEntity/basis/derivation/learnedStandard/screen/capturedAt, TANPA UI) dari yang SUDAH dibangun dan berjalan di 20+ titik (`ProvenanceEnvelope`: formula/inputs/sourceDocument/standardStatus/history, tampil lewat tombol "i"). Dokumen itu kemungkinan ditulis tidak tahu panelnya sudah lebih dulu ada.',
  'Ada 2 rencana provenance yang saling bersaing di dokumentasi tanpa keputusan final -- risiko kebingungan arah pengembangan berikutnya (mis. fondasi Fase AI yang disebut dokumen itu) kalau tidak diselesaikan sebelum pekerjaan lanjutan menyentuh area ini.',
  'bisa_menunggu', array['Dokumentasi','Fungsi'], 'Pemilik Produk', 'menunggu', null, 'temuan_claude',
  'Rekomendasi Claude Code yang sudah disampaikan (belum diputuskan): pertahankan struktur ProvenanceEnvelope yang sudah ada (sudah teruji nyata di 20+ titik, sesuai prinsip "bangun untuk kebutuhan nyata sekarang"), TIDAK migrasi ke struktur dokumen kecuali pemilik produk memutuskan lain. Perlu keputusan eksplisit sebelum ada tindakan lanjutan di area ini (khususnya kalau Fase AI mulai dikerjakan).',
  'Ditemukan lewat BB.2 putaran 3 (22 Agu 2026, sapu HANDOFF.md baris 70-1894) -- entri asli tanggal 25 Agu 2026 ("Panel Asal-Usul — perluasan ke ±30 titik lain"), dilaporkan saat itu ke pemilik produk tapi tidak pernah jadi task tercatat.'
),
(
  v_company_id, 'MRG-10', 'Rekonsiliasi Metodologi Biaya SDM Aktual vs Standar (Risiko Selisih Palsu Lapis 2)', 'MRG', 'Margin & Biaya',
  '`compute_production_batch_labor_cost()` (biaya SDM AKTUAL dari labor log nyata per batch) masih pakai metodologi LAMA (per jam/per shift) -- BELUM direkonsiliasi ke basis BARU yang dipakai sisi STANDAR (kru harian ÷ batch/hari, dari MRG-02). Terkait: tunjangan makan/transport sisi AKTUAL sengaja belum dihitung per batch (butuh aturan atribusi hari-hadir vs batch, belum ditentukan).',
  'Pemilik produk sudah memperingatkan eksplisit soal ini: kalau basis biaya standar vs aktual beda metodologi, Lapis 2 Margin Watch (kategori "SDM") akan SELALU menunjukkan selisih PALSU (bukan selisih nyata dari harga/kondisi produksi) -- merusak kegunaan fitur pembongkaran selisih untuk kategori SDM secara sistematis.',
  'penting', array['Formula','Fungsi'], 'Claude Code', 'menunggu', '/sales-orders', 'temuan_claude',
  'Tentukan basis perhitungan biaya SDM AKTUAL per batch yang KONSISTEN dengan basis STANDAR (kru harian ÷ batch/hari dari MRG-02), lalu tentukan aturan atribusi tunjangan makan/transport (per hari hadir) ke batch produksi tertentu (perlu keputusan pemilik produk: dibagi rata ke semua batch hari itu? diabaikan di level batch, hanya dihitung di level periode?). Verifikasi dengan skenario nyata: 1 batch, bandingkan angka SDM standar vs aktual pada kondisi identik -- harus menghasilkan angka yang sama (bukan cuma "dekat").',
  'Ditemukan lewat BB.2 putaran 3 (22 Agu 2026, sapu HANDOFF.md baris 70-1894) -- entri asli tanggal 20 Agu 2026 ("Perintah Gabungan A→F, Bagian B"), pemilik produk eksplisit menyebut ini "perlu dikerjakan sebelum Bagian B benar-benar bisa disebut selesai" -- tapi Bagian B (MRG-02) sudah ditandai selesai tanpa item ini pernah jadi task terpisah.'
),
(
  v_company_id, 'MRG-11', 'Overhead SDM Bulanan: Formula SISA Otomatis vs Angka Statis Manual', 'MRG', 'Margin & Biaya',
  '`company_settings.monthly_overhead_baseline` MASIH angka statis manual (terakhir Rp73.352.547, direkonsiliasi ±1,8% karena beda basis standar-vs-aktual). Pertanyaan terbuka yang diulang 2x di HANDOFF (20 & 21 Agu) tapi tidak pernah jadi task: apakah nilai ini sebaiknya dihitung OTOMATIS sebagai SISA (total biaya pemberi kerja seluruh karyawan − biaya SDM yang tercatat di batch periode itu) alih-alih diupdate manual.',
  'Selama formula SISA belum dibangun, overhead bulanan tetap angka manual yang bisa jadi usang tanpa disadari -- ketepatan Margin Watch untuk komponen overhead bergantung pada kerajinan update manual, bukan mekanisme yang menjamin konsistensi dengan data payroll aktual.',
  'bisa_menunggu', array['Formula','Database'], 'Claude Code', 'menunggu', null, 'temuan_claude',
  'Formula SISA butuh 3 prasyarat yang belum lengkap (dicatat sebelumnya, belum berubah): (1) biaya pemberi kerja PHL per-orang nyata lengkap (baru ada struktur tarif), (2) cara menentukan batch mana masuk periode gaji mana (`production_batches.started_at`/`completed_at` sudah ada, belum dipakai untuk ini), (3) tunjangan+BPJS Kesehatan lengkap per orang. JANGAN dibangun sebelum ketiganya lengkap -- akan menghasilkan angka "SISA" yang kelihatan presisi padahal masih menebak, sesuai catatan sebelumnya.',
  'Ditemukan lewat BB.2 putaran 3 (22 Agu 2026, sapu HANDOFF.md baris 70-1894) -- pertanyaan yang sama tercatat 2x (20 & 21 Agu 2026) di bagian "Catatan menunggu"/"Pertanyaan terbuka" tapi tidak pernah dipromosikan jadi task tersendiri.'
);

end $$;
