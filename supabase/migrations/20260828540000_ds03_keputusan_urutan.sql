-- DS-03 (25 Agu 2026) — keputusan pemilik produk atas urutan migrasi Carbon.

do $$
begin
update build_tasks set
  notes = coalesce(notes || E'\n\n', '') ||
    E'=== KEPUTUSAN PEMILIK PRODUK, 25 Agu 2026 ===\n\n' ||
    E'1) URUTAN TIGA GELOMBANG DISETUJUI seperti diusulkan.\n' ||
    E'   Gelombang 1 layar publik & murah (8) -> gelombang 2 layar harian menengah (10)\n' ||
    E'   -> gelombang 3 layar data besar (13).\n\n' ||
    E'2) PILOT KETIGA: LAYAR PUBLIK DULU, LALU LANGSUNG MASTER ITEM TANPA JEDA.\n' ||
    E'   Pemilik produk memilih "keduanya" -- bukan salah satu. Artinya setelah gelombang 1\n' ||
    E'   tuntas, Master Item dikerjakan TANPA menunggu keputusan lagi di antaranya.\n\n' ||
    E'   Konsekuensi yang perlu diingat sesi berikutnya: JANGAN berhenti dan bertanya lagi\n' ||
    E'   setelah layar publik selesai. Izin untuk lanjut sudah diberikan di sini.'
where task_code = 'DS-03';

update build_tasks set urgency = 'super_urgent', super_urgent_since = now()
where task_code = 'DS-02';
end $$;
