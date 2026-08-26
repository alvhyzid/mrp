'use client';

import { useEffect, useState } from 'react';
import { dengarkanProfilBerubah } from '@/lib/profilEvents';
// SATU peta label peran untuk seluruh sistem. Berkas ini dulu punya petanya SENDIRI, dan
// keduanya SUDAH menyimpang: header berkata "Manager Warehouse" sementara halaman Tim berkata
// "Manajer Gudang" untuk orang yang sama. Lima label berbeda dari enam belas. Itu persis
// aturan "satu istilah di layar untuk semua departemen" yang dilanggar oleh salinan kedua.
import { getRoleLabel } from '@/lib/glossary';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderName,
  HeaderPanel,
  SideNav,
  SideNavDivider,
  SideNavItems,
  SideNavLink,
  SideNavMenu,
  SideNavMenuItem,
  SkipToContent,
  Switcher,
  SwitcherDivider,
  SwitcherItem,
  Tag,
  Theme
} from '@carbon/react';
import { Add, ChevronDown, Logout, UserAvatar } from '@carbon/icons-react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { canQuickCreateCustomerPo } from '@/lib/roles';
import NotificationBell from '@/features/mrp/components/NotificationBell';
import { WORKSPACES, MENU_AKUN, ARTI_STATUS, bisaDibuka, type ItemNav } from './navConfig';

// KERANGKA APLIKASI CARBON (DS-04, 25 Agu 2026).
//
// ============================================================================
// WARNA — KENAPA HEADER DAN PANEL KIRI GELAP
// ============================================================================
// Carbon menetapkan warna header lewat TEMA yang diterapkan ke "shell zone", bukan lewat
// warna yang ditulis sendiri. Kalimatnya: "The UI Shell can be customized to use any of the
// four IBM themes by applying an inline theme to the shell zone", dan latar header memakai
// token $background dari tema itu.
//
// Zona shell memakai g100 (gelap), area isi tetap g10 (terang). Ini bentuk IBM yang khas, dan
// sekaligus menyelesaikan keluhan bahwa panel kiri "terlalu menyatu dengan area isi": yang
// memisahkan keduanya sekarang perbedaan TEMA, bukan garis tipis yang mudah hilang.
//
// ============================================================================
// KENAPA PENJELASAN STATUS TIDAK LAGI MEMAKAI POPOVER
// ============================================================================
// Versi pertama memakai Toggletip per item. Panel penjelasannya TERPOTONG oleh panel kiri yang
// menggulir — dan itu bukan cacat yang bisa ditambal dengan mengatur posisi: elemen melayang
// di dalam wadah ber-`overflow` akan selalu terpotong oleh wadahnya.
//
// Gantinya dua hal yang lebih sederhana dan tidak bisa terpotong:
//   1. KETERANGAN PER ITEM ditulis langsung di bawah labelnya sebagai teks kecil.
//   2. ARTI SETIAP PENANDA dijelaskan SEKALI di kaki panel, bukan 75 kali di tiap item.
// Penjelasan yang sama diulang 75 kali bukan cuma boros — ia membuat orang berhenti membaca.


/// Warna penanda mengikuti ARTI-nya, bukan selera:
///   merah = jangan menunggunya, keputusannya sudah ditolak
///   biru  = ada, tapi menumpang di layar lain
///   abu   = belum dibangun (mayoritas — sengaja paling tenang supaya tidak berisik)
///   ungu  = sengaja ditunda, ada pemicunya
const WARNA_TAG: Record<string, 'red' | 'blue' | 'gray' | 'purple' | 'teal'> = {
  ditolak: 'red',
  sebagian: 'blue',
  'belum-ada': 'gray',
  diparkir: 'purple',
  internal: 'teal'
};

function Penanda({ status }: { status: ItemNav['status'] }) {
  if (status === 'aktif') return null;
  return (
    <Tag size="sm" type={WARNA_TAG[status]} className="shell-tag">
      {ARTI_STATUS[status].singkat}
    </Tag>
  );
}

/// Baris menu untuk item yang BELUM punya halaman.
///
/// Dirender sebagai teks, BUKAN tautan. Tautan yang diklik lalu tidak melakukan apa-apa lebih
/// buruk daripada yang tidak bisa diklik: yang pertama membuat orang mengira sistemnya rusak.
function ItemMati({ item }: { item: ItemNav }) {
  return (
    <li className="shell-mati">
      <span className="shell-mati__baris">
        <span className="shell-mati__label">{item.label}</span>
        <Penanda status={item.status} />
      </span>
      {item.keterangan && <span className="shell-mati__keterangan">{item.keterangan}</span>}
    </li>
  );
}

