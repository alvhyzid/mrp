'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Header,
  HeaderContainer,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderName,
  SideNav,
  SideNavItems,
  SideNavLink,
  SideNavMenu,
  SideNavMenuItem,
  SkipToContent,
  Tag,
  Toggletip,
  ToggletipButton,
  ToggletipContent,
  Theme
} from '@carbon/react';
import { Add, Information, Logout } from '@carbon/icons-react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { canQuickCreateCustomerPo } from '@/lib/roles';
import NotificationBell from '@/features/mrp/components/NotificationBell';
import { WORKSPACES, ARTI_STATUS, bisaDibuka, type ItemNav } from './navConfig';

// KERANGKA APLIKASI CARBON (DS-04, 25 Agu 2026) — menggantikan AppShell yang dirakit tangan.
//
// KENAPA DIKERJAKAN SEKARANG, bukan setelah isi halamannya Carbon (keputusan pemilik produk):
// setiap layar yang dimigrasikan sesudah ini lahir DI DALAM kerangka yang sudah benar. Bila
// ditunda, dua belas layar pertama dimigrasikan di kerangka lama lalu kerangkanya berganti —
// dan sebagian perlu disesuaikan lagi. Tampilan campur selama peralihan memang nyata, tapi ia
// HILANG SENDIRI seiring migrasi berjalan. Pekerjaan ganda tidak.
//
// AKIBAT YANG DISENGAJA, supaya tidak dikira pekerjaan setengah jadi: selama masa peralihan,
// kerangka Carbon ini membungkus isi halaman yang sebagian besar BELUM Carbon. Itu akan
// terlihat campur. Isi halaman TIDAK disentuh di pekerjaan ini.
//
// DEVIASI RESMI — LEBAR PENUH: isi tidak dibatasi lebar grid Carbon. Alasannya ERP padat data;
// membuang ruang kiri-kanan membuat kolom terpotong lebih cepat, dan memotong kolom diam-diam
// sudah jadi cacat berulang (RSP-01, RSP-02). Deviasi ini HANYA menyentuh lebar — tinggi
// header, padding bertoken, perilaku menu di layar sempit, SkipToContent, dan fokus keyboard
// tetap mengikuti Carbon.

const LABEL_PERAN: Record<string, string> = {
  company_admin: 'Admin Perusahaan',
  general_manager: 'General Manager',
  admin_staff: 'Staf Admin',
  production_manager: 'Manager Produksi',
  production_staff: 'Staf Produksi',
  ppic_manager: 'Manager PPIC',
  ppic_staff: 'Staf PPIC',
  finance_manager: 'Manager Finance',
  finance_staff: 'Staf Finance',
  purchasing_manager: 'Manager Purchasing',
  purchasing_staff: 'Staf Purchasing',
  warehouse_manager: 'Manager Warehouse',
  warehouse_staff: 'Staf Warehouse',
  hr_manager: 'Manager HRD',
  hr_staff: 'Staf HRD',
  viewer: 'Viewer'
};

/// Warna penanda mengikuti ARTI-nya, bukan selera:
///   merah  = jangan menunggunya, keputusannya sudah ditolak
///   biru   = ada tapi menumpang di layar lain
///   abu    = belum dibangun (mayoritas — sengaja warna paling tenang supaya tidak berisik)
///   ungu   = sengaja ditunda, ada pemicunya
const WARNA_TAG: Record<string, 'red' | 'blue' | 'gray' | 'purple' | 'teal'> = {
  ditolak: 'red',
  sebagian: 'blue',
  'belum-ada': 'gray',
  diparkir: 'purple',
  internal: 'teal'
};

function PenandaStatus({ item }: { item: ItemNav }) {
  if (item.status === 'aktif') return null;
  const arti = ARTI_STATUS[item.status];
  return (
    <span className="shell-penanda">
      <Tag size="sm" type={WARNA_TAG[item.status]}>
        {arti.singkat}
      </Tag>
      {/*
        Penjelasan dibuka dengan KLIK, tidak pernah hanya dengan sentuhan kursor — aturan tetap
        proyek. Penjelasan hover tidak bisa dipakai sama sekali di HP dan tablet, dan justru
        perangkat itulah yang dipakai di lantai produksi.

        Isinya menjawab "kenapa ini tidak bisa dibuka", bukan sekadar menyatakan bahwa ia tidak
        bisa. Penanda tanpa alasan hanya memindahkan pertanyaannya, tidak menjawabnya.
      */}
      <Toggletip align="right">
        <ToggletipButton label={`Kenapa "${item.label}" belum bisa dibuka`}>
          <Information size={12} />
        </ToggletipButton>
        <ToggletipContent>
          <p className="shell-penjelasan-judul">{arti.singkat}</p>
          <p>{arti.panjang}</p>
          {item.keterangan && <p className="shell-penjelasan-tambahan">{item.keterangan}</p>}
        </ToggletipContent>
      </Toggletip>
    </span>
  );
}

