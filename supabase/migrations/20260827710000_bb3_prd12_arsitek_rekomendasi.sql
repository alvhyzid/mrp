-- BB.3 -- lengkapi PRD-12 dengan rekomendasi arsitek. TIDAK DIKERJAKAN --
-- murni pencatatan rekomendasi + pertanyaan terbuka, menunggu keputusan
-- pemilik produk (instruksi eksplisit).
update public.build_tasks
set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nBB.3 -- REKOMENDASI ARSITEK (22 Agu 2026, BELUM DIKERJAKAN, menunggu keputusan pemilik produk):\n\n'
  'Aturan perpindahan status yang diusulkan:\n'
  '- planned -> in_progress : OTOMATIS, saat batch pertama di bawah WO ini dimulai.\n'
  '- in_progress -> completed : MANUAL oleh PPIC/supervisor (BUKAN otomatis saat kuantitas terpenuhi -- produksi sering meleset sedikit: target 2.500 box dengan hasil 2.480 tidak akan pernah menutup WO sendiri secara otomatis; sebaliknya bila hasil lebih, WO bisa tertutup otomatis sebelum batch terakhir sempat dilaporkan. Orang yang tahu keadaan lapangan yang harus menyatakan selesai, bukan angka kuantitas semata).\n'
  '- -> paused / cancelled : MANUAL, wajib isi alasan.\n\n'
  'DAMPAK NYATA yang membuat ini Mendesak (bukan sekadar kerapian label): pagar keamanan "tolak pembuatan batch baru bila WO selesai/batal" di createProductionBatch.ts TIDAK PERNAH AKTIF seumur hidup sistem, karena status tidak pernah berubah dari planned. Konsekuensi konkret untuk MLVT: setelah 10 batch selesai, TIDAK ADA APA PUN yang mencegah pembuatan batch ke-11 -- dan batch itu akan mengonsumsi BAHAN SUNGGUHAN dari gudang.\n\n'
  'PERTANYAAN TERBUKA untuk pemilik produk (JANGAN ditebak): pembuatan batch baru pada WO yang sudah berstatus selesai -- DIBLOKIR KERAS, atau DIPERINGATKAN dengan alasan wajib (pola peringatan+jejak, bukan blokir, yang selama ini jadi prinsip pemilik produk)? Konteks penting: prinsip peringatan+jejak (bukan blokir) yang dipakai di kasus-kasus lain sejauh ini mempertaruhkan hal yang bisa dikoreksi belakangan (label, urutan tahap) -- kasus ini mempertaruhkan KONSUMSI BAHAN SUNGGUHAN DARI GUDANG, yang tidak bisa "dibatalkan" semudah mengoreksi angka di layar. Jawabannya bisa berbeda dari kasus-kasus sebelumnya justru karena taruhannya berbeda kelas.'
where task_code = 'PRD-12';
