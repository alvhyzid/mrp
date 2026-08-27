'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { authedFetch as panggilApi, SesiTidakValid } from '@/lib/authedFetch';
import {
  Button,
  Checkbox,
  Dropdown,
  FormGroup,
  ComposedModal,
  DataTable,
  DataTableSkeleton,
  FileUploader,
  InlineNotification,
  Modal,
  ModalBody,
  ModalHeader,
  Pagination,
  Select as CarbonSelect,
  SelectItem as CarbonSelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  MultiSelect,
  Tag,
  TextInput,
  Toggletip,
  ToggletipButton,
  ToggletipContent
} from '@carbon/react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { FooterBertahap, PenandaLangkah, type LangkahModal } from '@/components/ui/modal-bertahap';
import { AreaNotifikasi, type Notifikasi } from '@/components/ui/notifikasi';
import { Add, Information } from '@carbon/icons-react';
import {
  SHELF_LIFE_UNITS,
  shelfLifeToDays,
  daysToShelfLife,
  formatShelfLife,
  type ShelfLifeUnit
} from '@/features/mrp/shelfLife';
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
  min_stock_percent: number | null;
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
  min_stock_percent: '',
  reorder_point: '',
  reorder_qty: '',
  standard_cost: '',
  bpom_registration_number: '',
  halal_certificate_number: '',
  is_active: true
};

/// Warna Tag mengikuti TIPE ITEM, bukan selera. Dipetakan dari nama varian lama supaya
/// tampilannya tidak berubah arti bagi orang yang sudah terbiasa.
function warnaTagTipe(tipe: string): 'blue' | 'teal' | 'purple' | 'magenta' | 'gray' {
  const peta: Record<string, 'blue' | 'teal' | 'purple' | 'magenta' | 'gray'> = {
    raw_material: 'blue',
    packaging: 'teal',
    wip: 'purple',
    finished_good: 'magenta'
  };
  return peta[tipe] ?? 'gray';
}

/// Label field dengan penjelasan yang dibuka lewat KLIK.
///
/// Aturan tetap proyek: penjelasan bantuan tidak pernah dibuka hanya dengan sentuhan kursor.
/// Penjelasan hover TIDAK BISA DIPAKAI SAMA SEKALI di HP dan tablet — dan justru perangkat
/// itulah yang dipakai di lantai produksi. Toggletip Carbon dibuka dengan klik.
function LabelBantuan({ teks, children }: { teks: string; children: React.ReactNode }) {
  return (
    <span className="item-label">
      {teks}
      <Toggletip align="top">
        <ToggletipButton label={`Penjelasan ${teks}`}>
          <Information size={16} />
        </ToggletipButton>
        <ToggletipContent>
          <p>{children}</p>
        </ToggletipContent>
      </Toggletip>
    </span>
  );
}

// LANGKAH FORMULIR ITEM (DS-18, 26 Agu 2026) — mengikuti cetakan PO klien.
//
// Nomor BPOM, kode halal, dan centang Aktif DINAIKKAN ke langkah pertama. Ketiganya
// keterangan JATI DIRI item — namanya, jenisnya, pendaftaran resminya, masih dipakai atau
// tidak — bukan aturan persediaan. Tanpa pemindahan itu langkah ketiga harus berjudul dua
// hal sekaligus, dan itu tepat yang dilarang uji pemecahan.
//
// DOKUMEN TIDAK MASUK MODAL PEMBUATAN, dan itu keputusan sadar (pemilik produk, 26 Agu
// 2026): melampirkan berkas menuntut itemnya sudah ada untuk ditempeli. Ia tetap di panel
// Detail, tempat item yang sudah tersimpan dibuka.
const LANGKAH_ITEM: LangkahModal[] = [
  { judul: 'Identitas', ringkas: 'Nama, jenis, pendaftaran' },
  { judul: 'Satuan', ringkas: 'Satuan pakai, beli, konversi' },
  { judul: 'Persediaan', ringkas: 'Masa simpan & stok minimum' }
];

