'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { canViewPlanningFeasibility, canViewFinancialData } from '@/lib/roles';
import { formatCurrency } from '@/lib/currency';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';

const statusLabels: Record<string, string> = { confirmed: 'Dikonfirmasi', in_production: 'Sedang Produksi', completed: 'Selesai', cancelled: 'Batal' };
const statusBadgeVariant: Record<string, 'info' | 'warning' | 'success' | 'critical'> = {
  confirmed: 'info',
  in_production: 'warning',
  completed: 'success',
  cancelled: 'critical'
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
};

type MarginVarianceItem = { item_code: string; name: string; impact: number; detail: string };
type MarginVarianceCategory = { category: string; label: string; total_impact: number; complete: boolean; incomplete_reason: string | null; items: MarginVarianceItem[] };
type MarginWatchResult = {
  item_code: string;
  item_name: string;
  qty_ordered: number;
  unit_price: number;
  standard_material_cost_per_unit: number;
  standard_packaging_cost_per_unit: number;
  standard_labor_cost_per_unit: number;
  labor_cost_complete: boolean;
  labor_cost_notes: string[];
  cost_data_complete: boolean;
  missing_cost_item_codes: string[];
  unverified_cost_item_codes: string[];
  standard_margin_per_unit: number;
  standard_margin_total: number;
  margin_floor_threshold: number | null;
  categories: MarginVarianceCategory[];
  total_variance_impact: number;
  projected_margin_total: number;
  projection_complete: boolean;
  snapshot_taken_at: string;
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
const shipmentStatusBadgeVariant: Record<string, 'secondary' | 'warning' | 'success' | 'critical'> = {
  draft: 'secondary',
  shipped: 'warning',
  delivered: 'success',
  cancelled: 'critical'
};

export default function SalesOrdersPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [soError, setSoError] = useState('');
  const [soLoading, setSoLoading] = useState(true);
  const [expandedSoId, setExpandedSoId] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const [feasibilityLineId, setFeasibilityLineId] = useState<number | null>(null);
  const [feasibilityLoading, setFeasibilityLoading] = useState(false);
  const [feasibilityError, setFeasibilityError] = useState('');
  const [feasibilityResult, setFeasibilityResult] = useState<FeasibilityResult | null>(null);

  const [marginLineId, setMarginLineId] = useState<number | null>(null);
  const [marginLoading, setMarginLoading] = useState(false);
  const [marginError, setMarginError] = useState('');
  const [marginResult, setMarginResult] = useState<MarginWatchResult | null>(null);
  const [marginThresholdInput, setMarginThresholdInput] = useState('');
  const [marginThresholdStatus, setMarginThresholdStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [marginThresholdMessage, setMarginThresholdMessage] = useState('');

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

  const showPriceColumn = useMemo(() => salesOrders.some((so) => so.lines.some((line) => line.unit_price !== null)), [salesOrders]);

  const columns = useMemo<ColumnDef<SalesOrder>[]>(
    () => [
      {
        id: 'so_number',
        header: 'No. SO',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.so_number}</span>
            <span className="text-xs text-muted-foreground">{row.original.po_number ? `dari PO ${row.original.po_number}` : '-'}</span>
          </div>
        )
      },
      { id: 'customer', header: 'Client', cell: ({ row }) => row.original.customer_name ?? '-' },
      { id: 'plant', header: 'Lokasi', cell: ({ row }) => row.original.production_plant_name ?? '-' },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={statusBadgeVariant[row.original.status] ?? 'secondary'}>{statusLabels[row.original.status] ?? row.original.status}</Badge> },
      { id: 'lines', header: 'Jumlah Baris', cell: ({ row }) => row.original.lines.length },
      {
        id: 'created_at',
        header: 'Dibuat',
        cell: ({ row }) => (row.original.created_at ? new Date(row.original.created_at).toLocaleDateString('id-ID') : '-')
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => toggleExpand(row.original)}>
            {expandedSoId === row.original.sales_order_id ? 'Tutup' : 'Detail'}
          </Button>
        )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedSoId]
  );

  const expandedSo = salesOrders.find((so) => so.sales_order_id === expandedSoId) ?? null;

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="px-6 text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="max-w-3xl px-6">
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em] text-destructive">Akses Ditolak</CardDescription>
              <CardTitle className="text-2xl">Sesi tidak valid</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Silakan login ulang untuk mengakses Sales Order.</p>
              <Button onClick={() => router.push('/login?redirectTo=/sales-orders')} className="w-fit">
                Ke Halaman Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="flex w-full flex-col gap-6 px-6">
        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Sales</CardDescription>
            <CardTitle className="text-2xl">Sales Order</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Sales Order tercipta otomatis begitu PO Client diproses (lihat halaman PO Client) — tidak dibuat manual di sini.
            </p>
            {soError ? <p className="text-sm text-destructive">{soError}</p> : null}
            {soLoading ? (
              <p className="text-sm text-muted-foreground">Memuat Sales Order...</p>
            ) : (
              <DataTable
                columns={columns}
                data={salesOrders}
                emptyMessage="Belum ada Sales Order."
                searchPlaceholder="Cari No. SO atau client..."
                getSearchText={(so) => `${so.so_number} ${so.customer_name ?? ''}`}
                paginated
                pageSize={15}
              />
            )}
          </CardContent>
        </Card>

        {expandedSo ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Detail Sales Order</CardDescription>
              <CardTitle className="text-xl">
                {expandedSo.so_number} — {expandedSo.customer_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">PO Client Asal:</span> {expandedSo.po_number ?? '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">Lokasi Pabrik:</span> {expandedSo.production_plant_name ?? '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span> <Badge variant={statusBadgeVariant[expandedSo.status] ?? 'secondary'}>{statusLabels[expandedSo.status] ?? expandedSo.status}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Dibuat:</span> {new Date(expandedSo.created_at).toLocaleDateString('id-ID')}
                </div>
              </div>

              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-data">
                  <thead>
                    <tr className="border-b">
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Qty Dipesan</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Sudah Direncanakan di WO</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Sudah Dikirim</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Sisa Belum Dikirim</th>
                      {showPriceColumn ? <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Harga Satuan</th> : null}
                      {canViewPlanningFeasibility(role) ? <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Kelayakan</th> : null}
                      {canViewFinancialData(role) ? <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Margin Watch</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {expandedSo.lines.map((line) => (
                      <tr key={line.sales_order_line_id} className="border-b last:border-0">
                        <td className="px-3 py-1.5">
                          {line.item_code} — {line.item_name}
                        </td>
                        <td className="px-3 py-1.5">
                          {line.qty_ordered} {line.item_base_uom}
                        </td>
                        <td className="px-3 py-1.5">
                          {line.qty_already_planned_in_wo} {line.item_base_uom}
                        </td>
                        <td className="px-3 py-1.5">
                          {line.qty_shipped} {line.item_base_uom}
                        </td>
                        <td className="px-3 py-1.5">
                          {line.qty_remaining_to_ship > 0 ? <span className="font-medium text-foreground">{line.qty_remaining_to_ship}</span> : <span className="text-muted-foreground">0</span>} {line.item_base_uom}
                        </td>
                        {showPriceColumn ? <td className="px-3 py-1.5">{line.unit_price === null ? <span className="text-muted-foreground">-</span> : formatCurrency(line.unit_price, { maxDecimals: 0 })}</td> : null}
                        {canViewPlanningFeasibility(role) ? (
                          <td className="px-3 py-1.5">
                            <Button size="sm" variant="outline" disabled={feasibilityLoading && feasibilityLineId === line.sales_order_line_id} onClick={() => handleCheckFeasibility(line.sales_order_line_id)}>
                              {feasibilityLoading && feasibilityLineId === line.sales_order_line_id ? 'Memuat...' : 'Cek Kelayakan'}
                            </Button>
                          </td>
                        ) : null}
                        {canViewFinancialData(role) ? (
                          <td className="px-3 py-1.5">
                            <Button size="sm" variant="outline" disabled={marginLoading && marginLineId === line.sales_order_line_id} onClick={() => handleCheckMarginWatch(line.sales_order_line_id)}>
                              {marginLoading && marginLineId === line.sales_order_line_id ? 'Memuat...' : 'Margin Watch'}
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {marginLineId && expandedSo.lines.some((l) => l.sales_order_line_id === marginLineId) ? (
                <div className="rounded-md border p-4">
                  <p className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Margin Watch — Baseline vs Proyeksi Berjalan</p>
                  {marginError ? <p className="text-sm text-destructive">{marginError}</p> : null}
                  {marginLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
                  {marginResult && !marginLoading ? (
                    <div className="flex flex-col gap-3 text-sm">
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
                                { label: 'Biaya kemasan/unit', value: formatCurrency(marginResult.standard_packaging_cost_per_unit) }
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
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">Ambang Margin Minimum (opsional)</span>
                          <Input
                            type="number"
                            step="any"
                            placeholder="mis. 35000000"
                            className="w-48"
                            value={marginThresholdInput}
                            onChange={(event) => setMarginThresholdInput(event.target.value)}
                          />
                        </label>
                        <Button size="sm" variant="outline" disabled={marginThresholdStatus === 'saving'} onClick={handleSaveMarginThreshold}>
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
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant={feasibilityResult.feasible ? 'success' : 'critical'}>{feasibilityResult.feasible ? 'FEASIBLE' : 'TIDAK FEASIBLE'}</Badge>
                          <span>
                            Butuh <span className="font-medium text-foreground">{feasibilityResult.batches_needed}</span> batch ({feasibilityResult.days_needed} hari produksi) — kapasitas{' '}
                            {feasibilityResult.batches_per_day} batch/hari
                            <ProvenanceInfoButton
                              label="Kebutuhan Batch & Kapasitas"
                              envelope={{
                                formula:
                                  'Kebutuhan batch = ROUNDUP(qty dipesan ÷ unit/batch). Hari produksi = ROUNDUP(kebutuhan batch ÷ batch/hari). unit/batch & batch/hari adalah standar K8 (production_standards), DIKUNCI (snapshot) sekali per baris SO saat pertama dihitung — perubahan standar setelahnya TIDAK mengubah rencana yang sudah ada (lihat peringatan "standar berubah" bila muncul).',
                                inputs: [
                                  { label: 'Qty dipesan', value: String(feasibilityResult.qty_ordered) },
                                  { label: 'Unit/batch (K8)', value: String(feasibilityResult.unit_per_batch) },
                                  { label: 'Batch/hari (K8)', value: String(feasibilityResult.batches_per_day) },
                                  { label: 'Kebutuhan batch', value: String(feasibilityResult.batches_needed) },
                                  { label: 'Hari produksi', value: String(feasibilityResult.days_needed) }
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
                            Hari kerja tersedia s/d {feasibilityResult.requested_ship_date}: <span className="text-foreground">{feasibilityResult.total_working_days_to_deadline} hari</span>
                            <ProvenanceInfoButton
                              label="Hari Kerja Tersedia s/d Deadline"
                              envelope={{
                                formula: 'Jumlah hari kerja dari HARI INI sampai tanggal diminta client, dihitung dari kalender kerja perusahaan (jam kerja Senin-Jumat & Sabtu di Pengaturan Perusahaan). BELUM memperhitungkan kapan bahan tersedia — itu angka "Efektif" di sebelahnya.',
                                inputs: [
                                  { label: 'Dari', value: feasibilityResult.today ?? '-' },
                                  { label: 'Sampai (diminta)', value: feasibilityResult.requested_ship_date ?? '-' },
                                  { label: 'Hasil', value: `${feasibilityResult.total_working_days_to_deadline} hari` }
                                ]
                              }}
                            />
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            Efektif (setelah bahan mulai tersedia): <span className="text-foreground">{feasibilityResult.effective_working_days_after_material_block} hari</span>
                            <ProvenanceInfoButton
                              label="Hari Kerja Efektif Setelah Bahan Tersedia"
                              envelope={{
                                formula: 'Sama seperti "Hari Kerja Tersedia", tapi dihitung mulai dari tanggal produksi BISA MULAI (menunggu bahan tahap pertama datang) — bukan dari hari ini. Kalau bahan sudah tersedia sekarang, angka ini sama dengan hari kerja tersedia biasa.',
                                inputs: [
                                  { label: 'Dari (produksi bisa mulai)', value: feasibilityResult.production_start_blocked_until ?? (feasibilityResult.today ?? 'hari ini') },
                                  { label: 'Sampai (diminta)', value: feasibilityResult.requested_ship_date ?? '-' },
                                  { label: 'Hasil', value: `${feasibilityResult.effective_working_days_after_material_block} hari` }
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
                                    { label: 'Hari produksi', value: String(feasibilityResult.days_needed ?? '-') },
                                    { label: 'Bahan tahap belakangan terlambat', value: String(feasibilityResult.late_stage_material_blocks?.length ?? 0) },
                                    { label: 'Estimasi selesai', value: feasibilityResult.order_ship_ready_date }
                                  ],
                                  sourceDocument: 'getPlanningFeasibility.ts'
                                }}
                              />
                            </span>
                          ) : null}
                          {!feasibilityResult.feasible ? (
                            <span className="flex items-center gap-1 text-muted-foreground sm:col-span-2">
                              Realistis terkirim tepat waktu: <span className="text-foreground">{feasibilityResult.realistic_qty_deliverable_on_time}</span> dari {feasibilityResult.qty_ordered} yang dipesan
                              <ProvenanceInfoButton
                                label="Realistis Terkirim Tepat Waktu"
                                envelope={{
                                  formula:
                                    'MIN antara qty dipesan dan (hari kerja efektif × batch/hari × unit/batch) — dibatasi lebih lanjut kalau ada bahan tahap belakangan yang datang terlambat (pakai jendela hari kerja sejak bahan ITU siap, bukan sejak mulai produksi). Angka paling KONSERVATIF dari semua batasan dipakai, dibulatkan ke bawah. Sengaja melebih-lebihkan risiko keterlambatan, bukan optimistis.',
                                  inputs: [
                                    { label: 'Qty dipesan', value: String(feasibilityResult.qty_ordered) },
                                    { label: 'Hari kerja efektif', value: `${feasibilityResult.effective_working_days_after_material_block} hari` },
                                    { label: 'Batch/hari × unit/batch', value: `${feasibilityResult.batches_per_day} × ${feasibilityResult.unit_per_batch}` },
                                    { label: 'Hasil realistis', value: String(feasibilityResult.realistic_qty_deliverable_on_time) }
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
                                  {c.item_code} — {c.name}: <span className="text-data font-medium text-foreground">{Math.round(c.qty_needed * 100) / 100}</span>
                                  {c.blocking_stage ? <span className="text-muted-foreground"> (tahap {c.blocking_stage.sequence_no}. {c.blocking_stage.step_name})</span> : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {feasibilityResult.material_shortages && feasibilityResult.material_shortages.length > 0 ? (
                          <div>
                            <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-destructive">
                              Kekurangan Bahan ({feasibilityResult.material_shortages.length} item)
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
                            <div className="overflow-hidden rounded-md border">
                              <table className="w-full text-data">
                                <thead>
                                  <tr className="border-b">
                                    <th className="h-7 px-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</th>
                                    <th className="h-7 px-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tahap</th>
                                    <th className="h-7 px-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Butuh</th>
                                    <th className="h-7 px-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Stok</th>
                                    <th className="h-7 px-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Kurang</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {feasibilityResult.material_shortages.map((s) => (
                                    <tr key={s.item_id} className="border-b last:border-0">
                                      <td className="px-2 py-1">
                                        {s.item_code} — {s.name}
                                      </td>
                                      <td className="px-2 py-1 text-muted-foreground">{s.blocking_stage ? `${s.blocking_stage.sequence_no}. ${s.blocking_stage.step_name}` : 'Sejak tahap 1'}</td>
                                      <td className="px-2 py-1">{Math.round(s.needed * 100) / 100}</td>
                                      <td className="px-2 py-1">{Math.round(s.available * 100) / 100}</td>
                                      <td className="px-2 py-1 font-medium text-destructive">{Math.round(s.short * 100) / 100}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
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
                  <div className="overflow-hidden rounded-md border">
                    <table className="w-full text-data">
                      <thead>
                        <tr className="border-b">
                          <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">No. Surat Jalan</th>
                          <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                          <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Alamat Tujuan</th>
                          <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Dibuat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedSo.shipments.map((shipment) => (
                          <tr key={shipment.shipment_id} className="border-b last:border-0">
                            <td className="px-3 py-1.5">{shipment.shipment_number}</td>
                            <td className="px-3 py-1.5">
                              <Badge variant={shipmentStatusBadgeVariant[shipment.status] ?? 'secondary'}>{shipmentStatusLabels[shipment.status] ?? shipment.status}</Badge>
                            </td>
                            <td className="px-3 py-1.5 text-xs">{shipment.delivery_address}</td>
                            <td className="px-3 py-1.5">{new Date(shipment.created_at).toLocaleDateString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
