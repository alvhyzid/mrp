-- DEC-S13 — WEWENANG PELEPASAN DARURAT DIPERSEMPIT KE GENERAL MANAGER SAJA.
--
-- KEPUTUSAN PEMILIK PRODUK (30 Agu 2026): pelepasan darurat adalah wewenang
-- COMPANY GENERAL MANAGER. Company Admin TIDAK memilikinya.
--
-- KENAPA PEMISAHAN INI PENTING, dan bukan sekadar selera: `company_admin` adalah peran
-- ADMINISTRATOR SISTEM di FABRIX -- ia mengelola pengguna, undangan, dan setelan. Memberinya
-- wewenang melampaui penghalang departemen berarti wewenang teknis diam-diam menjadi wewenang
-- komersial. Itu persis yang tidak boleh terjadi pada aksi yang melampaui keputusan orang lain.
--
-- Inilah yang dimaksud "wewenang darurat punya NAMA SENDIRI": mempersempitnya hanya menyentuh
-- satu fungsi ini dan satu konstanta di src/lib/roles.ts -- nol tempat lain.

create or replace function public.jwt_boleh_lepas_darurat()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() = 'general_manager';
$$;

comment on function public.jwt_boleh_lepas_darurat() is
  'Wewenang PELEPASAN DARURAT (DEC-S13, dipersempit 30 Agu 2026): HANYA general_manager. Company Admin sengaja TIDAK termasuk -- ia peran administrator sistem, bukan wewenang komersial. Menyalin EMERGENCY_HOLD_RELEASE_ROLES di src/lib/roles.ts.';
