-- EE (dua hal) --
-- 1) PRD-12: pertanyaan terbuka SUDAH DIJAWAB pemilik produk. Dicatat
--    sebagai keputusan final -- TIDAK dikerjakan sampai kodenya disebut
--    eksplisit (instruksi tegas: "Jangan mulai sampai pemilik produk
--    menyebut kodenya").
-- 2) AUD-11: catat task sapu 41 baris checklist-fase-spec-vs-fabrix.md
--    yang belum diperiksa satu per satu (CC.1 hanya menyapu 2 prioritas
--    yang disebut eksplisit, 41 baris sisanya belum diverifikasi).

update public.build_tasks
set detail_pekerjaan = detail_pekerjaan || E'\n\n---\n\nKEPUTUSAN FINAL (22 Agu 2026, via arsitek) -- pertanyaan terbuka di atas SUDAH DIJAWAB, dicatat supaya tidak dibuka ulang:\n\n'
  'BLOKIR KERAS + JALAN KELUAR BERNAMA (BUKAN pola peringatan+jejak yang biasa dipakai pemilik produk di kasus lain):\n'
  '- Pembuatan batch baru pada WO berstatus completed atau cancelled DITOLAK di database, bukan sekadar diperingatkan.\n'
  '- Jalan keluar: company_admin atau manajer produksi dapat MEMBUKA KEMBALI WO yang sudah selesai, dengan alasan WAJIB diisi dan tercatat (siapa, kapan, alasan). Setelah dibuka kembali, batch baru boleh dibuat seperti biasa.\n'
  '- Riwayat pembukaan kembali TIDAK BOLEH ditimpa -- berapa kali sebuah WO dibuka kembali adalah informasi berguna (pola sama dengan build_task_approval_history: log append-only, bukan kolom yang ditimpa).\n\n'
  'ALASAN kenapa ini beda dari prinsip peringatan+jejak yang biasa dipakai (WAJIB dicatat, bukan cuma keputusan telanjang): yang dipertaruhkan di sini adalah BAHAN SUNGGUHAN DARI GUDANG -- batch ke-11 pada WO yang sudah "selesai" akan menarik material dari stok, dan peringatan yang bisa diklik-lewat tidak menahan apa pun. Kerugiannya langsung berupa material terpakai, bukan catatan yang bisa dikoreksi belakangan seperti label atau urutan tahap. Membuka kembali WO adalah tindakan SADAR oleh orang berwenang; mengabaikan peringatan adalah klik oleh operator yang sedang buru-buru -- dua tingkat kehati-hatian yang berbeda untuk taruhan yang berbeda kelas.\n\n'
  'Aturan perpindahan status TETAP seperti rekomendasi tercatat sebelumnya (tidak berubah): planned->in_progress OTOMATIS saat batch pertama dimulai; ->completed MANUAL oleh PPIC/supervisor; ->paused/cancelled MANUAL wajib alasan.\n\n'
  'STATUS: siap dikerjakan. JANGAN MULAI sampai pemilik produk menyebut kode task ini secara eksplisit di instruksi kerja.'
where task_code = 'PRD-12';

insert into public.build_tasks
  (company_id, task_code, name, module_code, module_name, description, effect_description, urgency, tags, pic, status, origin, detail_pekerjaan, notes)
values (
  1, 'AUD-11', 'Sapu Ulang 41 Baris checklist-fase-spec-vs-fabrix.md', 'AUD', 'Audit Kualitas',
  'checklist-fase-spec-vs-fabrix.md menandai 41 baris sebagai status per 20 Agu 2026 (sebagian besar "ditunda sadar dengan pemicu") -- CC.1 (22 Agu) hanya menyapu 2 prioritas yang disebut eksplisit dokumen itu sendiri, 41 baris sisanya BELUM diperiksa satu per satu terhadap kondisi terkini maupun terhadap build_tasks.',
  'Sejak 20 Agu banyak yang berubah (Supplier & Pelanggan CRUD, snapshot routing/BOM, glossary UI, dst -- sudah dicatat sebagai catatan kedaluwarsa di header dokumen). Baris yang dulu "ditunda sadar" bisa jadi SEKARANG relevan, atau malah sudah terlanjur dikerjakan tanpa disadari sebagai penyelesaian baris itu. Ini kelas masalah yang sama dengan AUD-04/H.4: temuan yang benar tapi terkubur karena tidak ada yang menariknya jadi pekerjaan -- 7 baru ditemukan dari SATU dokumen (audit-infrastruktur-fabrix.md + checklist-audit-jalan-kaki.md), 41 baris dokumen ini belum diperiksa sama sekali.',
  'bisa_menunggu', array['Dokumentasi','Data'], 'Claude Code', 'menunggu', 'pemilik_produk',
  'Boleh dikerjakan BERTAHAP (per rentang Phase 1-7 di dokumen, atau per beberapa baris sekaligus) -- YANG TIDAK BOLEH: dinyatakan selesai padahal baru sebagian disapu. Untuk tiap baris: (1) cek apakah statusnya (SUDAH/SEBAGIAN/DIRANCANG/DITUNDA SADAR/BELUM-DITOLAK) masih akurat hari ini -- kalau sudah berubah, catat sebagai kedaluwarsa dengan alasan, JANGAN dijadikan task baru; (2) kalau masih akurat DAN memerlukan tindakan, cek apakah sudah ada task-nya di build_tasks -- kalau belum, catat task baru; (3) laporkan progres per giliran: sudah sampai baris/Phase berapa, berapa ditemukan kedaluwarsa, berapa jadi task baru.',
  'Ditemukan lewat EE.1 (22 Agu 2026) -- pemilik produk secara eksplisit meminta ini dicatat sebagai task terpisah, bukan dikerjakan langsung.'
);
