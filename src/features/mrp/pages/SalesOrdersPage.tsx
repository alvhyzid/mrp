'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import {
  Button,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineNotification,
  NumberInput,
  Pagination,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandHeader,
  TableExpandRow,
  TableExpandedRow,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  TextInput,
  Tag
} from '@carbon/react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';

// SALES ORDER — dimigrasikan ke Carbon 26 Agu 2026 (DS-09), cetakan Master Item.
import { canViewPlanningFeasibility, canViewFinancialData } from '@/lib/roles';
import { formatCurrency, formatNumberId } from '@/lib/currency';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';

const statusLabels: Record<string, string> = { confirmed: 'Dikonfirmasi', in_production: 'Sedang Produksi', completed: 'Selesai', cancelled: 'Batal' };
/// Warna Tag mengikuti ARTI. "Sedang diproduksi" ungu, bukan kuning: itu kemajuan yang
/// normal, bukan peringatan. Hanya "dibatalkan" yang merah.
const statusWarnaTag: Record<string, 'blue' | 'purple' | 'green' | 'red'> = {
  confirmed: 'blue',
  in_production: 'purple',
  completed: 'green',
  cancelled: 'red'
};

type SoLine = {
  sales_order_line_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  qty_ordered: number;
  unit_price: number | null;
  qty_already_planned_in_wo: number;
  qty_shipped: number;
  qty_remaining_to_ship: number;
};

type SoShipmentSummary = {
  shipment_id: number;
  shipment_number: string;
  status: string;
  shipment_date: string;
  delivery_address: string;
  created_at: string;
};

type SalesOrder = {
  sales_order_id: number;
  so_number: string;
  customer_id: number;
  customer_name: string | null;
  identity_predates_snapshot: boolean;
  customer_purchase_order_id: number | null;
  po_number: string | null;
  production_plant_id: number;
  production_plant_name: string | null;
  status: string;
  created_at: string;
  lines: SoLine[];
  shipments: SoShipmentSummary[];
};

type BlockingStage = { sequence_no: number; step_name: string };
type MaterialShortage = { item_id: number; item_code: string; name: string; needed: number; available: number; short: number; blocking_stage: BlockingStage | null };
type ComponentToProduce = { item_id: number; item_code: string; name: string; qty_needed: number; blocking_stage: BlockingStage | null };
type LateStageBlock = { item_id: number; item_code: string; name: string; blocking_stage: BlockingStage; expected_date: string | null; stage_ready_date: string | null };
type FeasibilityResult = {
  item_code: string;
  item_name: string;
  qty_ordered: number;
  unit_per_batch?: number;
  batches_per_day?: number;
  batches_needed?: number;
  days_needed?: number;
  requested_ship_date?: string;
  today?: string;
  routing_available?: boolean;
  // production_start_blocked_until = kapan produksi bisa MULAI (cuma diblokir
  // bahan tahap PERTAMA). order_ship_ready_date = kapan order realistis SELESAI/
  // siap dikirim (mempertimbangkan bahan tahap belakangan juga) -- dua tanggal
  // ini SENGAJA dipisah (sebelumnya tercampur jadi 1 angka), lihat
  // getPlanningFeasibility.ts.
  production_start_blocked_until: string | null;
  order_ship_ready_date?: string;
  late_stage_material_blocks?: LateStageBlock[];
  total_working_days_to_deadline?: number;
  effective_working_days_after_material_block?: number;
  feasible: boolean | null;
  realistic_qty_deliverable_on_time?: number;
  material_shortages?: MaterialShortage[];
  components_to_produce?: ComponentToProduce[];
  standard_drift?: { message: string; unit_per_batch: { used_in_plan: number; current: number }; batches_per_day: { used_in_plan: number; current: number } } | null;
  reason?: string;
  standard_snapshot_taken_at?: string;
  locked?: boolean;
  locked_by_name?: string | null;
  relock_reason?: string | null;
  // Sesi 5 (item 3, 21 Agu 2026): asal-usul standar unit_per_batch/batches_per_day
  // yang MEMBENTUK baseline terkunci -- source = ESTIMASI_MANUAL/DIPELAJARI,
  // sample_count = jumlah batch nyata yang mendasari kalau DIPELAJARI.
  standard_provenance?: {
    unit_per_batch: { source: string | null; sample_count: number | null };
    batches_per_day: { source: string | null; sample_count: number | null };
  } | null;
};

type MarginVarianceItem = { item_code: string; name: string; impact: number; detail: string };
type MarginVarianceCategory = { category: string; label: string; total_impact: number; complete: boolean; incomplete_reason: string | null; items: MarginVarianceItem[] };
type PackagingBreakdownRow = { item_code: string; name: string; qty_per_unit_output: number; unit_cost: number | null; cost_per_unit_output: number | null };
type MarginWatchResult = {
  item_code: string;
  item_name: string;
  qty_ordered: number;
  unit_price: number;
  standard_material_cost_per_unit: number;
  standard_packaging_cost_per_unit: number;
  packaging_breakdown: PackagingBreakdownRow[];
  standard_labor_cost_per_unit: number;
  labor_cost_complete: boolean;
  labor_cost_notes: string[];
  cost_data_complete: boolean;
  missing_cost_item_codes: string[];
  unverified_cost_item_codes: string[];
  estimated_from_reference_price_item_codes: string[];
  standard_margin_per_unit: number;
  standard_margin_total: number;
  margin_floor_threshold: number | null;
  categories: MarginVarianceCategory[];
  total_variance_impact: number;
  projected_margin_total: number;
  projection_complete: boolean;
  snapshot_taken_at: string | null;
  locked: boolean;
  locked_by_name: string | null;
  relock_reason: string | null;
};

const marginCategoryProvenance: Record<string, { formula: string; sourceDocument?: string }> = {
  harga_bahan: {
    formula:
      'Per komponen BOM (eksplosi berjenjang): (harga aktual − standard_cost) × qty dibutuhkan untuk qty dipesan. Harga aktual diambil dari (a) rata-rata tertimbang unit_cost lot yang sudah dikonsumsi, atau kalau belum ada, (b) unit_price PO supplier yang belum diterima. Item tanpa sinyal harga aktual dilewati, bukan dianggap sama dengan standar.'
  },
  pemakaian_bahan: {
    formula:
      'Per komponen: (qty aktual dikonsumsi − qty standar untuk qty output sejauh ini) × standard_cost komponen. qty standar = rasio BOM per unit × qty output tercatat di work_order_outputs.'
  },
  reject: {
    formula: 'Total qty_reject (satuan jual) tercatat di work_order_step_progress × biaya standar per unit item ini. Reject di satuan tahap-antara (bukan satuan jual) tidak dihitung rupiahnya.'
  }
};

const shipmentStatusLabels: Record<string, string> = { draft: 'Draft', shipped: 'Terkirim', delivered: 'Diterima', cancelled: 'Batal' };
const shipmentStatusWarnaTag: Record<string, 'gray' | 'purple' | 'green' | 'red'> = {
  draft: 'gray',
  shipped: 'purple',
  delivered: 'green',
  cancelled: 'red'
};

