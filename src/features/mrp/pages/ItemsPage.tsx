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
import { FieldLabel } from '@/components/ui/field-help';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { canViewFinancialData, isCompanyLeadership } from '@/lib/roles';
import { itemTypes, typeLabels, typeBadgeVariant } from '../itemTypeLabels';
import { formatCurrency, formatNumberId } from '@/lib/currency';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';

type Item = {
  item_id: number;
  item_code: string;
  name: string;
  type: string;
  base_uom: string;
  purchase_uom: string;
  uom_conversion_factor: number;
  shelf_life_days: number | null;
  min_stock_level: number;
  reorder_point: number | null;
  reorder_qty: number | null;
  is_active: boolean;
  standard_cost: number | null;
  bpom_registration_number: string | null;
  halal_certificate_number: string | null;
};

// MST-15 / B.1 — POLA KONVERSI UMUM.
//
// Keluhan pemilik produk: "Faktor Konversi" cuma kolom angka kosong, dan orang yang
// mengisinya harus tahu sendiri bahwa 1 kg = 1000 gram HARUS ditulis sebagai 1000.
// Salah arah (menulis 0,001) tidak ketahuan sampai angka biaya ikut salah.
//
// Daftar ini SENGAJA pendek dan berisi satuan yang benar-benar dipakai PT Indo Taste
// hari ini, bukan tabel konversi universal. Kolom angkanya tetap ada dan tetap bisa
// diisi bebas -- pola ini jalan pintas, bukan pembatas.
const POLA_KONVERSI: { dari: string; ke: string; faktor: number }[] = [
  { dari: 'kg', ke: 'g', faktor: 1000 },
  { dari: 'ton', ke: 'kg', faktor: 1000 },
  { dari: 'liter', ke: 'ml', faktor: 1000 },
  { dari: 'dus', ke: 'pcs', faktor: 12 },
  { dari: 'roll', ke: 'pcs', faktor: 1 },
  { dari: 'sama', ke: 'sama', faktor: 1 }
];

// MST-17 — HANYA tiga jenis ini yang bisa dilampirkan ke item, sesuai permintaan
// pemilik produk. Bukan daftar dokumen perusahaan secara umum (SOP, kontrak, surat
// jalan punya tempatnya sendiri di modul Dokumen).
//
// `requiresExpiry` mencerminkan sifat dokumennya, bukan aturan karangan: sertifikat
// halal dan izin BPOM punya masa berlaku dan harus diperbarui; COA melekat pada satu
// batch bahan dan tidak kedaluwarsa dengan cara yang sama.
const DOC_TYPE_ITEM: { code: string; label: string; requiresExpiry: boolean }[] = [
  { code: 'COA', label: 'COA (Certificate of Analysis)', requiresExpiry: false },
  { code: 'SERTIFIKAT_HALAL', label: 'Sertifikat Halal', requiresExpiry: true },
  { code: 'BPOM', label: 'Izin Edar BPOM', requiresExpiry: true }
];

type ItemDocument = {
  document_id: number;
  doc_type: string;
  title: string;
  doc_number: string | null;
  expiry_date: string | null;
  uploaded_at: string;
  size_bytes: number;
};

const emptyForm = {
  item_code: '',
  name: '',
  type: itemTypes[0],
  base_uom: '',
  purchase_uom: '',
  uom_conversion_factor: '1',
  shelf_life_days: '',
  min_stock_level: '0',
  reorder_point: '',
  reorder_qty: '',
  standard_cost: '',
  bpom_registration_number: '',
  halal_certificate_number: '',
  is_active: true
};

