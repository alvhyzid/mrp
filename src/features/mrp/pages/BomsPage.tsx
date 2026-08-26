'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  ModalHeader,
  NumberInput,
  Pagination,
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
import { FooterBertahap, PenandaLangkah, type LangkahModal } from '@/components/ui/modal-bertahap';
import { AreaNotifikasi, type Notifikasi } from '@/components/ui/notifikasi';
import { canManageBom, canViewFinancialData } from '@/lib/roles';
import { typeLabels } from '../itemTypeLabels';

// BOM — dimigrasikan ke Carbon 26 Agu 2026 (DS-09), cetakan Master Item.
import { formatCurrency, formatNumberId } from '@/lib/currency';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';

const bomStatuses = ['draft', 'active', 'archived'];

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  active: 'Aktif',
  archived: 'Diarsipkan'
};

/// Warna Tag mengikuti ARTI. "Draf" ungu, bukan kuning: ia belum dipakai produksi, dan itu
/// keadaan yang sah — bukan peringatan. "Diarsipkan" abu, juga bukan merah.
const statusWarnaTag: Record<string, 'purple' | 'green' | 'cool-gray'> = {
  draft: 'purple',
  active: 'green',
  archived: 'cool-gray'
};

type BomLine = {
  bom_line_id: number;
  component_item_id: number;
  component_item_code: string | null;
  component_item_name: string | null;
  component_item_type: string | null;
  component_standard_cost: number | null;
  qty_per_unit_output: number;
  uom: string;
  routing_step_id: number | null;
};

type RoutingStepOption = { routing_step_id: number; sequence_no: number; step_name: string };
type RoutingOption = { routing_id: number; item_id: number; steps: RoutingStepOption[] };

type Bom = {
  bom_id: number;
  parent_item_id: number;
  parent_item_code: string | null;
  parent_item_name: string | null;
  parent_item_base_uom: string | null;
  version: number;
  standard_yield_qty: number;
  standard_yield_uom: string;
  standard_yield_basis_note: string | null;
  standard_yield_source: string | null;
  status: string;
  buffer_percentage: number | null;
  lines: BomLine[];
};

type ItemOption = {
  item_id: number;
  item_code: string;
  name: string;
  type: string;
  base_uom: string;
};

type FormLine = {
  component_item_id: string;
  qty_per_batch: string;
  uom: string;
  routing_step_id: string;
};

const emptyFormLine: FormLine = { component_item_id: '', qty_per_batch: '', uom: '', routing_step_id: '' };

const yieldSourceLabels: Record<string, string> = {
  ESTIMASI_MANUAL: 'Estimasi Manual',
  DIPELAJARI: 'Dipelajari dari Batch Nyata'
};

const emptyForm = {
  parent_item_id: '',
  standard_yield_qty: '',
  standard_yield_uom: '',
  standard_yield_basis_note: '',
  standard_yield_source: '',
  status: 'draft',
  buffer_percentage: '',
  lines: [{ ...emptyFormLine }] as FormLine[]
};

// LANGKAH FORMULIR BOM (DS-18, 26 Agu 2026) — mengikuti cetakan PO klien.
//
// DUA langkah, bukan tiga. "Buffer & status" sempat direncanakan jadi langkah tersendiri dan
// dibatalkan: isinya hanya dua field dan keduanya TIDAK punya konteks sendiri — buffer
// menerangkan hasil standar, status menerangkan resepnya. Memisahkannya akan melahirkan
// langkah yang judulnya terpaksa menyebut dua hal, dan itu yang dilarang uji pemecahan.
const LANGKAH_BOM: LangkahModal[] = [
  { judul: 'Resep', ringkas: 'Item induk & hasil standar' },
  { judul: 'Komponen', ringkas: 'Bahan dan jumlahnya' }
];