export default function AppShellCarbon({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

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

  const keluar = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <HeaderContainer
      render={({ isSideNavExpanded, onClickSideNavExpand }: { isSideNavExpanded: boolean; onClickSideNavExpand: () => void }) => {
        // RSP-01 — menu menutup sendiri setelah berpindah halaman. Tanpa ini, di HP menu
        // tetap menutupi halaman tujuan setelah pengguna memilih, dan terasa seperti tidak
        // terjadi apa-apa. Ditaruh di sini karena keadaan buka-tutupnya milik HeaderContainer.
        const tutupSetelahPindah = () => {
          if (isSideNavExpanded) onClickSideNavExpand();
        };

        const tautan = (item: ItemNav) => {
          const aktif = pathname === item.href;
          if (!bisaDibuka(item)) {
            // Item tanpa halaman TIDAK dirender sebagai tautan sama sekali. Tautan yang
            // diklik lalu tidak melakukan apa-apa lebih buruk daripada tidak bisa diklik:
            // yang pertama membuat orang mengira sistemnya rusak.
            return (
              <li key={item.label} className="shell-item-mati">
                <span className="shell-item-mati__label">{item.label}</span>
                <PenandaStatus item={item} />
              </li>
            );
          }
          return (
            <SideNavMenuItem
              key={item.label}
              as={Link}
              href={item.href}
              isActive={aktif}
              aria-current={aktif ? 'page' : undefined}
              onClick={tutupSetelahPindah}
            >
              <span className="shell-item-hidup">
                <span>{item.label}</span>
                <PenandaStatus item={item} />
              </span>
            </SideNavMenuItem>
          );
        };

        return (
          <>
            <Theme theme="g10">
              <Header aria-label="FABRIX">
                {/* SkipToContent: wajib aksesibilitas. Tab pertama dari awal halaman
                    memunculkannya, dan menekannya melompat langsung ke isi utama —
                    tanpa itu pengguna keyboard harus menelusuri 102 item menu dulu. */}
                {/* Teksnya Bahasa Indonesia, bukan bawaan Carbon yang berbahasa Inggris.
                    Aturan D-3 menetapkan label NAVIGASI boleh Inggris karena ia nama modul;
                    ini bukan nama modul melainkan KALIMAT PERINTAH yang dibaca orang. */}
                <SkipToContent href="#main-content">Lompat ke isi utama</SkipToContent>
                <HeaderMenuButton
                  aria-label={isSideNavExpanded ? 'Tutup menu' : 'Buka menu'}
                  onClick={onClickSideNavExpand}
                  isActive={isSideNavExpanded}
                  isCollapsible
                />
                <HeaderName as={Link} href="/dashboard" prefix="FABRIX">
                  {companyName ?? ''}
                </HeaderName>

                <HeaderGlobalBar>
                  {meLoaded && (
                    <span className="shell-identitas">
                      {userName ?? '…'}
                      {role && <span className="shell-peran">{LABEL_PERAN[role] ?? role}</span>}
                    </span>
                  )}
                  {meLoaded && <NotificationBell role={role} companyId={companyId} />}
                  {canQuickCreateCustomerPo(role) && (
                    <HeaderGlobalAction aria-label="Buat PO klien" onClick={() => router.push('/customer-purchase-orders')}>
                      <Add size={20} />
                    </HeaderGlobalAction>
                  )}
                  <HeaderGlobalAction aria-label="Keluar" onClick={keluar}>
                    <Logout size={20} />
                  </HeaderGlobalAction>
                </HeaderGlobalBar>

                <SideNav
                  aria-label="Navigasi utama"
                  expanded={isSideNavExpanded}
                  onSideNavBlur={onClickSideNavExpand}
                  isPersistent
                  className="shell-sidenav"
                >
                  <SideNavItems>
                    {WORKSPACES.map((ws) => {
                      const adaYangAktif = ws.items.some((i) => i.href && pathname === i.href);
                      // Satu-satunya item aktif di workspace Overview adalah Dashboard, dan
                      // ia dipakai setiap hari. Ditaruh sebagai tautan datar, bukan di balik
                      // kelompok yang harus dibuka dulu.
                      if (ws.label === 'Overview') {
                        return (
                          <div key={ws.label}>
                            <SideNavLink
                              as={Link}
                              href="/dashboard"
                              isActive={pathname === '/dashboard'}
                              onClick={tutupSetelahPindah}
                            >
                              Dashboard
                            </SideNavLink>
                            <SideNavMenu title="Overview" defaultExpanded={false}>
                              {ws.items.filter((i) => i.href !== '/dashboard').map(tautan)}
                            </SideNavMenu>
                          </div>
                        );
                      }
                      return (
                        <SideNavMenu key={ws.label} title={ws.label} defaultExpanded={adaYangAktif}>
                          {ws.items.map(tautan)}
                        </SideNavMenu>
                      );
                    })}
                  </SideNavItems>
                </SideNav>
              </Header>
            </Theme>

            {/* LEBAR PENUH — deviasi resmi. Isi TIDAK dibungkus Grid Carbon.
                Wadahnya tetap memakai token Carbon untuk jarak dan tinggi header. */}
            {/* tabIndex={-1} BUKAN hiasan: tanpa itu, menekan "Lompat ke isi utama" memang
                memindahkan halaman ke jangkarnya, tapi FOKUS keyboard tetap tertinggal di
                <body>. Akibatnya Tab berikutnya mengulang dari awal dokumen — pengguna
                keyboard kembali ke 102 item menu yang barusan ia lompati.
                Diukur di peramban sebelum diperbaiki: fokus mendarat di BODY. */}
            <main id="main-content" tabIndex={-1} className="shell-isi">
              {children}
            </main>
          </>
        );
      }}
    />
  );
}
