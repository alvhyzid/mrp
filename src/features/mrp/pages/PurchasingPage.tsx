'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import {
  Button,
  ComposedModal,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NumberInput,
  Pagination,
  SkeletonText,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandHeader,
  TableExpandRow,
  TableExpandedRow,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  TextInput
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { formatCurrency, formatNumberId } from '@/lib/currency';
import { canManagePurchasing } from '@/lib/roles';
import { AreaNotifikasi, type Notifikasi } from '@/components/ui/notifikasi';

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
/// Warna Tag mengikuti ARTI. "Diterima sebagian" ungu, bukan kuning: itu kemajuan yang
/// normal, bukan peringatan. Hanya "dibatalkan" yang merah.
const poStatusWarnaTag: Record<string, 'gray' | 'blue' | 'purple' | 'green' | 'red'> = {
  draft: 'gray',
  ordered: 'blue',
  partially_received: 'purple',
  received: 'green',
  cancelled: 'red'
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
  // NOTIFIKASI BERSAMA. Aturan proyek: modal untuk MEMUTUSKAN, notifikasi untuk
  // MEMBERI TAHU. Sebelumnya hasil berhasil maupun gagal sama-sama dijejalkan ke satu
  // kotak DI DALAM modal yang judulnya dipaku mati "Gagal" -- sehingga penyimpanan yang
  // BERHASIL terbaca sebagai kegagalan.
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const beriTahu = useCallback((jenis: Notifikasi['jenis'], judul: string, rincian?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setNotifikasi((prev) => [...prev, { id, jenis, judul, rincian }]);
  }, []);
  const tutupNotifikasi = useCallback((id: string) => {
    setNotifikasi((prev) => prev.filter((n) => n.id !== id));
  }, []);

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
  // GALAT TINGKAT FIELD (STANDAR VALIDASI FABRIX §2 golongan A). Sebuah DAFTAR, bukan satu
  // nilai, karena §5.1 mewajibkan seluruh isian yang salah ditandai sekaligus — berhenti di
  // yang pertama memaksa orang menyimpan berulang kali untuk menemukan sisanya.
  const [poFieldError, setPoFieldError] = useState<{ field: string; line?: number; message: string }[]>([]);
  const galatPo = (field: string, line?: number) =>
    poFieldError.find((g) => g.field === field && g.line === line)?.message;

  // FASE 3 (Carbon "DataTable with toolbar") — form "Tambah Supplier"/"Buat PO"
  // pindah dari section inline di bawah tabel ke modal, dipicu tombol toolbar.
  // Field, validasi, handleCreateSupplier/handleCreatePo TIDAK diubah, cuma wadahnya.
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  // PMB-11: modal Supplier punya DUA tahap untuk pembuatan data baru -- 'isian' lalu
  // 'ringkasan' (draf ditampilkan, baru dikonfirmasi). Lihat handleLanjutKeRingkasan.
  const [tahapSupplier, setTahapSupplier] = useState<'isian' | 'ringkasan'>('isian');
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);

  // Pencarian, saringan, dan pembagian halaman: Carbon DataTable tidak membawanya.
  const [cariSupplier, setCariSupplier] = useState('');
  const [saringSupplier, setSaringSupplier] = useState<string>('aktif');
  const [cariPo, setCariPo] = useState('');
  const [saringPo, setSaringPo] = useState<string>('semua');
  const [halamanPo, setHalamanPo] = useState(1);
  const [perHalamanPo, setPerHalamanPo] = useState(15);
  const adaSaringan = cariSupplier.trim() !== '' || saringSupplier !== 'aktif' || cariPo.trim() !== '' || saringPo !== 'semua';
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

  /// Menutup modal supplier DAN mengembalikannya ke tahap isian. Tanpa mengembalikan
  /// tahapnya, modal yang ditutup saat sedang menampilkan ringkasan akan terbuka kembali
  /// langsung di ringkasan draf yang sudah tidak relevan.
  const tutupSupplierModal = () => {
    setIsSupplierModalOpen(false);
    setTahapSupplier('isian');
    resetSupplierForm();
  };

  const resetSupplierForm = () => {
    setTahapSupplier('isian');
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

  // Ringkasan draf yang ditampilkan sebelum menyimpan. Field kosong DITAMPILKAN sebagai
  // "belum diisi", bukan disembunyikan -- supaya pengguna melihat apa yang TIDAK jadi
  // tersimpan, bukan cuma apa yang jadi tersimpan.
  const ringkasanDrafSupplier = useMemo(() => {
    const atau = (v: string) => (v.trim() ? v.trim() : 'belum diisi');
    const pic = [supplierForm.pic_name, supplierForm.pic_phone, supplierForm.pic_email]
      .map((v) => v.trim())
      .filter(Boolean)
      .join(' · ');
    return [
      { label: 'Nama Supplier', nilai: atau(supplierForm.name) },
      { label: 'Jenis Supplier', nilai: supplierTypeLabels[supplierForm.supplier_type] || supplierForm.supplier_type },
      { label: 'Alamat', nilai: atau(supplierForm.address) },
      { label: 'NPWP', nilai: atau(supplierForm.npwp) },
      {
        label: 'Lead Time Umum',
        nilai: supplierForm.lead_time_days.trim() ? `${supplierForm.lead_time_days} hari` : 'belum diisi'
      },
      { label: 'Termin Pembayaran', nilai: atau(supplierForm.payment_terms) },
      { label: 'Kontak Person (PIC)', nilai: pic || 'belum diisi' },
      { label: 'Kontak Lain', nilai: atau(supplierForm.contact_info) }
    ];
  }, [supplierForm]);

  // PMB-11 / aturan modal #4: pembuatan data BARU tidak langsung tersimpan -- pengguna
  // melihat ringkasan draf lebih dulu, lalu mengonfirmasi. Perubahan data yang SUDAH ADA
  // tidak lewat langkah ini: penggunanya sudah melihat nilai lama di form, jadi ringkasan
  // draf cuma menambah satu klik tanpa menambah kejelasan.
  const handleLanjutKeRingkasan = () => {
    if (!supplierForm.name.trim()) {
      setSupplierFormStatus('error');
      setSupplierFormMessage('Nama supplier wajib diisi.');
      return;
    }
    setSupplierFormStatus('idle');
    setSupplierFormMessage('');
    setTahapSupplier('ringkasan');
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
    // BERHASIL: tutup modal, bersihkan pesan, dan laporkan lewat notifikasi.
    // Pesannya WAJIB dibersihkan -- bila ditinggalkan, ia muncul lagi sebagai kotak
    // galat saat modal dibuka berikutnya, untuk penyimpanan yang sudah lama selesai.
    const memperbarui = editingSupplierId !== null;
    setSupplierFormStatus('success');
    setSupplierFormMessage('');
    tutupSupplierModal();
    beriTahu('success', memperbarui ? 'Supplier diperbarui' : 'Supplier baru ditambahkan', supplierForm.name);
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
    setPriceFormMessage('');
    setEditingPriceId(null);
    setPriceForm(emptySupplierPriceForm);
    setIsPriceModalOpen(false);
    beriTahu('success', 'Bahan yang dipasok disimpan');
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
  const removePoLine = (index: number) => {
    // §5.4 — isian yang hilang dari layar wajib membawa galatnya pergi. Galat yatim tidak
    // bisa diperbaiki siapa pun karena kontrolnya sudah tidak ada.
    setPoFieldError([]);
    setPoForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  };
  const updatePoLine = (index: number, field: keyof FormLine, value: string) => {
    // §5.3 — tanda dicabut begitu isiannya diperbaiki. Galat yang menetap setelah dibetulkan
    // melatih orang mengabaikannya.
    setPoFieldError((prev) => prev.filter((g) => !(g.field === field && g.line === index)));
    setPoForm((prev) => ({ ...prev, lines: prev.lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)) }));
  };

  const handleCreatePo = async () => {
    setPoFieldError([]);
    // SEBELUMNYA satu kalimat gabungan "Supplier dan lokasi pabrik wajib dipilih." di dasar
    // modal. Sekarang KEDUANYA ditandai sekaligus di kontrolnya masing-masing (§5.1).
    const kurang: { field: string; line?: number; message: string }[] = [];
    if (!poForm.supplier_id) kurang.push({ field: 'supplier_id', message: 'Supplier wajib dipilih.' });
    if (!poForm.production_plant_id) kurang.push({ field: 'production_plant_id', message: 'Lokasi pabrik (alamat kirim) wajib dipilih.' });
    if (kurang.length > 0) {
      setPoFieldError(kurang);
      setPoFormStatus('idle');
      setPoFormMessage('');
      return;
    }
    // BARIS TERISI SEPARUH sebelumnya DIBUANG DIAM-DIAM oleh filter di bawah: pengguna
    // mengisi item lalu lupa jumlahnya, barisnya hilang dari PO, dan tidak ada yang memberi
    // tahu. Sekarang barisnya ditandai — akar yang sama dengan sisa kelas ini: sistem tahu
    // baris mana, penggunanya tidak diberi tahu.
    const separuh = poForm.lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => (l.item_id && !l.qty_ordered) || (!l.item_id && l.qty_ordered))
      .map(({ l, i }) =>
        l.item_id
          ? { field: 'qty_ordered', line: i, message: 'Jumlah pesan wajib diisi untuk baris ini.' }
          : { field: 'item_id', line: i, message: 'Item wajib dipilih untuk baris ini.' }
      );
    if (separuh.length > 0) {
      setPoFieldError(separuh);
      setPoFormStatus('idle');
      setPoFormMessage('');
      return;
    }
    const linesPayload = poForm.lines
      .filter((l) => l.item_id && l.qty_ordered)
      .map((l) => ({ item_id: Number(l.item_id), qty_ordered: Number(l.qty_ordered), unit_price: l.unit_price === '' ? null : Number(l.unit_price) }));
    if (linesPayload.length === 0) {
      // GOLONGAN B: penggunanya harus MENGISI baris, bukan memperbaiki satu isian yang
      // terlihat salah. Tetap di tingkat formulir, dan itu memang benar.
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
      // §3 — field dibaca sebagai DATA dari jawaban server, TIDAK ditebak dari kalimatnya.
      // Ketiadaan `field` bermakna "bukan golongan A", dan galatnya tetap di tingkat formulir.
      if (typeof body.field === 'string' && body.field) {
        setPoFieldError([{ field: body.field, line: typeof body.line === 'number' ? body.line : undefined, message: String(body.error || 'Isian ini ditolak.') }]);
        setPoFormStatus('idle');
        setPoFormMessage('');
        return;
      }
      setPoFormStatus('error');
      setPoFormMessage(body.error || 'Gagal membuat PO.');
      return;
    }
    setPoFormStatus('success');
    setPoFormMessage('');
    setPoForm(emptyPoForm);
    setIsPoModalOpen(false);
    beriTahu('success', 'PO baru dibuat', `ID ${body.purchase_order_id}`);
    await loadPurchaseOrders();
  };


  // ==========================================================================
  // TABEL SUPPLIER — cetakan Master Item
  // ==========================================================================
  const kolomSupplier = [
    { key: 'name', header: 'Nama' },
    { key: 'pic', header: 'PIC' },
    { key: 'lead_time', header: 'Lead time' },
    { key: 'type', header: 'Jenis' },
    { key: 'status', header: 'Status' },
    { key: 'aksi', header: 'Aksi' }
  ];

  const supplierTersaring = useMemo(() => {
    const kata = cariSupplier.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (saringSupplier === 'aktif' && s.archived_at) return false;
      if (saringSupplier === 'diarsipkan' && !s.archived_at) return false;
      if (!kata) return true;
      return s.name.toLowerCase().includes(kata);
    });
  }, [suppliers, cariSupplier, saringSupplier]);

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [String(s.supplier_id), s])), [suppliers]);

  const barisSupplier = useMemo(
    () =>
      supplierTersaring.map((s) => ({
        id: String(s.supplier_id),
        name: s.name,
        pic: s.pic_name ?? '',
        lead_time: s.lead_time_days ?? 0,
        type: supplierTypeLabels[s.supplier_type] ?? s.supplier_type,
        status: s.archived_at ? 'Diarsipkan' : 'Aktif',
        aksi: ''
      })),
    [supplierTersaring]
  );

  const isiSelSupplier = (s: Supplier, kunci: string) => {
    switch (kunci) {
      case 'name':
        return s.name;
      case 'pic':
        return s.pic_name ?? <span className="halaman__redup">—</span>;
      case 'lead_time':
        return s.lead_time_days !== null ? `${formatNumberId(s.lead_time_days, 0)} hari` : <span className="halaman__redup">—</span>;
      case 'type':
        return supplierTypeLabels[s.supplier_type] ?? s.supplier_type;
      case 'status':
        return s.archived_at ? (
          <Tag type="cool-gray">Diarsipkan{s.archived_by_name ? ` oleh ${s.archived_by_name}` : ''}</Tag>
        ) : (
          <Tag type="green">Aktif</Tag>
        );
      case 'aksi':
        return (
          <div className="beli-aksi">
            <div className="beli-aksi__biasa">
              {canManage && !s.archived_at ? (
                <Button kind="ghost" size="sm" onClick={() => startEditSupplier(s)}>
                  Ubah
                </Button>
              ) : null}
              {canManage && s.archived_at ? (
                <Button kind="ghost" size="sm" onClick={() => handleRestoreSupplier(s)}>
                  Pulihkan
                </Button>
              ) : null}
            </div>
            {/* AKSI MERUSAK DIDORONG KE KANAN, terpisah dari aksi sehari-hari. */}
            {canManage && !s.archived_at ? (
              <div className="beli-aksi__merusak">
                {s.can_delete ? (
                  <Button kind="danger--tertiary" size="sm" onClick={() => handleDeleteSupplier(s)}>
                    Hapus
                  </Button>
                ) : (
                  <Button kind="danger--tertiary" size="sm" onClick={() => handleArchiveSupplier(s)}>
                    Arsipkan
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        );
      default:
        return null;
    }
  };

  const renderSupplierDetail = (supplier: Supplier) => (
    <div className="beli-detail">
      {supplierActionMessage && supplierActionMessage.supplierId === supplier.supplier_id ? (
        <InlineNotification
          kind={supplierActionMessage.kind === 'success' ? 'success' : 'error'}
          lowContrast
          hideCloseButton
          title={supplierActionMessage.kind === 'success' ? 'Berhasil' : 'Gagal'}
          subtitle={supplierActionMessage.message}
        />
      ) : null}

      <StructuredListWrapper isCondensed aria-label={`Rincian supplier ${supplier.name}`}>
        <StructuredListBody>
          {[
            ['Alamat', supplier.address ?? '—'],
            ['NPWP', supplier.npwp ?? '—'],
            ['PIC', `${supplier.pic_name ?? '—'}${supplier.pic_phone ? ` — ${supplier.pic_phone}` : ''}${supplier.pic_email ? ` — ${supplier.pic_email}` : ''}`],
            ['Termin pembayaran', supplier.payment_terms ?? '—']
          ].map(([label, nilai]) => (
            <StructuredListRow key={String(label)}>
              <StructuredListCell noWrap>{label}</StructuredListCell>
              <StructuredListCell>{nilai}</StructuredListCell>
            </StructuredListRow>
          ))}
        </StructuredListBody>
      </StructuredListWrapper>

      <div className="beli-detail__kepala">
        <h3 className="halaman__subjudul halaman__subjudul--rapat">Bahan yang dipasok</h3>
        {canManage && !supplier.archived_at ? (
          <Button kind="tertiary" size="sm" renderIcon={Add} onClick={startAddPrice}>
            Tambah bahan
          </Button>
        ) : null}
      </div>

      {supplierPricesLoading ? (
        <SkeletonText paragraph lineCount={3} />
      ) : supplierPrices.length === 0 ? (
        <p className="halaman__redup">Belum ada bahan yang dipasok tercatat untuk supplier ini.</p>
      ) : (
        <Table size="lg" className="tabel-responsif">
          <TableHead>
            <TableRow>
              <TableHeader>Bahan</TableHeader>
              <TableHeader>Harga acuan</TableHeader>
              <TableHeader>Minimum order</TableHeader>
              <TableHeader>Lead time khusus</TableHeader>
              {canManage && !supplier.archived_at ? <TableHeader>Aksi</TableHeader> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {supplierPrices.map((price) => (
              <TableRow key={price.supplier_item_price_id}>
                <TableCell data-label="Bahan">
                  <div className="beli-sel-bahan">
                    <span className="beli-sel-bahan__kode">
                      {price.item_code} — {price.item_name}
                    </span>
                    {price.supplier_item_code || price.supplier_item_name ? (
                      <span className="beli-sel-bahan__alias">
                        Menurut supplier: {price.supplier_item_code ?? '—'} {price.supplier_item_name ? `(${price.supplier_item_name})` : ''}
                      </span>
                    ) : null}
                    {price.notes ? <span className="beli-sel-bahan__alias">Catatan: {price.notes}</span> : null}
                  </div>
                </TableCell>
                <TableCell data-label="Harga acuan">
                  {/* DISEBUT TERBUKA: ini harga ACUAN, bukan harga pembelian nyata. Menyebutnya
                      "harga" saja membuat orang mengira ini yang benar-benar dibayar. */}
                  {price.reference_price !== null ? formatCurrency(price.reference_price, { maxDecimals: 0 }) : '—'}
                  {price.price_valid_from ? ` (berlaku sejak ${price.price_valid_from})` : ''}
                </TableCell>
                <TableCell data-label="Minimum order">
                  {price.min_order_qty !== null ? `${formatNumberId(price.min_order_qty, 2)} ${price.min_order_uom ?? ''}` : '—'}
                </TableCell>
                <TableCell data-label="Lead time khusus">
                  {price.lead_time_days_override !== null ? `${price.lead_time_days_override} hari` : 'Pakai lead time umum supplier'}
                </TableCell>
                {canManage && !supplier.archived_at ? (
                  <TableCell data-label="Aksi">
                    <div className="beli-aksi">
                      <div className="beli-aksi__biasa">
                        <Button kind="ghost" size="sm" onClick={() => startEditPrice(price)}>
                          Ubah
                        </Button>
                      </div>
                      <div className="beli-aksi__merusak">
                        <Button kind="danger--tertiary" size="sm" onClick={() => handleDeletePrice(price)}>
                          Hapus
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  // ==========================================================================
  // TABEL PO KE SUPPLIER
  // ==========================================================================
  const kolomPo = [
    { key: 'po_number', header: 'No. PO' },
    { key: 'supplier', header: 'Supplier' },
    { key: 'plant', header: 'Lokasi' },
    { key: 'status', header: 'Status' },
    { key: 'order_date', header: 'Tanggal pesan' },
    { key: 'expected_date', header: 'Perkiraan datang' }
  ];

  const poTersaring = useMemo(() => {
    const kata = cariPo.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      if (saringPo !== 'semua' && po.status !== saringPo) return false;
      if (!kata) return true;
      return `PO-${String(po.purchase_order_id).padStart(4, '0')} ${po.supplier_name ?? ''}`.toLowerCase().includes(kata);
    });
  }, [purchaseOrders, cariPo, saringPo]);

  const poHalamanIni = useMemo(() => poTersaring.slice((halamanPo - 1) * perHalamanPo, halamanPo * perHalamanPo), [poTersaring, halamanPo, perHalamanPo]);
  const poById = useMemo(() => new Map(purchaseOrders.map((po) => [String(po.purchase_order_id), po])), [purchaseOrders]);

  const barisPo = useMemo(
    () =>
      poHalamanIni.map((po) => ({
        id: String(po.purchase_order_id),
        po_number: `PO-${String(po.purchase_order_id).padStart(4, '0')}`,
        supplier: po.supplier_name ?? '',
        plant: po.production_plant_name ?? '',
        status: po.status_label,
        order_date: po.order_date,
        expected_date: po.expected_date ?? ''
      })),
    [poHalamanIni]
  );

  const isiSelPo = (po: PurchaseOrder, kunci: string) => {
    switch (kunci) {
      case 'po_number':
        return `PO-${String(po.purchase_order_id).padStart(4, '0')}`;
      case 'supplier':
        return (
          <div className="beli-sel-bahan">
            <span className="beli-sel-bahan__kode">{po.supplier_name ?? '—'}</span>
            {po.identity_predates_snapshot ? <span className="beli-sel-bahan__alias">Terbit sebelum pembekuan identitas berlaku</span> : null}
          </div>
        );
      case 'plant':
        return po.production_plant_name ?? <span className="halaman__redup">—</span>;
      case 'status':
        return <Tag type={poStatusWarnaTag[po.status] ?? 'gray'}>{po.status_label}</Tag>;
      case 'order_date':
        return po.order_date;
      case 'expected_date':
        return po.expected_date ?? <span className="halaman__redup">—</span>;
      default:
        return null;
    }
  };

  const renderPoDetail = (po: PurchaseOrder) => {
    const adaKolomHarga = po.lines.some((l) => l.unit_price !== null);
    return (
      <div className="beli-detail">
        <Table size="lg" className="tabel-responsif">
          <TableHead>
            <TableRow>
              <TableHeader>Item</TableHeader>
              <TableHeader>Dipesan</TableHeader>
              <TableHeader>Diterima</TableHeader>
              {/* Server menyembunyikan harga untuk peran yang tidak berhak. Kepala dan isi
                  memakai kondisi yang SAMA supaya jumlah kolomnya tidak pernah berbeda. */}
              {adaKolomHarga ? <TableHeader>Harga satuan</TableHeader> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {po.lines.map((line) => (
              <TableRow key={line.purchase_order_line_id}>
                <TableCell data-label="Item">{line.item_code ?? line.item_name}</TableCell>
                <TableCell data-label="Dipesan">
                  {formatNumberId(line.qty_ordered, 2)} {line.purchase_uom}
                </TableCell>
                <TableCell data-label="Diterima">
                  {formatNumberId(line.qty_received, 2)} {line.purchase_uom}
                </TableCell>
                {adaKolomHarga ? <TableCell data-label="Harga satuan">{formatCurrency(line.unit_price, { maxDecimals: 0 })}</TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (checkingAccess) {
    return (
      <div className="halaman">
        <DataTableSkeleton columnCount={6} rowCount={6} showHeader showToolbar />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <KepalaHalaman remah={[]} judul="Pembelian" />
        <InlineNotification kind="error" lowContrast hideCloseButton title="Akses ditolak" subtitle="Halaman ini khusus peran yang berwenang atas pembelian." />
        <Button className="beli-tombol-kembali" onClick={() => router.push('/dashboard')}>
          Kembali ke ringkasan
        </Button>
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Supply Chain' }, { label: 'Purchasing' }]}
        judul="Pembelian"
        pengantar={`${supplierTersaring.length} supplier dan ${poTersaring.length} PO ke supplier${adaSaringan ? ' sesuai saringan' : ' tercatat'}.`}
      />

      <h2 className="halaman__subjudul">Supplier</h2>
      {suppliersLoading ? (
        <DataTableSkeleton columnCount={6} rowCount={5} showHeader showToolbar />
      ) : (
        <DataTable rows={barisSupplier} headers={kolomSupplier} isSortable size="lg">
          {(rp: any) => (
            <TableContainer {...rp.getTableContainerProps()}>
              <TableToolbar>
                <TableToolbarContent>
                  {/* MELIPAT, bukan selalu terbuka — bawaan Carbon, `persistent` tidak dipakai. */}
                  <TableToolbarSearch
                    placeholder="Cari nama supplier…"
                    labelText="Cari supplier"
                    onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => setCariSupplier(typeof e === 'string' ? '' : e.target.value)}
                  />
                  {/* SARINGAN, bukan kotak centang — bentuknya sama dengan Master Item, dan
                      sekarang bisa menjawab "khusus yang diarsipkan". */}
                  <Dropdown
                    id="beli-saring-supplier"
                    size="lg"
                    className="halaman__saring"
                    label="Status"
                    titleText="Status"
                    hideLabel
                    items={['aktif', 'diarsipkan', 'semua']}
                    itemToString={(v: string) => (v === 'aktif' ? 'Aktif' : v === 'diarsipkan' ? 'Diarsipkan' : 'Semua status')}
                    selectedItem={saringSupplier}
                    onChange={({ selectedItem }: { selectedItem: string | null }) => setSaringSupplier(selectedItem ?? 'aktif')}
                  />
                  {canManage ? (
                    <Button size="lg" renderIcon={Add} onClick={startCreateSupplier}>
                      Tambah supplier
                    </Button>
                  ) : null}
                </TableToolbarContent>
              </TableToolbar>
              <Table {...rp.getTableProps()} className="tabel-responsif">
                <TableHead>
                  <TableRow>
                    <TableExpandHeader aria-label="Buka bahan yang dipasok" />
                    {rp.headers.map((h: any) => {
                      const { key, ...sisa } = rp.getHeaderProps({ header: h }) as { key?: string };
                      void key;
                      return (
                        <TableHeader key={h.key} {...sisa} isSortable={h.key !== 'aksi'}>
                          {h.header}
                        </TableHeader>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rp.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={kolomSupplier.length + 1}>
                        {cariSupplier.trim() || saringSupplier !== 'aktif' ? 'Tidak ada supplier yang cocok dengan pencarian atau saringan.' : 'Belum ada supplier.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rp.rows.map((row: any) => {
                      const s = supplierById.get(row.id);
                      if (!s) return null;
                      const { key, ...sisaBaris } = rp.getRowProps({ row }) as { key?: string };
                      void key;
                      return (
                        <React.Fragment key={row.id}>
                          <TableExpandRow
                            {...sisaBaris}
                            isExpanded={expandedSupplierId === s.supplier_id}
                            onExpand={() => toggleSupplierDetail(s)}
                            aria-label={`Bahan dipasok ${s.name}`}
                          >
                            {kolomSupplier.map((h) => (
                              <TableCell key={h.key} data-label={h.header}>
                                {isiSelSupplier(s, h.key)}
                              </TableCell>
                            ))}
                          </TableExpandRow>
                          <TableExpandedRow colSpan={kolomSupplier.length + 1}>
                            {expandedSupplierId === s.supplier_id ? renderSupplierDetail(s) : null}
                          </TableExpandedRow>
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}

      <h2 className="halaman__subjudul">Purchase Order ke supplier</h2>
      {poError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat PO" subtitle={poError} /> : null}
      {poLoading ? (
        <DataTableSkeleton columnCount={6} rowCount={5} showHeader showToolbar />
      ) : (
        <>
          <DataTable rows={barisPo} headers={kolomPo} isSortable size="lg">
            {(rp: any) => (
              <TableContainer {...rp.getTableContainerProps()}>
                <TableToolbar>
                  <TableToolbarContent>
                    <TableToolbarSearch
                      placeholder="Cari nomor PO atau supplier…"
                      labelText="Cari PO"
                      onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => {
                        setCariPo(typeof e === 'string' ? '' : e.target.value);
                        setHalamanPo(1);
                      }}
                    />
                    <Dropdown
                      id="beli-saring-po"
                      size="lg"
                      className="halaman__saring"
                      label="Status"
                      titleText="Status"
                      hideLabel
                      items={['semua', ...Object.keys(poStatusWarnaTag)]}
                      itemToString={(v: string) => (v === 'semua' ? 'Semua status' : purchaseOrders.find((p) => p.status === v)?.status_label ?? v)}
                      selectedItem={saringPo}
                      onChange={({ selectedItem }: { selectedItem: string | null }) => {
                        setSaringPo(selectedItem ?? 'semua');
                        setHalamanPo(1);
                      }}
                    />
                    {canManage ? (
                      <Button size="lg" renderIcon={Add} onClick={() => { setPoFieldError([]); setPoFormMessage(''); setPoFormStatus('idle'); setIsPoModalOpen(true); }}>
                        Buat PO
                      </Button>
                    ) : null}
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...rp.getTableProps()} className="tabel-responsif">
                  <TableHead>
                    <TableRow>
                      <TableExpandHeader aria-label="Buka rincian PO" />
                      {rp.headers.map((h: any) => {
                        const { key, ...sisa } = rp.getHeaderProps({ header: h }) as { key?: string };
                        void key;
                        return (
                          <TableHeader key={h.key} {...sisa} isSortable>
                            {h.header}
                          </TableHeader>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rp.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={kolomPo.length + 1}>
                          {cariPo.trim() || saringPo !== 'semua' ? 'Tidak ada PO yang cocok dengan pencarian atau saringan.' : 'Belum ada PO ke supplier.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rp.rows.map((row: any) => {
                        const po = poById.get(row.id);
                        if (!po) return null;
                        const { key, ...sisaBaris } = rp.getRowProps({ row }) as { key?: string };
                        void key;
                        return (
                          <React.Fragment key={row.id}>
                            <TableExpandRow
                              {...sisaBaris}
                              isExpanded={expandedPoId === po.purchase_order_id}
                              onExpand={() => setExpandedPoId((kini) => (kini === po.purchase_order_id ? null : po.purchase_order_id))}
                              aria-label={`Rincian PO-${String(po.purchase_order_id).padStart(4, '0')}`}
                            >
                              {kolomPo.map((h) => (
                                <TableCell key={h.key} data-label={h.header}>
                                  {isiSelPo(po, h.key)}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow colSpan={kolomPo.length + 1}>
                              {expandedPoId === po.purchase_order_id ? renderPoDetail(po) : null}
                            </TableExpandedRow>
                          </React.Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>

          <Pagination
            page={halamanPo}
            pageSize={perHalamanPo}
            pageSizes={[15, 30, 50]}
            totalItems={poTersaring.length}
            onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
              setHalamanPo(page);
              setPerHalamanPo(pageSize);
            }}
            backwardText="Halaman sebelumnya"
            forwardText="Halaman berikutnya"
            itemsPerPageText="Baris per halaman"
            itemRangeText={(mulai: number, akhir: number, total: number) => `${mulai}–${akhir} dari ${total} PO`}
            pageRangeText={(_kini: number, total: number) => `dari ${total} halaman`}
            pageNumberText="Nomor halaman"
          />
        </>
      )}

      {/* ====================================================================
          MODAL SUPPLIER — BERTAHAP untuk data BARU (isian → ringkasan draf),
          langsung simpan untuk PERUBAHAN data lama. Aturan #7: ringkasan hanya
          untuk data baru; saat mengubah, pengguna sudah melihat nilai lamanya.
          ==================================================================== */}
      {canManage ? (
        <ComposedModal open={isSupplierModalOpen} size="md" onClose={() => { tutupSupplierModal(); return true; }}>
          <ModalHeader
            label="Master data"
            title={editingSupplierId ? `Ubah supplier — ${supplierForm.name}` : tahapSupplier === 'ringkasan' ? 'Periksa dulu sebelum disimpan' : 'Tambah supplier baru'}
            closeModal={tutupSupplierModal}
          />
          <ModalBody hasForm>
            {tahapSupplier === 'ringkasan' ? (
              <>
                <p className="halaman__pengantar">Supplier berikut akan ditambahkan. Tekan Kembali bila masih ada yang perlu diperbaiki.</p>
                <StructuredListWrapper isCondensed aria-label="Ringkasan draf supplier">
                  <StructuredListBody>
                    {ringkasanDrafSupplier.map((b) => (
                      <StructuredListRow key={b.label}>
                        <StructuredListCell noWrap>{b.label}</StructuredListCell>
                        <StructuredListCell>{b.nilai}</StructuredListCell>
                      </StructuredListRow>
                    ))}
                  </StructuredListBody>
                </StructuredListWrapper>
              </>
            ) : (
              <div className="beli-form">
                <TextInput
                  id="supplier-nama"
                  size="lg"
                  className="beli-form__lebar-penuh"
                  labelText="Nama supplier"
                  // Aturan modal: placeholder TIDAK memuat instruksi — contoh turun ke helper text.
                  helperText="Contoh: PT Sumber Bahan Jaya."
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <TextInput
                  id="supplier-alamat"
                  size="lg"
                  className="beli-form__lebar-penuh"
                  labelText="Alamat"
                  helperText="Alamat lengkap supplier, dipakai di dokumen pembelian."
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))}
                />
                <TextInput
                  id="supplier-npwp"
                  size="lg"
                  labelText="NPWP"
                  value={supplierForm.npwp}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, npwp: e.target.value }))}
                />
                <NumberInput
                  id="supplier-lead-time"
                  label="Lead time (hari)"
                  min={0}
                  allowEmpty
                  hideSteppers
                  helperText="Berapa hari biasanya barang datang setelah PO dikirim."
                  value={supplierForm.lead_time_days === '' ? '' : Number(supplierForm.lead_time_days)}
                  onChange={(_e: unknown, { value }: { value: number | string }) => setSupplierForm((prev) => ({ ...prev, lead_time_days: String(value ?? '') }))}
                />
                <TextInput
                  id="supplier-termin"
                  size="lg"
                  labelText="Termin pembayaran"
                  value={supplierForm.payment_terms}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, payment_terms: e.target.value }))}
                />
                <Dropdown
                  id="supplier-jenis"
                  size="lg"
                  titleText="Jenis supplier"
                  label="Pilih jenis"
                  items={Object.keys(supplierTypeLabels)}
                  itemToString={(v: string) => supplierTypeLabels[v] ?? v}
                  selectedItem={supplierForm.supplier_type}
                  onChange={({ selectedItem }: { selectedItem: string | null }) => setSupplierForm((prev) => ({ ...prev, supplier_type: selectedItem ?? '' }))}
                />
                <TextInput
                  id="supplier-pic-nama"
                  size="lg"
                  labelText="Nama PIC"
                  value={supplierForm.pic_name}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, pic_name: e.target.value }))}
                />
                <TextInput
                  id="supplier-pic-telepon"
                  size="lg"
                  labelText="Telepon PIC"
                  value={supplierForm.pic_phone}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, pic_phone: e.target.value }))}
                />
                <TextInput
                  id="supplier-pic-email"
                  size="lg"
                  labelText="Email PIC"
                  value={supplierForm.pic_email}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, pic_email: e.target.value }))}
                />
                <TextInput
                  id="supplier-kontak"
                  size="lg"
                  className="beli-form__lebar-penuh"
                  labelText="Kontak lain"
                  value={supplierForm.contact_info}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, contact_info: e.target.value }))}
                />
                {supplierFormStatus === 'error' && supplierFormMessage ? (
                  <div className="beli-form__lebar-penuh">
                    <InlineNotification kind="error" lowContrast hideCloseButton title="Tidak bisa disimpan" subtitle={supplierFormMessage} />
                  </div>
                ) : null}
              </div>
            )}
          </ModalBody>
          {/* `children` WAJIB pada ModalFooter di @carbon/react 1.114. */}
          <ModalFooter>
            <Button kind="secondary" onClick={tahapSupplier === 'ringkasan' ? () => setTahapSupplier('isian') : tutupSupplierModal}>
              {tahapSupplier === 'ringkasan' ? 'Kembali' : 'Batal'}
            </Button>
            <Button
              kind="primary"
              disabled={supplierFormStatus === 'saving'}
              onClick={editingSupplierId ? handleSaveSupplier : tahapSupplier === 'ringkasan' ? handleSaveSupplier : handleLanjutKeRingkasan}
            >
              {supplierFormStatus === 'saving' ? 'Menyimpan...' : editingSupplierId ? 'Simpan perubahan' : tahapSupplier === 'ringkasan' ? 'Simpan supplier' : 'Lanjut'}
            </Button>
          </ModalFooter>
        </ComposedModal>
      ) : null}

      {/* MODAL BAHAN YANG DIPASOK */}
      {canManage ? (
        <ComposedModal open={isPriceModalOpen} size="md" onClose={() => { setIsPriceModalOpen(false); return true; }}>
          <ModalHeader
            label="Supplier"
            title={editingPriceId ? 'Ubah bahan yang dipasok' : 'Tambah bahan yang dipasok'}
            closeModal={() => setIsPriceModalOpen(false)}
          />
          <ModalBody hasForm>
            <div className="beli-form">
              <Dropdown
                id="harga-item"
                size="lg"
                className="beli-form__lebar-penuh"
                titleText="Bahan"
                label="Pilih bahan..."
                disabled={!!editingPriceId}
                items={items}
                itemToString={(i: any) => (i ? `${i.item_code} — ${i.name}` : '')}
                selectedItem={items.find((i) => String(i.item_id) === priceForm.item_id) ?? null}
                onChange={({ selectedItem }: { selectedItem: any }) => setPriceForm((prev) => ({ ...prev, item_id: selectedItem ? String(selectedItem.item_id) : '' }))}
                helperText={editingPriceId ? 'Bahan tidak bisa diubah — hapus baris ini lalu tambah yang baru bila salah.' : undefined}
              />
              <TextInput
                id="harga-kode-supplier"
                size="lg"
                labelText="Kode menurut supplier"
                helperText="Kosongkan kalau supplier memakai kode yang sama."
                value={priceForm.supplier_item_code}
                onChange={(e) => setPriceForm((prev) => ({ ...prev, supplier_item_code: e.target.value }))}
              />
              <TextInput
                id="harga-nama-supplier"
                size="lg"
                labelText="Nama menurut supplier"
                value={priceForm.supplier_item_name}
                onChange={(e) => setPriceForm((prev) => ({ ...prev, supplier_item_name: e.target.value }))}
              />
              <NumberInput
                id="harga-acuan"
                label="Harga acuan"
                min={0}
                allowEmpty
                hideSteppers
                helperText="Perkiraan harga saat ini — BUKAN harga pembelian nyata."
                value={priceForm.reference_price === '' ? '' : Number(priceForm.reference_price)}
                onChange={(_e: unknown, { value }: { value: number | string }) => setPriceForm((prev) => ({ ...prev, reference_price: String(value ?? '') }))}
              />
              <TextInput
                id="harga-berlaku"
                size="lg"
                type="date"
                labelText="Berlaku sejak"
                value={priceForm.price_valid_from}
                onChange={(e) => setPriceForm((prev) => ({ ...prev, price_valid_from: e.target.value }))}
              />
              <NumberInput
                id="harga-min-qty"
                label="Minimum order"
                min={0}
                allowEmpty
                hideSteppers
                value={priceForm.min_order_qty === '' ? '' : Number(priceForm.min_order_qty)}
                onChange={(_e: unknown, { value }: { value: number | string }) => setPriceForm((prev) => ({ ...prev, min_order_qty: String(value ?? '') }))}
              />
              <TextInput
                id="harga-min-satuan"
                size="lg"
                labelText="Satuan minimum order"
                placeholder="mis. karung"
                value={priceForm.min_order_uom}
                onChange={(e) => setPriceForm((prev) => ({ ...prev, min_order_uom: e.target.value }))}
              />
              <NumberInput
                id="harga-lead-time"
                label="Lead time khusus (hari)"
                min={0}
                allowEmpty
                hideSteppers
                helperText="Kosongkan untuk memakai lead time umum supplier."
                value={priceForm.lead_time_days_override === '' ? '' : Number(priceForm.lead_time_days_override)}
                onChange={(_e: unknown, { value }: { value: number | string }) => setPriceForm((prev) => ({ ...prev, lead_time_days_override: String(value ?? '') }))}
              />
              <TextInput
                id="harga-catatan"
                size="lg"
                className="beli-form__lebar-penuh"
                labelText="Catatan (opsional)"
                value={priceForm.notes}
                onChange={(e) => setPriceForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
              {priceFormStatus === 'error' && priceFormMessage ? (
                <div className="beli-form__lebar-penuh">
                  <InlineNotification kind="error" lowContrast hideCloseButton title="Tidak bisa disimpan" subtitle={priceFormMessage} />
                </div>
              ) : null}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button kind="secondary" onClick={() => setIsPriceModalOpen(false)}>
              Batal
            </Button>
            <Button kind="primary" disabled={priceFormStatus === 'saving'} onClick={handleSavePrice}>
              {priceFormStatus === 'saving' ? 'Menyimpan...' : 'Simpan bahan'}
            </Button>
          </ModalFooter>
        </ComposedModal>
      ) : null}

      {/* MODAL BUAT PO — BERTAHAP: baris item ditambah dan dihapus sebelum disimpan. */}
      {canManage ? (
        <ComposedModal open={isPoModalOpen} size="md" onClose={() => { setIsPoModalOpen(false); return true; }}>
          <ModalHeader label="Pembelian" title="Buat PO baru" closeModal={() => setIsPoModalOpen(false)} />
          <ModalBody hasForm>
            <div className="beli-form">
              <Dropdown
                id="po-supplier"
                size="lg"
                titleText="Supplier"
                invalid={Boolean(galatPo('supplier_id'))}
                invalidText={galatPo('supplier_id')}
                label="Pilih supplier..."
                items={suppliers.filter((s) => !s.archived_at)}
                itemToString={(s: any) => s?.name ?? ''}
                selectedItem={suppliers.find((s) => String(s.supplier_id) === poForm.supplier_id) ?? null}
                onChange={({ selectedItem }: { selectedItem: any }) => setPoForm((prev) => ({ ...prev, supplier_id: selectedItem ? String(selectedItem.supplier_id) : '' }))}
              />
              <Dropdown
                id="po-lokasi"
                size="lg"
                titleText="Lokasi pabrik (alamat kirim)"
                invalid={Boolean(galatPo('production_plant_id'))}
                invalidText={galatPo('production_plant_id')}
                label="Pilih lokasi..."
                items={plants}
                itemToString={(p: any) => p?.name ?? ''}
                selectedItem={plants.find((p) => String(p.production_plant_id) === poForm.production_plant_id) ?? null}
                onChange={({ selectedItem }: { selectedItem: any }) =>
                  setPoForm((prev) => ({ ...prev, production_plant_id: selectedItem ? String(selectedItem.production_plant_id) : '' }))
                }
              />
              <TextInput
                id="po-perkiraan"
                size="lg"
                type="date"
                labelText="Perkiraan tanggal datang (opsional)"
                value={poForm.expected_date}
                onChange={(e) => setPoForm((prev) => ({ ...prev, expected_date: e.target.value }))}
              />
            </div>

            <div className="beli-baris">
              <div className="beli-baris__kepala">
                <h3 className="halaman__subjudul halaman__subjudul--rapat">Baris item</h3>
                <Button kind="tertiary" size="sm" renderIcon={Add} onClick={addPoLine}>
                  Tambah baris
                </Button>
              </div>
              {poForm.lines.map((line, index) => {
                const selectedItem = items.find((i) => String(i.item_id) === line.item_id);
                return (
                  <div key={index} className="beli-baris__isi">
                    <Dropdown
                      id={`po-item-${index}`}
                      size="lg"
                      titleText="Item"
                      invalid={Boolean(galatPo('item_id', index))}
                      invalidText={galatPo('item_id', index)}
                      label="Pilih item..."
                      items={items}
                      itemToString={(i: any) => (i ? `${i.item_code} — ${i.name}` : '')}
                      selectedItem={selectedItem ?? null}
                      onChange={({ selectedItem: dipilih }: { selectedItem: any }) => updatePoLine(index, 'item_id', dipilih ? String(dipilih.item_id) : '')}
                    />
                    <NumberInput
                      id={`po-qty-${index}`}
                      label={`Jumlah pesan (${selectedItem?.purchase_uom ?? 'satuan beli'})`}
                      invalid={Boolean(galatPo('qty_ordered', index))}
                      invalidText={galatPo('qty_ordered', index) ?? ''}
                      min={0}
                      allowEmpty
                      hideSteppers
                      value={line.qty_ordered === '' ? '' : Number(line.qty_ordered)}
                      onChange={(_e: unknown, { value }: { value: number | string }) => updatePoLine(index, 'qty_ordered', String(value ?? ''))}
                    />
                    <NumberInput
                      id={`po-harga-${index}`}
                      label="Harga satuan (opsional)"
                      invalid={Boolean(galatPo('unit_price', index))}
                      invalidText={galatPo('unit_price', index) ?? ''}
                      min={0}
                      allowEmpty
                      hideSteppers
                      value={line.unit_price === '' ? '' : Number(line.unit_price)}
                      onChange={(_e: unknown, { value }: { value: number | string }) => updatePoLine(index, 'unit_price', String(value ?? ''))}
                    />
                    <Button kind="danger--tertiary" size="sm" renderIcon={TrashCan} disabled={poForm.lines.length === 1} onClick={() => removePoLine(index)}>
                      Hapus baris
                    </Button>
                  </div>
                );
              })}
            </div>

            {poFormStatus === 'error' && poFormMessage && poFieldError.length === 0 ? (
              <InlineNotification kind="error" lowContrast hideCloseButton title="Tidak bisa disimpan" subtitle={poFormMessage} />
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button kind="secondary" onClick={() => setIsPoModalOpen(false)}>
              Batal
            </Button>
            <Button kind="primary" disabled={poFormStatus === 'saving'} onClick={handleCreatePo}>
              {poFormStatus === 'saving' ? 'Menyimpan...' : 'Buat PO'}
            </Button>
          </ModalFooter>
        </ComposedModal>
      ) : null}

      <AreaNotifikasi daftar={notifikasi} onTutup={tutupNotifikasi} />
    </div>
  );
}
