'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { canAccessWarehouseDashboard, canAccessHrDashboard, canAccessPpicDashboard, canAccessProductionDashboard } from '@/lib/roles';

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

const NAV_ITEMS: NavItem[] = [
  { label: 'Ringkasan', href: '/dashboard', visible: () => true },
  { label: 'Dashboard Warehouse', href: '/warehouse', visible: canAccessWarehouseDashboard },
  { label: 'Dashboard HRD', href: '/hr', visible: canAccessHrDashboard },
  { label: 'Dashboard PPIC', href: '/ppic', visible: canAccessPpicDashboard },
  { label: 'Dashboard Production', href: '/production', visible: canAccessProductionDashboard },
  { label: 'Item Master', href: '/items', visible: () => true },
  { label: 'BOM (Resep)', href: '/boms', visible: () => true },
  { label: 'PO Client', href: '/customer-purchase-orders', visible: () => true },
  { label: 'Work Order', href: '/work-orders', visible: () => true },
  { label: 'Kelola Tim', href: '/team', visible: (role) => role === 'company_admin' },
  { label: 'Data Perusahaan', href: '/company', visible: (role) => role === 'company_admin' },
  { label: 'Profil Saya', href: '/profile', visible: () => true }
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

  const visibleItems = NAV_ITEMS.filter((item) => item.visible(role));

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
          <button
            type="button"
            onClick={handleSignOut}
            className="h-8 rounded-none border border-[#8d8d8d] bg-white px-3 text-xs font-medium text-[#161616] transition-colors hover:bg-[#f4f4f4]"
          >
            Keluar
          </button>
        </div>
      </header>

      <nav aria-label="Navigasi utama" className="fixed bottom-0 left-0 top-12 z-30 w-64 overflow-y-auto border-r border-[#e0e0e0] bg-white">
        <ul>
          {visibleItems.map((item) => {
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
          })}
        </ul>
      </nav>

      <div className="ml-64 pt-12">{children}</div>
    </div>
  );
}
