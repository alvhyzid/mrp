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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { canAccessWarehouseDashboard, canAdjustStock } from '@/lib/roles';
import { typeLabels, typeBadgeVariant } from '@/features/mrp';

const STOCK_ALERT_TYPES = ['stock_depletion_forecast', 'expiry_risk_low_usage', 'low_stock', 'material_shortage'];

const adjustmentReasonLabels: Record<string, string> = {
  stock_opname_variance: 'Selisih Stok Opname',
  damaged: 'Kerusakan',
  other: 'Lainnya'
};

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

type PoPendingLine = {
  purchase_order_line_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  purchase_uom: string | null;
  qty_ordered: number;
  qty_received: number;
};
type PoPendingRow = {
  purchase_order_id: number;
  supplier_name: string | null;
  production_plant_name: string | null;
  status: string;
  order_date: string | null;
  expected_date: string | null;
  line_count: number;
  lines: PoPendingLine[];
};

const poStatusLabels: Record<string, string> = { draft: 'Draft', ordered: 'Dipesan', partially_received: 'Sebagian Diterima' };

type LotOption = {
  lot_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  lot_number: string;
  quantity_on_hand: number;
};

export default function WarehouseDashboardPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const [stock, setStock] = useState<StockRow[]>([]);
  const [stockError, setStockError] = useState('');
  const [stockLoading, setStockLoading] = useState(true);

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [alertsError, setAlertsError] = useState('');
  const [alertsLoading, setAlertsLoading] = useState(true);

  const [pendingPos, setPendingPos] = useState<PoPendingRow[]>([]);
  const [pendingPosError, setPendingPosError] = useState('');
  const [pendingPosLoading, setPendingPosLoading] = useState(true);

  const [expandedPoId, setExpandedPoId] = useState<number | null>(null);
  const [receiptQty, setReceiptQty] = useState<Record<number, string>>({});
  const [receiptStatus, setReceiptStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [receiptMessage, setReceiptMessage] = useState('');

  const [lots, setLots] = useState<LotOption[]>([]);
  const [adjustmentForm, setAdjustmentForm] = useState({ lot_id: '', qty_delta: '', reason_code: '', notes: '' });
  const [adjustmentStatus, setAdjustmentStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [adjustmentMessage, setAdjustmentMessage] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const authedFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Sesi tidak valid.');
      const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) } });
      return { ok: response.ok, body: await response.json() };
    },
    [getAccessToken]
  );

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

  const loadLots = useCallback(async () => {
    const { ok, body } = await authedFetch('/api/lots');
    if (ok) setLots(body.lots || []);
  }, [authedFetch]);

  const handleSubmitAdjustment = async () => {
    const qtyDelta = Number(adjustmentForm.qty_delta);
    if (!adjustmentForm.lot_id) {
      setAdjustmentStatus('error');
      setAdjustmentMessage('Pilih lot dulu.');
      return;
    }
    if (!Number.isFinite(qtyDelta) || qtyDelta === 0) {
      setAdjustmentStatus('error');
      setAdjustmentMessage('Isi jumlah penyesuaian (boleh negatif untuk mengurangi), tidak boleh 0.');
      return;
    }
    if (!adjustmentForm.reason_code) {
      setAdjustmentStatus('error');
      setAdjustmentMessage('Pilih alasan penyesuaian.');
      return;
    }
    if (adjustmentForm.reason_code === 'other' && !adjustmentForm.notes.trim()) {
      setAdjustmentStatus('error');
      setAdjustmentMessage('Alasan "Lainnya" wajib diisi catatan bebasnya.');
      return;
    }

    setAdjustmentStatus('saving');
    setAdjustmentMessage('');
    const { ok, body } = await authedFetch('/api/stock-adjustments', {
      method: 'POST',
      body: JSON.stringify({
        lot_id: Number(adjustmentForm.lot_id),
        qty_delta: qtyDelta,
        reason_code: adjustmentForm.reason_code,
        notes: adjustmentForm.notes.trim() || null
      })
    });
    if (!ok) {
      setAdjustmentStatus('error');
      setAdjustmentMessage(body.error || 'Gagal mencatat penyesuaian stok.');
      return;
    }
    setAdjustmentStatus('success');
    setAdjustmentMessage(`Penyesuaian tercatat — stok lot ini sekarang ${body.quantity_on_hand}.`);
    setAdjustmentForm({ lot_id: '', qty_delta: '', reason_code: '', notes: '' });
    await Promise.all([loadStock(), loadLots()]);
  };

  const handleToggleExpand = (po: PoPendingRow) => {
    if (expandedPoId === po.purchase_order_id) {
      setExpandedPoId(null);
      return;
    }
    setExpandedPoId(po.purchase_order_id);
    setReceiptQty({});
    setReceiptStatus('idle');
    setReceiptMessage('');
  };

  const handleSubmitReceipt = async (po: PoPendingRow) => {
    const lines = po.lines
      .filter((l) => receiptQty[l.purchase_order_line_id] && Number(receiptQty[l.purchase_order_line_id]) > 0)
      .map((l) => ({ purchase_order_line_id: l.purchase_order_line_id, qty_received: Number(receiptQty[l.purchase_order_line_id]) }));
    if (lines.length === 0) {
      setReceiptStatus('error');
      setReceiptMessage('Isi jumlah diterima minimal 1 baris.');
      return;
    }
    setReceiptStatus('saving');
    setReceiptMessage('');
    const { ok, body } = await authedFetch('/api/goods-receipts', { method: 'POST', body: JSON.stringify({ purchase_order_id: po.purchase_order_id, lines }) });
    if (!ok) {
      setReceiptStatus('error');
      setReceiptMessage(body.error || 'Gagal mencatat penerimaan barang.');
      return;
    }
    setReceiptStatus('success');
    setReceiptMessage('Barang diterima — lot baru otomatis dibuat dan stok bertambah.');
    setReceiptQty({});
    await Promise.all([loadPendingPos(), loadStock(), loadAlerts()]);
  };

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
      setRole(meData?.user?.role ?? null);
      setCheckingAccess(false);
      await Promise.all([loadStock(), loadAlerts(), loadPendingPos(), loadLots()]);
    };
    checkAccessAndLoad();
  }, [router, loadStock, loadAlerts, loadPendingPos, loadLots]);

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
      { id: 'po', header: 'No. PO', cell: ({ row }) => `PO-${String(row.original.purchase_order_id).padStart(4, '0')}` },
      { accessorKey: 'supplier_name', header: 'Supplier' },
      { id: 'plant', header: 'Tujuan Plant', cell: ({ row }) => row.original.production_plant_name },
      { id: 'status', header: 'Status', cell: ({ row }) => poStatusLabels[row.original.status] ?? row.original.status },
      { accessorKey: 'expected_date', header: 'Perkiraan Datang', cell: ({ row }) => row.original.expected_date ?? '-' },
      { accessorKey: 'line_count', header: 'Jumlah Baris' },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => handleToggleExpand(row.original)}>
            {expandedPoId === row.original.purchase_order_id ? 'Tutup' : 'Terima Barang'}
          </Button>
        )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedPoId]
  );

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
      <div className="flex w-full flex-col gap-6 px-6">
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
          <CardContent className="flex flex-col gap-3">
            {pendingPosError ? <p className="text-sm text-destructive">{pendingPosError}</p> : null}
            {pendingPosLoading ? (
              <p className="text-sm text-muted-foreground">Memuat PO...</p>
            ) : (
              <DataTable columns={pendingPoColumns} data={pendingPos} emptyMessage="Tidak ada PO ke supplier yang masih menunggu barang datang." />
            )}

            {expandedPoId
              ? (() => {
                  const po = pendingPos.find((p) => p.purchase_order_id === expandedPoId);
                  if (!po) return null;
                  return (
                    <div className="rounded-md border p-3">
                      <p className="mb-2 text-sm font-medium text-foreground">
                        Terima Barang — PO-{String(po.purchase_order_id).padStart(4, '0')} ({po.supplier_name})
                      </p>
                      {po.lines.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Semua baris PO ini sudah diterima penuh.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {po.lines.map((line) => (
                            <div key={line.purchase_order_line_id} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-end gap-2">
                              <div className="text-sm">
                                <span className="font-medium text-foreground">{line.item_code}</span> <span className="text-muted-foreground">{line.item_name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Dipesan: {line.qty_ordered} {line.purchase_uom}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Sudah diterima: {line.qty_received} {line.purchase_uom}
                              </div>
                              <div>
                                <label className="mb-1 block text-xs text-muted-foreground">Diterima Sekarang ({line.purchase_uom})</label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={receiptQty[line.purchase_order_line_id] ?? ''}
                                  onChange={(e) => setReceiptQty((prev) => ({ ...prev, [line.purchase_order_line_id]: e.target.value }))}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {receiptMessage ? <p className={`mt-2 text-sm ${receiptStatus === 'error' ? 'text-destructive' : 'text-success'}`}>{receiptMessage}</p> : null}
                      {po.lines.length > 0 ? (
                        <Button size="sm" className="mt-2" disabled={receiptStatus === 'saving'} onClick={() => handleSubmitReceipt(po)}>
                          {receiptStatus === 'saving' ? 'Menyimpan...' : 'Konfirmasi Barang Diterima'}
                        </Button>
                      ) : null}
                    </div>
                  );
                })()
              : null}
          </CardContent>
        </Card>

        {canAdjustStock(role) ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Koreksi Stok</CardDescription>
              <CardTitle className="text-xl">Penyesuaian Stok Manual</CardTitle>
              <CardDescription>Khusus stok opname/kerusakan — bukan pengganti alur penerimaan/produksi/pengiriman normal. Setiap penyesuaian tercatat di riwayat pergerakan stok beserta alasannya.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Lot</span>
                    <Select value={adjustmentForm.lot_id} onValueChange={(value) => setAdjustmentForm((prev) => ({ ...prev, lot_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih lot..." />
                      </SelectTrigger>
                      <SelectContent>
                        {lots.map((lot) => (
                          <SelectItem key={lot.lot_id} value={String(lot.lot_id)}>
                            {lot.item_code} — {lot.item_name} — {lot.lot_number} (stok: {lot.quantity_on_hand} {lot.item_base_uom})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Jumlah Penyesuaian (+/-)</span>
                    <Input
                      type="number"
                      step="any"
                      placeholder="mis. -5 (berkurang) atau 5 (bertambah)"
                      value={adjustmentForm.qty_delta}
                      onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, qty_delta: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Alasan</span>
                    <Select value={adjustmentForm.reason_code} onValueChange={(value) => setAdjustmentForm((prev) => ({ ...prev, reason_code: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih alasan..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(adjustmentReasonLabels).map(([code, label]) => (
                          <SelectItem key={code} value={code}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Catatan {adjustmentForm.reason_code === 'other' ? '(wajib)' : '(opsional)'}</span>
                    <Input
                      value={adjustmentForm.notes}
                      onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="mis. hasil stok opname 15 Agustus, selisih -5 kg"
                    />
                  </label>
                </div>

                <Button className="w-fit" disabled={adjustmentStatus === 'saving'} onClick={handleSubmitAdjustment}>
                  {adjustmentStatus === 'saving' ? 'Menyimpan...' : 'Catat Penyesuaian'}
                </Button>
                {adjustmentMessage ? <p className={`text-sm ${adjustmentStatus === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>{adjustmentMessage}</p> : null}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
