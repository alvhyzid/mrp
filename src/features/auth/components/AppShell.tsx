'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Dashboard,
  Document,
  Receipt,
  Assembly,
  FlowConnection,
  Task,
  InventoryManagement,
  Cube,
  ShoppingCart,
  ChartLine,
  Industry,
  UserMultiple,
  Settings as SettingsIcon,
  UserAvatar
} from '@carbon/icons-react';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { canAccessWarehouseDashboard, canAccessHrDashboard, canAccessPpicDashboard, canAccessProductionDashboard, canQuickCreateCustomerPo } from '@/lib/roles';
import { NotificationBell } from '@/features/mrp';

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

// Prefiks badan hukum umum yang dibuang dulu sebelum hitung inisial company —
// supaya inisial mencerminkan NAMA INTI perusahaan, bukan kebetulan sama-sama
// diawali jenis badan hukum yang sama. TAMBAHKAN DI SINI kalau nanti ada tenant
// baru dengan prefiks lain yang belum tercakup (mis. "Yayasan", "UMKM", dst).
const COMPANY_NAME_PREFIXES = ['PT', 'CV', 'UD', 'PD', 'FA', 'FIRMA', 'PERUM', 'KOPERASI'];

// Placeholder slot logo saat perusahaan belum upload logo asli — inisial dihitung
// MURNI dari companyName (data), persis pola yang sama dengan kenapa "PT ITM"
// dulu salah di-hardcode di header: apa pun yang tampil di elemen shared ini
// WAJIB diturunkan dari data tenant yang sedang login, tidak boleh ada string
// nama perusahaan tertulis langsung di kode. Aturan: buang 1 prefiks badan
// hukum di kata pertama (case-insensitive, titik di akhir diabaikan) kalau ada,
// baru ambil huruf pertama dari 2 kata sisa berikutnya (mis. "PT Indo Taste
// Manufacture" -> "IT"); kalau sisa cuma 1 kata, pakai 2 huruf pertama kata itu
// (mis. "PT ITM" -> "IT").
function getCompanyInitials(name: string | null): string {
  if (!name) return '';
  let words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1 && COMPANY_NAME_PREFIXES.includes(words[0].replace(/\.$/, '').toUpperCase())) {
    words = words.slice(1);
  }
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

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

type NavItem = { label: string; href: string; visible: (role: string | null) => boolean; icon: CarbonIcon };
type NavSection = { title: string; items: NavItem[] };
// Tipe komponen icon dari @carbon/icons-react (bukan tebakan/lucide — icon set
// resmi IBM Carbon, konsisten dengan font/warna/ukuran shell yang sudah disumber
// dari paket @carbon/* asli).
type CarbonIcon = React.ComponentType<{ size?: number; className?: string }>;

// "Ringkasan" berdiri sendiri di paling atas, tanpa section/divider — dashboard
// lintas-department, cuma relevan untuk company_admin/general_manager (department
// lain sudah punya dashboard sendiri sebagai halaman utama mereka).
const TOP_ITEM: NavItem = { label: 'Ringkasan', href: '/dashboard', visible: () => true, icon: Dashboard };

// Tiap section dirender dengan judul + garis pembatas di atasnya, dan section itu
// sendiri disembunyikan total kalau tidak ada satu pun item di dalamnya yang
// visible untuk role yang login (jadi tidak ada judul section menggantung kosong).
// Visibilitas PER ITEM sengaja tetap identik dengan sebelum restrukturisasi ini —
// cuma pengelompokan & format tampilannya yang berubah.
const NAV_SECTIONS: NavSection[] = [
  {
    title: 'MRP',
    items: [
      { label: 'PO Client', href: '/customer-purchase-orders', visible: () => true, icon: Document },
      { label: 'Sales Order', href: '/sales-orders', visible: () => true, icon: Receipt },
      { label: 'BOM (Resep)', href: '/boms', visible: () => true, icon: Assembly },
      { label: 'Routing', href: '/routing', visible: () => true, icon: FlowConnection },
      { label: 'Work Order', href: '/work-orders', visible: () => true, icon: Task }
    ]
  },
  {
    title: 'Purchasing',
    items: [{ label: 'PO Supplier', href: '/purchasing', visible: () => true, icon: ShoppingCart }]
  },
  {
    title: 'Warehouse',
    items: [
      { label: 'Dashboard', href: '/warehouse', visible: canAccessWarehouseDashboard, icon: InventoryManagement },
      { label: 'Item Master', href: '/items', visible: () => true, icon: Cube }
    ]
  },
  {
    title: 'PPIC',
    items: [{ label: 'Dashboard', href: '/ppic', visible: canAccessPpicDashboard, icon: ChartLine }]
  },
  {
    title: 'Production',
    items: [{ label: 'Dashboard', href: '/production', visible: canAccessProductionDashboard, icon: Industry }]
  },
  {
    title: 'HR',
    items: [{ label: 'Dashboard', href: '/hr', visible: canAccessHrDashboard, icon: UserMultiple }]
  },
  {
    title: 'Settings',
    items: [
      { label: 'Data Perusahaan', href: '/company', visible: (role) => role === 'company_admin', icon: SettingsIcon },
      { label: 'Profil Saya', href: '/profile', visible: () => true, icon: UserAvatar }
    ]
  }
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  // Beda dari companyLogoUrl (null = "sudah dicek, memang tidak ada logo"): flag
  // ini khusus menandai "belum selesai dicek sama sekali", supaya slot logo bisa
  // menampilkan placeholder netral saat masih memuat alih-alih kosong tiba-tiba
  // terisi (mencegah kesan patah/blank sesaat, dan mencegah konten header
  // "melompat" begitu logo muncul).
  const [meLoaded, setMeLoaded] = useState(false);

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
          setCompanyLogoUrl(data?.company?.logo_url ?? null);
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
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={`relative flex h-8 items-center gap-3 px-4 text-sm transition-colors ${
            active ? 'bg-[rgba(141,141,141,0.2)] font-medium text-[#161616]' : 'text-[#525252] hover:bg-[rgba(141,141,141,0.12)]'
          }`}
        >
          {active ? <span className="absolute inset-y-0 left-0 w-[3px] bg-[#0f62fe]" aria-hidden="true" /> : null}
          <Icon size={16} className="shrink-0" />
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between border-b border-[#c6c6c6] bg-white px-4">
        <div className="flex items-center gap-2.5">
          {!meLoaded ? (
            <span className="h-6 w-6 shrink-0 animate-pulse rounded-none bg-[#e0e0e0]" aria-hidden="true" />
          ) : companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={companyLogoUrl} alt={companyName ?? 'Logo perusahaan'} className="h-6 w-6 shrink-0 object-contain" />
          ) : companyName ? (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none bg-[#e0e0e0] text-[10px] font-semibold text-[#525252]"
              title={companyName}
            >
              {getCompanyInitials(companyName)}
            </span>
          ) : null}
          <span className="text-sm font-semibold text-[#161616]">
            MRP{companyName ? ` — ${companyName}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {meLoaded ? <NotificationBell role={role} companyId={companyId} /> : null}
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
        <div className="flex-1 overflow-y-auto py-2">
          <ul className="pb-2">{renderNavLink(TOP_ITEM)}</ul>
          {visibleSections.map((section) => (
            <div key={section.title} className="border-t border-[#e0e0e0] pb-2 pt-3">
              <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-[#8d8d8d]">{section.title}</p>
              <ul className="flex flex-col gap-0.5">{section.items.map(renderNavLink)}</ul>
            </div>
          ))}
        </div>
        <div className="border-t border-[#e0e0e0] p-3">
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