export default function ItemsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [canViewCost, setCanViewCost] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  // Setelan ke-18 (MST-27). Null bila perusahaan belum menetapkannya.
  const [persenBawaanPerusahaan, setPersenBawaanPerusahaan] = useState<number | null>(null);
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
  const [langkah, setLangkah] = useState(0);
  // Hasil yang BERHASIL lewat notifikasi, bukan pesan di dalam modal yang keburu tertutup.
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const beriTahu = useCallback((jenis: Notifikasi['jenis'], judul: string, rincian?: string) => {
    setNotifikasi((lama) => [...lama, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, jenis, judul, rincian }]);
  }, []);
  const tutupNotifikasi = useCallback((id: string) => setNotifikasi((lama) => lama.filter((n) => n.id !== id)), []);


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
  // MST-18 — satuan shelf life hanya hidup di FORMULIR. Yang disimpan tetap jumlah hari
  // di kolom shelf_life_days, supaya FEFO tidak kehilangan dasarnya.
  const [shelfLifeUnit, setShelfLifeUnit] = useState<ShelfLifeUnit>('hari');

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

  // AUD-35/AUD-37 — memakai pintu bersama src/lib/authedFetch.ts, bukan pengambil token
  // sendiri. Halaman ini yang PERTAMA dipindah; sisanya menyusul bersama migrasi Carbon
  // masing-masing. Daftar yang belum dipindah dijaga tests/membaca_tidak_menulis.test.ts,
  // dan daftar itu hanya boleh MENYUSUT.
  const authedFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await panggilApi(path, options);
    return { ok: response.ok, body: await response.json() };
  }, []);

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

    // FormData mengatur Content-Type-nya sendiri beserta boundary-nya; panggilApi tahu itu
    // dan tidak menimpanya.
    const response = await panggilApi('/api/documents', { method: 'POST', body: fd });
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
    setItemsLoading(true);
    try {
      const response = await panggilApi('/api/items');
      const data = await response.json();
      if (!response.ok) {
        setItemsError(data.error || 'Gagal memuat daftar item.');
        setItemsLoading(false);
        return;
      }
      setItems(data.items || []);
      setPersenBawaanPerusahaan(
        typeof data.persen_bawaan_perusahaan === 'number' ? data.persen_bawaan_perusahaan : null
      );
      setItemsError('');
    } catch (e) {
      setItemsError(e instanceof SesiTidakValid ? 'Sesi Anda sudah berakhir. Silakan masuk lagi.' : String(e));
    }
    setItemsLoading(false);
  }, []);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }

      // Pemeriksaan sesi ikut lewat pintu bersama. `SesiTidakValid` dilempar bila memang
      // tidak ada sesi -- halaman ini yang memutuskan apa yang terjadi berikutnya, bukan
      // pembungkusnya.
      let meResponse: Response;
      try {
        meResponse = await panggilApi('/api/me');
      } catch (e) {
        if (e instanceof SesiTidakValid) {
          router.replace('/login?redirectTo=/items');
          return;
        }
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }
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

  // Modal berbahaya Carbon menggantikan window.confirm (DS-05).
  //
  // Bukan soal rupa: window.confirm memblokir seluruh peramban, tidak bisa memuat penekanan
  // apa pun selain teks polos, dan tidak bisa menandai bahwa aksinya MERUSAK. Carbon
  // menyediakan varian `danger` justru untuk ini.
  const [itemAkanDihapus, setItemAkanDihapus] = useState<Item | null>(null);
  const [hargaAkanDihapus, setHargaAkanDihapus] = useState<number | null>(null);

  const handleDeleteItem = async (item: Item) => {
    setItemAkanDihapus(null);
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
    setHargaAkanDihapus(null);
    if (expandedItemPricesId === null) return;
    const { ok } = await authedFetch(`/api/supplier-item-prices/${priceId}`, { method: 'DELETE' });
    if (ok) await loadItemPrices(expandedItemPricesId);
  };

  const resetForm = () => {
    setLangkah(0);
    setEditingItemId(null);
    setForm(emptyForm);
    setFormStatus('idle');
    setFormMessage('');
  };

  const startEdit = (item: Item) => {
    setShelfLifeUnit(daysToShelfLife(item.shelf_life_days).satuan);
    setIsFormModalOpen(true);
    setEditingItemId(item.item_id);
    setForm({
      item_code: item.item_code,
      name: item.name,
      type: item.type,
      base_uom: item.base_uom,
      purchase_uom: item.purchase_uom,
      uom_conversion_factor: String(item.uom_conversion_factor ?? 1),
      shelf_life_days: daysToShelfLife(item.shelf_life_days).nilai,
      min_stock_level: String(item.min_stock_level),
      min_stock_percent: item.min_stock_percent === null || item.min_stock_percent === undefined ? '' : String(item.min_stock_percent),
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

    const payload = {
      ...(editingItemId ? { item_id: editingItemId } : {}),
      item_code: form.item_code,
      name: form.name,
      type: form.type,
      base_uom: form.base_uom,
      purchase_uom: form.purchase_uom,
      uom_conversion_factor: form.uom_conversion_factor,
      // Dikirim SELALU dalam hari. Satuan tidak ikut dikirim -- database tidak perlu
      // tahu pengguna mengetiknya sebagai bulan atau minggu.
      shelf_life_days: form.shelf_life_days.trim() ? String(shelfLifeToDays(Number(form.shelf_life_days), shelfLifeUnit)) : '',
      min_stock_level: form.min_stock_level,
      min_stock_percent: form.min_stock_percent,
      reorder_point: form.reorder_point,
      reorder_qty: form.reorder_qty,
      standard_cost: form.standard_cost,
      bpom_registration_number: form.bpom_registration_number,
      halal_certificate_number: form.halal_certificate_number,
      is_active: form.is_active
    };

    let response: Response;
    try {
      response = await panggilApi('/api/items', {
        method: editingItemId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
    } catch (e) {
      setFormStatus('error');
      setFormMessage(e instanceof SesiTidakValid ? 'Sesi Anda sudah tidak valid, silakan login ulang.' : String(e));
      return;
    }
    const data = await response.json();

    if (!response.ok) {
      setFormStatus('error');
      setFormMessage(data.error || 'Gagal menyimpan item.');
      return;
    }

    const memperbarui = editingItemId !== null;
    setFormStatus('idle');
    setFormMessage('');
    resetForm();
    setIsFormModalOpen(false);
    beriTahu('success', memperbarui ? 'Item diperbarui' : 'Item baru ditambahkan');
    await loadItems();
  };
  // ==========================================================================
  // TABEL — DataTable Carbon
  // ==========================================================================
  // Bukan <table> polos, dan bukan komponen tabel bersama yang lama. Alasannya bukan
  // keseragaman semata: pengurutan, baris yang bisa dimekarkan, toolbar, dan pencarian sudah
  // DIBAWA DataTable Carbon lengkap dengan peran ARIA dan navigasi keyboardnya. Memakai tabel
  // polos lalu menambal kemampuannya sendiri melahirkan jalur kedua yang tidak ikut berubah
  // saat yang pertama diperbaiki.
  //
  // YANG DIPAKAI  : pengurutan, baris mekar, toolbar + pencarian, pembagian halaman.
  // YANG TIDAK    : pemilihan banyak baris beserta aksi massalnya — SENGAJA. Satu-satunya aksi
  //                 massal yang masuk akal di sini adalah menghapus, dan menghapus banyak item
  //                 sekaligus justru yang paling ingin dihindari (lihat MST-16: hapus bahkan
  //                 dikeluarkan dari baris tabel karena terlalu mudah tertekan).
  const [cariItem, setCariItem] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [ukuranHalaman, setUkuranHalaman] = useState(15);

  // SARINGAN — mengikuti pola penyaringan Carbon: beberapa saringan dengan pembaruan
  // LANGSUNG (bukan tombol "terapkan"). Dipilih karena daftarnya pendek dan hasilnya terlihat
  // seketika; saringan bertombol berguna saat menghitung ulang mahal, dan di sini tidak.
  //   Tipe   -> banyak-pilihan (MultiSelect), karena orang wajar memilih Bahan Baku DAN Kemasan
  //   Status -> satu-pilihan (Dropdown), karena aktif dan nonaktif saling meniadakan
  const [saringTipe, setSaringTipe] = useState<string[]>([]);
  const [saringStatus, setSaringStatus] = useState<'semua' | 'aktif' | 'nonaktif'>('semua');

  const itemTersaring = useMemo(() => {
    const k = cariItem.trim().toLowerCase();
    return items.filter((i) => {
      if (k && !`${i.item_code} ${i.name}`.toLowerCase().includes(k)) return false;
      if (saringTipe.length > 0 && !saringTipe.includes(i.type)) return false;
      if (saringStatus === 'aktif' && !i.is_active) return false;
      if (saringStatus === 'nonaktif' && i.is_active) return false;
      return true;
    });
  }, [items, cariItem, saringTipe, saringStatus]);

  const adaSaringan = saringTipe.length > 0 || saringStatus !== 'semua' || cariItem.trim() !== '';

  const itemHalamanIni = useMemo(
    () => itemTersaring.slice((halaman - 1) * ukuranHalaman, halaman * ukuranHalaman),
    [itemTersaring, halaman, ukuranHalaman]
  );

  const itemById = useMemo(() => new Map(items.map((i) => [String(i.item_id), i])), [items]);

  // Kolom biaya standar HANYA dirender untuk peran yang berhak — bukan ditampilkan kosong.
  // API sudah mengembalikan null untuk peran lain; ini lapisan kedua supaya kolomnya tidak
  // muncul sama sekali.
  const headers = useMemo(
    () => [
      { key: 'item_code', header: 'Kode' },
      { key: 'name', header: 'Nama' },
      { key: 'type', header: 'Tipe' },
      { key: 'base_uom', header: 'Satuan dasar' },
      { key: 'purchase_uom', header: 'Satuan beli' },
      { key: 'min_stock_level', header: 'Stok minimum' },
      ...(canViewCost ? [{ key: 'standard_cost', header: 'Biaya standar' }] : []),
      { key: 'is_active', header: 'Status' }
    ],
    [canViewCost]
  );

  const rows = useMemo(
    () =>
      itemHalamanIni.map((i) => ({
        id: String(i.item_id),
        item_code: i.item_code,
        name: i.name,
        type: i.type,
        base_uom: i.base_uom,
        purchase_uom: i.purchase_uom,
        min_stock_level: i.min_stock_level,
        ...(canViewCost ? { standard_cost: i.standard_cost } : {}),
        is_active: i.is_active
      })),
    [itemHalamanIni, canViewCost]
  );

  const isiSel = (item: Item, key: string): React.ReactNode => {
    if (key === 'item_code') return <span className="item-kode">{item.item_code}</span>;
    if (key === 'type') {
      // TAG DI SINI BENAR, dan ini kebalikan dari kesalahan pilot pertama.
      //
      // Tag Carbon untuk MENGGOLONGKAN dan MENYARING — tipe item persis itu: sekumpulan
      // golongan tetap yang dipakai memilah daftar. Yang keliru di pilot pertama adalah
      // memakai Tag untuk STATUS SEBUAH FIELD ("belum diisi"), yang bukan penggolongan.
      return <Tag type={warnaTagTipe(item.type)} size="sm">{typeLabels[item.type] ?? item.type}</Tag>;
    }
    if (key === 'min_stock_level') return <span className="item-angka">{formatNumberId(item.min_stock_level, 2)}</span>;
    if (key === 'standard_cost') return <span className="item-angka">{formatCurrency(item.standard_cost)}</span>;
    if (key === 'is_active') {
      return (
        <Tag type={item.is_active ? 'green' : 'red'} size="sm">
          {item.is_active ? 'Aktif' : 'Nonaktif'}
        </Tag>
      );
    }
    return String((item as unknown as Record<string, unknown>)[key] ?? '');
  };

  const judulKolom = (key: string, header: string) => {
    if (key !== 'standard_cost') return header;
    return (
      <span className="item-judul-kolom">
        {header}
        <ProvenanceInfoButton
          label="Biaya Standar Item"
          envelope={{
            formula:
              'Nilai input manual di form Item — tidak dihitung dari komponen/BOM apa pun. Dipakai sebagai harga master pada perhitungan biaya BOM, Margin Watch, dan Kelayakan Jadwal di seluruh sistem.',
            inputs: [{ label: 'Cara isi/ubah', value: 'Form edit Item → field Biaya Standar' }]
          }}
        />
      </span>
    );
  };

  const detailRows = (item: Item): { label: string; nilai: React.ReactNode }[] => {
    const atau = (v: string | null | undefined) => (v && String(v).trim() ? String(v) : '—');
    const baris: { label: string; nilai: React.ReactNode }[] = [
      { label: 'Kode item', nilai: atau(item.item_code) },
      { label: 'Nama', nilai: item.name },
      { label: 'Tipe', nilai: <Tag type={warnaTagTipe(item.type)} size="sm">{typeLabels[item.type]}</Tag> },
      { label: 'Satuan dasar/pakai', nilai: atau(item.base_uom) },
      { label: 'Satuan beli', nilai: atau(item.purchase_uom) },
      {
        label: 'Faktor konversi',
        nilai: `1 ${item.purchase_uom || 'satuan beli'} = ${formatNumberId(item.uom_conversion_factor ?? 1)} ${item.base_uom || 'satuan dasar'}`
      },
      { label: 'Shelf life', nilai: formatShelfLife(item.shelf_life_days) },
      {
        label: 'Stok minimum',
        // TIGA LAPIS, dan yang ditampilkan adalah yang SEDANG MENANG -- bukan ketiganya
        // berjajar. Urutannya sama persis dengan tentukanAmbang() di stockThreshold.ts.
        nilai:
          item.min_stock_percent !== null && item.min_stock_percent !== undefined
            ? `${formatNumberId(item.min_stock_percent, 2)}% dari total yang pernah masuk (khusus item ini)`
            : persenBawaanPerusahaan !== null && persenBawaanPerusahaan > 0
              ? `${formatNumberId(persenBawaanPerusahaan, 2)}% dari total yang pernah masuk (persen bawaan perusahaan)`
              : Number(item.min_stock_level ?? 0) > 0
                ? `${formatNumberId(item.min_stock_level ?? 0, 2)} (angka tetap)`
                : 'Belum ada ambang — item ini tidak akan pernah memicu peringatan stok.'
      }
      // Reorder Point & Qty DICABUT dari tampilan (MST-21, keputusan pemilik produk
      // 25 Agu 2026). Kolomnya tetap ada di basis data supaya angka lama tidak hilang, tapi
      // tidak muncul di layar mana pun -- Point karena ambangnya dihitung dari kebutuhan
      // produksi, Qty karena ia milik purchasing dan akan hidup di layar mereka.
    ];
    if (canViewCost) {
      baris.push({
        label: 'Biaya standar',
        nilai: item.standard_cost !== null ? formatCurrency(item.standard_cost, { maxDecimals: 0 }) : '—'
      });
    }
    baris.push(
      { label: 'No. registrasi BPOM', nilai: atau(item.bpom_registration_number) },
      { label: 'Kode halal', nilai: atau(item.halal_certificate_number) },
      {
        label: 'Status',
        nilai: (
          <Tag type={item.is_active ? 'green' : 'red'} size="sm">
            {item.is_active ? 'Aktif' : 'Nonaktif'}
          </Tag>
        )
      }
    );
    return baris;
  };

  // MST-16 TETAP UTUH: satu pintu masuk "Detail", dan seluruh aksi (Ubah / Tambah Pemasok /
  // Hapus) hidup DI DALAMNYA. Hapus sengaja tidak ada di baris tabel — tombol hapus yang
  // berjejer rapat di daftar panjang terlalu mudah tertekan pada baris yang salah.
  const renderItemDetail = (item: Item) => (
    <div className="item-detail">
      <h4 className="item-detail__judul">Detail “{item.name}”</h4>
      <dl className="item-detail__daftar">
        {detailRows(item).map((baris) => (
          <div key={baris.label} className="item-detail__baris">
            <dt>{baris.label}</dt>
            <dd>{baris.nilai}</dd>
          </div>
        ))}
      </dl>

      {canManage ? (
        <div className="item-detail__aksi">
          <Button size="md" kind="tertiary" onClick={() => startEdit(item)}>
            Ubah
          </Button>
          {/* Aksi merusak ditempatkan TERPISAH dan BERJAUHAN dari aksi biasa (aturan tetap
              proyek). Di layar sentuh jari jauh lebih besar daripada kursor, dan aksi yang
              tidak bisa dibatalkan tidak boleh berjarak satu jari dari aksi sehari-hari. */}
          <Button size="md" kind="danger--ghost" className="item-detail__hapus" onClick={() => setItemAkanDihapus(item)}>
            Hapus
          </Button>
        </div>
      ) : null}

      {itemActionMessage ? (
        <InlineNotification
          kind={itemActionMessage.kind === 'error' ? 'error' : 'success'}
          title={itemActionMessage.kind === 'error' ? 'Gagal' : 'Berhasil'}
          subtitle={itemActionMessage.message}
          onCloseButtonClick={() => setItemActionMessage(null)}
          lowContrast
        />
      ) : null}

      {renderItemDocuments(item)}
      {item.type === 'raw_material' || item.type === 'packaging' ? renderItemSuppliers(item) : null}
    </div>
  );

  const renderItemDocuments = (item: Item) => (
    <section className="item-bagian">
      <h4 className="item-bagian__judul">Dokumen</h4>
      {/* Ditulis eksplisit di layar, bukan cuma diketahui di kode: banyak bahan memang tidak
          punya dokumen sendiri, dan tanpa kalimat ini orang akan mengira ada yang kurang. */}
      <p className="item-bagian__pengantar">
        COA, Sertifikat Halal, dan Izin Edar BPOM. Ketiganya opsional — item tetap sah tanpa dokumen apa pun.
      </p>

      {itemDocsLoading ? (
        <p className="item-teks--redup">Memuat dokumen…</p>
      ) : itemDocs.length === 0 ? (
        <p className="item-teks--redup">Belum ada dokumen dilampirkan.</p>
      ) : (
        <ul className="item-dokumen">
          {itemDocs.map((d) => {
            const jenis = DOC_TYPE_ITEM.find((t) => t.code === d.doc_type);
            const kedaluwarsa = d.expiry_date ? new Date(`${d.expiry_date}T00:00:00`) < new Date() : false;
            return (
              <li key={d.document_id} className="item-dokumen__baris">
                <div className="item-dokumen__isi">
                  <p className="item-dokumen__judul">{d.title}</p>
                  <p className="item-teks--redup">
                    {jenis?.label ?? d.doc_type}
                    {d.doc_number ? ` · ${d.doc_number}` : ''}
                    {d.expiry_date ? ` · berlaku sampai ${d.expiry_date}` : ''}
                  </p>
                </div>
                <div className="item-dokumen__aksi">
                  {kedaluwarsa ? <Tag type="red" size="sm">Kedaluwarsa</Tag> : null}
                  <Button size="md" kind="ghost" onClick={() => bukaDokumen(d.document_id)}>
                    Buka
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <div className="item-lampir">
          <p className="item-bagian__subjudul">Lampirkan dokumen</p>
          <div className="item-kisi">
            <CarbonSelect
              size="lg"
              id={`doc-type-${item.item_id}`}
              labelText={
                <LabelBantuan teks="Jenis dokumen">
                  Jenis dokumen menentukan apakah tanggal berlakunya wajib diisi. Sertifikat Halal dan Izin Edar BPOM
                  punya masa berlaku; COA melekat pada satu batch bahan dan tidak kedaluwarsa dengan cara yang sama.
                </LabelBantuan>
              }
              value={docForm.doc_type}
              onChange={(e) => setDocForm((p) => ({ ...p, doc_type: e.target.value }))}
            >
              {DOC_TYPE_ITEM.map((t) => (
                <CarbonSelectItem key={t.code} value={t.code} text={t.label} />
              ))}
            </CarbonSelect>

            <TextInput
              size="lg"
              id={`doc-number-${item.item_id}`}
              labelText="Nomor dokumen"
              helperText="Boleh dikosongkan."
              value={docForm.doc_number}
              onChange={(e) => setDocForm((p) => ({ ...p, doc_number: e.target.value }))}
            />

            <TextInput
              size="lg"
              id={`doc-expiry-${item.item_id}`}
              type="date"
              labelText={`Berlaku sampai${DOC_TYPE_ITEM.find((t) => t.code === docForm.doc_type)?.requiresExpiry ? '' : ' (boleh dikosongkan)'}`}
              value={docForm.expiry_date}
              onChange={(e) => setDocForm((p) => ({ ...p, expiry_date: e.target.value }))}
            />

            <TextInput
              size="lg"
              id={`doc-title-${item.item_id}`}
              labelText="Judul"
              helperText="Bila dikosongkan, judulnya diisi otomatis dari jenis dokumen dan nama item."
              value={docForm.title}
              onChange={(e) => setDocForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          <FileUploader
            size="lg"
            labelTitle="Berkas"
            labelDescription="PDF, PNG, JPG, WEBP, XLSX, atau DOCX. Maksimal 20 MB."
            buttonLabel="Pilih berkas"
            accept={['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.xlsx', '.docx']}
            filenameStatus={docFile ? 'edit' : 'uploading'}
            iconDescription="Hapus berkas"
            onChange={(event: React.SyntheticEvent<HTMLElement>) =>
              setDocFile((event.currentTarget as HTMLInputElement).files?.[0] ?? null)
            }
            onDelete={() => setDocFile(null)}
          />

          <div className="item-lampir__aksi">
            <Button size="md" disabled={docStatus === 'uploading'} onClick={() => handleUploadItemDoc(item)}>
              {docStatus === 'uploading' ? 'Mengunggah…' : 'Unggah dokumen'}
            </Button>
          </div>

          {docMessage ? (
            <InlineNotification
              kind={docMessage.kind === 'error' ? 'error' : 'success'}
              title={docMessage.kind === 'error' ? 'Gagal' : 'Tersimpan'}
              subtitle={docMessage.message}
              onCloseButtonClick={() => setDocMessage(null)}
              lowContrast
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );

  const renderItemSuppliers = (item: Item) => (
    <section className="item-bagian">
      <h4 className="item-bagian__judul">Supplier yang memasok “{item.name}”</h4>
      {itemPricesLoading ? (
        <p className="item-teks--redup">Memuat…</p>
      ) : itemPrices.length === 0 ? (
        <p className="item-teks--redup">Belum ada supplier tercatat untuk bahan ini.</p>
      ) : (
        <ul className="item-dokumen">
          {itemPrices.map((price) => (
            <li key={price.supplier_item_price_id} className="item-dokumen__baris">
              <div className="item-dokumen__isi">
                <p className="item-dokumen__judul">{price.supplier_name}</p>
                <p className="item-teks--redup">
                  Harga acuan — belum ada pembelian nyata:{' '}
                  {price.reference_price !== null ? formatCurrency(price.reference_price, { maxDecimals: 0 }) : '-'}
                  {price.price_valid_from ? ` (berlaku sejak ${price.price_valid_from})` : ''}
                </p>
              </div>
              {canManage ? (
                <Button size="md" kind="danger--ghost" onClick={() => setHargaAkanDihapus(price.supplier_item_price_id)}>
                  Hapus
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="item-lampir">
          <p className="item-bagian__subjudul">Tambah supplier pemasok</p>
          <div className="item-kisi">
            <CarbonSelect
              size="lg"
              id={`supplier-${item.item_id}`}
              labelText="Supplier"
              value={newSupplierPriceForm.supplier_id}
              onChange={(e) => setNewSupplierPriceForm((prev) => ({ ...prev, supplier_id: e.target.value }))}
            >
              <CarbonSelectItem value="" text="— pilih supplier —" />
              {suppliersForPicker.map((s) => (
                <CarbonSelectItem key={s.supplier_id} value={String(s.supplier_id)} text={s.name} />
              ))}
            </CarbonSelect>
            <TextInput
              size="lg"
              id={`harga-${item.item_id}`}
              type="number"
              min={0}
              labelText="Harga acuan"
              helperText="Boleh dikosongkan."
              value={newSupplierPriceForm.reference_price}
              onChange={(e) => setNewSupplierPriceForm((prev) => ({ ...prev, reference_price: e.target.value }))}
            />
            <TextInput
              size="lg"
              id={`berlaku-${item.item_id}`}
              type="date"
              labelText="Berlaku sejak"
              value={newSupplierPriceForm.price_valid_from}
              onChange={(e) => setNewSupplierPriceForm((prev) => ({ ...prev, price_valid_from: e.target.value }))}
            />
          </div>
          {supplierPriceFormMessage ? (
            <InlineNotification kind="error" title="Gagal" subtitle={supplierPriceFormMessage} lowContrast onCloseButtonClick={() => setSupplierPriceFormMessage('')} />
          ) : null}
          <div className="item-lampir__aksi">
            <Button size="md" onClick={handleAddItemSupplierPrice}>
              Tambah
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );

  if (checkingAccess) {
    return (
      <div className="halaman">
        <DataTableSkeleton columnCount={7} rowCount={8} showHeader showToolbar />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <KepalaHalaman remah={[]} judul="Daftar item" />
        <InlineNotification
          kind="error"
          title="Sesi tidak valid"
          subtitle="Silakan masuk lagi untuk membuka daftar item."
          hideCloseButton
          lowContrast
        />
        <Button size="lg" onClick={() => router.push('/login?redirectTo=/items')}>
          Ke halaman masuk
        </Button>
      </div>
    );
  }

  return (
    <div className="halaman">
      {/*
        SATU judul saja, dan letaknya di ATAS tabel — bukan dua.

        Versi sebelumnya punya judul halaman "Daftar item" DAN judul tabel "Daftar item" yang
        sama persis, berjarak beberapa sentimeter. Itu bukan gaya Carbon melainkan kelalaian
        saya: anatomi DataTable Carbon memang memuat "Title and description", dan saya
        menambahkan judul halaman sendiri di atasnya tanpa mencabut yang bawaan.
        Judul tabelnya sekarang dicabut; yang tersisa judul halaman, dengan jumlah item
        sebagai keterangannya.

        BREADCRUMB atas permintaan pemilik produk, menggantikan baris "MASTER DATA" yang dulu
        hanya hiasan. Catatan jujur yang perlu diketahui: Carbon menyarankan breadcrumb untuk
        hierarki LEBIH DARI DUA TINGKAT, sedangkan milik kita dua (workspace -> halaman).
        Dipakai tetap, karena ia memberi tahu POSISI dan menyediakan jalan kembali — dua hal
        yang tidak diberikan baris hiasan sebelumnya.

        "Product & Engineering" SENGAJA tidak bisa diklik: ia kelompok di menu kiri, bukan
        halaman. Breadcrumb yang menunjuk halaman tidak ada lebih buruk daripada breadcrumb
        yang jujur bahwa tingkat itu memang bukan halaman.
      */}
      {/* Kepala halaman lewat PINTU BERSAMA `KepalaHalaman`.
          Sebelum 26 Agu 2026 halaman ini menuliskannya sendiri — dan karena itulah halaman
          lain menyalinnya, lalu satu per satu meleset. Cetakannya sekarang hidup di satu
          komponen; halaman berikutnya memanggilnya, bukan menyalinnya. */}
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Product & Engineering' }, { label: 'Items' }]}
        judul="Daftar item"
        pengantar={`${itemTersaring.length} item${adaSaringan ? ` dari ${items.length} yang tercatat` : ' tercatat'}`}
      />

      {itemsError ? (
        <InlineNotification kind="error" title="Gagal memuat" subtitle={itemsError} lowContrast onCloseButtonClick={() => setItemsError('')} />
      ) : null}

      {itemsLoading ? (
        <DataTableSkeleton columnCount={headers.length + 1} rowCount={8} showHeader showToolbar />
      ) : (
        <>
          {/* size="lg" — baris 48px, bukan 40px bawaan.
              Diambil dari SKALA CARBON SENDIRI, bukan dari menimpa tinggi baris. Alasannya
              aturan proyek: target sentuh minimal 44px, dan tombol buka-detail di kiri tiap
              baris mengikuti tinggi barisnya. Diukur pada ukuran bawaan: 32px — terlalu kecil
              untuk jari, apalagi jari bersarung tangan di lantai produksi.
              Carbon juga mensyaratkan baris kepala mengikuti ukuran baris isi; prop `size`
              mengurus keduanya sekaligus. */}
          <DataTable rows={rows} headers={headers} isSortable size="lg">
            {/* Tipe render-prop dibiarkan mengikuti bawaan Carbon lewat parameter tunggal.
                Menuliskan bentuknya sendiri sempat dicoba dan DITOLAK typecheck: bentuk yang
                ditulis tangan tidak akan ikut berubah saat Carbon memperbaruinya, dan itu
                justru jalur kedua yang sedang diberantas. */}
            {(rp) => (
              // TableContainer SENGAJA tanpa title/description: judulnya sudah ada di kepala
              // halaman. Dua judul yang sama persis berjarak beberapa sentimeter membuat orang
              // mengira ada dua hal berbeda.
              <TableContainer {...rp.getTableContainerProps()}>
                <TableToolbar>
                  <TableToolbarContent>
                    {/* MELIPAT, bukan selalu terbuka. `persistent` sengaja DICABUT: bawaan
                        Carbon adalah ikon kaca pembesar yang melebar jadi kolom isian saat
                        diklik. Memaksanya selalu terbuka memakan lebar toolbar yang justru
                        dibutuhkan saringan, dan menghilangkan isyarat bahwa ia bisa ditutup. */}
                    <TableToolbarSearch
                      placeholder="Cari kode atau nama item…"
                      labelText="Cari item"
                      onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => {
                        setCariItem(typeof e === 'string' ? '' : e.target.value);
                        setHalaman(1);
                      }}
                    />

                    <MultiSelect
                      id="saring-tipe"
                      size="lg"
                      className="item-saring"
                      label="Tipe"
                      // titleText + hideLabel, BUKAN titleText kosong.
                      //
                      // Diukur: `titleText=""` tetap merender elemen label, dan kotaknya
                      // terdorong 16px lebih rendah daripada pencarian dan tombol di
                      // sebelahnya. Terlihat sebagai saringan yang "melenceng" dari toolbar.
                      // hideLabel menyembunyikannya secara visual TAPI tetap membacakannya ke
                      // pembaca layar — label yang dibuang sama sekali akan membuat saringan
                      // ini tidak punya nama bagi yang tidak melihat layar.
                      titleText="Tipe"
                      hideLabel
                      items={itemTypes}
                      itemToString={(t: string) => typeLabels[t] ?? t}
                      selectedItems={saringTipe}
                      onChange={({ selectedItems }: { selectedItems: string[] }) => {
                        setSaringTipe(selectedItems ?? []);
                        setHalaman(1);
                      }}
                    />

                    <Dropdown
                      id="saring-status"
                      size="lg"
                      className="item-saring"
                      label="Status"
                      titleText="Status"
                      hideLabel
                      items={['semua', 'aktif', 'nonaktif']}
                      itemToString={(v: string) =>
                        v === 'semua' ? 'Semua status' : v === 'aktif' ? 'Aktif' : 'Nonaktif'
                      }
                      selectedItem={saringStatus}
                      onChange={({ selectedItem }: { selectedItem: 'semua' | 'aktif' | 'nonaktif' }) => {
                        setSaringStatus(selectedItem ?? 'semua');
                        setHalaman(1);
                      }}
                    />

                    {canManage ? (
                      <Button
                        size="lg"
                        renderIcon={Add}
                        onClick={() => {
                          resetForm();
                          setIsFormModalOpen(true);
                        }}
                      >
                        Tambah item
                      </Button>
                    ) : null}
                  </TableToolbarContent>
                </TableToolbar>

                <Table {...rp.getTableProps()} className="tabel-responsif--lebar">
                  <TableHead>
                    <TableRow>
                      <TableExpandHeader aria-label="Buka detail" />
                      {rp.headers.map((h) => {
                        const { key, ...sisa } = rp.getHeaderProps({ header: h }) as { key?: string };
                        void key;
                        return (
                          // Kolom "Biaya standar" SENGAJA tidak bisa diurut.
                          //
                          // Bukan karena mengurutnya tidak berguna, melainkan karena judul
                          // kolomnya memuat tombol Asal-Usul — dan TableHeader yang bisa
                          // diurut adalah sebuah <button>. Menaruh tombol di dalam tombol
                          // menghasilkan HTML tidak sah: peramban boleh merapikannya sesuka
                          // hati, dan tombol Asal-Usulnya bisa berhenti bisa ditekan tanpa
                          // ada yang tahu. Ditemukan dari galat hydration di konsol.
                          <TableHeader key={h.key} {...sisa} isSortable={h.key !== 'standard_cost'}>
                            {judulKolom(String(h.key), String(h.header))}
                          </TableHeader>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rp.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={rp.headers.length + 1}>
                          {adaSaringan ? 'Tidak ada item yang cocok dengan pencarian atau saringan.' : 'Belum ada item.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rp.rows.map((baris) => {
                        const item = itemById.get(baris.id);
                        if (!item) return null;
                        const { key, ...sisaBaris } = rp.getRowProps({ row: baris }) as { key?: string };
                        void key;
                        return (
                          <React.Fragment key={baris.id}>
                            <TableExpandRow
                              {...sisaBaris}
                              isExpanded={expandedItemPricesId === item.item_id}
                              onExpand={() => void toggleItemDetail(item)}
                              aria-label={`Detail ${item.name}`}
                            >
                              {headers.map((h) => (
                                <TableCell key={h.key} data-label={h.header}>
                                  {isiSel(item, h.key)}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow colSpan={headers.length + 1}>
                              {expandedItemPricesId === item.item_id ? renderItemDetail(item) : null}
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
            page={halaman}
            pageSize={ukuranHalaman}
            pageSizes={[15, 30, 50]}
            totalItems={itemTersaring.length}
            onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
              setHalaman(page);
              setUkuranHalaman(pageSize);
            }}
            backwardText="Halaman sebelumnya"
            forwardText="Halaman berikutnya"
            itemsPerPageText="Baris per halaman"
            // Teks bawaan Carbon berbahasa Inggris. Aturan D-3 hanya membolehkan Inggris untuk
            // LABEL NAVIGASI (nama modul); ini isi halaman, jadi Bahasa Indonesia.
            itemRangeText={(mulai: number, akhir: number, total: number) =>
              `${mulai}–${akhir} dari ${total} item`
            }
            pageRangeText={(_current: number, total: number) => `dari ${total} halaman`}
            pageNumberText="Nomor halaman"
          />
        </>
      )}

      {/* ====================================================================
          MODAL ISIAN — transaksional, bukan bertahap.
          ====================================================================
          Sembilan belas field memang banyak, TAPI keputusannya SATU: simpan item. Modal
          bertahap dipakai bila langkahnya berurutan dan saling bergantung — di sini tidak;
          orang bisa mengisi dari mana saja dan menyimpan kapan saja. */}
      {canManage ? (
        <ComposedModal
          open={isFormModalOpen}
          size="md"
          onClose={() => {
            resetForm();
            setIsFormModalOpen(false);
            return true;
          }}
        >
          <ModalHeader
            label="Master data"
            title={editingItemId ? `Ubah item: ${form.item_code}` : 'Tambah item baru'}
            closeModal={() => {
              resetForm();
              setIsFormModalOpen(false);
            }}
          />
          <ModalBody hasForm>
            <form id="form-item" onSubmit={handleSubmit} className="item-form">
              <PenandaLangkah
                langkah={LANGKAH_ITEM}
                aktif={langkah}
                onPindah={setLangkah}
                className="item-form__langkah"
              />

              {/* LANGKAH 1 — Identitas: nama, jenis, pendaftaran resmi, masih dipakai atau tidak. */}
              {langkah === 0 ? (
                <div className="item-form__bagian">
                <TextInput
                  size="lg"
                  id="item_code"
                  labelText="Kode item"
                  value={form.item_code}
                  onChange={(e) => setForm((prev) => ({ ...prev, item_code: e.target.value }))}
                  required
                />
                <TextInput
                  size="lg"
                  id="name"
                  labelText="Nama item"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <CarbonSelect
                  size="lg"
                  id="type"
                  labelText="Tipe"
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                >
                  {itemTypes.map((t) => (
                    <CarbonSelectItem key={t} value={t} text={typeLabels[t]} />
                  ))}
                </CarbonSelect>

                <TextInput
                  size="lg"
                  id="bpom_registration_number"
                  labelText={
                    <LabelBantuan teks="No. registrasi BPOM">
                      Nomor izin edar dari BPOM untuk item ini. Boleh dikosongkan bila item ini belum/tidak punya izin
                      edar sendiri, misalnya bahan baku.
                    </LabelBantuan>
                  }
                  helperText="Contoh: BPOM RI MD 023733999101561."
                  value={form.bpom_registration_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, bpom_registration_number: e.target.value }))}
                />
                <TextInput
                  size="lg"
                  id="halal_certificate_number"
                  labelText={
                    <LabelBantuan teks="Kode halal">
                      Nomor sertifikat halal item ini. Diminta bersama nomor BPOM saat pengurusan izin, jadi disimpan
                      berdampingan. Boleh dikosongkan — banyak bahan baku tidak punya sertifikat halal sendiri.
                    </LabelBantuan>
                  }
                  value={form.halal_certificate_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, halal_certificate_number: e.target.value }))}
                />

                <div className="item-form__lebar">
                  <Checkbox
                    id="is_active"
                    labelText="Aktif"
                    checked={form.is_active}
                    onChange={(_e: unknown, { checked }: { checked: boolean }) => setForm((prev) => ({ ...prev, is_active: checked }))}
                  />
                </div>
                </div>
              ) : null}

              {/* LANGKAH 2 — Satuan: satuan pakai, satuan beli, dan konversinya. */}
              {langkah === 1 ? (
                <div className="item-form__bagian">
                <TextInput
                  size="lg"
                  id="base_uom"
                  labelText={
                    <LabelBantuan teks="Satuan dasar/pakai">
                      Satuan yang dipakai saat bahan ini DIPAKAI di produksi dan dicatat stoknya. Biasanya satuan
                      terkecil, mis. gram untuk bahan yang ditimbang.
                    </LabelBantuan>
                  }
                  helperText="Contoh: g, ml, pcs."
                  value={form.base_uom}
                  onChange={(e) => setForm((prev) => ({ ...prev, base_uom: e.target.value }))}
                  required
                />
                <TextInput
                  size="lg"
                  id="purchase_uom"
                  labelText={
                    <LabelBantuan teks="Satuan beli">
                      Satuan yang tertulis di dokumen pembelian dari supplier. Boleh berbeda dari satuan pakai —
                      selisihnya diisi di Faktor konversi.
                    </LabelBantuan>
                  }
                  helperText="Contoh: kg, liter, dus."
                  value={form.purchase_uom}
                  onChange={(e) => setForm((prev) => ({ ...prev, purchase_uom: e.target.value }))}
                  required
                />

                <div className="item-form__lebar">
                  <TextInput
                    size="lg"
                    id="uom_conversion_factor"
                    type="number"
                    min="0"
                    step="any"
                    labelText={
                      <LabelBantuan teks="Faktor konversi (satuan beli → satuan dasar)">
                        Berapa banyak satuan dasar yang didapat dari SATU satuan beli. Contoh: beli per kg, pakai per
                        gram → isi 1000, karena 1 kg berisi 1000 g. Kalau satuan beli dan satuan pakai sama, isi 1.
                      </LabelBantuan>
                    }
                    helperText="Pilih pola di bawah untuk mengisi cepat, atau ketik angkanya sendiri."
                    value={form.uom_conversion_factor}
                    onChange={(e) => setForm((prev) => ({ ...prev, uom_conversion_factor: e.target.value }))}
                    required
                  />
                  {/* MST-15 — pola konversi umum. Daftar ini SENGAJA pendek dan berisi satuan
                      yang benar-benar dipakai hari ini, bukan tabel konversi universal. */}
                  <div className="item-pola">
                    {POLA_KONVERSI.map((pola) => (
                      <Button
                        key={`${pola.dari}-${pola.ke}-${pola.faktor}`}
                        size="lg"
                        kind="tertiary"
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, uom_conversion_factor: String(pola.faktor) }))}
                      >
                        {pola.dari === 'sama' ? 'Satuannya sama (1)' : `1 ${pola.dari} = ${formatNumberId(pola.faktor)} ${pola.ke}`}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* SATU ISIAN BERPASANGAN, bukan dua field yang kebetulan bersebelahan.
                    =============================================================
                    Diukur 25 Agu 2026: angka dan satuannya SUDAH berdampingan di baris yang
                    sama (kiri 219 dan 564, atas 573 keduanya). Jadi dugaan "terpisah kolom"
                    KELIRU untuk pasangan ini.
                    Yang membuat pemilik produk tidak mengenalinya adalah hal lain: keduanya
                    punya LABEL SENDIRI-SENDIRI ("Shelf life" dan "Satuan shelf life"), sehingga
                    terbaca sebagai DUA field yang tidak berhubungan.

                    Carbon TIDAK punya komponen angka-berpasangan-satuan -- diperiksa di paket
                    terpasang: ada NumberInput dan Select, tidak ada yang menyatukan keduanya.
                    Jadi disatukan lewat FormGroup: SATU legend, dua kontrol di dalamnya. */}
                </div>
              ) : null}

              {/* LANGKAH 3 — Aturan persediaan: masa simpan, stok minimum, biaya standar. */}
              {langkah === 2 ? (
                <div className="item-form__bagian">
                <FormGroup
                  legendText={
                    <LabelBantuan teks="Shelf life">
                      Berapa lama bahan atau produk ini masih layak sejak diproduksi/diterima. Isi angkanya, lalu pilih
                      satuannya — sistem menyimpannya dalam hari, karena tanggal kedaluwarsa tiap lot dihitung dari
                      angka itu (dasar aturan FEFO). Kosongkan bila bahan ini tidak punya masa simpan.
                    </LabelBantuan>
                  }
                  className="item-form__lebar item-berpasangan"
                >
                  <div className="item-berpasangan__isi">
                    <TextInput
                      size="lg"
                      id="shelf_life_days"
                      type="number"
                      min="0"
                      labelText="Angka"
                      hideLabel
                      placeholder="mis. 6"
                      value={form.shelf_life_days}
                      onChange={(e) => setForm((prev) => ({ ...prev, shelf_life_days: e.target.value }))}
                    />
                    <CarbonSelect
                      size="lg"
                      id="shelf_life_unit"
                      labelText="Satuan"
                      hideLabel
                      value={shelfLifeUnit}
                      onChange={(e) => setShelfLifeUnit(e.target.value as ShelfLifeUnit)}
                    >
                      {SHELF_LIFE_UNITS.map((u) => (
                        <CarbonSelectItem key={u} value={u} text={u.charAt(0).toUpperCase() + u.slice(1)} />
                      ))}
                    </CarbonSelect>
                  </div>
                  {/* Hasil konversinya DITAMPILKAN dalam bentuk yang diminta pemilik produk:
                      "6 bulan (180 hari)". Angka harinya itulah yang dipakai menghitung tanggal
                      kedaluwarsa tiap lot; menyembunyikannya membuat pengguna tidak punya cara
                      memeriksa apakah sistem memahami maksudnya. */}
                  <p className="item-berpasangan__hasil">
                    {form.shelf_life_days.trim() && Number(form.shelf_life_days) > 0
                      ? `${form.shelf_life_days} ${shelfLifeUnit} (${shelfLifeToDays(Number(form.shelf_life_days), shelfLifeUnit)} hari)`
                      : 'Boleh dikosongkan bila bahan ini tidak punya masa simpan.'}
                  </p>
                </FormGroup>

                {/* DUA AMBANG YANG SALING MENIADAKAN, jadi WAJIB berdampingan.
                    =============================================================
                    Diukur 25 Agu 2026: sebelumnya persen ada di kolom KETIGA (kiri 908) dan
                    angka mutlak di kolom PERTAMA baris berikutnya (kiri 219, atas 713).
                    Terpisah kolom DAN terpisah baris -- padahal yang satu MEMBATALKAN yang lain.
                    Orang bisa mengisi salah satunya tanpa pernah melihat yang lain. */}
                <FormGroup legendText="Stok minimum" className="item-form__lebar item-berpasangan">
                  <div className="item-berpasangan__isi">
                    <TextInput
                      size="lg"
                      id="min_stock_percent"
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      labelText={
                        <LabelBantuan teks="Persen dari yang pernah masuk">
                          Ambang sebagai PERSEN dari jumlah yang PERNAH MASUK untuk item ini. SENGAJA bukan persen dari
                          stok saat ini: ambang yang dihitung dari stok saat ini ikut turun setiap kali stok turun, jadi
                          justru menghilang ketika stok menipis.
                        </LabelBantuan>
                      }
                      helperText={
                        persenBawaanPerusahaan !== null && persenBawaanPerusahaan > 0
                          ? `Dikosongkan berarti memakai persen bawaan perusahaan, yaitu ${formatNumberId(persenBawaanPerusahaan, 2)}%.`
                          : 'Contoh: 10 berarti diperingatkan saat sisa kurang dari 10% dari total yang pernah masuk.'
                      }
                      value={form.min_stock_percent}
                      onChange={(e) => setForm((prev) => ({ ...prev, min_stock_percent: e.target.value }))}
                    />
                    <TextInput
                      size="lg"
                      id="min_stock_level"
                      type="number"
                      min="0"
                      labelText={
                        <LabelBantuan teks="Angka mutlak">
                          Ambang dalam ANGKA MUTLAK. Dipertahankan untuk item lama yang belum dipindah ke persen.
                        </LabelBantuan>
                      }
                      {...(form.min_stock_percent.trim() && Number(form.min_stock_percent) > 0
                        ? { warn: true, warnText: 'Diabaikan — kolom persen di sebelah sedang terisi, dan persen yang menang.' }
                        : persenBawaanPerusahaan !== null && persenBawaanPerusahaan > 0
                          ? {
                              warn: true,
                              warnText: `Diabaikan — persen bawaan perusahaan ${formatNumberId(persenBawaanPerusahaan, 2)}% yang dipakai.`
                            }
                          : { helperText: 'Dipakai bila kolom persen dikosongkan.' })}
                      value={form.min_stock_level}
                      onChange={(e) => setForm((prev) => ({ ...prev, min_stock_level: e.target.value }))}
                    />
                  </div>
                </FormGroup>

                {/* REORDER POINT & REORDER QTY DICABUT dari form ini (MST-21, keputusan
                    pemilik produk 25 Agu 2026).
                    =============================================================
                    BUKAN disembunyikan, melainkan dipindahkan kepemilikannya:
                      Reorder POINT dihapus dari tampilan mana pun. Ambangnya sudah bisa
                        dihitung sendiri dari kebutuhan produksi; angka yang diketik tangan
                        hanya menambah satu hal yang harus dijaga benar oleh manusia, untuk
                        hasil yang sudah bisa dihitung. Kolomnya tetap ada di basis data.
                      Reorder QTY dipertahankan, tapi pindah ke layar yang diakses purchasing --
                        ia KEPUTUSAN KOMERSIAL (ukuran kemasan supplier, diskon jumlah, ongkos
                        kirim) yang tidak bisa diturunkan dari kebutuhan produksi.
                    Form ini diisi GUDANG, jadi keduanya tidak muncul di sini. */}

                {canViewCost ? (
                  <TextInput
                    size="lg"
                    id="standard_cost"
                    type="number"
                    min="0"
                    labelText="Biaya standar"
                    value={form.standard_cost}
                    onChange={(e) => setForm((prev) => ({ ...prev, standard_cost: e.target.value }))}
                  />
                ) : null}

                </div>
              ) : null}

              {formMessage ? (
                <div className="item-form__lebar">
                  <InlineNotification
                    kind={formStatus === 'success' ? 'success' : 'error'}
                    title={formStatus === 'success' ? 'Tersimpan' : 'Gagal menyimpan'}
                    subtitle={formMessage}
                    onCloseButtonClick={() => setFormMessage('')}
                    lowContrast
                  />
                </div>
              ) : null}
            </form>
          </ModalBody>
          <FooterBertahap
            langkah={LANGKAH_ITEM}
            aktif={langkah}
            onPindah={setLangkah}
            onBatal={() => {
              resetForm();
              setIsFormModalOpen(false);
            }}
            labelAksiAkhir={editingItemId ? 'Simpan perubahan' : 'Tambah item'}
            // Formulir ini punya <form> sungguhan dengan atribut `required` di beberapa field,
            // dan handleSubmit-nya menerima FormEvent. Dipanggil lewat requestSubmit() supaya
            // pemeriksaan wajib-isi bawaan peramban TETAP berjalan — memanggil handler-nya
            // langsung akan melewati pemeriksaan itu tanpa ada yang menyadarinya.
            onSimpan={() => (document.getElementById('form-item') as HTMLFormElement | null)?.requestSubmit()}
            sedangMenyimpan={formStatus === 'pending'}
          />
        </ComposedModal>
      ) : null}

      {/* MODAL BERBAHAYA — menggantikan window.confirm.
          Kalimatnya menyebut NAMA item-nya: konfirmasi yang cuma bertanya "yakin hapus?"
          tidak membantu orang yang salah menekan baris. */}
      <Modal
        open={itemAkanDihapus !== null}
        // sm, bukan md bawaan: Carbon menyediakan xs/sm justru untuk teks pendek dan SATU
        // keputusan — "modals with brief text should be extra small or small to avoid long
        // single lines". Modal md untuk satu kalimat pertanyaan membuat barisnya terlalu
        // panjang untuk dibaca sekali lihat.
        size="sm"
        danger
        modalHeading={
          itemAkanDihapus ? `Hapus “${itemAkanDihapus.name}” (${itemAkanDihapus.item_code || 'tanpa kode'})?` : ''
        }
        modalLabel="Tindakan merusak"
        primaryButtonText="Hapus"
        secondaryButtonText="Batal"
        onRequestClose={() => setItemAkanDihapus(null)}
        onSecondarySubmit={() => setItemAkanDihapus(null)}
        onRequestSubmit={() => itemAkanDihapus && void handleDeleteItem(itemAkanDihapus)}
      >
        <p>
          Bila item ini sudah dipakai di BOM, lot, atau dokumen pembelian, item TIDAK akan dihapus melainkan
          dinonaktifkan, supaya riwayatnya tetap utuh.
        </p>
        <p className="item-modal__catatan">
          Keputusan hapus-atau-nonaktifkan dihitung server, bukan ditanyakan ke Anda — dari layar tidak ada cara
          mengetahui apakah item ini pernah masuk BOM tiga bulan lalu.
        </p>
      </Modal>

      <Modal
        open={hargaAkanDihapus !== null}
        size="sm"
        danger
        modalHeading="Hapus supplier ini dari daftar pemasok bahan ini?"
        modalLabel="Tindakan merusak"
        primaryButtonText="Hapus"
        secondaryButtonText="Batal"
        onRequestClose={() => setHargaAkanDihapus(null)}
        onSecondarySubmit={() => setHargaAkanDihapus(null)}
        onRequestSubmit={() => hargaAkanDihapus !== null && void handleDeleteItemSupplierPrice(hargaAkanDihapus)}
      >
        <p>Harga acuannya ikut terhapus. Riwayat pembelian yang sudah terjadi tidak terpengaruh.</p>
      </Modal>

      {/* Ditempatkan SEKALI di kaki halaman; posisinya (kanan atas, di bawah header)
          diatur komponennya sendiri. */}
      <AreaNotifikasi daftar={notifikasi} onTutup={tutupNotifikasi} />
    </div>
  );
}
