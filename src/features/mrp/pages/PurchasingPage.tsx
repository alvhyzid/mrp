'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatNumberId } from '@/lib/currency';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { canManagePurchasing } from '@/lib/roles';

type Supplier = {
  supplier_id: number;
  name: string;
  contact_info: string | null;
  lead_time_days: number | null;
  supplier_type: string;
  address: string | null;
  npwp: string | null;
  pic_name: string | null;
  pic_phone: string | null;
  pic_email: string | null;
  payment_terms: string | null;
  archived_at: string | null;
  archived_by_name: string | null;
  purchase_order_count: number;
  supplied_item_count: number;
  can_delete: boolean;
};
type Plant = { production_plant_id: number; name: string; is_active: boolean };
type ItemOption = { item_id: number; item_code: string | null; name: string; purchase_uom: string; type: string };
type PoLine = { purchase_order_line_id: number; item_code: string | null; item_name: string | null; purchase_uom: string | null; qty_ordered: number; qty_received: number; unit_price: number | null };
type PurchaseOrder = { purchase_order_id: number; supplier_name: string | null; identity_predates_snapshot: boolean; production_plant_name: string | null; status: string; status_label: string; order_date: string; expected_date: string | null; lines: PoLine[] };
type SupplierItemPrice = {
  supplier_item_price_id: number;
  supplier_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  supplier_item_code: string | null;
  supplier_item_name: string | null;
  reference_price: number | null;
  price_valid_from: string | null;
  min_order_qty: number | null;
  min_order_uom: string | null;
  lead_time_days_override: number | null;
  notes: string | null;
};

