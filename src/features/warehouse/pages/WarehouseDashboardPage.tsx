'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { canAccessWarehouseDashboard } from '@/lib/roles';
import { typeLabels, typeBadgeVariant } from '@/features/mrp';

const STOCK_ALERT_TYPES = ['stock_depletion_forecast', 'expiry_risk_low_usage', 'low_stock', 'material_shortage'];

const severityBadgeVariant: Record<string, 'info' | 'warning' | 'critical'> = { info: 'info', warning: 'warning', critical: 'critical' };
const alertTypeLabels: Record<string, string> = {
  stock_depletion_forecast: 'Proyeksi Stok Habis',
  expiry_risk_low_usage: 'Risiko Kadaluarsa (Pemakaian Lambat)',
  low_stock: 'Stok Rendah',
  material_shortage: 'Kekurangan Bahan'
};

type StockRow = {
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_type: string | null;
  base_uom: string | null;
  min_stock_level: number | null;
  production_plant_name: string | null;
  total_qty: number;
  lot_count: number;
  is_below_min_stock: boolean;
};

type AlertRow = {
  system_alert_id: number;
  alert_type: string;
  message: string;
  severity: string;
  related_item_code: string | null;
  related_item_name: string | null;
  created_at: string;
};

type PoPendingRow = {
  purchase_order_id: number;
  supplier_name: string | null;
  production_plant_name: string | null;
  status: string;
  order_date: string | null;
  expected_date: string | null;
  line_count: number;
};

