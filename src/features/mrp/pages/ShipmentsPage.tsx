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
import { canManageShipments } from '@/lib/roles';

const statusLabels: Record<string, string> = { draft: 'Draft', shipped: 'Terkirim', delivered: 'Diterima', cancelled: 'Batal' };
const statusBadgeVariant: Record<string, 'secondary' | 'warning' | 'success' | 'critical'> = {
  draft: 'secondary',
  shipped: 'warning',
  delivered: 'success',
  cancelled: 'critical'
};

type SoLine = {
  sales_order_line_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  qty_ordered: number;
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
  production_plant_id: number;
  production_plant_name: string | null;
  status: string;
  lines: SoLine[];
  shipments: SoShipmentSummary[];
};

type ShipmentLine = {
  shipment_line_id: number;
  sales_order_line_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  qty_shipped: number;
  lot_id: number;
  lot_number: string | null;
  lot_expiry_date: string | null;
};

type Shipment = {
  shipment_id: number;
  shipment_number: string;
  shipment_date: string;
  status: string;
  delivery_address: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  vehicle_number: string | null;
  driver_name: string | null;
  created_at: string;
  sales_order_id: number;
  so_number: string | null;
  customer_id: number | null;
  customer_name: string | null;
  lines: ShipmentLine[];
};

type LotOption = { lot_id: number; item_id: number; lot_number: string; expiry_date: string | null; quantity_on_hand: number };

type LineFormState = { qty_shipped: string; lot_id: string };

