'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
};

export default function SalesOrdersPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [soError, setSoError] = useState('');
  const [soLoading, setSoLoading] = useState(true);
  const [expandedSoId, setExpandedSoId] = useState<number | null>(null);

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
      if (!meResponse.ok) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }
      setCheckingAccess(false);
      await loadSalesOrders();
    };
    checkAccessAndLoad();
  }, [router, loadSalesOrders]);

  const toggleExpand = (so: SalesOrder) => {
    setExpandedSoId((current) => (current === so.sales_order_id ? null : so.sales_order_id));
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
      <div className="container flex max-w-5xl flex-col gap-6">
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
            {soLoading ? <p className="text-sm text-muted-foreground">Memuat Sales Order...</p> : <DataTable columns={columns} data={salesOrders} emptyMessage="Belum ada Sales Order." />}
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
                      {showPriceColumn ? <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Harga Satuan</th> : null}
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
                        {showPriceColumn ? <td className="px-3 py-1.5">{line.unit_price === null ? <span className="text-muted-foreground">-</span> : line.unit_price}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
