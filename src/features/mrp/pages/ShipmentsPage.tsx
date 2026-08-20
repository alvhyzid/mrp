'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { canManageShipments } from '@/lib/roles';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { ConfirmAndSignModal } from '@/features/signatures';
import SuratJalanPreview from '../components/SuratJalanPreview';

const SHIPMENT_SIGN_CONFIRMATION_TEXT = 'Sudah di cek dan tambahkan tanda tangan saya';

// Label kolom Status di "Daftar Pengiriman" SENGAJA beda istilah dari nama status
// database (`shipments.status`, tidak diubah): shipped ("barang sudah keluar gudang,
// dalam perjalanan") ditampilkan "Di Proses" bukan "Terkirim" — "Terkirim" dipakai
// untuk delivered ("barang sudah sampai ke penerima"), lebih sesuai arti kata
// sehari-hari yang diminta user (17 Agu 2026).
const statusLabels: Record<string, string> = { draft: 'Draft', shipped: 'Di Proses', delivered: 'Terkirim', cancelled: 'Batal' };
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
  lot_quantity_on_hand: number | null;
  so_line_qty_ordered: number | null;
  so_line_qty_shipped: number | null;
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
  dispatch_photo_url: string | null;
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
  const [currentUser, setCurrentUser] = useState<{ name: string | null; role: string | null; signature_url: string | null } | null>(null);
  const [companyInfo, setCompanyInfo] = useState<{ name: string; logo_url: string | null } | null>(null);

  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [soError, setSoError] = useState('');
  const [soLoading, setSoLoading] = useState(true);

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipmentsError, setShipmentsError] = useState('');
  const [shipmentsLoading, setShipmentsLoading] = useState(true);

  const [creatingForSoId, setCreatingForSoId] = useState<number | null>(null);
  const [createStep, setCreateStep] = useState<'form' | 'preview'>('form');
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

  const [detailShipmentId, setDetailShipmentId] = useState<number | null>(null);
  const [statusActionState, setStatusActionState] = useState<Record<number, 'idle' | 'saving'>>({});
  const [statusMessage, setStatusMessage] = useState<Record<number, { text: string; error: boolean }>>({});

  const [dispatchingShipmentId, setDispatchingShipmentId] = useState<number | null>(null);
  const [dispatchPhotoFile, setDispatchPhotoFile] = useState<File | null>(null);
  const [dispatchPhotoPreviewUrl, setDispatchPhotoPreviewUrl] = useState<string | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [dispatchError, setDispatchError] = useState('');

  // Object URL foto preview di modal "Proses Pengiriman" — dibuat/direvoke di sini
  // (bukan dipanggil langsung di JSX) supaya tidak membuat URL baru tiap render dan
  // tidak membocorkan memori saat file diganti/modal ditutup.
  useEffect(() => {
    if (!dispatchPhotoFile) {
      setDispatchPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(dispatchPhotoFile);
    setDispatchPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [dispatchPhotoFile]);

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
      setCurrentUser({ name: meData.user?.name ?? null, role: meData.user?.role ?? null, signature_url: meData.user?.signature_url ?? null });
      if (meData.company) setCompanyInfo({ name: meData.company.name, logo_url: meData.company.logo_url ?? null });
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
      setCreateStep('form');
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
    setCreateStep('form');
    setLotsByItemId({});
    setLotsLoaded(false);
    setLineInputs({});
  };

  // Baris valid (qty + lot terisi) untuk SO yang sedang dibuatkan pengiriman — dipakai
  // BERSAMA oleh Langkah 1 ("Lanjut") dan submit final Langkah 2, supaya validasinya
  // konsisten satu sumber, bukan diduplikasi beda-beda di 2 tempat.
  const computeValidLines = (so: SalesOrder) =>
    so.lines
      .filter((line) => line.qty_remaining_to_ship > 0)
      .map((line) => {
        const input = lineInputs[line.sales_order_line_id];
        return { sales_order_line_id: line.sales_order_line_id, item_id: line.item_id, qty_shipped: Number(input?.qty_shipped), lot_id: Number(input?.lot_id) };
      })
      .filter((line) => Number.isFinite(line.qty_shipped) && line.qty_shipped > 0 && line.lot_id > 0);

  // Langkah 1 -> Langkah 2 — MURNI validasi lokal, TIDAK ADA panggilan API sama sekali
  // di sini (sesuai kriteria: menutup wizard sebelum submit final = nol data tercatat,
  // trivial dipenuhi karena memang belum ada request apa pun sampai titik ini).
  const handleGoToPreview = (so: SalesOrder) => {
    if (!deliveryAddress.trim()) {
      setCreateStatus('error');
      setCreateMessage('Alamat tujuan wajib diisi.');
      return;
    }
    if (computeValidLines(so).length === 0) {
      setCreateStatus('error');
      setCreateMessage('Isi jumlah dan pilih lot untuk minimal 1 baris item.');
      return;
    }
    setCreateStatus('idle');
    setCreateMessage('');
    setCreateStep('preview');
  };

  // Dipanggil ConfirmAndSignModal (Langkah 2) HANYA setelah checkbox dicentang & tombol
  // "Buat Pengiriman" diklik. shipments + shipment_lines + document_signatures ditulis
  // dalam 1 transaksi lewat RPC create_shipment_with_signature() (migration 20260817180000)
  // — status SELALU tetap 'draft', stok TIDAK berkurang di sini. Melempar (throw) kalau
  // gagal -> ConfirmAndSignModal menangkap & menampilkan pesannya, modal TIDAK tertutup.
  const handleFinalSubmit = async (so: SalesOrder) => {
    const lines = computeValidLines(so);
    const { ok, body } = await authedFetch('/api/shipments', {
      method: 'POST',
      body: JSON.stringify({
        sales_order_id: so.sales_order_id,
        delivery_address: deliveryAddress.trim(),
        recipient_name: recipientName.trim() || null,
        recipient_phone: recipientPhone.trim() || null,
        vehicle_number: vehicleNumber.trim() || null,
        driver_name: driverName.trim() || null,
        confirmation_text: SHIPMENT_SIGN_CONFIRMATION_TEXT,
        lines
      })
    });
    if (!ok) {
      throw new Error(body.error || 'Gagal membuat pengiriman.');
    }
    setCreateStatus('success');
    setCreateMessage(`Pengiriman ${body.shipment_number} dibuat & ditandatangani (status draft) — belum mengurangi stok sampai ditandai "Dikirim".`);
    closeCreateForm();
    await Promise.all([loadSalesOrders(), loadShipments()]);
  };

  const handleTransition = async (shipment: Shipment, targetStatus: 'delivered') => {
    setStatusActionState((prev) => ({ ...prev, [shipment.shipment_id]: 'saving' }));
    setStatusMessage((prev) => ({ ...prev, [shipment.shipment_id]: { text: '', error: false } }));
    const { ok, body } = await authedFetch('/api/shipments/status', { method: 'PATCH', body: JSON.stringify({ shipment_id: shipment.shipment_id, status: targetStatus }) });
    setStatusActionState((prev) => ({ ...prev, [shipment.shipment_id]: 'idle' }));
    if (!ok) {
      setStatusMessage((prev) => ({ ...prev, [shipment.shipment_id]: { text: body.error || 'Gagal mengubah status.', error: true } }));
      return;
    }
    setStatusMessage((prev) => ({ ...prev, [shipment.shipment_id]: { text: 'Ditandai diterima.', error: false } }));
    await Promise.all([loadSalesOrders(), loadShipments()]);
  };

  // "Proses Pengiriman" (draft->shipped) — WAJIB foto bukti pengiriman, lihat
  // processShipmentDispatch.ts. FormData, TIDAK lewat authedFetch (helper itu selalu
  // set Content-Type: application/json yang akan merusak boundary multipart).
  const openDispatchModal = (shipmentId: number) => {
    setDetailShipmentId(null);
    setDispatchingShipmentId(shipmentId);
    setDispatchPhotoFile(null);
    setDispatchStatus('idle');
    setDispatchError('');
  };

  const closeDispatchModal = () => {
    setDispatchingShipmentId(null);
    setDispatchPhotoFile(null);
    setDispatchStatus('idle');
    setDispatchError('');
  };

  const handleDispatchSubmit = async () => {
    if (!dispatchingShipmentId || !dispatchPhotoFile) return;
    setDispatchStatus('uploading');
    setDispatchError('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setDispatchStatus('error');
      setDispatchError('Sesi tidak valid.');
      return;
    }

    const formData = new FormData();
    formData.append('shipment_id', String(dispatchingShipmentId));
    formData.append('photo', dispatchPhotoFile);

    const response = await fetch('/api/shipments/dispatch', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: formData });
    const body = await response.json();

    if (!response.ok) {
      setDispatchStatus('error');
      setDispatchError(body.error || 'Gagal memproses pengiriman.');
      return;
    }

    setStatusMessage((prev) => ({ ...prev, [dispatchingShipmentId]: { text: 'Sedang diproses — stok telah berkurang.', error: false } }));
    closeDispatchModal();
    await Promise.all([loadSalesOrders(), loadShipments()]);
  };

  const soColumns = useMemo<ColumnDef<SalesOrder>[]>(
    () => [
      { id: 'so_number', header: 'No. SO', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.so_number}</span> },
      { id: 'customer', header: 'Client', cell: ({ row }) => row.original.customer_name ?? '-' },
      { id: 'plant', header: 'Lokasi', cell: ({ row }) => row.original.production_plant_name ?? '-' },
      {
        id: 'remaining',
        header: () => (
          <span className="flex items-center gap-1">
            Sisa Qty Belum Terkirim
            <ProvenanceInfoButton
              label="Sisa Qty Belum Terkirim"
              envelope={{
                formula: 'qty_ordered (baris Sales Order) − qty_shipped (total sudah dikirim lewat surat jalan berstatus terkirim/diterima). Dihitung server-side per baris SO, bukan diperkirakan.',
                inputs: [{ label: 'Sumber', value: 'listSalesOrders / listShipments' }]
              }}
            />
          </span>
        ),
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
          return (
            <Button size="sm" variant="outline" onClick={() => setDetailShipmentId((current) => (current === shipment.shipment_id ? null : shipment.shipment_id))}>
              {detailShipmentId === shipment.shipment_id ? 'Tutup' : 'Detail'}
            </Button>
          );
        }
      }
    ],
    [detailShipmentId]
  );

  // Panel detail per baris (pola Carbon "Expandable Data Table") — tampil LANGSUNG di
  // bawah baris terkait di "Daftar Pengiriman" saat tombol "Detail" diklik, berisi semua
  // informasi hasil "Buat Pengiriman" + aksi lanjutan (lihat/cetak Surat Jalan, proses
  // pengiriman/tandai diterima) di 1 tempat, bukan modal terpisah.
  const renderShipmentDetail = (shipment: Shipment) => {
    const saving = statusActionState[shipment.shipment_id] === 'saving';
    return (
      <div className="flex flex-col gap-4 text-sm">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">No. Sales Order:</span> <span className="font-medium text-foreground">{shipment.so_number}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Client:</span> <span className="font-medium text-foreground">{shipment.customer_name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tanggal:</span> <span className="font-medium text-foreground">{new Date(shipment.shipment_date).toLocaleDateString('id-ID')}</span>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <span className="text-muted-foreground">Alamat Tujuan:</span> <span className="font-medium text-foreground">{shipment.delivery_address}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Penerima:</span> {shipment.recipient_name || '-'} {shipment.recipient_phone ? `(${shipment.recipient_phone})` : ''}
          </div>
          <div>
            <span className="text-muted-foreground">Kendaraan:</span> {shipment.vehicle_number || '-'}
          </div>
          <div>
            <span className="text-muted-foreground">Sopir:</span> {shipment.driver_name || '-'}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border bg-background">
          <table className="w-full text-data">
            <thead>
              <tr className="border-b">
                <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</th>
                <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Qty Dikirim</th>
                <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Lot</th>
                {shipment.status !== 'draft' ? (
                  <>
                    <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Stok Lot Saat Ini</th>
                    <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Sudah Dikirim (SO ini)</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {shipment.lines.map((line) => (
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
                  {shipment.status !== 'draft' ? (
                    <>
                      <td className="px-3 py-1.5">
                        {line.lot_quantity_on_hand ?? '-'} {line.item_base_uom}
                      </td>
                      <td className="px-3 py-1.5">
                        {line.so_line_qty_shipped ?? '-'} / {line.so_line_qty_ordered ?? '-'} {line.item_base_uom}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {shipment.status !== 'draft' && shipment.dispatch_photo_url ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Foto Bukti Pengiriman</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shipment.dispatch_photo_url} alt="Foto bukti pengiriman" className="h-40 w-fit rounded-md border object-contain" />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/shipments/${shipment.shipment_id}/surat-jalan`} target="_blank" rel="noopener noreferrer">
              Lihat / Cetak Surat Jalan
            </Link>
          </Button>
          {shipment.status === 'draft' ? <Button size="sm" onClick={() => openDispatchModal(shipment.shipment_id)}>Proses Pengiriman</Button> : null}
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
  };

  const creatingForSo = salesOrders.find((so) => so.sales_order_id === creatingForSoId) ?? null;
  const dispatchingShipment = shipments.find((s) => s.shipment_id === dispatchingShipmentId) ?? null;

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
              <Dialog open={createStep === 'form'} onOpenChange={(open) => (!open ? closeCreateForm() : undefined)}>
                <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>
                    Buat Pengiriman — {creatingForSo.so_number} ({creatingForSo.customer_name})
                  </DialogTitle>
                  <DialogDescription>Langkah 1 dari 2 — isi baris item &amp; detail pengiriman, lalu lanjut ke preview Surat Jalan.</DialogDescription>
                </DialogHeader>
                <div className="flex max-h-[65vh] flex-col gap-6 overflow-y-auto pr-1">
                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detail Sales Order</h3>
                    <div className="rounded-md border p-3 text-sm">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div>
                          <span className="text-muted-foreground">No. SO:</span> <span className="font-medium text-foreground">{creatingForSo.so_number}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Client:</span> <span className="font-medium text-foreground">{creatingForSo.customer_name}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Lokasi Produksi:</span> <span className="font-medium text-foreground">{creatingForSo.production_plant_name}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-col gap-1 border-t pt-2">
                        {creatingForSo.lines.map((line) => (
                          <div key={line.sales_order_line_id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                            <span className="text-muted-foreground">
                              {line.item_code} — {line.item_name}
                            </span>
                            <span>
                              Sudah dikirim <span className="font-medium text-foreground">{line.qty_shipped}</span> / {line.qty_ordered} {line.item_base_uom}
                              {line.qty_remaining_to_ship > 0 ? (
                                <span className="text-muted-foreground"> (sisa {line.qty_remaining_to_ship})</span>
                              ) : (
                                <span className="text-success-subtle-foreground"> (selesai)</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Produk</h3>
                    <div className="flex flex-col gap-4">
                      {creatingForSo.lines
                        .filter((line) => line.qty_remaining_to_ship > 0)
                        .map((line) => (
                          <div key={line.sales_order_line_id} className="flex flex-col gap-2 rounded-md border p-3">
                            <div className="text-sm">
                              <span className="font-medium text-foreground">{line.item_code}</span> <span className="text-muted-foreground">{line.item_name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                (Sisa: <span className="font-medium text-foreground">{line.qty_remaining_to_ship}</span> {line.item_base_uom})
                              </span>
                            </div>
                            <div className="grid grid-cols-[3fr_1fr] gap-3">
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
                            </div>
                          </div>
                        ))}
                    </div>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detail Pengiriman</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
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
                  </section>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <Button onClick={() => handleGoToPreview(creatingForSo)}>Lanjut</Button>
                  <Button variant="outline" onClick={closeCreateForm}>
                    Batal
                  </Button>
                </div>
                {createMessage ? <p className={`mt-2 text-sm ${createStatus === 'error' ? 'text-destructive' : 'text-success-subtle-foreground'}`}>{createMessage}</p> : null}
                </DialogContent>
              </Dialog>
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
            {shipmentsLoading ? (
              <p className="text-sm text-muted-foreground">Memuat pengiriman...</p>
            ) : (
              <DataTable
                columns={shipmentColumns}
                data={shipments}
                emptyMessage="Belum ada pengiriman tercatat."
                getRowId={(s) => String(s.shipment_id)}
                expandedRowId={detailShipmentId !== null ? String(detailShipmentId) : null}
                renderExpandedRow={renderShipmentDetail}
                searchPlaceholder="Cari No. Surat Jalan atau client..."
                getSearchText={(s) => `${s.shipment_number} ${s.customer_name ?? ''} ${s.so_number ?? ''}`}
                paginated
                pageSize={15}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Langkah 2 wizard — preview Surat Jalan draft + tanda tangan. Dibangun MURNI dari
          state form lokal (belum ada shipment nyata sampai submit final berhasil). */}
      {creatingForSo ? (
        <ConfirmAndSignModal
          open={createStep === 'preview'}
          onOpenChange={(open) => {
            if (!open) setCreateStep('form');
          }}
          title="Preview Surat Jalan & Tanda Tangan"
          confirmationText={SHIPMENT_SIGN_CONFIRMATION_TEXT}
          cancelLabel="Kembali"
          confirmLabel="Buat Pengiriman"
          onConfirm={() => handleFinalSubmit(creatingForSo)}
        >
          <SuratJalanPreview
            companyName={companyInfo?.name ?? 'Perusahaan Anda'}
            companyLogoUrl={companyInfo?.logo_url ?? null}
            shipmentNumber={null}
            shipmentDate={new Date().toISOString()}
            soNumber={creatingForSo.so_number}
            customerName={creatingForSo.customer_name ?? '-'}
            deliveryAddress={deliveryAddress || '-'}
            recipientName={recipientName || null}
            vehicleNumber={vehicleNumber || null}
            driverName={driverName || null}
            signerName={currentUser?.name ?? null}
            signerRole={currentUser?.role ?? null}
            lines={computeValidLines(creatingForSo).map((line) => {
              const soLine = creatingForSo.lines.find((l) => l.sales_order_line_id === line.sales_order_line_id);
              const lot = (lotsByItemId[line.item_id] ?? []).find((l) => l.lot_id === line.lot_id);
              return {
                itemCode: soLine?.item_code ?? null,
                itemName: soLine?.item_name ?? null,
                qty: line.qty_shipped,
                uom: soLine?.item_base_uom ?? null,
                lotNumber: lot?.lot_number ?? String(line.lot_id)
              };
            })}
          />
          <p className="mt-3 text-xs text-muted-foreground">Status pengiriman ini akan tetap &quot;Draft&quot; setelah dibuat — stok baru berkurang saat &quot;Proses Pengiriman&quot; dilakukan (di Daftar Pengiriman) secara terpisah.</p>
        </ConfirmAndSignModal>
      ) : null}

      {/* "Proses Pengiriman" (draft->shipped) — WAJIB upload foto bukti pengiriman
          (migration 20260817190000) sebelum stok berkurang. Terpisah dari panel detail
          (renderShipmentDetail) karena ini aksi entri data, bukan sekadar tampilan. */}
      {dispatchingShipment ? (
        <Dialog open onOpenChange={(open) => (!open ? closeDispatchModal() : undefined)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Proses Pengiriman — {dispatchingShipment.shipment_number}</DialogTitle>
              <DialogDescription>Upload foto bukti barang dimuat/dikirim. Stok akan berkurang setelah diproses.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Foto Pengiriman (wajib)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setDispatchPhotoFile(event.target.files?.[0] ?? null)}
                  className="text-sm text-foreground file:mr-3 file:h-8 file:rounded-none file:border-0 file:bg-[#0f62fe] file:px-3 file:text-xs file:font-medium file:text-white hover:file:bg-[#0043ce]"
                />
                <span className="text-xs text-muted-foreground">PNG, JPG, atau WEBP, maksimal 5MB.</span>
              </label>
              {dispatchPhotoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dispatchPhotoPreviewUrl} alt="Preview foto pengiriman" className="h-40 w-fit rounded-md border object-contain" />
              ) : null}
              {dispatchError ? <p className="text-sm text-destructive">{dispatchError}</p> : null}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button disabled={!dispatchPhotoFile || dispatchStatus === 'uploading'} onClick={handleDispatchSubmit}>
                {dispatchStatus === 'uploading' ? 'Memproses...' : 'Proses (Kurangi Stok)'}
              </Button>
              <Button variant="outline" onClick={closeDispatchModal}>
                Batal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </main>
  );
}