type FormLine = { item_id: string; qty_ordered: string; unit_price: string };
const emptyFormLine: FormLine = { item_id: '', qty_ordered: '', unit_price: '' };
const emptyPoForm = { supplier_id: '', production_plant_id: '', expected_date: '', lines: [{ ...emptyFormLine }] as FormLine[] };
const emptySupplierForm = {
  name: '',
  contact_info: '',
  lead_time_days: '',
  supplier_type: 'material_supplier',
  address: '',
  npwp: '',
  pic_name: '',
  pic_phone: '',
  pic_email: '',
  payment_terms: ''
};
const emptySupplierPriceForm = {
  item_id: '',
  supplier_item_code: '',
  supplier_item_name: '',
  reference_price: '',
  price_valid_from: '',
  min_order_qty: '',
  min_order_uom: '',
  lead_time_days_override: '',
  notes: ''
};

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
  const canManage = canManagePurchasing(role);

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
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [showArchivedSuppliers, setShowArchivedSuppliers] = useState(false);
  const [supplierActionMessage, setSupplierActionMessage] = useState<{ supplierId: number; message: string; kind: 'error' | 'success' } | null>(null);

  // Alur 1 (3.4) — "bahan yang dipasok", pintu masuk dari layar Supplier.
  const [expandedSupplierId, setExpandedSupplierId] = useState<number | null>(null);
  const [supplierPrices, setSupplierPrices] = useState<SupplierItemPrice[]>([]);
  const [supplierPricesLoading, setSupplierPricesLoading] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [priceForm, setPriceForm] = useState(emptySupplierPriceForm);
  const [priceFormStatus, setPriceFormStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [priceFormMessage, setPriceFormMessage] = useState('');

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

  const loadSuppliers = useCallback(
    async (includeArchived: boolean) => {
      setSuppliersLoading(true);
      const { ok, body } = await authedFetch(`/api/suppliers${includeArchived ? '?includeArchived=true' : ''}`);
      if (ok) setSuppliers(body.suppliers || []);
      setSuppliersLoading(false);
    },
    [authedFetch]
  );

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
      await Promise.all([loadSuppliers(showArchivedSuppliers), loadPurchaseOrders(), loadPlantsAndItems()]);
    };
    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadPurchaseOrders, loadPlantsAndItems]);

  const isFirstArchivedFilterRender = useRef(true);
  useEffect(() => {
    if (isFirstArchivedFilterRender.current) {
      isFirstArchivedFilterRender.current = false;
      return;
    }
    loadSuppliers(showArchivedSuppliers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchivedSuppliers]);

  const resetSupplierForm = () => {
    setEditingSupplierId(null);
    setSupplierForm(emptySupplierForm);
  };

  const startCreateSupplier = () => {
    resetSupplierForm();
    setSupplierFormStatus('idle');
    setSupplierFormMessage('');
    setIsSupplierModalOpen(true);
  };

  const startEditSupplier = (supplier: Supplier) => {
    setEditingSupplierId(supplier.supplier_id);
    setSupplierForm({
      name: supplier.name,
      contact_info: supplier.contact_info ?? '',
      lead_time_days: supplier.lead_time_days === null ? '' : String(supplier.lead_time_days),
      supplier_type: supplier.supplier_type,
      address: supplier.address ?? '',
      npwp: supplier.npwp ?? '',
      pic_name: supplier.pic_name ?? '',
      pic_phone: supplier.pic_phone ?? '',
      pic_email: supplier.pic_email ?? '',
      payment_terms: supplier.payment_terms ?? ''
    });
    setSupplierFormStatus('idle');
    setSupplierFormMessage('');
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) {
      setSupplierFormStatus('error');
      setSupplierFormMessage('Nama supplier wajib diisi.');
      return;
    }
    setSupplierFormStatus('saving');
    setSupplierFormMessage('');
    const payload = {
      name: supplierForm.name,
      contact_info: supplierForm.contact_info || null,
      lead_time_days: supplierForm.lead_time_days || null,
      supplier_type: supplierForm.supplier_type,
      address: supplierForm.address || null,
      npwp: supplierForm.npwp || null,
      pic_name: supplierForm.pic_name || null,
      pic_phone: supplierForm.pic_phone || null,
      pic_email: supplierForm.pic_email || null,
      payment_terms: supplierForm.payment_terms || null
    };
    const { ok, body } = editingSupplierId
      ? await authedFetch('/api/suppliers', { method: 'PATCH', body: JSON.stringify({ supplier_id: editingSupplierId, ...payload }) })
      : await authedFetch('/api/suppliers', { method: 'POST', body: JSON.stringify(payload) });
    if (!ok) {
      setSupplierFormStatus('error');
      setSupplierFormMessage(body.error || 'Gagal menyimpan supplier.');
      return;
    }
    setSupplierFormStatus('success');
    setSupplierFormMessage(editingSupplierId ? 'Supplier berhasil diperbarui.' : 'Supplier baru berhasil ditambahkan.');
    setEditingSupplierId(null);
    setSupplierForm(emptySupplierForm);
    await loadSuppliers(showArchivedSuppliers);
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    const confirmed = window.confirm(`Hapus permanen supplier "${supplier.name}"? Tindakan ini tidak bisa dibatalkan.`);
    if (!confirmed) return;
    const { ok, body } = await authedFetch(`/api/suppliers/${supplier.supplier_id}`, { method: 'DELETE' });
    if (!ok) {
      setSupplierActionMessage({ supplierId: supplier.supplier_id, message: body.error || 'Gagal menghapus supplier.', kind: 'error' });
      return;
    }
    setSupplierActionMessage(null);
    await loadSuppliers(showArchivedSuppliers);
  };

  const handleArchiveSupplier = async (supplier: Supplier) => {
    const { ok, body } = await authedFetch(`/api/suppliers/${supplier.supplier_id}/archive`, { method: 'POST' });
    if (!ok) {
      setSupplierActionMessage({ supplierId: supplier.supplier_id, message: body.error || 'Gagal mengarsipkan supplier.', kind: 'error' });
      return;
    }
    setSupplierActionMessage({ supplierId: supplier.supplier_id, message: 'Supplier berhasil diarsipkan.', kind: 'success' });
    await loadSuppliers(showArchivedSuppliers);
  };

  const handleRestoreSupplier = async (supplier: Supplier) => {
    const { ok, body } = await authedFetch(`/api/suppliers/${supplier.supplier_id}/restore`, { method: 'POST' });
    if (!ok) {
      setSupplierActionMessage({ supplierId: supplier.supplier_id, message: body.error || 'Gagal memulihkan supplier.', kind: 'error' });
      return;
    }
    setSupplierActionMessage({ supplierId: supplier.supplier_id, message: 'Supplier berhasil dipulihkan.', kind: 'success' });
    await loadSuppliers(showArchivedSuppliers);
  };

  const loadSupplierPrices = useCallback(
    async (supplierId: number) => {
      setSupplierPricesLoading(true);
      const { ok, body } = await authedFetch(`/api/supplier-item-prices?supplier_id=${supplierId}`);
      if (ok) setSupplierPrices(body.prices || []);
      setSupplierPricesLoading(false);
    },
    [authedFetch]
  );

  const toggleSupplierDetail = async (supplier: Supplier) => {
    if (expandedSupplierId === supplier.supplier_id) {
      setExpandedSupplierId(null);
      return;
    }
    setExpandedSupplierId(supplier.supplier_id);
    await loadSupplierPrices(supplier.supplier_id);
  };

  const startAddPrice = () => {
    setEditingPriceId(null);
    setPriceForm(emptySupplierPriceForm);
    setPriceFormStatus('idle');
    setPriceFormMessage('');
    setIsPriceModalOpen(true);
  };

  const startEditPrice = (price: SupplierItemPrice) => {
    setEditingPriceId(price.supplier_item_price_id);
    setPriceForm({
      item_id: String(price.item_id),
      supplier_item_code: price.supplier_item_code ?? '',
      supplier_item_name: price.supplier_item_name ?? '',
      reference_price: price.reference_price === null ? '' : String(price.reference_price),
      price_valid_from: price.price_valid_from ?? '',
      min_order_qty: price.min_order_qty === null ? '' : String(price.min_order_qty),
      min_order_uom: price.min_order_uom ?? '',
      lead_time_days_override: price.lead_time_days_override === null ? '' : String(price.lead_time_days_override),
      notes: price.notes ?? ''
    });
    setPriceFormStatus('idle');
    setPriceFormMessage('');
    setIsPriceModalOpen(true);
  };

  const handleSavePrice = async () => {
    if (!priceForm.item_id) {
      setPriceFormStatus('error');
      setPriceFormMessage('Bahan wajib dipilih dari daftar item.');
      return;
    }
    if (expandedSupplierId === null) return;
    setPriceFormStatus('saving');
    setPriceFormMessage('');
    const { ok, body } = await authedFetch('/api/supplier-item-prices', {
      method: 'POST',
      body: JSON.stringify({
        supplier_id: expandedSupplierId,
        item_id: Number(priceForm.item_id),
        supplier_item_code: priceForm.supplier_item_code || null,
        supplier_item_name: priceForm.supplier_item_name || null,
        reference_price: priceForm.reference_price || null,
        price_valid_from: priceForm.price_valid_from || null,
        min_order_qty: priceForm.min_order_qty || null,
        min_order_uom: priceForm.min_order_uom || null,
        lead_time_days_override: priceForm.lead_time_days_override || null,
        notes: priceForm.notes || null
      })
    });
    if (!ok) {
      setPriceFormStatus('error');
      setPriceFormMessage(body.error || 'Gagal menyimpan bahan yang dipasok.');
      return;
    }
    setPriceFormStatus('success');
    setPriceFormMessage('Bahan yang dipasok berhasil disimpan.');
    setEditingPriceId(null);
    setPriceForm(emptySupplierPriceForm);
    setIsPriceModalOpen(false);
    await loadSupplierPrices(expandedSupplierId);
    await loadSuppliers(showArchivedSuppliers);
  };

  const handleDeletePrice = async (price: SupplierItemPrice) => {
    const confirmed = window.confirm(`Hapus "${price.item_code ?? price.item_name}" dari daftar bahan yang dipasok supplier ini?`);
    if (!confirmed || expandedSupplierId === null) return;
    const { ok } = await authedFetch(`/api/supplier-item-prices/${price.supplier_item_price_id}`, { method: 'DELETE' });
    if (ok) {
      await loadSupplierPrices(expandedSupplierId);
      await loadSuppliers(showArchivedSuppliers);
    }
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
      { id: 'pic', header: 'PIC', cell: ({ row }) => row.original.pic_name ?? '-' },
      { id: 'lead_time', header: 'Lead Time', cell: ({ row }) => (row.original.lead_time_days !== null ? `${formatNumberId(row.original.lead_time_days, 0)} hari` : '-') },
      { id: 'type', header: 'Jenis', cell: ({ row }) => supplierTypeLabels[row.original.supplier_type] ?? row.original.supplier_type },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.archived_at ? (
            <span className="text-data text-xs text-muted-foreground">
              Diarsipkan{row.original.archived_by_name ? ` oleh ${row.original.archived_by_name}` : ''}
            </span>
          ) : (
            <span className="text-data text-success-subtle-foreground">Aktif</span>
          )
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => toggleSupplierDetail(row.original)}>
              {expandedSupplierId === row.original.supplier_id ? 'Tutup' : 'Bahan Dipasok'}
            </Button>
            {canManage && !row.original.archived_at ? (
              <Button size="sm" variant="outline" onClick={() => startEditSupplier(row.original)}>
                Edit
              </Button>
            ) : null}
            {canManage && row.original.archived_at ? (
              <Button size="sm" variant="outline" onClick={() => handleRestoreSupplier(row.original)}>
                Pulihkan
              </Button>
            ) : null}
            {canManage && !row.original.archived_at && row.original.can_delete ? (
              <Button size="sm" variant="destructive" onClick={() => handleDeleteSupplier(row.original)}>
                Hapus
              </Button>
            ) : null}
            {canManage && !row.original.archived_at && !row.original.can_delete ? (
              <Button size="sm" variant="destructive" onClick={() => handleArchiveSupplier(row.original)}>
                Arsipkan
              </Button>
            ) : null}
          </div>
        )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, expandedSupplierId]
  );

  const renderSupplierDetail = (supplier: Supplier) => (
    <div className="flex flex-col gap-3">
      {supplierActionMessage && supplierActionMessage.supplierId === supplier.supplier_id ? (
        <p className={`text-sm ${supplierActionMessage.kind === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>{supplierActionMessage.message}</p>
      ) : null}
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <span>Alamat: {supplier.address ?? '-'}</span>
        <span>NPWP: {supplier.npwp ?? '-'}</span>
        <span>PIC: {supplier.pic_name ?? '-'}{supplier.pic_phone ? ` — ${supplier.pic_phone}` : ''}{supplier.pic_email ? ` — ${supplier.pic_email}` : ''}</span>
        <span>Termin Pembayaran: {supplier.payment_terms ?? '-'}</span>
      </div>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Bahan yang Dipasok</h4>
        {canManage && !supplier.archived_at ? (
          <Button size="sm" onClick={startAddPrice}>
            + Tambah Bahan
          </Button>
        ) : null}
      </div>
      {supplierPricesLoading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : supplierPrices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada bahan yang dipasok tercatat untuk supplier ini.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {supplierPrices.map((price) => (
            <div key={price.supplier_item_price_id} className="rounded-md border bg-background p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {price.item_code} — {price.item_name}
                  </p>
                  {price.supplier_item_code || price.supplier_item_name ? (
                    <p className="text-xs text-muted-foreground">
                      Kode/nama menurut supplier: {price.supplier_item_code ?? '-'} {price.supplier_item_name ? `(${price.supplier_item_name})` : ''}
                    </p>
                  ) : null}
                </div>
                {canManage && !supplier.archived_at ? (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEditPrice(price)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeletePrice(price)}>
                      Hapus
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <span>
                  Harga acuan — belum ada pembelian nyata:{' '}
                  {price.reference_price !== null ? formatCurrency(price.reference_price, { maxDecimals: 0 }) : '-'}
                  {price.price_valid_from ? ` (berlaku sejak ${price.price_valid_from})` : ''}
                </span>
                <span>
                  Minimum Order: {price.min_order_qty !== null ? `${formatNumberId(price.min_order_qty, 2)} ${price.min_order_uom ?? ''}` : '-'}
                </span>
                <span>Lead Time Khusus: {price.lead_time_days_override !== null ? `${price.lead_time_days_override} hari` : '(pakai lead time umum supplier)'}</span>
                {price.notes ? <span>Catatan: {price.notes}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const poColumns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      { id: 'po_number', header: 'No. PO', cell: ({ row }) => <span className="font-medium text-foreground">PO-{String(row.original.purchase_order_id).padStart(4, '0')}</span> },
      {
        id: 'supplier',
        header: 'Supplier',
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span>{row.original.supplier_name ?? '-'}</span>
            {row.original.identity_predates_snapshot ? (
              <span className="text-xs text-muted-foreground">Terbit sebelum pembekuan identitas berlaku</span>
            ) : null}
          </div>
        )
      },
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
                {formatNumberId(line.qty_ordered, 2)} {line.purchase_uom}
              </td>
              <td className="px-3 py-1.5">
                {formatNumberId(line.qty_received, 2)} {line.purchase_uom}
              </td>
              {po.lines.some((l) => l.unit_price !== null) ? <td className="px-3 py-1.5">{formatCurrency(line.unit_price, { maxDecimals: 0 })}</td> : null}
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
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showArchivedSuppliers} onChange={(e) => setShowArchivedSuppliers(e.target.checked)} />
              Tampilkan yang diarsipkan
            </label>
            {suppliersLoading ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : (
              <DataTable
                columns={supplierColumns}
                data={suppliers}
                emptyMessage="Belum ada supplier."
                searchPlaceholder="Cari nama supplier..."
                getSearchText={(s) => s.name}
                getRowId={(s) => String(s.supplier_id)}
                expandedRowId={expandedSupplierId !== null ? String(expandedSupplierId) : null}
                renderExpandedRow={renderSupplierDetail}
                primaryAction={canManage ? { label: 'Tambah Supplier', onClick: startCreateSupplier } : undefined}
              />
            )}
          </CardContent>
        </Card>

        {canManage ? (
          <Dialog
            open={isSupplierModalOpen}
            onOpenChange={(open) => {
              setIsSupplierModalOpen(open);
              if (!open) resetSupplierForm();
            }}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingSupplierId ? `Ubah Supplier — ${supplierForm.name}` : 'Tambah Supplier Baru'}</DialogTitle>
              </DialogHeader>
              <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Nama Supplier</span>
                  <Input placeholder="mis. PT Sumber Bahan Jaya" value={supplierForm.name} onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))} />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Alamat</span>
                  <Input placeholder="Alamat lengkap supplier" value={supplierForm.address} onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))} />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">NPWP</span>
                    <Input placeholder="01.234.567.8-901.000" value={supplierForm.npwp} onChange={(e) => setSupplierForm((prev) => ({ ...prev, npwp: e.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Lead Time Umum (hari)</span>
                    <Input type="number" min={0} placeholder="mis. 7" value={supplierForm.lead_time_days} onChange={(e) => setSupplierForm((prev) => ({ ...prev, lead_time_days: e.target.value }))} />
                  </label>
                </div>
                <span className="-mt-2 text-xs text-muted-foreground">Lead time bisa ditimpa per bahan lewat "Bahan yang Dipasok".</span>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Termin Pembayaran</span>
                  <Input placeholder="mis. 30 hari setelah terima barang" value={supplierForm.payment_terms} onChange={(e) => setSupplierForm((prev) => ({ ...prev, payment_terms: e.target.value }))} />
                </label>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">Kontak Person (PIC)</span>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input placeholder="Nama PIC" value={supplierForm.pic_name} onChange={(e) => setSupplierForm((prev) => ({ ...prev, pic_name: e.target.value }))} />
                    <Input placeholder="Telepon PIC" value={supplierForm.pic_phone} onChange={(e) => setSupplierForm((prev) => ({ ...prev, pic_phone: e.target.value }))} />
                    <Input placeholder="Email PIC" value={supplierForm.pic_email} onChange={(e) => setSupplierForm((prev) => ({ ...prev, pic_email: e.target.value }))} />
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Jenis Supplier</span>
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
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Kontak Lain (opsional)</span>
                  <Input placeholder="Catatan kontak tambahan" value={supplierForm.contact_info} onChange={(e) => setSupplierForm((prev) => ({ ...prev, contact_info: e.target.value }))} />
                </label>
              </div>
              {supplierFormMessage ? <p className={`text-sm ${supplierFormStatus === 'error' ? 'text-destructive' : 'text-success'}`}>{supplierFormMessage}</p> : null}
              <div className="flex items-center gap-3">
                <Button disabled={supplierFormStatus === 'saving'} onClick={handleSaveSupplier}>
                  {supplierFormStatus === 'saving' ? 'Menyimpan...' : editingSupplierId ? 'Simpan Perubahan' : 'Tambah Supplier'}
                </Button>
                <Button variant="outline" onClick={() => setIsSupplierModalOpen(false)}>
                  Batal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}

        {canManage ? (
          <Dialog open={isPriceModalOpen} onOpenChange={setIsPriceModalOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingPriceId ? 'Ubah Bahan yang Dipasok' : 'Tambah Bahan yang Dipasok'}</DialogTitle>
              </DialogHeader>
              <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Bahan</span>
                  <Select value={priceForm.item_id} onValueChange={(v) => setPriceForm((prev) => ({ ...prev, item_id: v }))} disabled={!!editingPriceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih dari daftar item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.item_id} value={String(item.item_id)}>
                          {item.item_code} — {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">Belum ada bahannya di daftar? Buat dulu di layar Item, jangan diketik bebas di sini.</span>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Kode/Nama Menurut Supplier (opsional)</span>
                  <Input
                    placeholder="mis. sebutan/kode barang ini menurut supplier, sering beda dari nama kita"
                    value={priceForm.supplier_item_name}
                    onChange={(e) => setPriceForm((prev) => ({ ...prev, supplier_item_name: e.target.value }))}
                  />
                  <Input
                    placeholder="Kode barang menurut supplier (opsional)"
                    value={priceForm.supplier_item_code}
                    onChange={(e) => setPriceForm((prev) => ({ ...prev, supplier_item_code: e.target.value }))}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Harga Acuan</span>
                    <Input type="number" min={0} placeholder="Perkiraan harga saat ini" value={priceForm.reference_price} onChange={(e) => setPriceForm((prev) => ({ ...prev, reference_price: e.target.value }))} />
                    <span className="text-xs text-muted-foreground">Harga acuan — belum ada pembelian nyata. Bukan HPP.</span>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Berlaku Sejak</span>
                    <Input type="date" value={priceForm.price_valid_from} onChange={(e) => setPriceForm((prev) => ({ ...prev, price_valid_from: e.target.value }))} />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Minimum Order</span>
                    <Input type="number" min={0} placeholder="Jumlah" value={priceForm.min_order_qty} onChange={(e) => setPriceForm((prev) => ({ ...prev, min_order_qty: e.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Satuan Minimum Order</span>
                    <Input placeholder="mis. karung, drum" value={priceForm.min_order_uom} onChange={(e) => setPriceForm((prev) => ({ ...prev, min_order_uom: e.target.value }))} />
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Lead Time Khusus Bahan Ini (hari, opsional)</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Kosongkan untuk pakai lead time umum supplier"
                    value={priceForm.lead_time_days_override}
                    onChange={(e) => setPriceForm((prev) => ({ ...prev, lead_time_days_override: e.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Catatan</span>
                  <Input placeholder="Catatan tambahan (opsional)" value={priceForm.notes} onChange={(e) => setPriceForm((prev) => ({ ...prev, notes: e.target.value }))} />
                </label>
              </div>
              {priceFormMessage ? <p className={`text-sm ${priceFormStatus === 'error' ? 'text-destructive' : 'text-success'}`}>{priceFormMessage}</p> : null}
              <div className="flex items-center gap-3">
                <Button disabled={priceFormStatus === 'saving'} onClick={handleSavePrice}>
                  {priceFormStatus === 'saving' ? 'Menyimpan...' : 'Simpan'}
                </Button>
                <Button variant="outline" onClick={() => setIsPriceModalOpen(false)}>
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
                      {plants
                        .filter((p) => p.is_active)
                        .map((p) => (
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
