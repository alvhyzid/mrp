'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { canAccessWarehouseDashboard, canAccessHrDashboard, canAccessPpicDashboard, canAccessProductionDashboard, canQuickCreateCustomerPo } from '@/lib/roles';

// UI Shell Carbon Design System (Header + SideNav) sebagai layout terpakai
// bersama di semua halaman berlogin — perluasan dari tombol Logout yang
// sebelumnya cuma ada sendiri-sendiri di beberapa halaman. Struktur & ukuran
// diambil dari source resmi @carbon/react (packages/react/src/components/UIShell)
// dan @carbon/styles (scss/components/ui-shell), bukan tebakan:
// - Header: tinggi 48px (mini-units(6)), bg $background, border-bottom 1px
//   solid $border-subtle (#c6c6c6), nama app 14px/600/$text-primary.
// - SideNav: lebar expanded 256px (mini-units(32)), bg $background, item
//   min-height 32px (mini-units(4)), teks default $text-secondary (#525252),
//   hover bg rgba(141,141,141,.12), item aktif bg rgba(141,141,141,.2) +
//   teks $text-primary + garis aksen kiri 3px $border-interactive (#0f62fe).
// Font IBM Plex Sans dimuat sekali di app/layout.tsx (berlaku company-wide
// sejak Tahap 3), tidak perlu dimuat lagi di sini.

const ROLE_LABELS: Record<string, string> = {
  company_admin: 'Admin Perusahaan',
  general_manager: 'General Manager',
  admin_staff: 'Staf Administrasi',
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

type NavItem = { label: string; href: string; visible: (role: string | null) => boolean };
type NavSection = { title: string; items: NavItem[] };

// "Ringkasan" berdiri sendiri di paling atas, tanpa section/divider — dashboard
// lintas-department, cuma relevan untuk company_admin/general_manager (department
// lain sudah punya dashboard sendiri sebagai halaman utama mereka).
const TOP_ITEM: NavItem = { label: 'Ringkasan', href: '/dashboard', visible: () => true };

// Tiap section dirender dengan judul + garis pembatas di atasnya, dan section itu
// sendiri disembunyikan total kalau tidak ada satu pun item di dalamnya yang
// visible untuk role yang login (jadi tidak ada judul section menggantung kosong).
// Visibilitas PER ITEM sengaja tetap identik dengan sebelum restrukturisasi ini —
// cuma pengelompokan & format tampilannya yang berubah.
const NAV_SECTIONS: NavSection[] = [
  {
    title: 'MRP',
    items: [
      { label: 'PO Client', href: '/customer-purchase-orders', visible: () => true },
      { label: 'Sales Order', href: '/sales-orders', visible: () => true },
      { label: 'BOM (Resep)', href: '/boms', visible: () => true },
      { label: 'Work Order', href: '/work-orders', visible: () => true }
    ]
  },
  {
    title: 'Warehouse',
    items: [
      { label: 'Dashboard', href: '/warehouse', visible: canAccessWarehouseDashboard },
      { label: 'Item Master', href: '/items', visible: () => true }
    ]
  },
  {
    title: 'PPIC',
    items: [{ label: 'Dashboard', href: '/ppic', visible: canAccessPpicDashboard }]
  },
  {
    title: 'Production',
    items: [{ label: 'Dashboard', href: '/production', visible: canAccessProductionDashboard }]
  },
  {
    title: 'HR',
    items: [{ label: 'Dashboard', href: '/hr', visible: canAccessHrDashboard }]
  },
  {
    title: 'Settings',
    items: [
      { label: 'Data Perusahaan', href: '/company', visible: (role) => role === 'company_admin' },
      { label: 'Profil Saya', href: '/profile', visible: () => true }
    ]
  }
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // AppShell hidup di app/(shell)/layout.tsx, jadi SATU instance ini dipakai
    // terus selama user berpindah-pindah halaman di dalam grup (shell) — TIDAK
    // remount per halaman. Makanya effect ini sengaja HANYA jalan sekali saat
    // mount (bukan tiap `pathname` berubah): kalau ikut pathname, /api/me akan
    // diulang tiap kali pindah menu, persis pola redundan yang baru saja
    // dihilangkan dari alur login. `pathname` saat ini dibaca langsung (bukan
    // lewat dependency) hanya untuk redirectTo kalau ternyata sesi sudah habis.
    const load = async () => {
      if (!hasSupabaseConfig || !supabase) return;
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace(`/login?redirectTo=${encodeURIComponent(window.location.pathname || '/dashboard')}`);
        return;
      }
      const response = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
      });
      const data = await response.json();
      if (!cancelled && response.ok) {
        setUserName(data?.user?.name ?? null);
        setRole(data?.user?.role ?? null);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.visible(role))
  })).filter((section) => section.items.length > 0);

  const renderNavLink = (item: NavItem) => {
    const active = pathname === item.href;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={`relative flex h-8 items-center px-4 text-sm transition-colors ${
            active ? 'bg-[rgba(141,141,141,0.2)] font-medium text-[#161616]' : 'text-[#525252] hover:bg-[rgba(141,141,141,0.12)]'
          }`}
        >
          {active ? <span className="absolute inset-y-0 left-0 w-[3px] bg-[#0f62fe]" aria-hidden="true" /> : null}
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between border-b border-[#c6c6c6] bg-white px-4">
        <span className="text-sm font-semibold text-[#161616]">MRP &mdash; PT ITM</span>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#525252]">
            {userName ?? '…'}
            {role ? (
              <>
                <span className="mx-1.5 text-[#c6c6c6]">|</span>
                {ROLE_LABELS[role] ?? role}
              </>
            ) : null}
          </span>
          {/* Dulu slot ini dipakai tombol Keluar (sekarang pindah ke bawah side nav,
              supaya tetap bisa diakses semua role tanpa perlu gate role) — sekarang
              dipakai pintasan "Buat PO", cuma untuk role yang eksplisit diberi izin. */}
          {canQuickCreateCustomerPo(role) ? (
            <Link
              href="/customer-purchase-orders"
              className="inline-flex h-8 items-center rounded-none bg-[#0f62fe] px-3 text-xs font-medium text-white transition-colors hover:bg-[#0043ce]"
            >
              Buat PO
            </Link>
          ) : null}
        </div>
      </header>

      <nav aria-label="Navigasi utama" className="fixed bottom-0 left-0 top-12 z-30 flex w-64 flex-col border-r border-[#e0e0e0] bg-white">
        <div className="flex-1 overflow-y-auto">
          <ul>{renderNavLink(TOP_ITEM)}</ul>
          {visibleSections.map((section) => (
            <div key={section.title} className="border-t border-[#e0e0e0] pt-2">
              <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[#8d8d8d]">{section.title}</p>
              <ul>{section.items.map(renderNavLink)}</ul>
            </div>
          ))}
        </div>
        <div className="border-t border-[#e0e0e0] p-2">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-8 w-full items-center justify-center rounded-none border border-[#8d8d8d] bg-white text-xs font-medium text-[#161616] transition-colors hover:bg-[#f4f4f4]"
          >
            Keluar
          </button>
        </div>
      </nav>

      <div className="ml-64 pt-12">{children}</div>
    </div>
  );
}