export default function SalesOrdersPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [soError, setSoError] = useState('');
  const [soLoading, setSoLoading] = useState(true);
  const [expandedSoId, setExpandedSoId] = useState<number | null>(null);

  // Pencarian, saringan, dan pembagian halaman: Carbon DataTable tidak membawanya.
  const [cari, setCari] = useState('');
  const [saringStatus, setSaringStatus] = useState<string>('semua');
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(15);
  const adaSaringan = cari.trim() !== '' || saringStatus !== 'semua';
  const [role, setRole] = useState<string | null>(null);

  const [feasibilityLineId, setFeasibilityLineId] = useState<number | null>(null);
  const [feasibilityLoading, setFeasibilityLoading] = useState(false);
  const [feasibilityError, setFeasibilityError] = useState('');
  const [feasibilityResult, setFeasibilityResult] = useState<FeasibilityResult | null>(null);
  const [feasibilityLockStatus, setFeasibilityLockStatus] = useState<'idle' | 'locking' | 'error'>('idle');
  const [feasibilityLockMessage, setFeasibilityLockMessage] = useState('');
  const [feasibilityRelockReason, setFeasibilityRelockReason] = useState('');

  const [marginLineId, setMarginLineId] = useState<number | null>(null);
  const [marginLoading, setMarginLoading] = useState(false);
  const [marginError, setMarginError] = useState('');
  const [marginResult, setMarginResult] = useState<MarginWatchResult | null>(null);
  const [marginThresholdInput, setMarginThresholdInput] = useState('');
  const [marginThresholdStatus, setMarginThresholdStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [marginThresholdMessage, setMarginThresholdMessage] = useState('');
  const [marginLockStatus, setMarginLockStatus] = useState<'idle' | 'locking' | 'error'>('idle');
  const [marginLockMessage, setMarginLockMessage] = useState('');
  const [marginRelockReason, setMarginRelockReason] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadSalesOrders = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setSoLoading(true);
    const response = await fetch('/api/sales-orders', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setSoError(data.error || 'Gagal memuat daftar Sales Order.');
      setSoLoading(false);
      return;
    }
    setSalesOrders(data.salesOrders || []);
    setSoError('');
    setSoLoading(false);
  }, [getAccessToken]);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/sales-orders');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      if (!meResponse.ok) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }
      setRole(meData?.user?.role ?? null);
      setCheckingAccess(false);
      await loadSalesOrders();
    };
    checkAccessAndLoad();
  }, [router, loadSalesOrders]);

  const toggleExpand = (so: SalesOrder) => {
    setExpandedSoId((current) => (current === so.sales_order_id ? null : so.sales_order_id));
    setFeasibilityLineId(null);
    setFeasibilityResult(null);
    setFeasibilityError('');
    setMarginLineId(null);
    setMarginResult(null);
    setMarginError('');
  };

  // Margin Watch Lapis 1 (baseline dikunci sekali) + Lapis 2 (selisih 5
  // kategori dari data AKTUAL berjalan) — 20 Agu 2026.
  const handleCheckMarginWatch = async (lineId: number) => {
    setMarginLineId(lineId);
    setMarginLoading(true);
    setMarginError('');
    setMarginResult(null);
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setMarginLoading(false);
      setMarginError('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }
    const response = await fetch(`/api/sales-order-lines/${lineId}/margin-watch`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    setMarginLoading(false);
    if (!response.ok) {
      setMarginError(data.error || 'Gagal memuat Margin Watch.');
      return;
    }
    setMarginResult(data as MarginWatchResult);
    setMarginThresholdInput(data.margin_floor_threshold !== null ? String(data.margin_floor_threshold) : '');
  };

  const handleSaveMarginThreshold = async () => {
    if (!marginLineId) return;
    setMarginThresholdStatus('saving');
    setMarginThresholdMessage('');
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setMarginThresholdStatus('error');
      setMarginThresholdMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }
    const response = await fetch('/api/sales-order-lines/margin-watch-threshold', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ sales_order_line_id: marginLineId, margin_floor_threshold: marginThresholdInput === '' ? null : Number(marginThresholdInput) })
    });
    const data = await response.json();
    if (!response.ok) {
      setMarginThresholdStatus('error');
      setMarginThresholdMessage(data.error || 'Gagal menyimpan ambang margin.');
      return;
    }
    setMarginThresholdStatus('idle');
    setMarginThresholdMessage('Ambang tersimpan.');
    await handleCheckMarginWatch(marginLineId);
  };

  // P2 (Fase Produksi Nyata) — sebelum ini, kelayakan jadwal/kekurangan bahan per
  // baris SO cuma bisa dicek lewat API mentah (dipakai sepanjang analisis
  // SAS001/SAS005 sesi-sesi sebelumnya), belum pernah dirender di halaman manapun.
  const handleCheckFeasibility = async (lineId: number) => {
    setFeasibilityLineId(lineId);
    setFeasibilityLoading(true);
    setFeasibilityError('');
    setFeasibilityResult(null);
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setFeasibilityLoading(false);
      setFeasibilityError('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }
    const response = await fetch(`/api/sales-order-lines/${lineId}/planning-feasibility`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    setFeasibilityLoading(false);
    if (!response.ok) {
      setFeasibilityError(data.error || 'Gagal memuat kelayakan jadwal.');
      return;
    }
    setFeasibilityResult(data as FeasibilityResult);
  };

  // Sesi 0C (21 Agu 2026) — mengunci baseline SEKARANG aksi terpisah dari
  // sekadar membuka panel (getMarginWatch/getPlanningFeasibility tidak lagi
  // menulis apa pun). Konfirmasi permanen + alasan wajib kalau mengunci ULANG.
  const handleLockMargin = async (lineId: number, isRelock: boolean) => {
    if (isRelock && !marginRelockReason.trim()) {
      setMarginLockStatus('error');
      setMarginLockMessage('Alasan wajib diisi untuk mengunci ulang.');
      return;
    }
    const confirmed = window.confirm(
      isRelock
        ? 'Mengunci ULANG baseline Margin Watch akan mengarsipkan baseline lama (tetap tersimpan, tidak dihapus) dan menggantinya dengan angka biaya standar SAAT INI. Lanjutkan?'
        : 'Mengunci baseline Margin Watch akan menyimpan angka biaya standar SAAT INI sebagai acuan pembanding PERMANEN untuk order ini -- tidak bisa diubah lagi kecuali company_admin mengunci ulang dengan alasan. Lanjutkan?'
    );
    if (!confirmed) return;

    setMarginLockStatus('locking');
    setMarginLockMessage('');
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setMarginLockStatus('error');
      setMarginLockMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }
    const response = await fetch('/api/sales-order-lines/margin-baseline-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ sales_order_line_id: lineId, reason: marginRelockReason })
    });
    const data = await response.json();
    if (!response.ok) {
      setMarginLockStatus('error');
      setMarginLockMessage(data.error || 'Gagal mengunci baseline.');
      return;
    }
    setMarginLockStatus('idle');
    setMarginLockMessage('Baseline terkunci.');
    setMarginRelockReason('');
    await handleCheckMarginWatch(lineId);
  };

  const handleLockFeasibility = async (lineId: number, isRelock: boolean) => {
    if (isRelock && !feasibilityRelockReason.trim()) {
      setFeasibilityLockStatus('error');
      setFeasibilityLockMessage('Alasan wajib diisi untuk mengunci ulang.');
      return;
    }
    const confirmed = window.confirm(
      isRelock
        ? 'Mengunci ULANG rencana Kelayakan Jadwal akan mengarsipkan rencana lama (tetap tersimpan, tidak dihapus) dan menggantinya dengan standar produksi SAAT INI. Lanjutkan?'
        : 'Mengunci rencana Kelayakan Jadwal akan menyimpan standar produksi SAAT INI sebagai acuan PERMANEN untuk order ini -- tidak bisa diubah lagi kecuali company_admin mengunci ulang dengan alasan. Lanjutkan?'
    );
    if (!confirmed) return;

    setFeasibilityLockStatus('locking');
    setFeasibilityLockMessage('');
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setFeasibilityLockStatus('error');
      setFeasibilityLockMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }
    const response = await fetch('/api/sales-order-lines/feasibility-baseline-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ sales_order_line_id: lineId, reason: feasibilityRelockReason })
    });
    const data = await response.json();
    if (!response.ok) {
      setFeasibilityLockStatus('error');
      setFeasibilityLockMessage(data.error || 'Gagal mengunci rencana.');
      return;
    }
    setFeasibilityLockStatus('idle');
    setFeasibilityLockMessage('Rencana terkunci.');
    setFeasibilityRelockReason('');
    await handleCheckFeasibility(lineId);
  };

  const showPriceColumn = useMemo(() => salesOrders.some((so) => so.lines.some((line) => line.unit_price !== null)), [salesOrders]);

  // ==========================================================================
  // TABEL SALES ORDER — cetakan Master Item
  // ==========================================================================
  const kolom = [
    { key: 'so_number', header: 'No. SO' },
    { key: 'customer', header: 'Klien' },
    { key: 'plant', header: 'Lokasi' },
    { key: 'status', header: 'Status' },
    { key: 'lines', header: 'Jumlah baris' },
    { key: 'created_at', header: 'Dibuat' }
  ];

  const soTersaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return salesOrders.filter((so) => {
      if (saringStatus !== 'semua' && so.status !== saringStatus) return false;
      if (!kata) return true;
      return `${so.so_number} ${so.customer_name ?? ''}`.toLowerCase().includes(kata);
    });
  }, [salesOrders, cari, saringStatus]);

  const soHalamanIni = useMemo(() => soTersaring.slice((halaman - 1) * perHalaman, halaman * perHalaman), [soTersaring, halaman, perHalaman]);
  const soById = useMemo(() => new Map(salesOrders.map((so) => [String(so.sales_order_id), so])), [salesOrders]);

  const baris = useMemo(
    () =>
      soHalamanIni.map((so) => ({
        id: String(so.sales_order_id),
        so_number: so.so_number,
        customer: so.customer_name ?? '',
        plant: so.production_plant_name ?? '',
        status: statusLabels[so.status] ?? so.status,
        lines: so.lines.length,
        created_at: so.created_at ?? ''
      })),
    [soHalamanIni]
  );

  const isiSel = (so: SalesOrder, kunci: string) => {
    switch (kunci) {
      case 'so_number':
        return (
          <div className="so-sel-nomor">
            <span className="so-sel-nomor__utama">{so.so_number}</span>
            <span className="so-sel-nomor__asal">{so.po_number ? `dari PO ${so.po_number}` : 'tanpa PO klien'}</span>
          </div>
        );
      case 'customer':
        return (
          <div className="so-sel-nomor">
            <span className="so-sel-nomor__utama">{so.customer_name ?? '—'}</span>
            {so.identity_predates_snapshot ? <span className="so-sel-nomor__asal">Terbit sebelum pembekuan identitas berlaku</span> : null}
          </div>
        );
      case 'plant':
        return so.production_plant_name ?? <span className="halaman__redup">—</span>;
      case 'status':
        return <Tag type={statusWarnaTag[so.status] ?? 'gray'}>{statusLabels[so.status] ?? so.status}</Tag>;
      case 'lines':
        return so.lines.length;
      case 'created_at':
        return so.created_at ? new Date(so.created_at).toLocaleDateString('id-ID') : '—';
      default:
        return null;
    }
  };

  const expandedSo = salesOrders.find((so) => so.sales_order_id === expandedSoId) ?? null;

  if (checkingAccess) {
    return (
      <div className="halaman">
        <DataTableSkeleton columnCount={6} rowCount={6} showHeader showToolbar />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <KepalaHalaman remah={[]} judul="Sales Order" />
        <InlineNotification kind="error" lowContrast hideCloseButton title="Sesi tidak valid" subtitle="Silakan masuk ulang untuk membuka Sales Order." />
        <Button className="so-tombol-masuk" onClick={() => router.push('/login?redirectTo=/sales-orders')}>
          Ke halaman masuk
        </Button>
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sales & CRM' }, { label: 'Sales Orders' }]}
        judul="Sales Order"
        pengantar={`${soTersaring.length} Sales Order${adaSaringan ? ` dari ${salesOrders.length} yang tercatat` : ' tercatat'} — tercipta otomatis begitu PO klien diproses, tidak dibuat manual di sini.`}
      />

      {soError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat Sales Order" subtitle={soError} /> : null}

      {soLoading ? (
        <DataTableSkeleton columnCount={6} rowCount={6} showHeader showToolbar />
      ) : (
        <>
          <DataTable rows={baris} headers={kolom} isSortable size="lg">
            {(rp: any) => (
              <TableContainer {...rp.getTableContainerProps()}>
                <TableToolbar>
                  <TableToolbarContent>
                    {/* MELIPAT, bukan selalu terbuka — bawaan Carbon, `persistent` tidak dipakai. */}
                    <TableToolbarSearch
                      placeholder="Cari nomor SO atau nama klien…"
                      labelText="Cari Sales Order"
                      onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => {
                        setCari(typeof e === 'string' ? '' : e.target.value);
                        setHalaman(1);
                      }}
                    />
                    <Dropdown
                      id="so-saring-status"
                      size="lg"
                      className="halaman__saring"
                      label="Status"
                      titleText="Status"
                      hideLabel
                      items={['semua', ...Object.keys(statusLabels)]}
                      itemToString={(v: string) => (v === 'semua' ? 'Semua status' : statusLabels[v] ?? v)}
                      selectedItem={saringStatus}
                      onChange={({ selectedItem }: { selectedItem: string | null }) => {
                        setSaringStatus(selectedItem ?? 'semua');
                        setHalaman(1);
                      }}
                    />
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...rp.getTableProps()} className="tabel-responsif">
                  <TableHead>
                    <TableRow>
                      <TableExpandHeader aria-label="Buka rincian Sales Order" />
                      {rp.headers.map((h: any) => {
                        const { key, ...sisa } = rp.getHeaderProps({ header: h }) as { key?: string };
                        void key;
                        return (
                          <TableHeader key={h.key} {...sisa} isSortable>
                            {h.header}
                          </TableHeader>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rp.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={kolom.length + 1}>
                          {adaSaringan ? 'Tidak ada Sales Order yang cocok dengan pencarian atau saringan.' : 'Belum ada Sales Order.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rp.rows.map((row: any) => {
                        const so = soById.get(row.id);
                        if (!so) return null;
                        const { key, ...sisaBaris } = rp.getRowProps({ row }) as { key?: string };
                        void key;
                        return (
                          <React.Fragment key={row.id}>
                            <TableExpandRow
                              {...sisaBaris}
                              isExpanded={expandedSoId === so.sales_order_id}
                              onExpand={() => toggleExpand(so)}
                              aria-label={`Rincian ${so.so_number}`}
                            >
                              {kolom.map((h) => (
                                <TableCell key={h.key} data-label={h.header}>
                                  {isiSel(so, h.key)}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow colSpan={kolom.length + 1}>
                              {expandedSoId === so.sales_order_id && expandedSo ? (
                                <div className="so-detail">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">PO Client Asal:</span> {expandedSo.po_number ?? '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">Lokasi Pabrik:</span> {expandedSo.production_plant_name ?? '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span> <Tag type={statusWarnaTag[expandedSo.status] ?? 'gray'}>{statusLabels[expandedSo.status] ?? expandedSo.status}</Tag>
                </div>
                <div>
                  <span className="text-muted-foreground">Dibuat:</span> {new Date(expandedSo.created_at).toLocaleDateString('id-ID')}
                </div>
              </div>

              <Table size="lg" className="tabel-responsif">
                <TableHead>
                  <TableRow>
                    <TableHeader>Item</TableHeader>
                    <TableHeader>Qty dipesan</TableHeader>
                    <TableHeader>Sudah direncanakan di WO</TableHeader>
                    <TableHeader>Sudah dikirim</TableHeader>
                    <TableHeader>Sisa belum dikirim</TableHeader>
                    {showPriceColumn ? <TableHeader>Harga satuan</TableHeader> : null}
                    {canViewPlanningFeasibility(role) ? <TableHeader>Kelayakan</TableHeader> : null}
                    {canViewFinancialData(role) ? <TableHeader>Margin Watch</TableHeader> : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expandedSo.lines.map((line) => (
                    <TableRow key={line.sales_order_line_id}>
                      <TableCell data-label="Item">
                        {line.item_code} — {line.item_name}
                      </TableCell>
                      <TableCell data-label="Qty dipesan">
                        {formatNumberId(line.qty_ordered, 2)} {line.item_base_uom}
                      </TableCell>
                      <TableCell data-label="Sudah direncanakan di WO">
                        {formatNumberId(line.qty_already_planned_in_wo, 2)} {line.item_base_uom}
                      </TableCell>
                      <TableCell data-label="Sudah dikirim">
                        {formatNumberId(line.qty_shipped, 2)} {line.item_base_uom}
                      </TableCell>
                      <TableCell data-label="Sisa belum dikirim">
                        {line.qty_remaining_to_ship > 0 ? formatNumberId(line.qty_remaining_to_ship, 2) : <span className="halaman__redup">0</span>} {line.item_base_uom}
                      </TableCell>
                      {showPriceColumn ? (
                        <TableCell data-label="Harga satuan">
                          {line.unit_price === null ? <span className="halaman__redup">—</span> : formatCurrency(line.unit_price, { maxDecimals: 0 })}
                        </TableCell>
                      ) : null}
                      {canViewPlanningFeasibility(role) ? (
                        <TableCell data-label="Kelayakan">
                          <Button
                            kind="tertiary"
                            size="sm"
                            disabled={feasibilityLoading && feasibilityLineId === line.sales_order_line_id}
                            onClick={() => handleCheckFeasibility(line.sales_order_line_id)}
                            title="Menghitung & menampilkan kelayakan jadwal dari data SAAT INI -- tidak menyimpan/mengunci apa pun. Untuk mengunci rencana sebagai acuan permanen, pakai tombol 'Kunci' di dalam panel."
                          >
                            {feasibilityLoading && feasibilityLineId === line.sales_order_line_id ? 'Memuat...' : 'Cek Kelayakan'}
                          </Button>
                        </TableCell>
                      ) : null}
                      {canViewFinancialData(role) ? (
                        <TableCell data-label="Margin Watch">
                          <Button
                            kind="tertiary"
                            size="sm"
                            disabled={marginLoading && marginLineId === line.sales_order_line_id}
                            onClick={() => handleCheckMarginWatch(line.sales_order_line_id)}
                            title="Menghitung & menampilkan margin dari data SAAT INI -- tidak menyimpan/mengunci apa pun. Untuk mengunci baseline sebagai acuan permanen, pakai tombol 'Kunci' di dalam panel."
                          >
                            {marginLoading && marginLineId === line.sales_order_line_id ? 'Memuat...' : 'Margin Watch'}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {marginLineId && expandedSo.lines.some((l) => l.sales_order_line_id === marginLineId) ? (
                <div className="rounded-md border p-4">
                  <p className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Margin Watch — Baseline vs Proyeksi Berjalan</p>
                  {marginError ? <p className="text-sm text-destructive">{marginError}</p> : null}
                  {marginLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
                  {marginResult && !marginLoading ? (
                    <div className="flex flex-col gap-3 text-sm">
                      {marginResult.locked ? (
                        <p className="text-xs text-muted-foreground">
                          Baseline terkunci sejak {marginResult.snapshot_taken_at ? new Date(marginResult.snapshot_taken_at).toLocaleString('id-ID') : '-'}
                          {marginResult.locked_by_name ? ` oleh ${marginResult.locked_by_name}` : ''} — permanen, tidak berubah walau harga master diperbarui belakangan.
                          {marginResult.relock_reason ? ` Alasan kunci ulang: "${marginResult.relock_reason}".` : ''}
                          {canViewFinancialData(role) && role === 'company_admin' ? (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <TextInput
                                id="alasan-kunci-ulang-margin"
                                size="sm"
                                labelText="Alasan kunci ulang"
                                hideLabel
                                placeholder="alasan kunci ulang"
                                value={marginRelockReason}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMarginRelockReason(e.target.value)}
                              />
                              <Button kind="tertiary" size="sm" disabled={marginLockStatus === 'locking'} onClick={() => handleLockMargin(marginLineId!, true)}>
                                Kunci Ulang
                              </Button>
                            </span>
                          ) : null}
                        </p>
                      ) : (
                        <div className="rounded-md border border-warning/40 bg-warning-subtle p-2 text-xs font-medium text-warning-subtle-foreground">
                          ⚠ PERKIRAAN SEMENTARA — BELUM DIKUNCI SEBAGAI ACUAN. Angka di bawah dihitung LIVE dari data saat ini, bukan baseline permanen.
                          {canViewFinancialData(role) ? (
                            <div className="mt-1">
                              <Button
                                kind="tertiary"
                                size="sm"
                                disabled={marginLockStatus === 'locking' || !marginResult.cost_data_complete || marginResult.estimated_from_reference_price_item_codes.length > 0}
                                onClick={() => handleLockMargin(marginLineId!, false)}
                              >
                                {marginLockStatus === 'locking' ? 'Mengunci...' : 'Kunci sebagai Acuan Pembanding'}
                              </Button>
                              {!marginResult.cost_data_complete ? (
                                <span className="ml-2 text-xs font-normal">Belum bisa dikunci: {marginResult.missing_cost_item_codes.length} bahan/kemasan belum punya harga standar.</span>
                              ) : marginResult.estimated_from_reference_price_item_codes.length > 0 ? (
                                <span className="ml-2 text-xs font-normal">Belum bisa dikunci: {marginResult.estimated_from_reference_price_item_codes.length} bahan masih pakai harga acuan supplier — belum ada pembelian nyata.</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )}
                      {marginLockMessage ? <p className={marginLockStatus === 'error' ? 'text-xs text-destructive' : 'text-xs text-success'}>{marginLockMessage}</p> : null}
                      {!marginResult.labor_cost_complete ? (
                        <div className="rounded-md border-2 border-destructive/50 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                          ⚠ SEMUA angka margin di panel ini BELUM TERMASUK biaya SDM standar — margin rencana & proyeksi di bawah SELALU LEBIH BESAR dari kenyataan.
                          {marginResult.labor_cost_notes.length > 0 ? (
                            <ul className="mt-1 list-disc pl-5 text-xs font-normal">
                              {marginResult.labor_cost_notes.map((n, i) => (
                                <li key={i}>{n}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                      {!marginResult.cost_data_complete ? (
                        <p className="rounded-md border border-warning/40 bg-warning-subtle p-2 text-xs text-warning-subtle-foreground">
                          Baseline BELUM LENGKAP — bahan berikut belum punya harga master (standard_cost), tidak ikut dijumlah: {marginResult.missing_cost_item_codes.join(', ')}.
                        </p>
                      ) : null}
                      {marginResult.unverified_cost_item_codes.length > 0 ? (
                        <p className="rounded-md border border-warning/40 bg-warning-subtle p-2 text-xs text-warning-subtle-foreground">
                          Harga BELUM TERVERIFIKASI (ikut dihitung, tapi belum dikonfirmasi purchasing): {marginResult.unverified_cost_item_codes.join(', ')}.
                        </p>
                      ) : null}
                      {marginResult.estimated_from_reference_price_item_codes.length > 0 ? (
                        <p className="rounded-md border border-warning/40 bg-warning-subtle p-2 text-xs text-warning-subtle-foreground">
                          Harga acuan supplier — belum ada pembelian nyata (dipakai sebagai perkiraan, tidak bisa jadi acuan terkunci): {marginResult.estimated_from_reference_price_item_codes.join(', ')}.
                        </p>
                      ) : null}
                      <div className="grid gap-1 sm:grid-cols-2">
                        <span className="text-muted-foreground">
                          Harga jual: <span className="text-foreground">{formatCurrency(marginResult.unit_price, { maxDecimals: 0 })}</span>/unit
                        </span>
                        <span className="text-muted-foreground">
                          Biaya standar:{' '}
                          <span className="text-foreground">
                            {formatCurrency(marginResult.standard_material_cost_per_unit + marginResult.standard_packaging_cost_per_unit + marginResult.standard_labor_cost_per_unit)}
                          </span>
                          /unit (bahan {formatCurrency(marginResult.standard_material_cost_per_unit)} + kemasan {formatCurrency(marginResult.standard_packaging_cost_per_unit)}
                          <ProvenanceInfoButton
                            label="Biaya Bahan & Kemasan Standar per Unit"
                            envelope={{
                              formula: 'Dari BOM aktif item ini: Σ (qty_per_unit_output tiap komponen × standard_cost komponen tsb pada items), dipisah bahan-baku vs kemasan menurut Item.type.',
                              inputs: [
                                { label: 'Biaya bahan/unit', value: formatCurrency(marginResult.standard_material_cost_per_unit) },
                                { label: 'Biaya kemasan/unit', value: formatCurrency(marginResult.standard_packaging_cost_per_unit) },
                                ...marginResult.packaging_breakdown.map((row) => ({
                                  label: `↳ ${row.name} (${row.item_code})`,
                                  value:
                                    row.unit_cost !== null
                                      ? `${row.qty_per_unit_output.toLocaleString('id-ID', { maximumFractionDigits: 4 })} × ${formatCurrency(row.unit_cost)} = ${formatCurrency(row.cost_per_unit_output ?? 0)}`
                                      : `${row.qty_per_unit_output.toLocaleString('id-ID', { maximumFractionDigits: 4 })} × (belum ada harga)`
                                }))
                              ],
                              sourceDocument: 'docs/spesifikasi-aturan-biaya-v1.md §3'
                            }}
                          />
                          {' '}+ SDM{' '}
                          {formatCurrency(marginResult.standard_labor_cost_per_unit)}
                          {!marginResult.labor_cost_complete ? ' [sebagian]' : ''}
                          <ProvenanceInfoButton
                            label="Biaya SDM Standar per Unit"
                            envelope={{
                              formula: 'Untuk tiap level produksi (item utama + WIP bersarang): kru harian ÷ batch standar/hari ÷ unit/batch, dikali rasio kebutuhan ke unit teratas.',
                              inputs: marginResult.labor_cost_notes.map((n, i) => ({ label: `Level ${i + 1}`, value: n })),
                              standardStatus: marginResult.labor_cost_complete ? null : 'ESTIMASI_MANUAL'
                            }}
                          />
                          )
                        </span>
                        <span className="text-muted-foreground">
                          Margin rencana (baseline){!marginResult.labor_cost_complete ? ' (SEBELUM SDM)' : ''}:{' '}
                          <span className="font-medium text-foreground">{formatCurrency(marginResult.standard_margin_total, { maxDecimals: 0 })}</span>
                          <ProvenanceInfoButton
                            label="Margin Rencana (Baseline)"
                            envelope={{
                              formula: 'Margin kontribusi = (harga jual × qty terkirim) − biaya produksi order. Baseline dikunci sekali per baris SO (snapshot).',
                              inputs: [
                                { label: 'Harga jual/unit', value: formatCurrency(marginResult.unit_price, { maxDecimals: 0 }) },
                                { label: 'Biaya bahan/unit', value: formatCurrency(marginResult.standard_material_cost_per_unit) },
                                { label: 'Biaya kemasan/unit', value: formatCurrency(marginResult.standard_packaging_cost_per_unit) },
                                { label: 'Biaya SDM/unit', value: formatCurrency(marginResult.standard_labor_cost_per_unit) }
                              ],
                              sourceDocument: 'docs/spesifikasi-aturan-biaya-v1.md §3'
                            }}
                          />
                        </span>
                        <span className="text-muted-foreground">
                          Proyeksi margin berjalan{!marginResult.labor_cost_complete ? ' (SEBELUM SDM)' : ''}:{' '}
                          <span className={`font-medium ${marginResult.projected_margin_total < marginResult.standard_margin_total ? 'text-destructive' : 'text-success'}`}>
                            {formatCurrency(marginResult.projected_margin_total, { maxDecimals: 0 })}
                          </span>
                          {!marginResult.projection_complete ? <span className="text-warning-subtle-foreground"> (belum lengkap — lihat catatan tiap kategori)</span> : null}
                        </span>
                      </div>

                      <div className="flex items-end gap-2 border-t pt-3">
                        <NumberInput
                          id="so-ambang-margin"
                          label="Ambang margin minimum (opsional)"
                          min={0}
                          allowEmpty
                          hideSteppers
                          className="so-ambang"
                          value={marginThresholdInput === '' ? '' : Number(marginThresholdInput)}
                          onChange={(_e: unknown, { value }: { value: number | string }) => setMarginThresholdInput(String(value ?? ''))}
                        />
                        <Button kind="tertiary" size="sm" disabled={marginThresholdStatus === 'saving'} onClick={handleSaveMarginThreshold}>
                          {marginThresholdStatus === 'saving' ? 'Menyimpan...' : 'Simpan Ambang'}
                        </Button>
                        <span className="text-xs text-muted-foreground">Kirim peringatan ke Finance & Manajemen kalau proyeksi margin turun di bawah angka ini.</span>
                      </div>
                      {marginThresholdMessage ? <p className={`text-xs ${marginThresholdStatus === 'error' ? 'text-destructive' : 'text-success'}`}>{marginThresholdMessage}</p> : null}

                      <div className="flex flex-col gap-2 border-t pt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rincian Selisih (terbesar dampaknya di atas)</p>
                        {marginResult.categories.map((cat) => (
                          <div key={cat.category} className="rounded-md border p-2">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 font-medium text-foreground">
                                {cat.label}
                                {marginCategoryProvenance[cat.category] ? (
                                  <ProvenanceInfoButton
                                    label={cat.label}
                                    envelope={{
                                      formula: marginCategoryProvenance[cat.category].formula,
                                      inputs: [
                                        { label: 'Total dampak', value: formatCurrency(cat.total_impact, { maxDecimals: 0 }) },
                                        { label: 'Lengkap?', value: cat.complete ? 'Ya' : 'Belum — sebagian data belum tersedia' }
                                      ],
                                      sourceDocument: 'src/features/mrp/server/getMarginWatch.ts'
                                    }}
                                  />
                                ) : null}
                              </span>
                              <span className={`font-medium ${cat.total_impact < 0 ? 'text-destructive' : cat.total_impact > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                                {cat.total_impact === 0 && cat.items.length === 0 ? '-' : formatCurrency(cat.total_impact, { maxDecimals: 0 })}
                              </span>
                            </div>
                            {cat.incomplete_reason ? <p className="mt-1 text-xs text-muted-foreground">{cat.incomplete_reason}</p> : null}
                            {cat.items.length > 0 ? (
                              <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                                {cat.items.map((item, idx) => (
                                  <li key={idx} className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground">
                                      {item.item_code !== '-' ? `${item.item_code} — ` : ''}
                                      {item.name}: {item.detail}
                                    </span>
                                    <span className={item.impact < 0 ? 'text-destructive' : 'text-success'}>{formatCurrency(item.impact, { maxDecimals: 0 })}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {feasibilityLineId && expandedSo.lines.some((l) => l.sales_order_line_id === feasibilityLineId) ? (
                <div className="rounded-md border p-4">
                  <p className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Kelayakan Jadwal & Kekurangan Bahan</p>
                  {feasibilityError ? <p className="text-sm text-destructive">{feasibilityError}</p> : null}
                  {feasibilityLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
                  {feasibilityResult && !feasibilityLoading ? (
                    feasibilityResult.feasible === null ? (
                      <p className="text-sm text-muted-foreground">{feasibilityResult.reason}</p>
                    ) : (
                      <div className="flex flex-col gap-3 text-sm">
                        {feasibilityResult.locked ? (
                          <p className="text-xs text-muted-foreground">
                            Rencana terkunci sejak {feasibilityResult.standard_snapshot_taken_at ? new Date(feasibilityResult.standard_snapshot_taken_at).toLocaleString('id-ID') : '-'}
                            {feasibilityResult.locked_by_name ? ` oleh ${feasibilityResult.locked_by_name}` : ''} — permanen, tidak berubah walau standar produksi diperbarui belakangan.
                            {feasibilityResult.relock_reason ? ` Alasan kunci ulang: "${feasibilityResult.relock_reason}".` : ''}
                            {canViewFinancialData(role) && role === 'company_admin' ? (
                              <span className="ml-2 inline-flex items-center gap-1">
                                <TextInput
                                  id="alasan-kunci-ulang-kelayakan"
                                  size="sm"
                                  labelText="Alasan kunci ulang"
                                  hideLabel
                                  placeholder="alasan kunci ulang"
                                  value={feasibilityRelockReason}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFeasibilityRelockReason(e.target.value)}
                                />
                                <Button kind="tertiary" size="sm" disabled={feasibilityLockStatus === 'locking'} onClick={() => handleLockFeasibility(feasibilityLineId!, true)}>
                                  Kunci Ulang
                                </Button>
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                        {feasibilityResult.locked && feasibilityResult.standard_provenance ? (
                          <p className="text-xs text-muted-foreground">
                            Asal-usul standar yang dikunci: unit/batch = {feasibilityResult.standard_provenance.unit_per_batch.source ?? 'tidak diketahui'}
                            {feasibilityResult.standard_provenance.unit_per_batch.source === 'DIPELAJARI'
                              ? ` (${formatNumberId(feasibilityResult.standard_provenance.unit_per_batch.sample_count ?? 0, 0)} sampel)`
                              : ''}
                            ; batch/hari = {feasibilityResult.standard_provenance.batches_per_day.source ?? 'tidak diketahui'}
                            {feasibilityResult.standard_provenance.batches_per_day.source === 'DIPELAJARI'
                              ? ` (${formatNumberId(feasibilityResult.standard_provenance.batches_per_day.sample_count ?? 0, 0)} sampel)`
                              : ''}
                            .
                          </p>
                        ) : null}
                        {!feasibilityResult.locked ? (
                          <div className="rounded-md border border-warning/40 bg-warning-subtle p-2 text-xs font-medium text-warning-subtle-foreground">
                            ⚠ PERKIRAAN SEMENTARA — BELUM DIKUNCI SEBAGAI ACUAN. Angka di bawah dihitung LIVE dari data saat ini, bukan rencana permanen.
                            {canViewFinancialData(role) ? (
                              <div className="mt-1">
                                <Button kind="tertiary" size="sm" disabled={feasibilityLockStatus === 'locking'} onClick={() => handleLockFeasibility(feasibilityLineId!, false)}>
                                  {feasibilityLockStatus === 'locking' ? 'Mengunci...' : 'Kunci sebagai Acuan Pembanding'}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {feasibilityLockMessage ? <p className={feasibilityLockStatus === 'error' ? 'text-xs text-destructive' : 'text-xs text-success'}>{feasibilityLockMessage}</p> : null}
                        <div className="flex flex-wrap items-center gap-3">
                          <Tag type={feasibilityResult.feasible ? 'green' : 'red'}>{feasibilityResult.feasible ? 'Layak dijadwalkan' : 'Belum layak dijadwalkan'}</Tag>
                          <span>
                            Butuh <span className="font-medium text-foreground">{formatNumberId(feasibilityResult.batches_needed, 2)}</span> batch ({formatNumberId(feasibilityResult.days_needed, 2)} hari produksi) — kapasitas{' '}
                            {formatNumberId(feasibilityResult.batches_per_day, 2)} batch/hari
                            <ProvenanceInfoButton
                              label="Kebutuhan Batch & Kapasitas"
                              envelope={{
                                formula:
                                  'Kebutuhan batch = ROUNDUP(qty dipesan ÷ unit/batch). Hari produksi = ROUNDUP(kebutuhan batch ÷ batch/hari). unit/batch & batch/hari adalah standar K8 (production_standards), DIKUNCI (snapshot) sekali per baris SO saat pertama dihitung — perubahan standar setelahnya TIDAK mengubah rencana yang sudah ada (lihat peringatan "standar berubah" bila muncul).',
                                inputs: [
                                  { label: 'Qty dipesan', value: formatNumberId(feasibilityResult.qty_ordered, 2) },
                                  { label: 'Unit/batch (K8)', value: formatNumberId(feasibilityResult.unit_per_batch, 2) },
                                  { label: 'Batch/hari (K8)', value: formatNumberId(feasibilityResult.batches_per_day, 2) },
                                  { label: 'Kebutuhan batch', value: formatNumberId(feasibilityResult.batches_needed, 2) },
                                  { label: 'Hari produksi', value: formatNumberId(feasibilityResult.days_needed, 2) }
                                ],
                                standardStatus: feasibilityResult.standard_drift ? 'ESTIMASI_MANUAL' : null
                              }}
                            />
                          </span>
                        </div>
                        {feasibilityResult.routing_available === false ? (
                          <p className="rounded-md border border-warning/40 bg-warning-subtle p-2 text-xs text-warning-subtle-foreground">
                            Item ini belum punya Routing (tahap SOP) di sistem — semua bahan dianggap dibutuhkan sejak mulai produksi (belum bisa sadar-tahap).
                          </p>
                        ) : null}

                        <div className="grid gap-1 sm:grid-cols-2">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            Hari kerja tersedia s/d {feasibilityResult.requested_ship_date}: <span className="text-foreground">{formatNumberId(feasibilityResult.total_working_days_to_deadline, 2)} hari</span>
                            <ProvenanceInfoButton
                              label="Hari Kerja Tersedia s/d Deadline"
                              envelope={{
                                formula: 'Jumlah hari kerja dari HARI INI sampai tanggal diminta client, dihitung dari kalender kerja perusahaan (jam kerja Senin-Jumat & Sabtu di Pengaturan Perusahaan). BELUM memperhitungkan kapan bahan tersedia — itu angka "Efektif" di sebelahnya.',
                                inputs: [
                                  { label: 'Dari', value: feasibilityResult.today ?? '-' },
                                  { label: 'Sampai (diminta)', value: feasibilityResult.requested_ship_date ?? '-' },
                                  { label: 'Hasil', value: `${formatNumberId(feasibilityResult.total_working_days_to_deadline, 2)} hari` }
                                ]
                              }}
                            />
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            Efektif (setelah bahan mulai tersedia): <span className="text-foreground">{formatNumberId(feasibilityResult.effective_working_days_after_material_block, 2)} hari</span>
                            <ProvenanceInfoButton
                              label="Hari Kerja Efektif Setelah Bahan Tersedia"
                              envelope={{
                                formula: 'Sama seperti "Hari Kerja Tersedia", tapi dihitung mulai dari tanggal produksi BISA MULAI (menunggu bahan tahap pertama datang) — bukan dari hari ini. Kalau bahan sudah tersedia sekarang, angka ini sama dengan hari kerja tersedia biasa.',
                                inputs: [
                                  { label: 'Dari (produksi bisa mulai)', value: feasibilityResult.production_start_blocked_until ?? (feasibilityResult.today ?? 'hari ini') },
                                  { label: 'Sampai (diminta)', value: feasibilityResult.requested_ship_date ?? '-' },
                                  { label: 'Hasil', value: `${formatNumberId(feasibilityResult.effective_working_days_after_material_block, 2)} hari` }
                                ]
                              }}
                            />
                          </span>
                          {feasibilityResult.production_start_blocked_until ? (
                            <span className="text-muted-foreground sm:col-span-2">
                              Produksi baru bisa MULAI <span className="text-foreground">{feasibilityResult.production_start_blocked_until}</span> (menunggu PO bahan tahap awal datang)
                            </span>
                          ) : null}
                          {feasibilityResult.order_ship_ready_date ? (
                            <span className="text-muted-foreground sm:col-span-2">
                              Estimasi SELESAI/siap kirim: <span className="text-foreground">{feasibilityResult.order_ship_ready_date}</span>
                              {feasibilityResult.requested_ship_date && feasibilityResult.order_ship_ready_date > feasibilityResult.requested_ship_date ? (
                                <span className="text-destructive"> (lewat dari tanggal diminta {feasibilityResult.requested_ship_date})</span>
                              ) : null}
                              <ProvenanceInfoButton
                                label="Tanggal Selesai Proyeksi"
                                envelope={{
                                  formula:
                                    'Tanggal produksi bisa MULAI (menunggu bahan tahap pertama datang) + hari kerja produksi (kebutuhan batch ÷ batch/hari) + hari tunggu tambahan kalau ada bahan tahap belakangan yang datang lebih lambat dari kebutuhannya (late_stage_material_blocks). Bukan sekadar mulai + durasi produksi — memperhitungkan bahan yang datang di tengah proses.',
                                  inputs: [
                                    { label: 'Produksi mulai', value: feasibilityResult.production_start_blocked_until ?? 'segera (bahan tahap awal tersedia)' },
                                    { label: 'Hari produksi', value: feasibilityResult.days_needed !== null && feasibilityResult.days_needed !== undefined ? formatNumberId(feasibilityResult.days_needed, 2) : '-' },
                                    { label: 'Bahan tahap belakangan terlambat', value: formatNumberId(feasibilityResult.late_stage_material_blocks?.length ?? 0, 0) },
                                    { label: 'Estimasi selesai', value: feasibilityResult.order_ship_ready_date }
                                  ],
                                  sourceDocument: 'getPlanningFeasibility.ts'
                                }}
                              />
                            </span>
                          ) : null}
                          {!feasibilityResult.feasible ? (
                            <span className="flex items-center gap-1 text-muted-foreground sm:col-span-2">
                              Realistis terkirim tepat waktu: <span className="text-foreground">{formatNumberId(feasibilityResult.realistic_qty_deliverable_on_time, 2)}</span> dari {formatNumberId(feasibilityResult.qty_ordered, 2)} yang dipesan
                              <ProvenanceInfoButton
                                label="Realistis Terkirim Tepat Waktu"
                                envelope={{
                                  formula:
                                    'MIN antara qty dipesan dan (hari kerja efektif × batch/hari × unit/batch) — dibatasi lebih lanjut kalau ada bahan tahap belakangan yang datang terlambat (pakai jendela hari kerja sejak bahan ITU siap, bukan sejak mulai produksi). Angka paling KONSERVATIF dari semua batasan dipakai, dibulatkan ke bawah. Sengaja melebih-lebihkan risiko keterlambatan, bukan optimistis.',
                                  inputs: [
                                    { label: 'Qty dipesan', value: formatNumberId(feasibilityResult.qty_ordered, 2) },
                                    { label: 'Hari kerja efektif', value: `${formatNumberId(feasibilityResult.effective_working_days_after_material_block, 2)} hari` },
                                    { label: 'Batch/hari × unit/batch', value: `${formatNumberId(feasibilityResult.batches_per_day, 2)} × ${formatNumberId(feasibilityResult.unit_per_batch, 2)}` },
                                    { label: 'Hasil realistis', value: formatNumberId(feasibilityResult.realistic_qty_deliverable_on_time, 2) }
                                  ],
                                  sourceDocument: 'getPlanningFeasibility.ts'
                                }}
                              />
                            </span>
                          ) : null}
                        </div>

                        {feasibilityResult.standard_drift ? (
                          <p className="rounded-md border border-warning/40 bg-warning-subtle p-2 text-xs text-warning-subtle-foreground">{feasibilityResult.standard_drift.message}</p>
                        ) : null}

                        {feasibilityResult.late_stage_material_blocks && feasibilityResult.late_stage_material_blocks.length > 0 ? (
                          <div>
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Bahan Tahap Belakangan (tidak menghalangi mulai, tapi mundurkan tanggal selesai)
                            </p>
                            <ul className="flex flex-col gap-0.5 text-xs">
                              {feasibilityResult.late_stage_material_blocks.map((b) => (
                                <li key={b.item_id}>
                                  {b.item_code} — {b.name} (tahap {b.blocking_stage.sequence_no}. {b.blocking_stage.step_name}):{' '}
                                  {b.expected_date ? (
                                    <span className="text-foreground">ETA {b.expected_date}</span>
                                  ) : (
                                    <span className="text-destructive">belum ada PO/ETA tercatat</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {feasibilityResult.components_to_produce && feasibilityResult.components_to_produce.length > 0 ? (
                          <div>
                            <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Perlu Diproduksi (bukan kekurangan beli — bahan penyusunnya cukup)
                              <ProvenanceInfoButton
                                label="Perlu Diproduksi"
                                envelope={{
                                  formula:
                                    'Komponen WIP (barang setengah jadi, punya BOM sendiri) yang dilewati saat eksplosi BOM berjenjang menuju item pesanan. qty_needed = qty_per_unit_output komponen × qty dibutuhkan level di atasnya, diakumulasi lintas semua jalur pemakaian. BEDA dari "Kekurangan Bahan" di bawah — daftar ini bukan soal stok kurang, tapi barang yang MEMANG harus diproduksi dulu (bukan dibeli) sebelum item akhir bisa dibuat.',
                                  inputs: [{ label: 'Item dievaluasi', value: `${feasibilityResult.item_code} — ${feasibilityResult.item_name}` }],
                                  sourceDocument: 'explodeBomRequirements.ts'
                                }}
                              />
                            </p>
                            <ul className="flex flex-col gap-0.5 text-xs">
                              {feasibilityResult.components_to_produce.map((c) => (
                                <li key={c.item_id}>
                                  {c.item_code} — {c.name}: <span className="text-data font-medium text-foreground">{formatNumberId(c.qty_needed, 2)}</span>
                                  {c.blocking_stage ? <span className="text-muted-foreground"> (tahap {c.blocking_stage.sequence_no}. {c.blocking_stage.step_name})</span> : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {feasibilityResult.material_shortages && feasibilityResult.material_shortages.length > 0 ? (
                          <div>
                            <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-destructive">
                              Kekurangan Bahan ({formatNumberId(feasibilityResult.material_shortages.length, 0)} item)
                              <ProvenanceInfoButton
                                label="Kekurangan Bahan"
                                envelope={{
                                  formula:
                                    'Per komponen BOM (dieksplosi berjenjang, termasuk WIP bersarang): Butuh = qty_per_unit_output komponen × qty dipesan (dibagi standard_yield_qty tiap level WIP). Kurang = MAX(0, Butuh − Stok tersedia saat ini di lots).',
                                  inputs: [{ label: 'Item dievaluasi', value: `${feasibilityResult.item_code} — ${feasibilityResult.item_name}` }],
                                  sourceDocument: 'explodeBomRequirements.ts'
                                }}
                              />
                            </p>
                            <Table size="sm" className="tabel-responsif">
                              <TableHead>
                                <TableRow>
                                  <TableHeader>Item</TableHeader>
                                  <TableHeader>Tahap</TableHeader>
                                  <TableHeader>Butuh</TableHeader>
                                  <TableHeader>Stok</TableHeader>
                                  <TableHeader>Kurang</TableHeader>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {feasibilityResult.material_shortages.map((s) => (
                                  <TableRow key={s.item_id}>
                                    <TableCell data-label="Item">
                                      {s.item_code} — {s.name}
                                    </TableCell>
                                    <TableCell data-label="Tahap">
                                      <span className="halaman__redup">{s.blocking_stage ? `${s.blocking_stage.sequence_no}. ${s.blocking_stage.step_name}` : 'Sejak tahap 1'}</span>
                                    </TableCell>
                                    <TableCell data-label="Butuh">{formatNumberId(s.needed, 2)}</TableCell>
                                    <TableCell data-label="Stok">{formatNumberId(s.available, 2)}</TableCell>
                                    <TableCell data-label="Kurang">{formatNumberId(s.short, 2)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-xs text-success">Tidak ada kekurangan bahan terdeteksi.</p>
                        )}
                      </div>
                    )
                  ) : null}
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Riwayat Pengiriman</p>
                {expandedSo.shipments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada pengiriman untuk SO ini.</p>
                ) : (
                  <Table size="lg" className="tabel-responsif">
                    <TableHead>
                      <TableRow>
                        <TableHeader>No. surat jalan</TableHeader>
                        <TableHeader>Status</TableHeader>
                        <TableHeader>Alamat tujuan</TableHeader>
                        <TableHeader>Dibuat</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {expandedSo.shipments.map((shipment) => (
                        <TableRow key={shipment.shipment_id}>
                          <TableCell data-label="No. surat jalan">{shipment.shipment_number}</TableCell>
                          <TableCell data-label="Status">
                            <Tag type={shipmentStatusWarnaTag[shipment.status] ?? 'gray'}>{shipmentStatusLabels[shipment.status] ?? shipment.status}</Tag>
                          </TableCell>
                          <TableCell data-label="Alamat tujuan">{shipment.delivery_address}</TableCell>
                          <TableCell data-label="Dibuat">{new Date(shipment.created_at).toLocaleDateString('id-ID')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
                                </div>
                              ) : null}
                            </TableExpandedRow>
                          </React.Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>

          <Pagination
            page={halaman}
            pageSize={perHalaman}
            pageSizes={[15, 30, 50]}
            totalItems={soTersaring.length}
            onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
              setHalaman(page);
              setPerHalaman(pageSize);
            }}
            backwardText="Halaman sebelumnya"
            forwardText="Halaman berikutnya"
            itemsPerPageText="Baris per halaman"
            itemRangeText={(mulai: number, akhir: number, total: number) => `${mulai}–${akhir} dari ${total} Sales Order`}
            pageRangeText={(_kini: number, total: number) => `dari ${total} halaman`}
            pageNumberText="Nomor halaman"
          />
        </>
      )}
    </div>
  );
}
