-- Temuan kedua dari giliran DS-09 halaman Kamus: pengecualian penjaga dikunci NOMOR BARIS.
-- DICATAT, TIDAK DIKERJAKAN (aturan FOKUS SATU TASK).
do $mig$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  perform pastikan_kode_task_kosong('DS-11');

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
    effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (v_company_id, 'DS-11',
    'Pengecualian Penjaga Kebocoran Istilah Dikunci NOMOR BARIS — Akan Salah Tuduh',
    'DS', 'Design System',
    'Tiga pengecualian di tests/ui_raw_leak_watchdog.test.ts ditulis sebagai rentang nomor baris, sehingga menyunting berkasnya menggeser pengecualiannya ke tempat yang salah.',
    'Menentukan apakah hasil penjaga masih layak dipercaya, atau jadi peringatan yang orang belajar abaikan.',
    'penting', 'menunggu', 'temuan_claude', 'Claude Code',
    concat_ws(chr(10),
      'DITEMUKAN 26 Agu 2026 saat memigrasikan halaman Kamus ke Carbon.',
      '',
      'Pengecualian yang ada sekarang, seluruhnya berupa rentang NOMOR BARIS:',
      '  - src/components/ui/provenance-info-button.tsx   211-239',
      '  - src/features/kamus/pages/KamusPage.tsx         410-425  (digeser hari ini dari 363-379)',
      '  - src/features/mrp/pages/ShipmentsPage.tsx       839',
      '',
      'KENAPA INI MASALAH, dan bukan sekadar kurang rapi: begitu berkasnya disunting di atas',
      'garis itu, pengecualiannya menunjuk baris lain. Akibatnya DUA ARAH, dan keduanya buruk:',
      '  1. baris yang memang dikecualikan jadi DITUDUH bocor -- penjaga yang salah tuduh;',
      '  2. baris lain yang benar-benar bocor jadi DIAMPUNI diam-diam -- lubang tanpa bunyi.',
      'Yang kedua tidak akan pernah ketahuan dari hasil test, karena hasilnya hijau.',
      '',
      'Hari ini rentangnya diperbarui MANUAL di giliran yang sama, dan itu berhasil justru karena',
      'ada catatan khusus di HANDOFF yang mengingatkannya. Cara kerja yang bergantung pada',
      'seseorang membaca catatan sudah terbukti gagal berkali-kali di proyek ini.',
      '',
      'YANG DIUSULKAN (bukan keputusan final): kunci pengecualian ke PENANDA KOMENTAR di dalam',
      'berkasnya sendiri, mis. `// penjaga:mulai-pengecualian ... // penjaga:selesai-pengecualian`,',
      'sehingga pengecualian ikut berpindah bersama kodenya. Alasannya sama dengan yang membuat',
      'kelas "kebetulan benar" lahir: hal yang kebenarannya bergantung pada penulisnya mengingat',
      'caranya butuh SATU PINTU BERSAMA, bukan aturan.'
    ),
    'Lahir dari DS-09 halaman Kamus. Dicatat, tidak dikerjakan.'
  );
end
$mig$;
