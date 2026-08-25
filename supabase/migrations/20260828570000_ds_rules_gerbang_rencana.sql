-- DS-RULES (25 Agu 2026) — gerbang rencana Carbon, permintaan pemilik produk.

do $$
declare v_company_id integer;
begin
  select company_id into v_company_id from companies where name = 'PT ITM' limit 1;
  if v_company_id is null then return; end if;

  update build_tasks set status = 'selesai', completed_at = now(),
    notes = coalesce(notes || E'\n\n','') ||
      E'=== DISETUJUI PEMILIK PRODUK 25 Agu 2026 ===\n' ||
      E'Halaman masuk, daftar, dan lupa kata sandi disetujui setelah koreksi tata letak tombol.'
  where task_code = 'DS-02' and status = 'menunggu_persetujuan';

  if exists (select 1 from build_tasks where task_code = 'DS-04') then
    raise exception 'DS-04 sudah dipakai.';
  end if;

  insert into build_tasks (company_id, task_code, name, module_code, module_name, description,
                           effect_description, urgency, status, origin, pic, detail_pekerjaan, notes)
  values (
    v_company_id, 'DS-04',
    'UI Shell Carbon: Header dan Navigasi Samping — Rencana Dulu, Menunggu Pemilik Produk',
    'DS', 'Design System',
    'Mengganti kerangka aplikasi (AppShell buatan sendiri) dengan UI Shell Carbon: Header, '
    || 'HeaderName, HeaderNavigation, SideNav, dan SkipToContent.',
    'Menyentuh SELURUH layar sekaligus. Satu perubahan mengubah tampilan 38 halaman.',
    'penting', 'menunggu', 'pemilik_produk', 'Claude Code + Pemilik Produk',
    E'BERGERBANG: rencananya disodorkan ke pemilik produk lebih dulu (DS-RULES C.4). Jangan\n' ||
    E'menyentuh kerangka aplikasi sebelum rencananya disetujui.',
    E'Diperiksa 25 Agu 2026: seluruh komponen UI Shell yang dibutuhkan ADA di @carbon/react\n' ||
    E'yang terpasang -- Header, HeaderName, HeaderNavigation, HeaderMenuButton, HeaderGlobalBar,\n' ||
    E'HeaderGlobalAction, SideNav, SideNavItems, SideNavLink, SideNavMenu, SkipToContent,\n' ||
    E'Switcher. Tidak ada yang perlu dirakit sendiri.\n\n' ||
    E'KENAPA BERGERBANG DAN BUKAN DIKERJAKAN LANGSUNG: ini satu-satunya pekerjaan Carbon yang\n' ||
    E'tidak bisa dilakukan bertahap. Ke-38 layar memakai kerangka yang sama, jadi begitu diganti,\n' ||
    E'seluruhnya berubah dalam satu kali dorong -- termasuk 31 layar yang isinya BELUM Carbon.\n' ||
    E'Akibatnya kerangka Carbon akan membungkus isi non-Carbon, dan itu terlihat lebih kacau\n' ||
    E'daripada keadaan sekarang yang setidaknya seragam salahnya.\n\n' ||
    E'PERTANYAAN YANG PERLU DIJAWAB PEMILIK PRODUK, dan ini bukan pertanyaan gaya:\n' ||
    E'  1. Kerangka dulu, atau isi dulu? Kerangka dulu = seluruh sistem langsung terasa Carbon\n' ||
    E'     tapi isinya belum; isi dulu = kerangka lama bertahan lebih lama tapi tiap layar yang\n' ||
    E'     selesai benar-benar selesai.\n' ||
    E'  2. Navigasi samping sekarang memuat 16 peran dengan menu berbeda-beda. Perlu\n' ||
    E'     dikelompokkan ulang, atau dipindah apa adanya?\n' ||
    E'Keduanya aturan produk, bukan hal yang dijawab Carbon.'
  );
end $$;