export default function AppShellCarbon({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // Foto yang GAGAL DIMUAT diingat supaya tidak dicoba terus-menerus. Tanpa ini, alamat yang
  // rusak menghasilkan ikon gambar patah -- lebih buruk daripada ikon bawaan yang rapi.
  const [fotoGagal, setFotoGagal] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  // Keadaan buka-tutup panel kiri DIURUS SENDIRI, bukan lewat HeaderContainer.
  //
  // Alasannya bukan selera: HeaderContainer menyediakan satu saklar yang di layar lebar tidak
  // berpengaruh sama sekali karena panelnya `isPersistent`. Akibatnya tombol lipat di kiri
  // atas TIDAK MELAKUKAN APA-APA di laptop — dilaporkan pemilik produk, dan memang benar.
  // Dengan keadaan sendiri, tombol itu melipat panelnya di lebar berapa pun.
  const [menuTerbuka, setMenuTerbuka] = useState(true);
  const [panelAkun, setPanelAkun] = useState(false);

  // Di layar sempit panel mulai TERTUTUP; di layar lebar mulai TERBUKA.
  useEffect(() => {
    if (typeof window !== 'undefined') setMenuTerbuka(window.innerWidth >= 1056);
  }, []);

  // Menutup sendiri setelah pindah halaman HANYA di layar sempit (RSP-01). Di layar lebar
  // menutupnya akan menghukum pengguna yang memang ingin panelnya tetap terbuka.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1056) setMenuTerbuka(false);
    setPanelAkun(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!hasSupabaseConfig || !supabase) return;
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace(`/login?redirectTo=${encodeURIComponent(window.location.pathname || '/dashboard')}`);
        return;
      }
      const response = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        cache: 'no-store'
      });
      const data = await response.json();
      if (!cancelled) {
        if (response.ok) {
          setUserName(data?.user?.name ?? null);
          setAvatarUrl(data?.user?.avatar_url ?? null);
          setRole(data?.user?.role ?? null);
          setCompanyId(data?.company?.company_id ?? null);
          setCompanyName(data?.company?.name ?? null);
        }
        setMeLoaded(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // KABAR "PROFIL BERUBAH" (MM.1). Header punya salinan datanya sendiri, jadi tanpa ini foto
  // baru tidak akan pernah sampai ke sini sampai halaman dimuat ulang -- dan muat ulang
  // DILARANG oleh keputusan pemilik produk.
  useEffect(() => {
    return dengarkanProfilBerubah((detail) => {
      setAvatarUrl(detail.avatarUrl);
      setFotoGagal(false);
      if (detail.nama !== undefined) setUserName(detail.nama);
    });
  }, []);

  const keluar = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

  const tutupBilaSempit = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1056) setMenuTerbuka(false);
  };

  const tautan = (item: ItemNav) => {
    if (!bisaDibuka(item)) return <ItemMati key={item.label} item={item} />;
    const aktif = pathname === item.href;
    return (
      <SideNavMenuItem
        key={item.label}
        as={Link}
        href={item.href}
        isActive={aktif}
        aria-current={aktif ? 'page' : undefined}
        onClick={tutupBilaSempit}
      >
        <span className="shell-hidup">
          <span>{item.label}</span>
          <Penanda status={item.status} />
        </span>
      </SideNavMenuItem>
    );
  };

  return (
    <>
      {/* ZONA SHELL — tema g100. Lihat catatan warna di kepala berkas. */}
      <Theme theme="g100">
        <Header aria-label="FABRIX">
          {/* Teksnya Bahasa Indonesia, bukan bawaan Carbon yang berbahasa Inggris. Aturan D-3
              menetapkan label NAVIGASI boleh Inggris karena ia nama modul; ini bukan nama
              modul melainkan KALIMAT PERINTAH yang dibaca orang. */}
          <SkipToContent href="#main-content">Lompat ke isi utama</SkipToContent>

          <HeaderMenuButton
            aria-label={menuTerbuka ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={menuTerbuka}
            onClick={() => setMenuTerbuka((v) => !v)}
            isActive={menuTerbuka}
            isCollapsible
          />

          <HeaderName as={Link} href="/dashboard" prefix="FABRIX">
            {companyName ?? ''}
          </HeaderName>

          <HeaderGlobalBar>
            {meLoaded && <NotificationBell role={role} companyId={companyId} />}

            {canQuickCreateCustomerPo(role) && (
              <HeaderGlobalAction aria-label="Buat PO klien" onClick={() => router.push('/customer-purchase-orders')}>
                <Add size={20} />
              </HeaderGlobalAction>
            )}

            {/* AVATAR + NAMA + PANAH — SATU tombol, bukan tiga elemen berdampingan.
                Seluruhnya bisa ditekan, jadi target sentuhnya selebar nama. Versi sebelumnya
                menaruh nama sebagai teks mati di sebelah ikon; ia terlihat bisa diklik dan
                tidak bisa. */}
            <button
              type="button"
              className={`shell-akun ${panelAkun ? 'shell-akun--terbuka' : ''}`}
              aria-label="Menu akun dan pengaturan"
              aria-expanded={panelAkun}
              onClick={() => setPanelAkun((v) => !v)}
            >
              {/* IKON CARBON SEBAGAI BAWAAN, BUKAN INISIAL (keputusan pemilik produk MM.1d).
                  Inisial terlihat seperti data padahal cuma tebakan dari nama; ikon jujur
                  berkata "belum ada foto". Foto yang gagal dimuat jatuh ke ikon yang sama --
                  gambar patah lebih buruk daripada tidak ada gambar. */}
              <span className="shell-akun__avatar" aria-hidden="true">
                {avatarUrl && !fotoGagal ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="shell-akun__foto"
                    onError={() => setFotoGagal(true)}
                  />
                ) : (
                  <UserAvatar size={20} />
                )}
              </span>
              <span className="shell-akun__teks">
                <span className="shell-akun__nama">{userName ?? '…'}</span>
                {role && <span className="shell-akun__peran">{getRoleLabel(role)}</span>}
              </span>
              <ChevronDown size={16} className="shell-akun__panah" />
            </button>

            <HeaderGlobalAction aria-label="Keluar" onClick={keluar}>
              <Logout size={20} />
            </HeaderGlobalAction>
          </HeaderGlobalBar>

          {/* PANEL AKUN — komponen Carbon untuk "additional system level actions or content
              associated with a system icon in the header". Bukan menu buatan sendiri. */}
          <HeaderPanel aria-label="Menu akun dan pengaturan" expanded={panelAkun}>
            {/*
              Anak-anak Switcher dirender DATAR, bukan dibungkus per kelompok.
              Alasannya bukan gaya: Switcher Carbon adalah <ul>, dan SwitcherDivider sendiri
              sudah berupa <li>. Versi pertama membungkus tiap kelompok dalam <li> lagi,
              sehingga menghasilkan <li> di dalam <li> — HTML tidak sah, dan React
              melaporkannya sebagai galat hydration di konsol. Tidak terlihat di layar, tapi
              nyata: peramban boleh "memperbaiki" struktur semacam itu sesuka hatinya, dan
              hasilnya berbeda-beda antar peramban.
            */}
            <Switcher aria-label="Menu akun dan pengaturan">
              {MENU_AKUN.flatMap((grup, iGrup) => [
                ...(iGrup > 0 ? [<SwitcherDivider key={`pisah-${grup.label}`} />] : []),
                <li key={`judul-${grup.label}`} className="shell-akun-judul">
                  {grup.label}
                </li>,
                ...grup.items.map((item) =>
                  bisaDibuka(item) ? (
                    <SwitcherItem
                      key={item.label}
                      aria-label={item.label}
                      href={item.href}
                      onClick={() => setPanelAkun(false)}
                    >
                      <span className="shell-hidup">
                        <span>{item.label}</span>
                        <Penanda status={item.status} />
                      </span>
                    </SwitcherItem>
                  ) : (
                    <ItemMati key={item.label} item={item} />
                  )
                )
              ])}
            </Switcher>
          </HeaderPanel>

          <SideNav aria-label="Navigasi utama" expanded={menuTerbuka} isPersistent={false} className="shell-sidenav">
            <SideNavItems>
              <SideNavLink as={Link} href="/dashboard" isActive={pathname === '/dashboard'} onClick={tutupBilaSempit}>
                Dashboard
              </SideNavLink>

              {WORKSPACES.map((ws) => {
                const adaYangAktif = ws.items.some((i) => i.href && pathname === i.href);
                const isi = ws.label === 'Overview' ? ws.items.filter((i) => i.href !== '/dashboard') : ws.items;
                return (
                  <SideNavMenu key={ws.label} title={ws.label} defaultExpanded={adaYangAktif}>
                    {isi.map(tautan)}
                  </SideNavMenu>
                );
              })}

              <SideNavDivider />

              {/* KETERANGAN PENANDA — dijelaskan SEKALI di sini, bukan 75 kali di tiap item.
                  Ditaruh di kaki panel karena ia dibaca sekali lalu tidak dibutuhkan lagi. */}
              <li className="shell-legenda">
                <p className="shell-legenda__judul">Arti penanda</p>
                {(['sebagian', 'belum-ada', 'diparkir', 'ditolak'] as const).map((st) => (
                  <span key={st} className="shell-legenda__baris">
                    <Tag size="sm" type={WARNA_TAG[st]} className="shell-tag">
                      {ARTI_STATUS[st].singkat}
                    </Tag>
                    <span>{ARTI_STATUS[st].panjang}</span>
                  </span>
                ))}
              </li>
            </SideNavItems>
          </SideNav>
        </Header>
      </Theme>

      {/* LEBAR PENUH — deviasi resmi. Isi TIDAK dibungkus Grid Carbon.
          Kelas `shell-isi--bergeser` hanya dipasang saat panel kiri terbuka, supaya tombol
          lipat benar-benar MELEBARKAN area kerja dan bukan sekadar menyembunyikan menu. */}
      <main id="main-content" tabIndex={-1} className={`shell-isi ${menuTerbuka ? 'shell-isi--bergeser' : ''}`}>
        {children}
      </main>
    </>
  );
}
