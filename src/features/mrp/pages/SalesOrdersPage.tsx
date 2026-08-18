'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { canViewPlanningFeasibility } from '@/lib/roles';

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

type MaterialShortage = { item_id: number; item_code: string; name: string; needed: number; available: number; short: number };
type ComponentToProduce = { item_id: number; item_code: string; name: string; qty_needed: number };
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
  material_blocked_until: string | null;
  total_working_days_to_deadline?: number;
  effective_working_days_after_material_block?: number;
  feasible: boolean | null;
  realistic_qty_deliverable_on_time?: number;
  material_shortages?: MaterialShortage[];
  components_to_produce?: ComponentToProduce[];
  standard_drift?: { message: string; unit_per_batch: { used_in_plan: number; current: number }; batches_per_day: { used_in_plan: number; current: number } } | null;
  reason?: string;
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
                        {showPriceColumn ? <td className="px-3 py-1.5">{line.unit_price === null ? <span className="text-muted-foreground">-</span> : line.unit_price}</td> : null}
                        {canViewPlanningFeasibility(role) ? (
                          <td className="px-3 py-1.5">
                            <Button size="sm" variant="outline" disabled={feasibilityLoading && feasibilityLineId === line.sales_order_line_id} onClick={() => handleCheckFeasibility(line.sales_order_line_id)}>
                              {feasibilityLoading && feasibilityLineId === line.sales_order_line_id ? 'Memuat...' : 'Cek Kelayakan'}
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
                          </span>
                        </div>
                        <div className="grid gap-1 sm:grid-cols-2">
                          <span className="text-muted-foreground">
                            Hari kerja tersedia s/d {feasibilityResult.requested_ship_date}: <span className="text-foreground">{feasibilityResult.total_working_days_to_deadline} hari</span>
                          </span>
                          <span className="text-muted-foreground">
                            Efektif (setelah bahan tersedia): <span className="text-foreground">{feasibilityResult.effective_working_days_after_material_block} hari</span>
                          </span>
                          {feasibilityResult.material_blocked_until ? (
                            <span className="text-muted-foreground sm:col-span-2">
                              Produksi baru bisa mulai <span className="text-foreground">{feasibilityResult.material_blocked_until}</span> (menunggu PO bahan datang)
                            </span>
                          ) : null}
                          {!feasibilityResult.feasible ? (
                            <span className="text-muted-foreground sm:col-span-2">
                              Realistis terkirim tepat waktu: <span className="text-foreground">{feasibilityResult.realistic_qty_deliverable_on_time}</span> dari {feasibilityResult.qty_ordered} yang dipesan
                            </span>
                          ) : null}
                        </div>

                        {feasibilityResult.standard_drift ? (
                          <p className="rounded-md border border-warning/40 bg-warning-subtle p-2 text-xs text-warning-subtle-foreground">{feasibilityResult.standard_drift.message}</p>
                        ) : null}

                        {feasibilityResult.components_to_produce && feasibilityResult.components_to_produce.length > 0 ? (
                          <div>
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Perlu Diproduksi (bukan kekurangan beli — bahan penyusunnya cukup)</p>
                            <ul className="flex flex-col gap-0.5 text-xs">
                              {feasibilityResult.components_to_produce.map((c) => (
                                <li key={c.item_id}>
                                  {c.item_code} — {c.name}: <span className="text-data font-medium text-foreground">{Math.round(c.qty_needed * 100) / 100}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {feasibilityResult.material_shortages && feasibilityResult.material_shortages.length > 0 ? (
                          <div>
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-destructive">Kekurangan Bahan ({feasibilityResult.material_shortages.length} item)</p>
                            <div className="overflow-hidden rounded-md border">
                              <table className="w-full text-data">
                                <thead>
                                  <tr className="border-b">
                                    <th className="h-7 px-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</th>
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