export default function ItemsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [canViewCost, setCanViewCost] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [itemsError, setItemsError] = useState('');
  const [itemsLoading, setItemsLoading] = useState(true);

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formStatus, setFormStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [formMessage, setFormMessage] = useState('');
  // FASE 3 (Carbon "DataTable with toolbar") — form tambah/edit item pindah dari Card
  // inline ke modal, dipicu tombol toolbar ("Tambah Item") ATAU tombol "Edit" per baris.
  // Field, validasi, handleSubmit TIDAK diubah, cuma wadahnya.
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  // Alur 1 (3.4) — "supplier yang memasok ini", PINTU MASUK KEDUA ke tabel yang
  // sama dengan layar Supplier (supplier_item_prices). Item TETAP dipilih dari
  // master di layar Supplier; di sini arahnya kebalikan (pilih SUPPLIER untuk
  // item yang sedang dilihat).
  const [suppliersForPicker, setSuppliersForPicker] = useState<{ supplier_id: number; name: string }[]>([]);
  const [expandedItemPricesId, setExpandedItemPricesId] = useState<number | null>(null);
  // Pesan hasil aksi di panel Detail (hapus/nonaktifkan). Sengaja TIDAK memakai alert()
  // browser: jawabannya bisa panjang (menyebut di mana saja item ini terpakai) dan perlu
  // tetap terbaca sambil pengguna melihat datanya.
  const [itemActionMessage, setItemActionMessage] = useState<{ kind: 'error' | 'success'; message: string } | null>(null);

  // MST-17 — dokumen yang menempel pada item (COA, Sertifikat Halal, BPOM).
  // KETIGANYA OPSIONAL: item tetap sah tanpa dokumen apa pun.
  const [itemDocs, setItemDocs] = useState<ItemDocument[]>([]);
  const [itemDocsLoading, setItemDocsLoading] = useState(false);
  const [docForm, setDocForm] = useState({ doc_type: 'COA', title: '', doc_number: '', expiry_date: '' });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docStatus, setDocStatus] = useState<'idle' | 'uploading'>('idle');
  const [docMessage, setDocMessage] = useState<{ kind: 'error' | 'success'; message: string } | null>(null);
  const [itemPrices, setItemPrices] = useState<
    { supplier_item_price_id: number; supplier_id: number; supplier_name: string | null; reference_price: number | null; price_valid_from: string | null; lead_time_days_override: number | null }[]
  >([]);
  const [itemPricesLoading, setItemPricesLoading] = useState(false);
  const [newSupplierPriceForm, setNewSupplierPriceForm] = useState({ supplier_id: '', reference_price: '', price_valid_from: '' });
  const [supplierPriceFormMessage, setSupplierPriceFormMessage] = useState('');

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

  const loadItemDocs = useCallback(
    async (itemId: number) => {
      setItemDocsLoading(true);
      const { ok, body } = await authedFetch(`/api/documents?entity_type=items&entity_id=${itemId}`);
      setItemDocs(ok ? body.documents || [] : []);
      setItemDocsLoading(false);
    },
    [authedFetch]
  );

  const handleUploadItemDoc = async (item: Item) => {
    if (!docFile) {
      setDocMessage({ kind: 'error', message: 'Pilih berkas dokumennya dulu.' });
      return;
    }
    const jenis = DOC_TYPE_ITEM.find((d) => d.code === docForm.doc_type);
    if (jenis?.requiresExpiry && !docForm.expiry_date) {
      setDocMessage({ kind: 'error', message: `Tanggal berlaku sampai wajib diisi untuk ${jenis.label}.` });
      return;
    }
    setDocStatus('uploading');
    setDocMessage(null);
    const fd = new FormData();
    fd.append('file', docFile);
    fd.append('doc_type', docForm.doc_type);
    // Judul boleh dikosongkan pengguna -- diisikan otomatis dari jenis + nama item,
    // supaya orang tidak dipaksa mengarang judul untuk sesuatu yang sudah jelas.
    fd.append('title', docForm.title.trim() || `${jenis?.label ?? docForm.doc_type} — ${item.name}`);
    if (docForm.doc_number.trim()) fd.append('doc_number', docForm.doc_number.trim());
    if (docForm.expiry_date) fd.append('expiry_date', docForm.expiry_date);
    // Penghubung ke item memakai document_links yang SUDAH ADA -- bukan kolom baru.
    fd.append('entity_type', 'items');
    fd.append('entity_id', String(item.item_id));
    fd.append('link_role', docForm.doc_type);

    const accessToken = await getAccessToken();
    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: fd
    });
    const body = await response.json();
    setDocStatus('idle');
    if (!response.ok) {
      setDocMessage({ kind: 'error', message: body.error || 'Gagal mengunggah dokumen.' });
      return;
    }
    setDocMessage({ kind: 'success', message: 'Dokumen tersimpan.' });
    setDocForm({ doc_type: 'COA', title: '', doc_number: '', expiry_date: '' });
    setDocFile(null);
    await loadItemDocs(item.item_id);
  };

  const bukaDokumen = async (documentId: number) => {
    const { ok, body } = await authedFetch(`/api/documents/${documentId}/signed-url`);
    if (ok && body.signedUrl) window.open(body.signedUrl, '_blank', 'noopener');
    else setDocMessage({ kind: 'error', message: body.error || 'Gagal membuka dokumen.' });
  };

  const loadItems = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    setItemsLoading(true);
    const response = await fetch('/api/items', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();

    if (!response.ok) {
      setItemsError(data.error || 'Gagal memuat daftar item.');
      setItemsLoading(false);
      return;
    }

    setItems(data.items || []);
    setItemsError('');
    setItemsLoading(false);
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
        router.replace('/login?redirectTo=/items');
        return;
      }

      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const meData = await meResponse.json();

      if (!meResponse.ok) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }

      setCanManage(isCompanyLeadership(meData?.user?.role));
      setCanViewCost(canViewFinancialData(meData?.user?.role));
      setCheckingAccess(false);
      const { ok: suppliersOk, body: suppliersBody } = await authedFetch('/api/suppliers');
      if (suppliersOk) setSuppliersForPicker(suppliersBody.suppliers || []);
      await loadItems();
    };

    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadItems]);

  const loadItemPrices = useCallback(
    async (itemId: number) => {
      setItemPricesLoading(true);
      const { ok, body } = await authedFetch(`/api/supplier-item-prices?item_id=${itemId}`);
      if (ok) setItemPrices(body.prices || []);
      setItemPricesLoading(false);
    },
    [authedFetch]
  );

  const toggleItemDetail = async (item: Item) => {
    if (expandedItemPricesId === item.item_id) {
      setExpandedItemPricesId(null);
      return;
    }
    setExpandedItemPricesId(item.item_id);
    setNewSupplierPriceForm({ supplier_id: '', reference_price: '', price_valid_from: '' });
    setSupplierPriceFormMessage('');
    setItemActionMessage(null);
    setDocMessage(null);
    setDocForm({ doc_type: 'COA', title: '', doc_number: '', expiry_date: '' });
    setDocFile(null);
    await loadItemDocs(item.item_id);
    // Daftar pemasok hanya berarti untuk bahan yang memang dibeli. Untuk produk jadi
    // dan WIP, bagian itu tidak ditampilkan sama sekali (lihat renderItemDetail).
    if (item.type === 'raw_material' || item.type === 'packaging') {
      await loadItemPrices(item.item_id);
    }
  };

  const handleDeleteItem = async (item: Item) => {
    // Konfirmasi menyebut NAMA item-nya. Konfirmasi yang cuma bertanya "yakin hapus?"
    // tidak membantu orang yang salah menekan baris.
    const confirmed = window.confirm(
      `Hapus "${item.name}" (${item.item_code ?? 'tanpa kode'})?\n\n` +
        'Bila item ini sudah dipakai di BOM, lot, atau dokumen pembelian, item TIDAK akan dihapus ' +
        'melainkan dinonaktifkan, supaya riwayatnya tetap utuh.'
    );
    if (!confirmed) return;
    setItemActionMessage(null);
    const { ok, body } = await authedFetch(`/api/items/${item.item_id}`, { method: 'DELETE' });
    if (!ok) {
      setItemActionMessage({ kind: 'error', message: body.error || 'Gagal menghapus item.' });
      return;
    }
    setItemActionMessage({ kind: 'success', message: String(body.message ?? 'Berhasil.') });
    if (body.action === 'dihapus') setExpandedItemPricesId(null);
    await loadItems();
  };

  const handleAddItemSupplierPrice = async () => {
    if (!newSupplierPriceForm.supplier_id || expandedItemPricesId === null) {
      setSupplierPriceFormMessage('Supplier wajib dipilih.');
      return;
    }
    const { ok, body } = await authedFetch('/api/supplier-item-prices', {
      method: 'POST',
      body: JSON.stringify({
        supplier_id: Number(newSupplierPriceForm.supplier_id),
        item_id: expandedItemPricesId,
        reference_price: newSupplierPriceForm.reference_price || null,
        price_valid_from: newSupplierPriceForm.price_valid_from || null
      })
    });
    if (!ok) {
      setSupplierPriceFormMessage(body.error || 'Gagal menyimpan.');
      return;
    }
    setNewSupplierPriceForm({ supplier_id: '', reference_price: '', price_valid_from: '' });
    setSupplierPriceFormMessage('');
    await loadItemPrices(expandedItemPricesId);
  };

  const handleDeleteItemSupplierPrice = async (priceId: number) => {
    if (expandedItemPricesId === null) return;
    const confirmed = window.confirm('Hapus supplier ini dari daftar pemasok bahan ini?');
    if (!confirmed) return;
    const { ok } = await authedFetch(`/api/supplier-item-prices/${priceId}`, { method: 'DELETE' });
    if (ok) await loadItemPrices(expandedItemPricesId);
  };

  const resetForm = () => {
    setEditingItemId(null);
    setForm(emptyForm);
    setFormStatus('idle');
    setFormMessage('');
  };

  const startEdit = (item: Item) => {
    setIsFormModalOpen(true);
    setEditingItemId(item.item_id);
    setForm({
      item_code: item.item_code,
      name: item.name,
      type: item.type,
      base_uom: item.base_uom,
      purchase_uom: item.purchase_uom,
      uom_conversion_factor: String(item.uom_conversion_factor ?? 1),
      shelf_life_days: item.shelf_life_days === null ? '' : String(item.shelf_life_days),
      min_stock_level: String(item.min_stock_level),
      reorder_point: item.reorder_point === null ? '' : String(item.reorder_point),
      reorder_qty: item.reorder_qty === null ? '' : String(item.reorder_qty),
      standard_cost: item.standard_cost === null ? '' : String(item.standard_cost),
      bpom_registration_number: item.bpom_registration_number ?? '',
      halal_certificate_number: item.halal_certificate_number ?? '',
      is_active: item.is_active
    });
    setFormStatus('idle');
    setFormMessage('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormStatus('pending');
    setFormMessage('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setFormStatus('error');
      setFormMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }

    const payload = {
      ...(editingItemId ? { item_id: editingItemId } : {}),
      item_code: form.item_code,
      name: form.name,
      type: form.type,
      base_uom: form.base_uom,
      purchase_uom: form.purchase_uom,
      uom_conversion_factor: form.uom_conversion_factor,
      shelf_life_days: form.shelf_life_days,
      min_stock_level: form.min_stock_level,
      reorder_point: form.reorder_point,
      reorder_qty: form.reorder_qty,
      standard_cost: form.standard_cost,
      bpom_registration_number: form.bpom_registration_number,
      halal_certificate_number: form.halal_certificate_number,
      is_active: form.is_active
    };

    const response = await fetch('/api/items', {
      method: editingItemId ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      setFormStatus('error');
      setFormMessage(data.error || 'Gagal menyimpan item.');
      return;
    }

    setFormStatus('success');
    setFormMessage(editingItemId ? 'Item berhasil diperbarui.' : 'Item baru berhasil ditambahkan.');
    resetForm();
    setIsFormModalOpen(false);
    await loadItems();
  };

  const columns = useMemo<ColumnDef<Item>[]>(() => {
    const baseColumns: ColumnDef<Item>[] = [
      {
        accessorKey: 'item_code',
        header: 'Kode',
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.item_code}</span>
      },
      { accessorKey: 'name', header: 'Nama' },
      {
        accessorKey: 'type',
        header: 'Tipe',
        cell: ({ row }) => (
          <Badge variant={typeBadgeVariant[row.original.type] ?? 'secondary'}>
            {typeLabels[row.original.type] ?? row.original.type}
          </Badge>
        )
      },
      { accessorKey: 'base_uom', header: 'Satuan Dasar' },
      { accessorKey: 'purchase_uom', header: 'Satuan Beli' },
      {
        accessorKey: 'min_stock_level',
        header: 'Min Stock',
        cell: ({ row }) => <span className="text-data">{formatNumberId(row.original.min_stock_level, 2)}</span>
      }
    ];

    // standard_cost adalah data finansial (lihat "Kontrol Akses Data Finansial") —
    // kolomnya cuma dirender sama sekali untuk role yang berhak, bukan cuma
    // ditampilkan kosong. API sendiri sudah mengembalikan null untuk role lain,
    // ini lapisan tambahan supaya kolomnya tidak nongol sama sekali di tabel.
    if (canViewCost) {
      baseColumns.push({
        accessorKey: 'standard_cost',
        header: () => (
          <span className="flex items-center gap-1">
            Biaya Standar
            <ProvenanceInfoButton
              label="Biaya Standar Item"
              envelope={{
                formula: 'Nilai input manual di form Item — tidak dihitung dari komponen/BOM apa pun. Dipakai sebagai harga master pada perhitungan biaya BOM, Margin Watch, dan Kelayakan Jadwal di seluruh sistem.',
                inputs: [{ label: 'Cara isi/ubah', value: 'Form edit Item → field Biaya Standar' }]
              }}
            />
          </span>
        ),
        cell: ({ row }) => <span className="text-data">{formatCurrency(row.original.standard_cost)}</span>
      });
    }

    baseColumns.push(
      {
        accessorKey: 'is_active',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? 'success' : 'critical'}>
            {row.original.is_active ? 'Aktif' : 'Nonaktif'}
          </Badge>
        )
      },
      {
        id: 'actions',
        header: 'Aksi',
        // MST-16 — SATU pintu masuk: "Detail". Sebelumnya kolom ini memuat "Edit" dan
        // "Pemasok" berdampingan, dan "Pemasok" cuma muncul untuk sebagian tipe item
        // sehingga barisnya tampak berbeda-beda tanpa alasan yang terbaca pengguna.
        // Semua aksi (Ubah, Tambah Pemasok, Hapus) sekarang hidup DI DALAM Detail.
        //
        // HAPUS SENGAJA TIDAK ADA DI TABEL. Tombol hapus yang berjejer rapat di daftar
        // panjang terlalu mudah tertekan pada baris yang salah — apalagi di layar sentuh.
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => toggleItemDetail(row.original)}>
            {expandedItemPricesId === row.original.item_id ? 'Tutup' : 'Detail'}
          </Button>
        )
      }
    );

    return baseColumns;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, canViewCost, expandedItemPricesId]);

  const detailRows = (item: Item): { label: string; nilai: React.ReactNode }[] => {
    const atau = (v: string | null | undefined) => (v && String(v).trim() ? String(v) : '—');
    const baris: { label: string; nilai: React.ReactNode }[] = [
      { label: 'Kode Item', nilai: atau(item.item_code) },
      { label: 'Nama', nilai: item.name },
      { label: 'Tipe', nilai: <Badge variant={typeBadgeVariant[item.type]}>{typeLabels[item.type]}</Badge> },
      { label: 'Satuan Dasar/Pakai', nilai: atau(item.base_uom) },
      { label: 'Satuan Beli', nilai: atau(item.purchase_uom) },
      {
        label: 'Faktor Konversi',
        nilai: `1 ${item.purchase_uom || 'satuan beli'} = ${formatNumberId(item.uom_conversion_factor ?? 1)} ${item.base_uom || 'satuan dasar'}`
      },
      { label: 'Shelf Life', nilai: item.shelf_life_days !== null ? `${formatNumberId(item.shelf_life_days)} hari` : '—' },
      { label: 'Min Stock Level', nilai: formatNumberId(item.min_stock_level ?? 0, 2) },
      { label: 'Reorder Point', nilai: item.reorder_point !== null ? formatNumberId(item.reorder_point, 2) : '—' },
      { label: 'Reorder Qty', nilai: item.reorder_qty !== null ? formatNumberId(item.reorder_qty, 2) : '—' }
    ];
    if (canViewCost) {
      baris.push({
        label: 'Biaya Standar',
        nilai: item.standard_cost !== null ? formatCurrency(item.standard_cost, { maxDecimals: 0 }) : '—'
      });
    }
    baris.push(
      { label: 'No. Registrasi BPOM', nilai: atau(item.bpom_registration_number) },
      { label: 'Kode Halal', nilai: atau(item.halal_certificate_number) },
      {
        label: 'Status',
        nilai: <Badge variant={item.is_active ? 'success' : 'critical'}>{item.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
      }
    );
    return baris;
  };

  // MST-16 — panel Detail: SELURUH informasi bahan + aksi Ubah / Tambah Pemasok / Hapus.
  const renderItemDetail = (item: Item) => (
    <div className="flex flex-col gap-5">
      <div>
        <h4 className="pb-2 text-sm font-semibold text-foreground">Detail &quot;{item.name}&quot;</h4>
        <dl className="divide-y border bg-background">
          {detailRows(item).map((baris) => (
            <div key={baris.label} className="grid gap-1 px-4 py-2.5 sm:grid-cols-3 sm:gap-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{baris.label}</dt>
              <dd className="min-w-0 break-words text-data sm:col-span-2">{baris.nilai}</dd>
            </div>
          ))}
        </dl>
      </div>

      {canManage ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
              Ubah
            </Button>
            {/* Hapus ditaruh TERPISAH di kanan, bukan berdempetan dengan Ubah --
                jarak fisik mengurangi salah tekan pada aksi yang paling merusak. */}
            <Button size="sm" variant="destructive" className="sm:ml-auto" onClick={() => handleDeleteItem(item)}>
              Hapus
            </Button>
          </div>
          {itemActionMessage ? (
            <p className={`text-sm ${itemActionMessage.kind === 'error' ? 'text-destructive' : 'text-success'}`}>
              {itemActionMessage.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {renderItemDocuments(item)}

      {item.type === 'raw_material' || item.type === 'packaging' ? renderItemSuppliers(item) : null}
    </div>
  );

  const renderItemDocuments = (item: Item) => (
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="text-sm font-semibold text-foreground">Dokumen</h4>
        {/* Ditulis eksplisit di layar, bukan cuma diketahui di kode: banyak bahan
            memang tidak punya dokumen sendiri, dan tanpa kalimat ini orang akan
            mengira ada yang kurang. */}
        <p className="text-xs text-muted-foreground">
          COA, Sertifikat Halal, dan Izin Edar BPOM. Ketiganya opsional — item tetap sah tanpa dokumen apa pun.
        </p>
      </div>

      {itemDocsLoading ? (
        <p className="text-sm text-muted-foreground">Memuat dokumen...</p>
      ) : itemDocs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada dokumen dilampirkan.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {itemDocs.map((d) => {
            const jenis = DOC_TYPE_ITEM.find((t) => t.code === d.doc_type);
            const kedaluwarsa = d.expiry_date ? new Date(`${d.expiry_date}T00:00:00`) < new Date() : false;
            return (
              <li key={d.document_id} className="flex flex-wrap items-center justify-between gap-2 border bg-background p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {jenis?.label ?? d.doc_type}
                    {d.doc_number ? ` · ${d.doc_number}` : ''}
                    {d.expiry_date ? ` · berlaku sampai ${d.expiry_date}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {kedaluwarsa ? <Badge variant="critical">Kedaluwarsa</Badge> : null}
                  <Button size="sm" variant="outline" onClick={() => bukaDokumen(d.document_id)}>
                    Buka
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <div className="flex flex-col gap-3 border border-dashed p-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lampirkan Dokumen</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <FieldLabel help="Jenis dokumen menentukan apakah tanggal berlakunya wajib diisi. Sertifikat Halal dan Izin Edar BPOM punya masa berlaku; COA melekat pada satu batch bahan dan tidak kedaluwarsa dengan cara yang sama.">
                Jenis Dokumen
              </FieldLabel>
              <Select value={docForm.doc_type} onValueChange={(v) => setDocForm((p) => ({ ...p, doc_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPE_ITEM.map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Nomor Dokumen (opsional)</span>
              <Input value={docForm.doc_number} onChange={(e) => setDocForm((p) => ({ ...p, doc_number: e.target.value }))} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Berlaku Sampai{DOC_TYPE_ITEM.find((t) => t.code === docForm.doc_type)?.requiresExpiry ? '' : ' (opsional)'}
              </span>
              <Input type="date" value={docForm.expiry_date} onChange={(e) => setDocForm((p) => ({ ...p, expiry_date: e.target.value }))} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Berkas</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                className="min-h-11 border border-border bg-background px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              />
              <span className="text-xs text-muted-foreground">PDF, PNG, JPG, WEBP, XLSX, atau DOCX. Maksimal 20 MB.</span>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Judul (opsional)</span>
            <Input value={docForm.title} onChange={(e) => setDocForm((p) => ({ ...p, title: e.target.value }))} />
            <span className="text-xs text-muted-foreground">Bila dikosongkan, judulnya diisi otomatis dari jenis dokumen dan nama item.</span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" disabled={docStatus === 'uploading'} onClick={() => handleUploadItemDoc(item)}>
              {docStatus === 'uploading' ? 'Mengunggah...' : 'Unggah Dokumen'}
            </Button>
            {docMessage ? (
              <span className={`text-sm ${docMessage.kind === 'error' ? 'text-destructive' : 'text-success'}`}>{docMessage.message}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderItemSuppliers = (item: Item) => (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-foreground">Supplier yang Memasok "{item.name}"</h4>
      {itemPricesLoading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : itemPrices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada supplier tercatat untuk bahan ini.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {itemPrices.map((price) => (
            <div key={price.supplier_item_price_id} className="flex items-center justify-between rounded-md border bg-background p-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{price.supplier_name}</p>
                <p className="text-xs text-muted-foreground">
                  Harga acuan — belum ada pembelian nyata: {price.reference_price !== null ? formatCurrency(price.reference_price, { maxDecimals: 0 }) : '-'}
                  {price.price_valid_from ? ` (berlaku sejak ${price.price_valid_from})` : ''}
                </p>
              </div>
              {canManage ? (
                <Button size="sm" variant="destructive" onClick={() => handleDeleteItemSupplierPrice(price.supplier_item_price_id)}>
                  Hapus
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {canManage ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tambah Supplier Pemasok</span>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={newSupplierPriceForm.supplier_id} onValueChange={(v) => setNewSupplierPriceForm((prev) => ({ ...prev, supplier_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih supplier..." />
              </SelectTrigger>
              <SelectContent>
                {suppliersForPicker.map((s) => (
                  <SelectItem key={s.supplier_id} value={String(s.supplier_id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              placeholder="Harga acuan (opsional)"
              value={newSupplierPriceForm.reference_price}
              onChange={(e) => setNewSupplierPriceForm((prev) => ({ ...prev, reference_price: e.target.value }))}
            />
            <Input type="date" value={newSupplierPriceForm.price_valid_from} onChange={(e) => setNewSupplierPriceForm((prev) => ({ ...prev, price_valid_from: e.target.value }))} />
          </div>
          {supplierPriceFormMessage ? <p className="text-xs text-destructive">{supplierPriceFormMessage}</p> : null}
          <Button size="sm" className="w-fit" onClick={handleAddItemSupplierPrice}>
            Tambah
          </Button>
        </div>
      ) : null}
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
              <CardTitle className="text-2xl">Sesi tidak valid</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Silakan login ulang untuk mengakses daftar item.</p>
              <Button onClick={() => router.push('/login?redirectTo=/items')} className="w-fit">
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
            <CardDescription className="uppercase tracking-[0.2em]">Master Data</CardDescription>
            <CardTitle className="text-2xl">Daftar Item</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {itemsError ? <p className="text-sm text-destructive">{itemsError}</p> : null}
            {itemsLoading ? (
              <p className="text-sm text-muted-foreground">Memuat item...</p>
            ) : (
              <DataTable
                columns={columns}
                data={items}
                emptyMessage="Belum ada item."
                searchPlaceholder="Cari kode atau nama item..."
                getSearchText={(item) => `${item.item_code} ${item.name}`}
                paginated
                pageSize={15}
                getRowId={(item) => String(item.item_id)}
                expandedRowId={expandedItemPricesId !== null ? String(expandedItemPricesId) : null}
                renderExpandedRow={renderItemDetail}
                primaryAction={canManage ? { label: 'Tambah Item', onClick: () => { resetForm(); setIsFormModalOpen(true); } } : undefined}
              />
            )}
          </CardContent>
        </Card>

        {canManage ? (
          <Dialog
            open={isFormModalOpen}
            onOpenChange={(open) => {
              if (!open) {
                resetForm();
                setIsFormModalOpen(false);
              }
            }}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingItemId ? `Edit: ${form.item_code}` : 'Tambah item baru'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Kode Item</span>
                  <Input value={form.item_code} onChange={(event) => setForm((prev) => ({ ...prev, item_code: event.target.value }))} required />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Nama Item</span>
                  <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Tipe</span>
                  <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {itemTypes.map((typeOption) => (
                        <SelectItem key={typeOption} value={typeOption}>
                          {typeLabels[typeOption]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <FieldLabel help="Satuan yang dipakai saat bahan ini DIPAKAI di produksi dan dicatat stoknya. Biasanya satuan terkecil, mis. gram untuk bahan yang ditimbang.">
                    Satuan Dasar/Pakai
                  </FieldLabel>
                  <Input
                    value={form.base_uom}
                    onChange={(event) => setForm((prev) => ({ ...prev, base_uom: event.target.value }))}
                    required
                  />
                  <span className="text-xs text-muted-foreground">Contoh: g, ml, pcs.</span>
                </label>

                <label className="flex flex-col gap-1.5">
                  <FieldLabel help="Satuan yang tertulis di dokumen pembelian dari supplier. Boleh berbeda dari satuan pakai — selisihnya diisi di Faktor Konversi.">
                    Satuan Beli
                  </FieldLabel>
                  <Input
                    value={form.purchase_uom}
                    onChange={(event) => setForm((prev) => ({ ...prev, purchase_uom: event.target.value }))}
                    required
                  />
                  <span className="text-xs text-muted-foreground">Contoh: kg, liter, dus.</span>
                </label>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <FieldLabel help="Berapa banyak satuan dasar yang didapat dari SATU satuan beli. Contoh: beli per kg, pakai per gram → isi 1000, karena 1 kg berisi 1000 g. Kalau satuan beli dan satuan pakai sama (mis. beli pcs, pakai pcs), isi 1.">
                    Faktor Konversi (satuan beli → satuan dasar)
                  </FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={form.uom_conversion_factor}
                    onChange={(event) => setForm((prev) => ({ ...prev, uom_conversion_factor: event.target.value }))}
                    required
                  />
                  <div className="flex flex-wrap gap-2">
                    {POLA_KONVERSI.map((pola) => (
                      <button
                        key={`${pola.dari}-${pola.ke}-${pola.faktor}`}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, uom_conversion_factor: String(pola.faktor) }))}
                        className="min-h-11 border border-border px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted focus:outline-none focus:outline-2 focus:outline-ring"
                      >
                        {pola.dari === 'sama' ? 'Satuannya sama (1)' : `1 ${pola.dari} = ${formatNumberId(pola.faktor)} ${pola.ke}`}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Pilih pola yang cocok untuk mengisi cepat, atau ketik angkanya sendiri di atas.
                  </span>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Shelf Life (hari)</span>
                  <Input
                    type="number"
                    min="0"
                    value={form.shelf_life_days}
                    onChange={(event) => setForm((prev) => ({ ...prev, shelf_life_days: event.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Min Stock Level</span>
                  <Input
                    type="number"
                    min="0"
                    value={form.min_stock_level}
                    onChange={(event) => setForm((prev) => ({ ...prev, min_stock_level: event.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Reorder Point</span>
                  <Input
                    type="number"
                    min="0"
                    value={form.reorder_point}
                    onChange={(event) => setForm((prev) => ({ ...prev, reorder_point: event.target.value }))}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Reorder Qty</span>
                  <Input
                    type="number"
                    min="0"
                    value={form.reorder_qty}
                    onChange={(event) => setForm((prev) => ({ ...prev, reorder_qty: event.target.value }))}
                  />
                </label>

                {canViewCost ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Biaya Standar</span>
                    <Input
                      type="number"
                      min="0"
                      value={form.standard_cost}
                      onChange={(event) => setForm((prev) => ({ ...prev, standard_cost: event.target.value }))}
                    />
                  </label>
                ) : null}

                <label className="flex flex-col gap-1.5">
                  <FieldLabel help="Nomor izin edar dari BPOM untuk item ini. Boleh dikosongkan bila item ini belum/tidak punya izin edar sendiri, misalnya bahan baku.">
                    No. Registrasi BPOM
                  </FieldLabel>
                  <Input
                    value={form.bpom_registration_number}
                    onChange={(event) => setForm((prev) => ({ ...prev, bpom_registration_number: event.target.value }))}
                  />
                  <span className="text-xs text-muted-foreground">Contoh: BPOM RI MD 023733999101561.</span>
                </label>

                <label className="flex flex-col gap-1.5">
                  <FieldLabel help="Nomor sertifikat halal item ini. Diminta bersama nomor BPOM saat pengurusan izin, jadi disimpan berdampingan. Boleh dikosongkan — banyak bahan baku tidak punya sertifikat halal sendiri.">
                    Kode Halal
                  </FieldLabel>
                  <Input
                    value={form.halal_certificate_number}
                    onChange={(event) => setForm((prev) => ({ ...prev, halal_certificate_number: event.target.value }))}
                  />
                </label>

                <label className="flex items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <span className="text-sm font-medium text-foreground">Aktif</span>
                </label>

                <div className="flex items-center gap-3 sm:col-span-2">
                  <Button type="submit" disabled={formStatus === 'pending'}>
                    {formStatus === 'pending' ? 'Menyimpan...' : editingItemId ? 'Simpan Perubahan' : 'Tambah Item'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setIsFormModalOpen(false);
                    }}
                  >
                    Batal
                  </Button>
                </div>

                {formMessage ? (
                  <p className={`sm:col-span-2 text-sm ${formStatus === 'success' ? 'text-success-subtle-foreground' : 'text-destructive'}`}>
                    {formMessage}
                  </p>
                ) : null}
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </main>
  );
}
