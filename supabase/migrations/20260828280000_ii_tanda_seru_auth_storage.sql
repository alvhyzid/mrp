-- II.1 / II.4 / II.6 — sisa tanda seru di test, pemantauan pengguna auth, berkas Storage yatim.

insert into build_tasks (
  company_id, task_code, name, module_code, module_name, description, effect_description,
  urgency, tags, pic, status, origin, detail_pekerjaan, notes
)
select 1, d.kode, d.nama, d.mk, d.mn, d.deskripsi, d.efek, d.urgensi, d.tags,
  'Claude Code', 'menunggu', 'temuan_claude', d.detail, d.catatan
from (values
(
  'AUD-28',
  '32 Tanda Seru Non-Null di Test — Diperbaiki Saat Berkasnya Disentuh, Bukan Sekaligus',
  'AUD', 'Audit & Proses',
  array['test']::text[], 'bisa_menunggu',
  'Pola `data.X!` / `.user!.` masih dipakai 32 kali di berkas test. Tanda seru menutupi kegagalan sampai ia meledak di tempat lain dengan pesan yang tidak menjelaskan sebabnya.',
  'Bila kueri atau pemanggilan gagal, test mati dengan galat yang menyesatkan — persis yang membuat AUD-21 terlihat seperti kegoyahan acak selama berhari-hari.',
  E'ATURAN PENGERJAAN (keputusan pemilik produk 24 Agu 2026): DIPERBAIKI SAAT BERKASNYA ' ||
  E'DISENTUH untuk keperluan lain. JANGAN diperbaiki sekaligus.\n\n' ||
  E'ALASANNYA: test yang meledak AKAN KETAHUAN — ia gagal berisik. Ini bukan kegentingan yang ' ||
  E'sama dengan tanda seru di kode aplikasi, yang meledak di depan pengguna.\n\n' ||
  E'SEBARAN (24 Agu 2026): prd12_work_order_status_lifecycle 6, role_hierarchy_financial_access 3, ' ||
  E'ai_project_dashboard 2, margin_watch 2, routing_archive 2, sisanya 1 masing-masing.\n\n' ||
  E'CATATAN CARA MENGHITUNG (aturan M.6): dihitung dengan mencari pola `data.X!`, `data!.`, ' ||
  E'`body.X!`, `.user!.`. YANG MUNGKIN LUPUT: penulisan yang membungkus hasil lebih dulu ' ||
  E'(destructuring lalu `!` di variabel), dan `as` casting yang menyembunyikan hal serupa TANPA ' ||
  E'tanda seru sama sekali. Angka 32 adalah lantai, bukan langit-langit.\n\n' ||
  E'KODE APLIKASI SUDAH BERSIH: 3 pemakaian (customerDeliveryAddresses.ts, computeMetric.ts x2) ' ||
  E'sudah diperbaiki 24 Agu 2026. CATATAN JUJUR: ketiganya ternyata SUDAH memeriksa galat lebih ' ||
  E'dulu, jadi bukan kelas bahaya yang sama dengan createUser — penilaian awal yang menyamaratakan ' ||
  E'itu keliru dan dikoreksi.',
  'Lahir dari sapuan HH.1 setelah akar AUD-21 ditemukan.'
),
(
  'AUD-29',
  'Pantau Jumlah Pengguna Auth di Project CI — Jangan Sapu Otomatis',
  'AUD', 'Audit & Proses',
  array['test','ci']::text[], 'bisa_menunggu',
  'Pengguna auth yatim dari run yang terputus tidak tersapu pembersihan mandiri (helper-nya buta secara struktural terhadap auth.users). Setelah ensureAuthUser, sisa itu tidak lagi menjatuhkan siapa pun — tapi ia menumpuk.',
  'Tumpukan yang tidak terlihat akan melewati batas pencarian halaman suatu saat, dan kelas kegagalan AUD-21 kembali dengan wajah baru.',
  E'KEPUTUSAN PEMILIK PRODUK (24 Agu 2026): JANGAN SAPU OTOMATIS berdasarkan pola email.\n' ||
  E'ALASAN: risikonya (salah pola -> menghapus 8 pengguna dasar -> MERUSAK SELURUH SUITE) lebih ' ||
  E'besar daripada manfaatnya (sisa yang hanya menumpuk dan tidak lagi menjatuhkan siapa pun).\n\n' ||
  E'YANG DIKERJAKAN SEBAGAI GANTINYA: laporkan JUMLAHNYA secara berkala, supaya bila suatu saat ' ||
  E'menumpuk tidak wajar itu TERLIHAT. Menumpang pencatat nilai (C.1) atau jadwal AUD-13 — JANGAN ' ||
  E'bangun penjadwal kedua.\n\n' ||
  E'PEMICU PENINJAUAN, dengan angkanya: project CI berisi 8 pengguna DASAR yang permanen. Tiap ' ||
  E'berkas test membuat 1-4 pengguna sementara. Bila jumlah pengguna auth melewati 60, berarti ' ||
  E'sisa dari run terputus sudah menumpuk melebihi satu kali suite penuh dan layak diperiksa. ' ||
  E'Bila melewati 150, batas pencarian halaman (kini 200 dengan penelusuran) mulai mendekat dan ' ||
  E'harus ditangani, bukan dipantau lagi.',
  'AUD-27 diselesaikan lewat keputusan ini; argumen dua arahnya tercatat di sana.'
),
(
  'INF-22',
  'Berkas Storage Yatim: 15 Berkas Tanpa Baris Database yang Merujuknya',
  'INF', 'Infrastruktur & Environment',
  array['Data','Keamanan']::text[], 'penting',
  'Storage FABRIX-APP berisi 15 berkas (5 foto konfirmasi pengiriman, 3 foto keberangkatan, 6 tanda tangan, 1 logo) sementara tabel shipments, delivery_confirmations, dan document_signatures SEMUANYA KOSONG.',
  'Berkas yatim menumpuk tanpa ada yang merujuknya, dan sebagiannya ada di bucket PUBLIK — masih bisa dibuka siapa pun yang punya URL-nya walau barisnya sudah tidak ada di sistem.',
  E'TEMUAN (24 Agu 2026, saat memeriksa asumsi QR surat jalan): database menunjukkan NOL shipment, ' ||
  E'NOL konfirmasi POD, NOL tanda tangan. Storage menunjukkan 15 berkas dari alur-alur itu.\n\n' ||
  E'PENJELASAN YANG PALING MUNGKIN: reset studi kasus lama menghapus baris database tetapi TIDAK ' ||
  E'menyentuh Storage. Ini sisi lain dari INF-16 — bukan cuma "Storage tidak ikut DICADANGKAN", ' ||
  E'tapi juga "Storage tidak ikut DIBERSIHKAN".\n\n' ||
  E'PERTIMBANGAN PRIVASI: delivery-confirmation-photos dan shipment-dispatch-photos adalah bucket ' ||
  E'PUBLIK. Foto yatim di sana masih terbuka bagi siapa pun yang menyimpan URL-nya. Sebelum ' ||
  E'menghapus, periksa dulu apakah ada yang masih dibutuhkan sebagai bukti — jangan hapus buru-buru.\n\n' ||
  E'TERKAIT: hardDeleteOrphanDocument.ts sudah menangani dokumen yatim untuk modul Dokumen; pola ' ||
  E'yang sama mungkin bisa dipakai, TAPI bucket-bucket ini tidak melewati registry dokumen.',
  'Ditemukan lewat II.6 saat memeriksa apakah surat jalan bercetak QR memang pernah ada.'
)
) as d(kode, nama, mk, mn, tags, urgensi, deskripsi, efek, detail, catatan)
where not exists (select 1 from build_tasks b where b.task_code = d.kode and b.company_id = 1);

-- AUD-27 ditutup lewat keputusan II.4.
update build_tasks
set status = 'selesai', completed_at = now(),
    notes = coalesce(notes,'') || E'\n\n' ||
      '24 Agu 2026 — DITUTUP lewat KEPUTUSAN, bukan lewat pembangunan: pemilik produk memutuskan ' ||
      'JANGAN sapu otomatis berdasarkan pola email, karena risiko merusak seluruh suite lebih besar ' ||
      'daripada manfaat membersihkan sisa yang sudah tidak berbahaya. Penggantinya AUD-29 (pantau ' ||
      'jumlahnya, dengan angka pemicu yang jelas).'
where task_code = 'AUD-27' and company_id = 1;