export default function WarehouseDashboardPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [stock, setStock] = useState<StockRow[]>([]);
  const [stockError, setStockError] = useState('');
  const [stockLoading, setStockLoading] = useState(true);

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [alertsError, setAlertsError] = useState('');
  const [alertsLoading, setAlertsLoading] = useState(true);

  const [pendingPos, setPendingPos] = useState<PoPendingRow[]>([]);
  const [pendingPosError, setPendingPosError] = useState('');
  const [pendingPosLoading, setPendingPosLoading] = useState(true);

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadStock = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setStockLoading(true);
    const response = await fetch('/api/stock-summary', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setStockError(data.error || 'Gagal memuat ringkasan stok.');
      setStockLoading(false);
      return;
    }
    setStock(data.stockSummary || []);
    setStockError('');
    setStockLoading(false);
  }, [getAccessToken]);

  const loadAlerts = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setAlertsLoading(true);
    const response = await fetch(`/api/system-alerts?alert_types=${STOCK_ALERT_TYPES.join(',')}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setAlertsError(data.error || 'Gagal memuat peringatan.');
      setAlertsLoading(false);
      return;
    }
    setAlerts(data.alerts || []);
    setAlertsError('');
    setAlertsLoading(false);
  }, [getAccessToken]);

  const loadPendingPos = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setPendingPosLoading(true);
    const response = await fetch('/api/purchase-orders-pending', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setPendingPosError(data.error || 'Gagal memuat PO menunggu.');
      setPendingPosLoading(false);
      return;
    }
    setPendingPos(data.purchaseOrders || []);
    setPendingPosError('');
    setPendingPosLoading(false);
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
        router.replace('/login?redirectTo=/warehouse');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      if (!meResponse.ok || !canAccessWarehouseDashboard(meData?.user?.role)) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }
      setCheckingAccess(false);
      await Promise.all([loadStock(), loadAlerts(), loadPendingPos()]);
    };
    checkAccessAndLoad();
  }, [router, loadStock, loadAlerts, loadPendingPos]);

  const stockColumns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      {
        id: 'item',
        header: 'Item',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.item_code}</span>
            <span className="text-xs text-muted-foreground">{row.original.item_name}</span>
          </div>
        )
      },
      {
        id: 'type',
        header: 'Tipe',
        cell: ({ row }) => (row.original.item_type ? <Badge variant={typeBadgeVariant[row.original.item_type] ?? 'secondary'}>{typeLabels[row.original.item_type] ?? row.original.item_type}</Badge> : null)
      },
      { id: 'plant', header: 'Lokasi', cell: ({ row }) => row.original.production_plant_name },
      {
        id: 'qty',
        header: 'Total Stok',
        cell: ({ row }) => (
          <span className="text-data">
            {row.original.total_qty} {row.original.base_uom} ({row.original.lot_count} lot)
          </span>
        )
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (row.original.is_below_min_stock ? <Badge variant="critical">Di bawah min. stok</Badge> : <Badge variant="success">Aman</Badge>)
      }
    ],
    []
  );

  const alertColumns = useMemo<ColumnDef<AlertRow>[]>(
    () => [
      { id: 'type', header: 'Jenis', cell: ({ row }) => alertTypeLabels[row.original.alert_type] ?? row.original.alert_type },
      { id: 'item', header: 'Item', cell: ({ row }) => (row.original.related_item_code ? `${row.original.related_item_code} — ${row.original.related_item_name}` : '-') },
      { accessorKey: 'message', header: 'Pesan' },
      { accessorKey: 'severity', header: 'Tingkat', cell: ({ row }) => <Badge variant={severityBadgeVariant[row.original.severity] ?? 'secondary'}>{row.original.severity}</Badge> }
    ],
    []
  );

  const pendingPoColumns = useMemo<ColumnDef<PoPendingRow>[]>(
    () => [
      { accessorKey: 'supplier_name', header: 'Supplier' },
      { id: 'plant', header: 'Tujuan Plant', cell: ({ row }) => row.original.production_plant_name },
      { accessorKey: 'status', header: 'Status' },
      { accessorKey: 'expected_date', header: 'Perkiraan Datang', cell: ({ row }) => row.original.expected_date ?? '-' },
      { accessorKey: 'line_count', header: 'Jumlah Baris' }
    ],
    []
  );

  if (checkingAccess) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="container max-w-5xl text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="container max-w-3xl">
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em] text-destructive">Akses Ditolak</CardDescription>
              <CardTitle className="text-2xl">Dashboard Warehouse</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Halaman ini khusus company_admin, general_manager, warehouse_manager, atau warehouse_staff.</p>
              <Button onClick={() => router.push('/dashboard')} className="w-fit">
                Kembali ke Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="container flex max-w-5xl flex-col gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Dashboard Department</p>
          <h1 className="text-2xl font-semibold text-foreground">Warehouse</h1>
        </div>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Inventory</CardDescription>
            <CardTitle className="text-xl">Stok Saat Ini per Lokasi</CardTitle>
          </CardHeader>
          <CardContent>
            {stockError ? <p className="text-sm text-destructive">{stockError}</p> : null}
            {stockLoading ? <p className="text-sm text-muted-foreground">Memuat stok...</p> : <DataTable columns={stockColumns} data={stock} emptyMessage="Belum ada stok tercatat." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Peringatan</CardDescription>
            <CardTitle className="text-xl">Stok Mau Habis / Risiko Kadaluarsa</CardTitle>
          </CardHeader>
          <CardContent>
            {alertsError ? <p className="text-sm text-destructive">{alertsError}</p> : null}
            {alertsLoading ? <p className="text-sm text-muted-foreground">Memuat peringatan...</p> : <DataTable columns={alertColumns} data={alerts} emptyMessage="Tidak ada peringatan terbuka saat ini." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Penerimaan Barang</CardDescription>
            <CardTitle className="text-xl">PO Supplier Menunggu Konfirmasi Datang</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pendingPosError ? <p className="text-sm text-destructive">{pendingPosError}</p> : null}
            {pendingPosLoading ? (
              <p className="text-sm text-muted-foreground">Memuat PO...</p>
            ) : (
              <DataTable columns={pendingPoColumns} data={pendingPos} emptyMessage="Belum ada PO ke supplier (modul Purchasing belum dibangun)." />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
