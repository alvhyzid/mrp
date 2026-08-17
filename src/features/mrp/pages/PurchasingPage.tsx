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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { canManagePurchasing } from '@/lib/roles';

type Supplier = { supplier_id: number; name: string; contact_info: string | null; lead_time_days: number | null; supplier_type: string };
type Plant = { production_plant_id: number; name: string };
type ItemOption = { item_id: number; item_code: string | null; name: string; purchase_uom: string; type: string };
type PoLine = { purchase_order_line_id: number; item_code: string | null; item_name: string | null; purchase_uom: string | null; qty_ordered: number; qty_received: number; unit_price: number | null };
type PurchaseOrder = { purchase_order_id: number; supplier_name: string | null; production_plant_name: string | null; status: string; status_label: string; order_date: string; expected_date: string | null; lines: PoLine[] };

type FormLine = { item_id: string; qty_ordered: string; unit_price: string };
const emptyFormLine: FormLine = { item_id: '', qty_ordered: '', unit_price: '' };
const emptyPoForm = { supplier_id: '', production_plant_id: '', expected_date: '', lines: [{ ...emptyFormLine }] as FormLine[] };
const emptySupplierForm = { name: '', contact_info: '', lead_time_days: '', supplier_type: 'material_supplier' };

const supplierTypeLabels: Record<string, string> = { material_supplier: 'Pemasok Bahan', subcontractor: 'Subkontraktor', both: 'Keduanya' };
const poStatusVariant: Record<string, 'info' | 'warning' | 'success' | 'secondary' | 'critical'> = {
  draft: 'secondary',
  ordered: 'info',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'critical'
};