export default function BomsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [canViewCost, setCanViewCost] = useState(false);

  const [boms, setBoms] = useState<Bom[]>([]);
  const [bomsError, setBomsError] = useState('');
  const [bomsLoading, setBomsLoading] = useState(true);

  const [items, setItems] = useState<ItemOption[]>([]);
  const [routings, setRoutings] = useState<RoutingOption[]>([]);

  const [viewingBomId, setViewingBomId] = useState<number | null>(null);
  const [editingBomId, setEditingBomId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formStatus, setFormStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [formMessage, setFormMessage] = useState('');
  // FASE 3 (Carbon "DataTable with toolbar") — form tambah/edit BOM pindah ke modal.
  // TIDAK auto-close saat sukses (beda dari halaman lain) — sengaja mempertahankan
  // perilaku asli di atas (pesan sukses tetap harus terlihat, resetForm() TIDAK
  // dipanggil di handleSubmit supaya formMessage tidak ikut ke-reset); modal ditutup
  // manual oleh user (Batal/X/klik luar), yang barulah memanggil resetForm().
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [langkah, setLangkah] = useState(0);
  // Hasil yang BERHASIL lewat notifikasi, bukan pesan di dalam modal yang keburu tertutup.
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const beriTahu = useCallback((jenis: Notifikasi['jenis'], judul: string, rincian?: string) => {
    setNotifikasi((lama) => [...lama, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, jenis, judul, rincian }]);
  }, []);
  const tutupNotifikasi = useCallback((id: string) => setNotifikasi((lama) => lama.filter((n) => n.id !== id)), []);


  // Pencarian, saringan, dan pembagian halaman: Carbon DataTable tidak membawanya.
  const [cari, setCari] = useState('');
  const [saringStatus, setSaringStatus] = useState<string>('semua');
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(15);
  const adaSaringan = cari.trim() !== '' || saringStatus !== 'semua';

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadBoms = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    setBomsLoading(true);
    const response = await fetch('/api/boms', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();

    if (!response.ok) {
      setBomsError(data.error || 'Gagal memuat daftar BOM.');
      setBomsLoading(false);
      return;
    }

    setBoms(data.boms || []);
    setBomsError('');
    setBomsLoading(false);
  }, [getAccessToken]);

  const loadItems = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch('/api/items', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    if (response.ok) {
      setItems(data.items || []);
    }
  }, [getAccessToken]);

  const loadRoutings = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch('/api/routings', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    if (response.ok) {
      setRoutings(data.routings || []);
    }
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
        router.replace('/login?redirectTo=/boms');
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

      setCanManage(canManageBom(meData?.user?.role));
      setCanViewCost(canViewFinancialData(meData?.user?.role));
      setCheckingAccess(false);
      await Promise.all([loadBoms(), loadItems(), loadRoutings()]);
    };

    checkAccessAndLoad();
  }, [router, loadBoms, loadItems, loadRoutings]);

  const itemsById = useMemo(() => new Map(items.map((item) => [item.item_id, item])), [items]);
  const routingByItemId = useMemo(() => new Map(routings.map((r) => [r.item_id, r])), [routings]);
  const routingStepById = useMemo(() => {
    const map = new Map<number, RoutingStepOption>();
    for (const routing of routings) {
      for (const step of routing.steps) map.set(step.routing_step_id, step);
    }
    return map;
  }, [routings]);
  const selectedParentRouting = routingByItemId.get(Number(form.parent_item_id));

  const resetForm = () => {
    setLangkah(0);
    setEditingBomId(null);
    setForm(emptyForm);
    setFormStatus('idle');
    setFormMessage('');
  };

  const startCreate = () => {
    setViewingBomId(null);
    resetForm();
    setIsFormModalOpen(true);
  };

  const startEdit = (bom: Bom) => {
    setIsFormModalOpen(true);
    setEditingBomId(bom.bom_id);
    setViewingBomId(null);
    setForm({
      parent_item_id: String(bom.parent_item_id),
      standard_yield_qty: String(bom.standard_yield_qty),
      standard_yield_uom: bom.standard_yield_uom,
      standard_yield_basis_note: bom.standard_yield_basis_note ?? '',
      standard_yield_source: bom.standard_yield_source ?? '',
      status: bom.status,
      buffer_percentage: bom.buffer_percentage !== null && bom.buffer_percentage !== undefined ? String(bom.buffer_percentage) : '',
      lines: bom.lines.map((line) => ({
        component_item_id: String(line.component_item_id),
        // Ditampilkan sebagai "jumlah per batch standar" supaya intuitif diisi orang
        // produksi — disimpan di database sebagai qty_per_unit_output (per 1 unit
        // hasil), dikonversi bolak-balik dengan standard_yield_qty.
        qty_per_batch: String(line.qty_per_unit_output * bom.standard_yield_qty),
        uom: line.uom,
        routing_step_id: line.routing_step_id ? String(line.routing_step_id) : ''
      }))
    });
    setFormStatus('idle');
    setFormMessage('');
  };

  const updateLine = (index: number, patch: Partial<FormLine>) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line))
    }));
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, { ...emptyFormLine }] }));
  };

  const removeLine = (index: number) => {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  };

  const handleParentItemChange = (value: string) => {
    setForm((prev) => {
      const selected = itemsById.get(Number(value));
      return {
        ...prev,
        parent_item_id: value,
        standard_yield_uom: prev.standard_yield_uom || selected?.base_uom || ''
      };
    });
  };

  const handleComponentChange = (index: number, value: string) => {
    const selected = itemsById.get(Number(value));
    updateLine(index, {
      component_item_id: value,
      uom: form.lines[index].uom || selected?.base_uom || ''
    });
  };

  // Dipanggil dari ModalFooter Carbon, bukan dari <form onSubmit>.
  const handleSubmit = async () => {
    setFormStatus('pending');
    setFormMessage('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setFormStatus('error');
      setFormMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }

    const standardYieldQty = Number(form.standard_yield_qty);
    if (!standardYieldQty || standardYieldQty <= 0) {
      setFormStatus('error');
      setFormMessage('Jumlah hasil standar harus lebih besar dari 0.');
      return;
    }

    const linesPayload = form.lines.map((line) => ({
      component_item_id: Number(line.component_item_id),
      // Konversi dari "per batch standar" (yang diisi user) ke "per unit output"
      // (yang disimpan di database) — prinsip BOM per-unit-output di CLAUDE.md.
      qty_per_unit_output: Number(line.qty_per_batch) / standardYieldQty,
      uom: line.uom,
      routing_step_id: line.routing_step_id ? Number(line.routing_step_id) : null
    }));

    const payload = {
      ...(editingBomId ? { bom_id: editingBomId } : {}),
      parent_item_id: Number(form.parent_item_id),
      standard_yield_qty: standardYieldQty,
      standard_yield_uom: form.standard_yield_uom,
      standard_yield_basis_note: form.standard_yield_basis_note,
      standard_yield_source: form.standard_yield_source,
      status: form.status,
      buffer_percentage: form.buffer_percentage === '' ? null : Number(form.buffer_percentage),
      lines: linesPayload
    };

    const response = await fetch('/api/boms', {
      method: editingBomId ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      setFormStatus('error');
      setFormMessage(data.error || 'Gagal menyimpan BOM.');
      return;
    }

    // SENGAJA tidak panggil resetForm() di sini — resetForm() juga membersihkan
    // formStatus/formMessage, jadi kalau dipanggil tepat setelah set 'success' di
    // atas, pesan konfirmasi akan langsung ketimpa 'idle'/kosong sebelum sempat
    // dirender (React 18 membatch semua setState di handler yang sama). Reset
    // field form saja di sini, biarkan pesan sukses tetap tampil.
    const memperbarui = editingBomId !== null;
    setFormStatus('idle');
    setFormMessage('');
    setEditingBomId(null);
    setForm(emptyForm);
    setLangkah(0);
    setIsFormModalOpen(false);
    beriTahu('success', memperbarui ? 'BOM diperbarui' : 'BOM baru dibuat');
    await loadBoms();
  };


  // ==========================================================================
  // TABEL BOM — cetakan Master Item
  // ==========================================================================
  const kolom = useMemo(
    () => [
      { key: 'parent_item', header: 'Item (hasil)' },
      { key: 'version', header: 'Versi' },
      { key: 'status', header: 'Status' },
      { key: 'yield', header: 'Hasil standar' },
      { key: 'line_count', header: 'Jumlah komponen' },
      { key: 'aksi', header: 'Aksi' }
    ],
    []
  );

  const bomTersaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return boms.filter((b) => {
      if (saringStatus !== 'semua' && b.status !== saringStatus) return false;
      if (!kata) return true;
      return `${b.parent_item_code ?? ''} ${b.parent_item_name ?? ''}`.toLowerCase().includes(kata);
    });
  }, [boms, cari, saringStatus]);

  const bomHalamanIni = useMemo(() => bomTersaring.slice((halaman - 1) * perHalaman, halaman * perHalaman), [bomTersaring, halaman, perHalaman]);
  const bomById = useMemo(() => new Map(boms.map((b) => [String(b.bom_id), b])), [boms]);

  const baris = useMemo(
    () =>
      bomHalamanIni.map((b) => ({
        id: String(b.bom_id),
        parent_item: b.parent_item_code ?? '',
        version: b.version,
        status: statusLabels[b.status] ?? b.status,
        yield: b.standard_yield_qty,
        line_count: b.lines.length,
        aksi: ''
      })),
    [bomHalamanIni]
  );

  const isiSel = (b: Bom, kunci: string) => {
    switch (kunci) {
      case 'parent_item':
        return (
          <div className="bom-sel-item">
            <span className="bom-sel-item__kode">{b.parent_item_code}</span>
            <span className="bom-sel-item__nama">{b.parent_item_name}</span>
          </div>
        );
      case 'version':
        return `v${b.version}`;
      case 'status':
        return <Tag type={statusWarnaTag[b.status] ?? 'gray'}>{statusLabels[b.status] ?? b.status}</Tag>;
      case 'yield':
        // Angka dibulatkan DI LAYAR, tapi yang dipakai perhitungan tetap presisi penuh —
        // itu sebabnya ada tanda ±, dan angka penuhnya ada di panel Asal-Usul.
        return `±${formatNumberId(Math.round(b.standard_yield_qty), 0)} ${b.parent_item_base_uom ?? b.standard_yield_uom}`;
      case 'line_count':
        return b.lines.length;
      case 'aksi':
        return canManage ? (
          <Button kind="ghost" size="sm" onClick={() => startEdit(b)}>
            Ubah
          </Button>
        ) : (
          <span className="halaman__redup">—</span>
        );
      default:
        return null;
    }
  };

  const detailBom = (b: Bom) => (
    <div className="bom-detail">
      <div className="bom-detail__kepala">
        <h3 className="halaman__subjudul halaman__subjudul--rapat">
          Komponen per ±{formatNumberId(Math.round(b.standard_yield_qty), 0)} {b.parent_item_base_uom ?? b.standard_yield_uom}
        </h3>
        <ProvenanceInfoButton
          label="Hasil standar per batch"
          envelope={{
            formula: b.standard_yield_basis_note ?? 'Belum ada keterangan asal angka — isi lewat formulir ubah BOM.',
            inputs: [
              {
                label: 'Angka presisi penuh dipakai perhitungan',
                value: `${formatNumberId(b.standard_yield_qty, 6)} ${b.parent_item_base_uom ?? b.standard_yield_uom} per batch`
              }
            ],
            standardStatus: b.standard_yield_source as 'ESTIMASI_MANUAL' | 'DIPELAJARI' | null
          }}
        />
      </div>
      {b.buffer_percentage !== null && b.buffer_percentage !== undefined ? (
        <p className="halaman__redup">Buffer {formatNumberId(b.buffer_percentage, 2)}% — kebutuhan bahan per batch dihitung dengan tambahan ini.</p>
      ) : null}

      <Table size="lg" className="tabel-responsif">
        <TableHead>
          <TableRow>
            <TableHeader>Komponen</TableHeader>
            <TableHeader>Tipe</TableHeader>
            <TableHeader>
              Jumlah per batch
              <ProvenanceInfoButton
                label="Jumlah per batch"
                envelope={{
                  formula:
                    'Per Unit Output (kolom di sebelah kanan) × Hasil Standar per Batch BOM ini. Angka skala-batch, supaya kelihatan total kebutuhan komponen kalau produksi 1 batch penuh sesuai resep.',
                  inputs: [
                    { label: 'Hasil standar per batch', value: `${formatNumberId(b.standard_yield_qty, 6)} ${b.parent_item_base_uom ?? b.standard_yield_uom}` }
                  ]
                }}
              />
            </TableHeader>
            <TableHeader>Per unit output</TableHeader>
            <TableHeader>Tahap SOP</TableHeader>
            {canViewCost ? (
              <TableHeader>
                Biaya standar
                <ProvenanceInfoButton
                  label="Biaya standar komponen"
                  envelope={{
                    formula:
                      'Diambil langsung dari items.standard_cost milik item komponen ini — data master (input manual di halaman Item), bukan hasil kalkulasi BOM.',
                    inputs: [{ label: 'Sumber', value: 'Master Item → Biaya Standar' }]
                  }}
                />
              </TableHeader>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {b.lines.map((line) => (
            <TableRow key={line.bom_line_id}>
              <TableCell data-label="Komponen">
                <div className="bom-sel-item">
                  <span className="bom-sel-item__kode">{line.component_item_code}</span>
                  <span className="bom-sel-item__nama">{line.component_item_name}</span>
                </div>
              </TableCell>
              <TableCell data-label="Tipe">
                {line.component_item_type ? <Tag type="outline">{typeLabels[line.component_item_type] ?? line.component_item_type}</Tag> : null}
              </TableCell>
              <TableCell data-label="Jumlah per batch">
                {(line.qty_per_unit_output * b.standard_yield_qty).toLocaleString('id-ID', { maximumFractionDigits: 4 })} {line.uom}
              </TableCell>
              <TableCell data-label="Per unit output">
                {line.qty_per_unit_output.toLocaleString('id-ID', { maximumFractionDigits: 6 })} {line.uom}
              </TableCell>
              <TableCell data-label="Tahap SOP">
                {line.routing_step_id && routingStepById.get(line.routing_step_id) ? (
                  `${routingStepById.get(line.routing_step_id)!.sequence_no}. ${routingStepById.get(line.routing_step_id)!.step_name}`
                ) : (
                  <span className="halaman__redup">Sejak tahap 1</span>
                )}
              </TableCell>
              {canViewCost ? <TableCell data-label="Biaya standar">{formatCurrency(line.component_standard_cost)}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

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
        <KepalaHalaman remah={[]} judul="Daftar BOM" />
        <InlineNotification kind="error" lowContrast hideCloseButton title="Sesi tidak valid" subtitle="Silakan masuk ulang untuk membuka daftar BOM." />
        <Button className="bom-tombol-masuk" onClick={() => router.push('/login?redirectTo=/boms')}>
          Ke halaman masuk
        </Button>
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Product & Engineering' }, { label: 'BOM' }]}
        judul="Daftar BOM"
        pengantar={`${bomTersaring.length} BOM${adaSaringan ? ` dari ${boms.length} yang tercatat` : ' tercatat'} — resep/komposisi per item hasil, dihitung PER UNIT OUTPUT supaya resepnya ikut berskala.`}
      />

      {bomsError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat BOM" subtitle={bomsError} /> : null}

      {bomsLoading ? (
        <DataTableSkeleton columnCount={6} rowCount={6} showHeader showToolbar />
      ) : (
        <>
          <DataTable rows={baris} headers={kolom} isSortable size="lg">
            {(rp: any) => (
              <TableContainer {...rp.getTableContainerProps()}>
                <TableToolbar>
                  <TableToolbarContent>
                    {/* MELIPAT, bukan selalu terbuka — bawaan Carbon, `persistent` tidak dipakai. */}
                    <TableToolbarSearch
                      placeholder="Cari kode atau nama item hasil…"
                      labelText="Cari BOM"
                      onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => {
                        setCari(typeof e === 'string' ? '' : e.target.value);
                        setHalaman(1);
                      }}
                    />
                    <Dropdown
                      id="bom-saring-status"
                      size="lg"
                      className="halaman__saring"
                      label="Status"
                      titleText="Status"
                      hideLabel
                      items={['semua', ...bomStatuses]}
                      itemToString={(v: string) => (v === 'semua' ? 'Semua status' : statusLabels[v] ?? v)}
                      selectedItem={saringStatus}
                      onChange={({ selectedItem }: { selectedItem: string | null }) => {
                        setSaringStatus(selectedItem ?? 'semua');
                        setHalaman(1);
                      }}
                    />
                    {canManage ? (
                      <Button size="lg" renderIcon={Add} onClick={startCreate}>
                        Tambah BOM
                      </Button>
                    ) : null}
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...rp.getTableProps()} className="tabel-responsif">
                  <TableHead>
                    <TableRow>
                      <TableExpandHeader aria-label="Buka daftar komponen" />
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
                        <TableCell colSpan={kolom.length + 1}>
                          {adaSaringan ? 'Tidak ada BOM yang cocok dengan pencarian atau saringan.' : 'Belum ada BOM.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rp.rows.map((row: any) => {
                        const b = bomById.get(row.id);
                        if (!b) return null;
                        const { key, ...sisaBaris } = rp.getRowProps({ row }) as { key?: string };
                        void key;
                        return (
                          <React.Fragment key={row.id}>
                            <TableExpandRow
                              {...sisaBaris}
                              isExpanded={viewingBomId === b.bom_id}
                              onExpand={() => {
                                setViewingBomId((kini) => (kini === b.bom_id ? null : b.bom_id));
                                setEditingBomId(null);
                              }}
                              aria-label={`Komponen ${b.parent_item_code}`}
                            >
                              {kolom.map((h) => (
                                <TableCell key={h.key} data-label={h.header}>
                                  {isiSel(b, h.key)}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow colSpan={kolom.length + 1}>{viewingBomId === b.bom_id ? detailBom(b) : null}</TableExpandedRow>
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
            pageSize={perHalaman}
            pageSizes={[15, 30, 50]}
            totalItems={bomTersaring.length}
            onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
              setHalaman(page);
              setPerHalaman(pageSize);
            }}
            backwardText="Halaman sebelumnya"
            forwardText="Halaman berikutnya"
            itemsPerPageText="Baris per halaman"
            itemRangeText={(mulai: number, akhir: number, total: number) => `${mulai}–${akhir} dari ${total} BOM`}
            pageRangeText={(_kini: number, total: number) => `dari ${total} halaman`}
            pageNumberText="Nomor halaman"
          />
        </>
      )}

      {canManage ? (
        // MODAL BERTAHAP: komponen ditambah dan dihapus sebelum disimpan.
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
            title={editingBomId ? `Ubah BOM: ${form.parent_item_id ? itemsById.get(Number(form.parent_item_id))?.item_code ?? '' : ''}` : 'Buat BOM baru'}
            closeModal={() => {
              resetForm();
              setIsFormModalOpen(false);
            }}
          />
          <ModalBody hasForm>
            <div className="bom-form">
              <PenandaLangkah
                langkah={LANGKAH_BOM}
                aktif={langkah}
                onPindah={setLangkah}
                className="bom-form__langkah"
              />

              {/* LANGKAH 1 — Item induk & hasil standar: resep ini untuk apa, dan sekali buat jadi berapa. */}
              {langkah === 0 ? (
                <div className="bom-form__bagian">
                <div className="bom-form__kisi">
                  <Dropdown
                    id="bom-item-induk"
                    size="lg"
                    titleText="Item hasil (induk)"
                    label="Pilih item..."
                    disabled={editingBomId !== null}
                    items={items}
                    itemToString={(i: ItemOption | null) => (i ? `${i.item_code} — ${i.name}` : '')}
                    selectedItem={items.find((i) => String(i.item_id) === form.parent_item_id) ?? null}
                    onChange={({ selectedItem }: { selectedItem: ItemOption | null }) => handleParentItemChange(selectedItem ? String(selectedItem.item_id) : '')}
                    helperText={editingBomId ? 'Item induk tidak bisa diubah — buat BOM baru kalau perlu item lain.' : undefined}
                  />
                  {/* HASIL STANDAR: angka dan satuan adalah SATU isian, jadi satu label. */}
                  <div className="bom-form__hasil">
                    <span className="cds--label">Hasil standar per batch</span>
                    <div className="bom-form__hasil-isi">
                      <NumberInput
                        id="bom-hasil-qty"
                        label="Jumlah"
                        hideLabel
                        min={0}
                        allowEmpty
                        hideSteppers
                        value={form.standard_yield_qty === '' ? '' : Number(form.standard_yield_qty)}
                        onChange={(_e: unknown, { value }: { value: number | string }) => setForm((prev) => ({ ...prev, standard_yield_qty: String(value ?? '') }))}
                      />
                      <TextInput
                        id="bom-hasil-satuan"
                        size="lg"
                        labelText="Satuan"
                        hideLabel
                        placeholder="satuan"
                        value={form.standard_yield_uom}
                        onChange={(event) => setForm((prev) => ({ ...prev, standard_yield_uom: event.target.value }))}
                      />
                    </div>
                  </div>
                  <Dropdown
                    id="bom-sumber-hasil"
                    size="lg"
                    titleText="Sumber angka hasil standar"
                    label="Belum ditentukan"
                    items={Object.keys(yieldSourceLabels)}
                    itemToString={(v: string) => yieldSourceLabels[v] ?? v}
                    selectedItem={form.standard_yield_source || null}
                    onChange={({ selectedItem }: { selectedItem: string | null }) => setForm((prev) => ({ ...prev, standard_yield_source: selectedItem ?? '' }))}
                  />
                  <Dropdown
                    id="bom-status"
                    size="lg"
                    titleText="Status"
                    label="Pilih status"
                    items={bomStatuses}
                    itemToString={(v: string) => statusLabels[v] ?? v}
                    selectedItem={form.status}
                    onChange={({ selectedItem }: { selectedItem: string | null }) => setForm((prev) => ({ ...prev, status: selectedItem ?? 'draft' }))}
                  />
                  <NumberInput
                    id="bom-buffer"
                    label="Buffer (%)"
                    min={0}
                    max={100}
                    allowEmpty
                    hideSteppers
                    helperText="Kompensasi kehilangan produksi — dipakai saat menghitung kebutuhan bahan per batch."
                    value={form.buffer_percentage === '' ? '' : Number(form.buffer_percentage)}
                    onChange={(_e: unknown, { value }: { value: number | string }) => setForm((prev) => ({ ...prev, buffer_percentage: String(value ?? '') }))}
                  />
                  <TextInput
                    id="bom-keterangan-hasil"
                    size="lg"
                    className="bom-form__lebar-penuh"
                    labelText="Keterangan asal angka hasil standar"
                    placeholder='mis. "10.000 g adonan × yield 85% ÷ 2,5 g/gummy ÷ 60 gummy/botol"'
                    helperText="Ini yang muncul di panel Asal-Usul — tulisan di sini yang menjelaskan angkanya kelak."
                    value={form.standard_yield_basis_note}
                    onChange={(event) => setForm((prev) => ({ ...prev, standard_yield_basis_note: event.target.value }))}
                  />
                </div>
                </div>
              ) : null}

              {/* LANGKAH 2 — Komponen: bahan apa saja dan berapa banyak. */}
              {langkah === 1 ? (
                <div className="bom-form__bagian">
                <div className="bom-komponen">
                  <div className="bom-komponen__kepala">
                    <h3 className="halaman__subjudul halaman__subjudul--rapat">
                      Komponen per {form.standard_yield_qty || '?'} {form.standard_yield_uom || 'satuan hasil'}
                    </h3>
                    <Button kind="tertiary" size="sm" renderIcon={Add} onClick={addLine}>
                      Tambah komponen
                    </Button>
                  </div>

                  {form.lines.map((line, index) => (
                    <div key={index} className="bom-komponen__baris">
                      <Dropdown
                        id={`bom-komponen-${index}`}
                        size="lg"
                        titleText="Item komponen"
                        label="Pilih item..."
                        items={items.filter((item) => String(item.item_id) !== form.parent_item_id)}
                        itemToString={(i: ItemOption | null) => (i ? `${i.item_code} — ${i.name} (${typeLabels[i.type] ?? i.type})` : '')}
                        selectedItem={items.find((i) => String(i.item_id) === line.component_item_id) ?? null}
                        onChange={({ selectedItem }: { selectedItem: ItemOption | null }) => handleComponentChange(index, selectedItem ? String(selectedItem.item_id) : '')}
                      />
                      <NumberInput
                        id={`bom-qty-${index}`}
                        label="Jumlah per batch"
                        min={0}
                        allowEmpty
                        hideSteppers
                        value={line.qty_per_batch === '' ? '' : Number(line.qty_per_batch)}
                        onChange={(_e: unknown, { value }: { value: number | string }) => updateLine(index, { qty_per_batch: String(value ?? '') })}
                      />
                      <TextInput
                        id={`bom-satuan-${index}`}
                        size="lg"
                        labelText="Satuan"
                        value={line.uom}
                        onChange={(event) => updateLine(index, { uom: event.target.value })}
                      />
                      {selectedParentRouting ? (
                        <Dropdown
                          id={`bom-tahap-${index}`}
                          size="lg"
                          titleText="Tahap SOP"
                          label="Sejak tahap 1 (bawaan)"
                          items={['', ...[...selectedParentRouting.steps].sort((a, b) => a.sequence_no - b.sequence_no).map((s) => String(s.routing_step_id))]}
                          itemToString={(v: string) => {
                            if (!v) return 'Sejak tahap 1 (bawaan)';
                            const step = selectedParentRouting.steps.find((s) => String(s.routing_step_id) === v);
                            return step ? `${step.sequence_no}. ${step.step_name}` : v;
                          }}
                          selectedItem={line.routing_step_id || ''}
                          onChange={({ selectedItem }: { selectedItem: string | null }) => updateLine(index, { routing_step_id: selectedItem ?? '' })}
                        />
                      ) : (
                        <TextInput
                          id={`bom-tahap-kosong-${index}`}
                          size="lg"
                          labelText="Tahap SOP"
                          readOnly
                          value="Item induk belum punya Routing"
                          helperText="Buat Routing untuk item induknya dulu supaya komponen bisa ditempelkan ke tahap tertentu."
                        />
                      )}
                      <Button kind="danger--tertiary" size="sm" renderIcon={TrashCan} disabled={form.lines.length <= 1} onClick={() => removeLine(index)}>
                        Hapus komponen
                      </Button>
                    </div>
                  ))}
                </div>

                </div>
              ) : null}

              {formMessage ? (
                <InlineNotification
                  kind={formStatus === 'success' ? 'success' : 'error'}
                  lowContrast
                  hideCloseButton
                  title={formStatus === 'success' ? 'Berhasil' : 'Gagal menyimpan'}
                  subtitle={formMessage}
                />
              ) : null}
            </div>
          </ModalBody>
          <FooterBertahap
            langkah={LANGKAH_BOM}
            aktif={langkah}
            onPindah={setLangkah}
            onBatal={() => {
              resetForm();
              setIsFormModalOpen(false);
            }}
            labelAksiAkhir={editingBomId ? 'Simpan perubahan' : 'Buat BOM'}
            onSimpan={() => void handleSubmit()}
            sedangMenyimpan={formStatus === 'pending'}
          />
        </ComposedModal>
      ) : null}

      {/* Ditempatkan SEKALI di kaki halaman; posisinya (kanan atas, di bawah header)
          diatur komponennya sendiri. */}
      <AreaNotifikasi daftar={notifikasi} onTutup={tutupNotifikasi} />
    </div>
  );
}