export default function ShipmentsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [soError, setSoError] = useState('');
  const [soLoading, setSoLoading] = useState(true);

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipmentsError, setShipmentsError] = useState('');
  const [shipmentsLoading, setShipmentsLoading] = useState(true);

  const [creatingForSoId, setCreatingForSoId] = useState<number | null>(null);
  const [lotsByItemId, setLotsByItemId] = useState<Record<number, LotOption[]>>({});
  const [lotsLoaded, setLotsLoaded] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [lineInputs, setLineInputs] = useState<Record<number, LineFormState>>({});
  const [createStatus, setCreateStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [createMessage, setCreateMessage] = useState('');

  const [expandedShipmentId, setExpandedShipmentId] = useState<number | null>(null);
  const [statusActionState, setStatusActionState] = useState<Record<number, 'idle' | 'saving'>>({});
  const [statusMessage, setStatusMessage] = useState<Record<number, { text: string; error: boolean }>>({});

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

  const loadSalesOrders = useCallback(async () => {
    setSoLoading(true);
    const { ok, body } = await authedFetch('/api/sales-orders');
    if (!ok) {
      setSoError(body.error || 'Gagal memuat daftar Sales Order.');
      setSoLoading(false);
      return;
    }
    setSalesOrders(body.salesOrders || []);
    setSoError('');
    setSoLoading(false);
  }, [authedFetch]);

  const loadShipments = useCallback(async () => {
    setShipmentsLoading(true);
    const { ok, body } = await authedFetch('/api/shipments');
    if (!ok) {
      setShipmentsError(body.error || 'Gagal memuat daftar pengiriman.');
      setShipmentsLoading(false);
      return;
    }
    setShipments(body.shipments || []);
    setShipmentsError('');
    setShipmentsLoading(false);
  }, [authedFetch]);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/shipments');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      if (!meResponse.ok || !canManageShipments(meData?.user?.role)) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }
      setCheckingAccess(false);
      await Promise.all([loadSalesOrders(), loadShipments()]);
    };
    checkAccessAndLoad();
  }, [router, loadSalesOrders, loadShipments]);

  const soWithRemaining = useMemo(() => salesOrders.filter((so) => so.lines.some((line) => line.qty_remaining_to_ship > 0)), [salesOrders]);

  // Alamat pengiriman TERAKHIR untuk customer yang sama (SO manapun) — starting point
  // yang bisa diedit, BUKAN auto-terisi permanen. shipments di sini sudah lintas-SO
  // (state company-wide), jadi cakupannya "customer yang sama", bukan cuma "SO yang sama".
  const lastAddressForCustomer = useCallback(
    (customerId: number): string => {
      const candidates = shipments.filter((s) => s.customer_id === customerId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return candidates[0]?.delivery_address ?? '';
    },
    [shipments]
  );

  const openCreateForm = useCallback(
    async (so: SalesOrder) => {
      setCreatingForSoId(so.sales_order_id);
      setCreateStatus('idle');
      setCreateMessage('');
      setDeliveryAddress(lastAddressForCustomer(so.customer_id));
      setRecipientName('');
      setRecipientPhone('');
      setVehicleNumber('');
      setDriverName('');

      const remainingLines = so.lines.filter((line) => line.qty_remaining_to_ship > 0);
      setLineInputs(Object.fromEntries(remainingLines.map((line) => [line.sales_order_line_id, { qty_shipped: '', lot_id: '' }])));
      setLotsByItemId({});
      setLotsLoaded(false);

      const itemIds = Array.from(new Set(remainingLines.map((line) => line.item_id)));
      if (itemIds.length === 0) {
        setLotsLoaded(true);
        return;
      }
      const { ok, body } = await authedFetch(`/api/lots?item_ids=${itemIds.join(',')}&production_plant_id=${so.production_plant_id}`);
      if (!ok) {
        setLotsLoaded(true);
        return;
      }
      const lots = (body.lots || []) as LotOption[];
      const byItem: Record<number, LotOption[]> = {};
      for (const lot of lots) {
        byItem[lot.item_id] = byItem[lot.item_id] ?? [];
        byItem[lot.item_id].push(lot);
      }
      setLotsByItemId(byItem);
      setLotsLoaded(true);
      // /api/lots sudah terurut expiry_date terdekat dulu (FEFO) — saran otomatis
      // adalah lot PERTAMA per item, staf bisa ganti manual lewat dropdown.
      setLineInputs((prev) => {
        const next = { ...prev };
        for (const line of remainingLines) {
          const suggested = byItem[line.item_id]?.[0];
          if (suggested) next[line.sales_order_line_id] = { ...next[line.sales_order_line_id], lot_id: String(suggested.lot_id) };
        }
        return next;
      });
    },
    [authedFetch, lastAddressForCustomer]
  );

  const closeCreateForm = () => {
    setCreatingForSoId(null);
    setLotsByItemId({});
    setLotsLoaded(false);
    setLineInputs({});
  };

  const handleSubmitCreate = async (so: SalesOrder) => {
    if (!deliveryAddress.trim()) {
      setCreateStatus('error');
      setCreateMessage('Alamat tujuan wajib diisi.');
      return;
    }
    const lines = so.lines
      .filter((line) => line.qty_remaining_to_ship > 0)
      .map((line) => {
        const input = lineInputs[line.sales_order_line_id];
        return { sales_order_line_id: line.sales_order_line_id, item_id: line.item_id, qty_shipped: Number(input?.qty_shipped), lot_id: Number(input?.lot_id) };
      })
      .filter((line) => Number.isFinite(line.qty_shipped) && line.qty_shipped > 0 && line.lot_id > 0);

    if (lines.length === 0) {
      setCreateStatus('error');
      setCreateMessage('Isi jumlah dan pilih lot untuk minimal 1 baris item.');
      return;
    }

    setCreateStatus('saving');
    setCreateMessage('');
    const { ok, body } = await authedFetch('/api/shipments', {
      method: 'POST',
      body: JSON.stringify({
        sales_order_id: so.sales_order_id,
        delivery_address: deliveryAddress.trim(),
        recipient_name: recipientName.trim() || null,
        recipient_phone: recipientPhone.trim() || null,
        vehicle_number: vehicleNumber.trim() || null,
        driver_name: driverName.trim() || null,
        lines
      })
    });
    if (!ok) {
      setCreateStatus('error');
      setCreateMessage(body.error || 'Gagal membuat pengiriman.');
      return;
    }
    setCreateStatus('success');
    setCreateMessage(`Pengiriman ${body.shipment_number} dibuat (status draft) — belum mengurangi stok sampai ditandai "Terkirim".`);
    closeCreateForm();
    await Promise.all([loadSalesOrders(), loadShipments()]);
  };

  const handleTransition = async (shipment: Shipment, targetStatus: 'shipped' | 'delivered') => {
    setStatusActionState((prev) => ({ ...prev, [shipment.shipment_id]: 'saving' }));
    setStatusMessage((prev) => ({ ...prev, [shipment.shipment_id]: { text: '', error: false } }));
    const { ok, body } = await authedFetch('/api/shipments/status', { method: 'PATCH', body: JSON.stringify({ shipment_id: shipment.shipment_id, status: targetStatus }) });
    setStatusActionState((prev) => ({ ...prev, [shipment.shipment_id]: 'idle' }));
    if (!ok) {
      setStatusMessage((prev) => ({ ...prev, [shipment.shipment_id]: { text: body.error || 'Gagal mengubah status.', error: true } }));
      return;
    }
    setStatusMessage((prev) => ({
      ...prev,
      [shipment.shipment_id]: { text: targetStatus === 'shipped' ? 'Terkirim — stok telah berkurang.' : 'Ditandai diterima.', error: false }
    }));
    await Promise.all([loadSalesOrders(), loadShipments()]);
  };

  const soColumns = useMemo<ColumnDef<SalesOrder>[]>(
    () => [
      { id: 'so_number', header: 'No. SO', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.so_number}</span> },
      { id: 'customer', header: 'Client', cell: ({ row }) => row.original.customer_name ?? '-' },
      { id: 'plant', header: 'Lokasi', cell: ({ row }) => row.original.production_plant_name ?? '-' },
      {
        id: 'remaining',
        header: 'Sisa Qty Belum Terkirim',
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5 text-xs">
            {row.original.lines
              .filter((line) => line.qty_remaining_to_ship > 0)
              .map((line) => (
                <span key={line.sales_order_line_id}>
                  {line.item_code}: <span className="font-medium text-foreground">{line.qty_remaining_to_ship}</span> {line.item_base_uom} (dari {line.qty_ordered})
                </span>
              ))}
          </div>
        )
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <Button size="sm" onClick={() => (creatingForSoId === row.original.sales_order_id ? closeCreateForm() : openCreateForm(row.original))}>
            {creatingForSoId === row.original.sales_order_id ? 'Tutup Form' : 'Buat Pengiriman'}
          </Button>
        )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [creatingForSoId, openCreateForm]
  );

  const shipmentColumns = useMemo<ColumnDef<Shipment>[]>(
    () => [
      {
        id: 'shipment_number',
        header: 'No. Surat Jalan',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.shipment_number}</span>
            <span className="text-xs text-muted-foreground">{row.original.so_number}</span>
          </div>
        )
      },
      { id: 'customer', header: 'Client', cell: ({ row }) => row.original.customer_name ?? '-' },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={statusBadgeVariant[row.original.status] ?? 'secondary'}>{statusLabels[row.original.status] ?? row.original.status}</Badge> },
      { id: 'delivery_address', header: 'Alamat Tujuan', cell: ({ row }) => <span className="text-xs">{row.original.delivery_address}</span> },
      { id: 'created_at', header: 'Dibuat', cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString('id-ID') },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => {
          const shipment = row.original;
          const saving = statusActionState[shipment.shipment_id] === 'saving';
          return (
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setExpandedShipmentId((current) => (current === shipment.shipment_id ? null : shipment.shipment_id))}>
                  {expandedShipmentId === shipment.shipment_id ? 'Tutup' : 'Detail'}
                </Button>
                {shipment.status === 'draft' ? (
                  <Button size="sm" disabled={saving} onClick={() => handleTransition(shipment, 'shipped')}>
                    {saving ? 'Memproses...' : 'Kirim (Kurangi Stok)'}
                  </Button>
                ) : null}
                {shipment.status === 'shipped' ? (
                  <Button size="sm" disabled={saving} onClick={() => handleTransition(shipment, 'delivered')}>
                    {saving ? 'Memproses...' : 'Tandai Diterima'}
                  </Button>
                ) : null}
              </div>
              {statusMessage[shipment.shipment_id]?.text ? (
                <span className={`text-xs ${statusMessage[shipment.shipment_id].error ? 'text-destructive' : 'text-success-subtle-foreground'}`}>{statusMessage[shipment.shipment_id].text}</span>
              ) : null}
            </div>
          );
        }
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedShipmentId, statusActionState, statusMessage]
  );

  const creatingForSo = salesOrders.find((so) => so.sales_order_id === creatingForSoId) ?? null;
  const expandedShipment = shipments.find((s) => s.shipment_id === expandedShipmentId) ?? null;

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
              <CardTitle className="text-2xl">Sesi tidak valid atau role Anda tidak berwenang</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Halaman Pengiriman hanya untuk Warehouse Manager/Staff, PPIC Manager, dan leadership.</p>
              <Button onClick={() => router.push('/login?redirectTo=/shipments')} className="w-fit">
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
            <CardDescription className="uppercase tracking-[0.2em]">Warehouse / PPIC</CardDescription>
            <CardTitle className="text-2xl">Pengiriman</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Sales Order dengan sisa qty yang belum terkirim penuh. Pilih "Buat Pengiriman" untuk membuat surat jalan baru (boleh parsial).</p>
            {soError ? <p className="text-sm text-destructive">{soError}</p> : null}
            {soLoading ? <p className="text-sm text-muted-foreground">Memuat Sales Order...</p> : <DataTable columns={soColumns} data={soWithRemaining} emptyMessage="Tidak ada Sales Order dengan sisa qty belum terkirim." />}

            {creatingForSo ? (
              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium text-foreground">
                  Buat Pengiriman — {creatingForSo.so_number} ({creatingForSo.customer_name})
                </p>
                <div className="flex flex-col gap-2">
                  {creatingForSo.lines
                    .filter((line) => line.qty_remaining_to_ship > 0)
                    .map((line) => (
                      <div key={line.sales_order_line_id} className="grid grid-cols-[2fr_1fr_1fr_2fr] items-end gap-2">
                        <div className="text-sm">
                          <span className="font-medium text-foreground">{line.item_code}</span> <span className="text-muted-foreground">{line.item_name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Sisa: <span className="font-medium text-foreground">{line.qty_remaining_to_ship}</span> {line.item_base_uom}
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">Jumlah Kirim</label>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            disabled={lotsLoaded && (lotsByItemId[line.item_id] ?? []).length === 0}
                            value={lineInputs[line.sales_order_line_id]?.qty_shipped ?? ''}
                            onChange={(e) => setLineInputs((prev) => ({ ...prev, [line.sales_order_line_id]: { ...prev[line.sales_order_line_id], qty_shipped: e.target.value } }))}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">Lot (saran FEFO — bisa diganti)</label>
                          {lotsLoaded && (lotsByItemId[line.item_id] ?? []).length === 0 ? (
                            <p className="text-xs text-destructive">
                              Sisa {line.qty_remaining_to_ship} {line.item_base_uom} ini masih BELUM DIKIRIM dari pesanan, TAPI stok fisiknya kosong (0 lot tersedia) — tidak bisa dikirim sampai ada barang masuk untuk item ini di lokasi pabrik SO ini.
                            </p>
                          ) : (
                          <Select
                            disabled={!lotsLoaded}
                            value={lineInputs[line.sales_order_line_id]?.lot_id ?? ''}
                            onValueChange={(value) => setLineInputs((prev) => ({ ...prev, [line.sales_order_line_id]: { ...prev[line.sales_order_line_id], lot_id: value } }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={lotsLoaded ? 'Pilih lot...' : 'Memuat lot...'} />
                            </SelectTrigger>
                            <SelectContent>
                              {(lotsByItemId[line.item_id] ?? []).map((lot) => (
                                <SelectItem key={lot.lot_id} value={String(lot.lot_id)}>
                                  {lot.lot_number} — stok {lot.quantity_on_hand} {line.item_base_uom}
                                  {lot.expiry_date ? ` — kadaluarsa ${new Date(lot.expiry_date).toLocaleDateString('id-ID')}` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          )}
                        </div>
                      </div>
                    ))}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Alamat Tujuan (wajib)</span>
                    <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Alamat lengkap tujuan pengiriman" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Nama Penerima (opsional)</span>
                    <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">No. HP Penerima (opsional)</span>
                    <Input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Nomor Kendaraan (opsional)</span>
                    <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="mis. B 1234 XYZ" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Nama Sopir (opsional)</span>
                    <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
                  </label>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <Button disabled={createStatus === 'saving'} onClick={() => handleSubmitCreate(creatingForSo)}>
                    {createStatus === 'saving' ? 'Menyimpan...' : 'Buat Pengiriman (Draft)'}
                  </Button>
                  <Button variant="outline" onClick={closeCreateForm}>
                    Batal
                  </Button>
                </div>
                {createMessage ? <p className={`mt-2 text-sm ${createStatus === 'error' ? 'text-destructive' : 'text-success-subtle-foreground'}`}>{createMessage}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Riwayat</CardDescription>
            <CardTitle className="text-2xl">Daftar Pengiriman</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {shipmentsError ? <p className="text-sm text-destructive">{shipmentsError}</p> : null}
            {shipmentsLoading ? <p className="text-sm text-muted-foreground">Memuat pengiriman...</p> : <DataTable columns={shipmentColumns} data={shipments} emptyMessage="Belum ada pengiriman tercatat." />}

            {expandedShipment ? (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-data">
                  <thead>
                    <tr className="border-b">
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Qty Dikirim</th>
                      <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Lot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expandedShipment.lines.map((line) => (
                      <tr key={line.shipment_line_id} className="border-b last:border-0">
                        <td className="px-3 py-1.5">
                          {line.item_code} — {line.item_name}
                        </td>
                        <td className="px-3 py-1.5">
                          {line.qty_shipped} {line.item_base_uom}
                        </td>
                        <td className="px-3 py-1.5">
                          {line.lot_number}
                          {line.lot_expiry_date ? ` (kadaluarsa ${new Date(line.lot_expiry_date).toLocaleDateString('id-ID')})` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