export default function PurchasingPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poLoading, setPoLoading] = useState(true);
  const [poError, setPoError] = useState('');

  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [supplierFormStatus, setSupplierFormStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [supplierFormMessage, setSupplierFormMessage] = useState('');

  const [poForm, setPoForm] = useState(emptyPoForm);
  const [poFormStatus, setPoFormStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [poFormMessage, setPoFormMessage] = useState('');

  // FASE 3 (Carbon "DataTable with toolbar") — form "Tambah Supplier"/"Buat PO"
  // pindah dari section inline di bawah tabel ke modal, dipicu tombol toolbar.
  // Field, validasi, handleCreateSupplier/handleCreatePo TIDAK diubah, cuma wadahnya.
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [expandedPoId, setExpandedPoId] = useState<number | null>(null);

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

  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    const { ok, body } = await authedFetch('/api/suppliers');
    if (ok) setSuppliers(body.suppliers || []);
    setSuppliersLoading(false);
  }, [authedFetch]);

  const loadPurchaseOrders = useCallback(async () => {
    setPoLoading(true);
    const { ok, body } = await authedFetch('/api/purchase-orders');
    if (!ok) {
      setPoError(body.error || 'Gagal memuat Purchase Order.');
      setPoLoading(false);
      return;
    }
    setPurchaseOrders(body.purchaseOrders || []);
    setPoError('');
    setPoLoading(false);
  }, [authedFetch]);

  const loadPlantsAndItems = useCallback(async () => {
    const [plantsRes, itemsRes] = await Promise.all([authedFetch('/api/production-plants'), authedFetch('/api/items')]);
    if (plantsRes.ok) setPlants(plantsRes.body.plants || []);
    if (itemsRes.ok) setItems((itemsRes.body.items || []).filter((i: ItemOption) => i.type === 'raw_material' || i.type === 'packaging'));
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
        router.replace('/login?redirectTo=/purchasing');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      setRole(meData?.user?.role ?? null);
      setCheckingAccess(false);
      await Promise.all([loadSuppliers(), loadPurchaseOrders(), loadPlantsAndItems()]);
    };
    checkAccessAndLoad();
  }, [router, loadSuppliers, loadPurchaseOrders, loadPlantsAndItems]);

  const handleCreateSupplier = async () => {
    if (!supplierForm.name.trim()) {
      setSupplierFormStatus('error');
      setSupplierFormMessage('Nama supplier wajib diisi.');
      return;
    }
    setSupplierFormStatus('saving');
    setSupplierFormMessage('');
    const { ok, body } = await authedFetch('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify({
        name: supplierForm.name,
        contact_info: supplierForm.contact_info || null,
        lead_time_days: supplierForm.lead_time_days || null,
        supplier_type: supplierForm.supplier_type
      })
    });
    if (!ok) {
      setSupplierFormStatus('error');
      setSupplierFormMessage(body.error || 'Gagal menyimpan supplier.');
      return;
    }
    setSupplierFormStatus('success');
    setSupplierFormMessage('Supplier baru berhasil ditambahkan.');
    setSupplierForm(emptySupplierForm);
    setIsSupplierModalOpen(false);
    await loadSuppliers();
  };

  const addPoLine = () => setPoForm((prev) => ({ ...prev, lines: [...prev.lines, { ...emptyFormLine }] }));
  const removePoLine = (index: number) => setPoForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  const updatePoLine = (index: number, field: keyof FormLine, value: string) =>
    setPoForm((prev) => ({ ...prev, lines: prev.lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)) }));

  const handleCreatePo = async () => {
    if (!poForm.supplier_id || !poForm.production_plant_id) {
      setPoFormStatus('error');
      setPoFormMessage('Supplier dan lokasi pabrik wajib dipilih.');
      return;
    }
    const linesPayload = poForm.lines
      .filter((l) => l.item_id && l.qty_ordered)
      .map((l) => ({ item_id: Number(l.item_id), qty_ordered: Number(l.qty_ordered), unit_price: l.unit_price === '' ? null : Number(l.unit_price) }));
    if (linesPayload.length === 0) {
      setPoFormStatus('error');
      setPoFormMessage('Minimal 1 baris item dengan jumlah pesan wajib diisi.');
      return;
    }
    setPoFormStatus('saving');
    setPoFormMessage('');
    const { ok, body } = await authedFetch('/api/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        supplier_id: Number(poForm.supplier_id),
        production_plant_id: Number(poForm.production_plant_id),
        expected_date: poForm.expected_date || null,
        lines: linesPayload
      })
    });
    if (!ok) {
      setPoFormStatus('error');
      setPoFormMessage(body.error || 'Gagal membuat PO.');
      return;
    }
    setPoFormStatus('success');
    setPoFormMessage(`PO baru berhasil dibuat (ID ${body.purchase_order_id}).`);
    setPoForm(emptyPoForm);
    setIsPoModalOpen(false);
    await loadPurchaseOrders();
  };

  const supplierColumns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      { id: 'name', header: 'Nama', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
      { id: 'contact_info', header: 'Kontak', cell: ({ row }) => row.original.contact_info ?? '-' },
      { id: 'lead_time', header: 'Lead Time', cell: ({ row }) => (row.original.lead_time_days !== null ? `${row.original.lead_time_days} hari` : '-') },
      { id: 'type', header: 'Jenis', cell: ({ row }) => supplierTypeLabels[row.original.supplier_type] ?? row.original.supplier_type }
    ],
    []
  );

  const poColumns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      { id: 'po_number', header: 'No. PO', cell: ({ row }) => <span className="font-medium text-foreground">PO-{String(row.original.purchase_order_id).padStart(4, '0')}</span> },
      { id: 'supplier', header: 'Supplier', cell: ({ row }) => row.original.supplier_name ?? '-' },
      { id: 'plant', header: 'Lokasi', cell: ({ row }) => row.original.production_plant_name ?? '-' },
      { id: 'status', header: 'Status', cell: ({ row }) => <Badge variant={poStatusVariant[row.original.status] ?? 'secondary'}>{row.original.status_label}</Badge> },
      { id: 'order_date', header: 'Tanggal Pesan', cell: ({ row }) => row.original.order_date },
      { id: 'expected_date', header: 'Perkiraan Datang', cell: ({ row }) => row.original.expected_date ?? '-' },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => setExpandedPoId((current) => (current === row.original.purchase_order_id ? null : row.original.purchase_order_id))}>
            {expandedPoId === row.original.purchase_order_id ? 'Tutup' : 'Detail'}
          </Button>
        )
      }
    ],
    [expandedPoId]
  );

  const renderPoDetail = (po: PurchaseOrder) => (
    <div className="overflow-x-auto rounded-md border bg-background">
      <table className="w-full text-data">
        <thead>
          <tr className="border-b">
            <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</th>
            <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Dipesan</th>
            <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Diterima</th>
            {po.lines.some((l) => l.unit_price !== null) ? <th className="h-8 px-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Harga Satuan</th> : null}
          </tr>
        </thead>
        <tbody>
          {po.lines.map((line) => (
            <tr key={line.purchase_order_line_id} className="border-b last:border-0">
              <td className="px-3 py-1.5">{line.item_code ?? line.item_name}</td>
              <td className="px-3 py-1.5">
                {line.qty_ordered} {line.purchase_uom}
              </td>
              <td className="px-3 py-1.5">
                {line.qty_received} {line.purchase_uom}
              </td>
              {po.lines.some((l) => l.unit_price !== null) ? <td className="px-3 py-1.5">{line.unit_price !== null ? line.unit_price.toLocaleString('id-ID') : '-'}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
              <CardTitle className="text-2xl">Purchasing</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Sesi tidak valid — silakan login ulang.</p>
              <Button onClick={() => router.push('/login')} className="w-fit">
                Ke Halaman Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const canManage = canManagePurchasing(role);

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="flex w-full flex-col gap-6 px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Master Data</p>
          <h1 className="text-2xl font-semibold text-foreground">Purchasing — PO ke Supplier</h1>
        </div>

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Master Data</CardDescription>
            <CardTitle className="text-xl">Supplier</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {suppliersLoading ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : (
              <DataTable
                columns={supplierColumns}
                data={suppliers}
                emptyMessage="Belum ada supplier."
                searchPlaceholder="Cari nama supplier..."
                getSearchText={(s) => s.name}
                primaryAction={canManage ? { label: 'Tambah Supplier', onClick: () => setIsSupplierModalOpen(true) } : undefined}
              />
            )}
          </CardContent>
        </Card>

        {canManage ? (
          <Dialog open={isSupplierModalOpen} onOpenChange={setIsSupplierModalOpen}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Tambah Supplier Baru</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Nama supplier" value={supplierForm.name} onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))} />
                <Input placeholder="Kontak (opsional)" value={supplierForm.contact_info} onChange={(e) => setSupplierForm((prev) => ({ ...prev, contact_info: e.target.value }))} />
                <Input type="number" min={0} placeholder="Lead time (hari)" value={supplierForm.lead_time_days} onChange={(e) => setSupplierForm((prev) => ({ ...prev, lead_time_days: e.target.value }))} />
                <Select value={supplierForm.supplier_type} onValueChange={(v) => setSupplierForm((prev) => ({ ...prev, supplier_type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material_supplier">Pemasok Bahan</SelectItem>
                    <SelectItem value="subcontractor">Subkontraktor</SelectItem>
                    <SelectItem value="both">Keduanya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {supplierFormMessage ? <p className={`text-sm ${supplierFormStatus === 'error' ? 'text-destructive' : 'text-success'}`}>{supplierFormMessage}</p> : null}
              <div className="flex items-center gap-3">
                <Button disabled={supplierFormStatus === 'saving'} onClick={handleCreateSupplier}>
                  {supplierFormStatus === 'saving' ? 'Menyimpan...' : 'Tambah Supplier'}
                </Button>
                <Button variant="outline" onClick={() => setIsSupplierModalOpen(false)}>
                  Batal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}

        <Card>
          <CardHeader>
            <CardDescription className="uppercase tracking-[0.2em]">Purchasing</CardDescription>
            <CardTitle className="text-xl">Purchase Order ke Supplier</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {poError ? <p className="text-sm text-destructive">{poError}</p> : null}
            {poLoading ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : (
              <DataTable
                columns={poColumns}
                data={purchaseOrders}
                emptyMessage="Belum ada PO ke supplier."
                searchPlaceholder="Cari No. PO atau supplier..."
                getSearchText={(po) => `PO-${String(po.purchase_order_id).padStart(4, '0')} ${po.supplier_name ?? ''}`}
                paginated
                pageSize={15}
                getRowId={(po) => String(po.purchase_order_id)}
                expandedRowId={expandedPoId !== null ? String(expandedPoId) : null}
                renderExpandedRow={renderPoDetail}
                primaryAction={canManage ? { label: 'Buat PO', onClick: () => setIsPoModalOpen(true) } : undefined}
              />
            )}
          </CardContent>
        </Card>

        {canManage ? (
          <Dialog open={isPoModalOpen} onOpenChange={setIsPoModalOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Buat PO Baru</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Supplier</label>
                  <Select value={poForm.supplier_id} onValueChange={(v) => setPoForm((prev) => ({ ...prev, supplier_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.supplier_id} value={String(s.supplier_id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Lokasi Pabrik (Alamat Kirim)</label>
                  <Select value={poForm.production_plant_id} onValueChange={(v) => setPoForm((prev) => ({ ...prev, production_plant_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih lokasi..." />
                    </SelectTrigger>
                    <SelectContent>
                      {plants.map((p) => (
                        <SelectItem key={p.production_plant_id} value={String(p.production_plant_id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Perkiraan Tanggal Datang (opsional)</label>
                  <Input type="date" value={poForm.expected_date} onChange={(e) => setPoForm((prev) => ({ ...prev, expected_date: e.target.value }))} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Baris Item</p>
                <Button size="sm" variant="outline" onClick={addPoLine}>
                  + Tambah Baris
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {poForm.lines.map((line, index) => {
                  const selectedItem = items.find((i) => String(i.item_id) === line.item_id);
                  return (
                    <div key={index} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-end gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Item</label>
                        <Select value={line.item_id} onValueChange={(v) => updatePoLine(index, 'item_id', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih item..." />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((i) => (
                              <SelectItem key={i.item_id} value={String(i.item_id)}>
                                {i.item_code} — {i.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Jumlah Pesan ({selectedItem?.purchase_uom ?? 'satuan beli'})</label>
                        <Input type="number" min={0} step="any" value={line.qty_ordered} onChange={(e) => updatePoLine(index, 'qty_ordered', e.target.value)} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Harga Satuan (opsional)</label>
                        <Input type="number" min={0} step="any" value={line.unit_price} onChange={(e) => updatePoLine(index, 'unit_price', e.target.value)} />
                      </div>
                      <div className="text-xs text-muted-foreground">{selectedItem?.purchase_uom ?? ''}</div>
                      <Button size="sm" variant="destructive" disabled={poForm.lines.length === 1} onClick={() => removePoLine(index)}>
                        Hapus
                      </Button>
                    </div>
                  );
                })}
              </div>

              {poFormMessage ? <p className={`text-sm ${poFormStatus === 'error' ? 'text-destructive' : 'text-success'}`}>{poFormMessage}</p> : null}
              <div className="flex items-center gap-3">
                <Button disabled={poFormStatus === 'saving'} onClick={handleCreatePo}>
                  {poFormStatus === 'saving' ? 'Menyimpan...' : 'Buat PO'}
                </Button>
                <Button variant="outline" onClick={() => setIsPoModalOpen(false)}>
                  Batal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </main>
  );
}
