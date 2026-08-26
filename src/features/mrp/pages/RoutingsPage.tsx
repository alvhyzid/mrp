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
  TextInput,
  Tile
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { canManageBom } from '@/lib/roles';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { formatNumberId } from '@/lib/currency';

// HALAMAN ROUTING — dimigrasikan ke Carbon 26 Agu 2026 (DS-09).
//
// POLA: Data table (https://carbondesignsystem.com/patterns/data-table-pattern) — daftar
// master dengan pencarian, saringan, tombol tambah, dan aksi per baris. Cetakannya sama
// dengan halaman Pelanggan supaya kedua layar tidak berbeda bentuk untuk hal yang sama.
//
// MODAL BERTAHAP, bukan transaksional: pengguna menambah dan menghapus baris tahap di
// dalam modal sebelum menyimpan, jadi isinya berubah beberapa kali dalam satu kunjungan.
//
// AKSI MERUSAK DIPISAH: Hapus/Arsipkan sekarang berjarak dari Detail/Edit dan memakai
// kind="danger--tertiary". Sebelumnya keempatnya berdempetan — di layar sentuh, jari jauh
// lebih besar daripada kursor, dan Arsipkan tidak boleh berjarak satu jari dari Edit.

type RoutingStep = {
  routing_step_id: number;
  sequence_no: number;
  step_name: string;
  active_duration_minutes: number;
  duration_per_unit_minutes: number | null;
  wait_duration_minutes: number;
  work_center_id: number | null;
  work_center_name: string | null;
  work_center_code: string | null;
};

type Routing = {
  routing_id: number;
  item_id: number;
  item_code: string | null;
  item_name: string | null;
  item_base_uom: string | null;
  version: number;
  steps: RoutingStep[];
  running_batch_count: number;
  referenced_work_order_count: number;
  can_delete: boolean;
  archived_at: string | null;
  archived_by_name: string | null;
};

type SaringStatus = 'aktif' | 'diarsipkan' | 'semua';

type ItemOption = { item_id: number; item_code: string; name: string; base_uom: string };
type WorkCenterOption = { work_center_id: number; name: string; code: string | null; is_active: boolean };

type FormStep = {
  sequence_no: string;
  step_name: string;
  active_duration_minutes: string;
  duration_per_unit_minutes: string;
  wait_duration_minutes: string;
  work_center_id: string;
};

const emptyFormStep: FormStep = { sequence_no: '', step_name: '', active_duration_minutes: '', duration_per_unit_minutes: '', wait_duration_minutes: '0', work_center_id: '' };

const emptyForm = {
  item_id: '',
  steps: [{ ...emptyFormStep, sequence_no: '1' }] as FormStep[]
};

export default function RoutingsPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const [routings, setRoutings] = useState<Routing[]>([]);
  const [routingsError, setRoutingsError] = useState('');
  const [routingsLoading, setRoutingsLoading] = useState(true);
  // SARINGAN STATUS, bukan kotak centang — bentuknya sama dengan saringan di Master Item.
  // Bawaannya "aktif": yang diarsipkan tidak muncul kecuali diminta.
  const [saringStatus, setSaringStatus] = useState<SaringStatus>('aktif');
  // Yang diarsipkan hanya perlu diambil dari server bila saringannya memintanya.
  const showArchived = saringStatus !== 'aktif';
  const [archiveActionStatus, setArchiveActionStatus] = useState<{ routingId: number; message: string; kind: 'error' | 'success' } | null>(null);

  const [items, setItems] = useState<ItemOption[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenterOption[]>([]);

  const [expandedRoutingId, setExpandedRoutingId] = useState<number | null>(null);
  const [editingRoutingId, setEditingRoutingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formStatus, setFormStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [formMessage, setFormMessage] = useState('');
  // FASE 3 (Carbon "DataTable with toolbar") — form tambah/edit Routing pindah ke
  // modal. TIDAK auto-close saat sukses, sama alasannya dengan BomsPage: handleSubmit
  // sengaja tidak memanggil resetForm() supaya pesan sukses tetap terlihat; modal
  // ditutup manual oleh user.
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  // Pencarian & pembagian halaman dulu diurus komponen DataTable lama (shadcn). Carbon
  // DataTable tidak membawa keduanya, jadi keadaannya hidup di sini.
  const [cari, setCari] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(15);

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadRoutings = useCallback(
    async (includeArchived: boolean) => {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      setRoutingsLoading(true);
      const response = await fetch(`/api/routings${includeArchived ? '?includeArchived=true' : ''}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await response.json();

      if (!response.ok) {
        setRoutingsError(data.error || 'Gagal memuat daftar Routing.');
        setRoutingsLoading(false);
        return;
      }

      setRoutings(data.routings || []);
      setRoutingsError('');
      setRoutingsLoading(false);
    },
    [getAccessToken]
  );

  const loadItems = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const response = await fetch('/api/items', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (response.ok) setItems(data.items || []);
  }, [getAccessToken]);

  const loadWorkCenters = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const response = await fetch('/api/work-centers', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (response.ok) setWorkCenters(data.workCenters || []);
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
        router.replace('/login?redirectTo=/routing');
        return;
      }

      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();

      if (!meResponse.ok) {
        setAccessDenied(true);
        setCheckingAccess(false);
        return;
      }

      setCanManage(canManageBom(meData?.user?.role));
      setCheckingAccess(false);
      await Promise.all([loadRoutings(showArchived), loadItems(), loadWorkCenters()]);
    };

    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadItems, loadWorkCenters]);

  // Muat ulang saat filter "Tampilkan yang diarsipkan" diubah (bukan saat
  // pertama kali mount -- itu sudah ditangani effect di atas).
  const isFirstArchivedFilterRender = useRef(true);
  useEffect(() => {
    if (isFirstArchivedFilterRender.current) {
      isFirstArchivedFilterRender.current = false;
      return;
    }
    loadRoutings(showArchived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saringStatus]);

  const itemsById = useMemo(() => new Map(items.map((item) => [item.item_id, item])), [items]);

  const resetForm = () => {
    setEditingRoutingId(null);
    setForm(emptyForm);
    setFormStatus('idle');
    setFormMessage('');
  };

  const startCreate = () => {
    setExpandedRoutingId(null);
    resetForm();
    setIsFormModalOpen(true);
  };

  const startEdit = (routing: Routing) => {
    setIsFormModalOpen(true);
    setEditingRoutingId(routing.routing_id);
    setExpandedRoutingId(null);
    setForm({
      item_id: String(routing.item_id),
      steps: routing.steps.map((step) => ({
        sequence_no: String(step.sequence_no),
        step_name: step.step_name,
        active_duration_minutes: String(step.active_duration_minutes),
        duration_per_unit_minutes: step.duration_per_unit_minutes !== null ? String(step.duration_per_unit_minutes) : '',
        wait_duration_minutes: String(step.wait_duration_minutes),
        work_center_id: step.work_center_id ? String(step.work_center_id) : ''
      }))
    });
    setFormStatus('idle');
    setFormMessage('');
  };

  const updateStep = (index: number, patch: Partial<FormStep>) => {
    setForm((prev) => ({ ...prev, steps: prev.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) }));
  };

  const addStep = () => {
    setForm((prev) => {
      const nextSequence = prev.steps.length ? Math.max(...prev.steps.map((s) => Number(s.sequence_no) || 0)) + 1 : 1;
      return { ...prev, steps: [...prev.steps, { ...emptyFormStep, sequence_no: String(nextSequence) }] };
    });
  };

  const removeStep = (index: number) => {
    setForm((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  };

  // Dipanggil dari ModalFooter Carbon (onRequestSubmit), bukan dari <form onSubmit>.
  const handleSubmit = async () => {
    setFormStatus('pending');
    setFormMessage('');

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setFormStatus('error');
      setFormMessage('Sesi Anda sudah tidak valid, silakan login ulang.');
      return;
    }

    const stepsPayload = form.steps.map((step) => ({
      sequence_no: Number(step.sequence_no),
      step_name: step.step_name,
      active_duration_minutes: Number(step.active_duration_minutes),
      duration_per_unit_minutes: step.duration_per_unit_minutes === '' ? null : Number(step.duration_per_unit_minutes),
      wait_duration_minutes: step.wait_duration_minutes === '' ? 0 : Number(step.wait_duration_minutes),
      work_center_id: step.work_center_id === '' ? null : Number(step.work_center_id)
    }));

    const payload = {
      ...(editingRoutingId ? { routing_id: editingRoutingId } : {}),
      item_id: Number(form.item_id),
      steps: stepsPayload
    };

    const response = await fetch('/api/routings', {
      method: editingRoutingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      setFormStatus('error');
      setFormMessage(data.error || 'Gagal menyimpan Routing.');
      return;
    }

    // SENGAJA tidak panggil resetForm() di sini — resetForm() juga membersihkan
    // formStatus/formMessage, jadi kalau dipanggil tepat setelah set 'success' di
    // atas, pesan konfirmasi akan langsung ketimpa 'idle'/kosong sebelum sempat
    // dirender (React 18 membatch semua setState di handler yang sama). Reset
    // field form saja di sini, biarkan pesan sukses tetap tampil.
    setFormStatus('success');
    setFormMessage(editingRoutingId ? 'Routing berhasil diperbarui.' : `Routing baru berhasil dibuat (v${data.version}).`);
    setEditingRoutingId(null);
    setForm(emptyForm);
    await loadRoutings(showArchived);
  };

  // Sesi 7 (7.3/7.4) — server yang MEMUTUSKAN hapus vs tolak (deleteRouting)
  // dan hapus vs tolak arsip (archiveRouting), layar hanya menampilkan tombol
  // sesuai can_delete/archived_at yang sudah dihitung server (listRoutings).
  const handleDeleteRouting = async (routing: Routing) => {
    const confirmed = window.confirm(`Hapus permanen Routing "${routing.item_code} v${routing.version}"? Tindakan ini tidak bisa dibatalkan.`);
    if (!confirmed) return;

    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch(`/api/routings/${routing.routing_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();

    if (!response.ok) {
      setArchiveActionStatus({ routingId: routing.routing_id, message: data.error || 'Gagal menghapus Routing.', kind: 'error' });
      return;
    }

    setArchiveActionStatus(null);
    await loadRoutings(showArchived);
  };

  const handleArchiveRouting = async (routing: Routing) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch(`/api/routings/${routing.routing_id}/archive`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();

    if (!response.ok) {
      setArchiveActionStatus({ routingId: routing.routing_id, message: data.error || 'Gagal mengarsipkan Routing.', kind: 'error' });
      return;
    }

    setArchiveActionStatus({ routingId: routing.routing_id, message: 'Routing berhasil diarsipkan.', kind: 'success' });
    await loadRoutings(showArchived);
  };

  const handleRestoreRouting = async (routing: Routing) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch(`/api/routings/${routing.routing_id}/restore`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();

    if (!response.ok) {
      setArchiveActionStatus({ routingId: routing.routing_id, message: data.error || 'Gagal memulihkan Routing.', kind: 'error' });
      return;
    }

    setArchiveActionStatus({ routingId: routing.routing_id, message: 'Routing berhasil dipulihkan.', kind: 'success' });
    await loadRoutings(showArchived);
  };


  // ==========================================================================
  // KOLOM & BARIS
  // ==========================================================================
  // Baris memuat NILAI ASLI, bukan hanya id. Carbon mengurutkan berdasarkan nilai di baris,
  // jadi baris yang cuma berisi id akan menghasilkan tabel yang tombol urutnya ada tapi
  // tidak mengurut apa pun — persis kelas "terlihat berfungsi padahal tidak pernah hidup".
  const kolom = useMemo(
    () => [
      { key: 'item', header: 'Item' },
      { key: 'version', header: 'Versi' },
      { key: 'status', header: 'Status' },
      { key: 'step_count', header: 'Jumlah tahap' },
      { key: 'running_batch_count', header: 'Batch berjalan' },
      { key: 'total_active', header: 'Total durasi aktif' },
      { key: 'aksi', header: 'Aksi' }
    ],
    []
  );

  const adaSaringan = cari.trim() !== '' || saringStatus !== 'aktif';

  const routingTersaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return routings.filter((r) => {
      if (saringStatus === 'aktif' && r.archived_at) return false;
      if (saringStatus === 'diarsipkan' && !r.archived_at) return false;
      if (!kata) return true;
      return `${r.item_code ?? ''} ${r.item_name ?? ''}`.toLowerCase().includes(kata);
    });
  }, [routings, cari, saringStatus]);

  const routingHalamanIni = useMemo(
    () => routingTersaring.slice((halaman - 1) * perHalaman, halaman * perHalaman),
    [routingTersaring, halaman, perHalaman]
  );

  const routingById = useMemo(() => new Map(routings.map((r) => [String(r.routing_id), r])), [routings]);

  const baris = useMemo(
    () =>
      routingHalamanIni.map((r) => ({
        id: String(r.routing_id),
        item: r.item_code ?? '',
        version: r.version,
        status: r.archived_at ? 'Diarsipkan' : 'Aktif',
        step_count: r.steps.length,
        running_batch_count: r.running_batch_count,
        total_active: r.steps.reduce((sum, s) => sum + s.active_duration_minutes, 0),
        aksi: ''
      })),
    [routingHalamanIni]
  );

  const isiSel = (r: Routing, kunci: string) => {
    switch (kunci) {
      case 'item':
        return (
          <div className="routing-sel-item">
            <span className="routing-sel-item__kode">{r.item_code}</span>
            <span className="routing-sel-item__nama">{r.item_name}</span>
          </div>
        );
      case 'version':
        return `v${r.version}`;
      case 'status':
        // Tag dipakai untuk MENGGOLONGKAN baris — itu konteks pemakaian Tag menurut Carbon.
        return r.archived_at ? (
          <Tag type="cool-gray">
            Diarsipkan{r.archived_by_name ? ` oleh ${r.archived_by_name}` : ''} —{' '}
            {new Date(r.archived_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Tag>
        ) : (
          <Tag type="green">Aktif</Tag>
        );
      case 'step_count':
        return r.steps.length;
      case 'running_batch_count':
        return r.running_batch_count > 0 ? <Tag type="magenta">{r.running_batch_count} batch</Tag> : '0';
      case 'total_active':
        return `${r.steps.reduce((sum, s) => sum + s.active_duration_minutes, 0)} mnt`;
      case 'aksi':
        return (
          <div className="routing-aksi">
            <div className="routing-aksi__biasa">
              {canManage && !r.archived_at ? (
                <Button kind="ghost" size="sm" onClick={() => startEdit(r)}>
                  Ubah
                </Button>
              ) : null}
              {canManage && r.archived_at ? (
                <Button kind="ghost" size="sm" onClick={() => handleRestoreRouting(r)}>
                  Pulihkan
                </Button>
              ) : null}
            </div>
            {/* AKSI MERUSAK DIDORONG KE KANAN, terpisah dari aksi sehari-hari. */}
            {canManage && !r.archived_at ? (
              <div className="routing-aksi__merusak">
                {r.can_delete ? (
                  <Button kind="danger--tertiary" size="sm" onClick={() => handleDeleteRouting(r)}>
                    Hapus
                  </Button>
                ) : (
                  <Button kind="danger--tertiary" size="sm" onClick={() => handleArchiveRouting(r)}>
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

  const detailTahap = (r: Routing) => (
    <div className="routing-detail">
      {r.running_batch_count > 0 ? (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title={`Dipakai ${r.running_batch_count} batch berjalan`}
          subtitle="Perubahan tidak akan mengubah batch tersebut — angkanya sudah dibekukan sejak batch itu dimulai."
        />
      ) : null}
      <Table size="lg" className="tabel-responsif">
        <TableHead>
          <TableRow>
            <TableHeader>Urutan</TableHeader>
            <TableHeader>Nama tahap</TableHeader>
            <TableHeader>Work center</TableHeader>
            <TableHeader>Durasi aktif / laju</TableHeader>
            <TableHeader>Durasi tunggu</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {r.steps.map((step) => (
            <TableRow key={step.routing_step_id}>
              <TableCell data-label="Urutan">{step.sequence_no}</TableCell>
              <TableCell data-label="Nama tahap">{step.step_name}</TableCell>
              <TableCell data-label="Work center">{step.work_center_name ? `${step.work_center_name}${step.work_center_code ? ` (${step.work_center_code})` : ''}` : '—'}</TableCell>
              <TableCell data-label="Durasi aktif / laju">
                {step.duration_per_unit_minutes !== null
                  ? `${formatNumberId(step.duration_per_unit_minutes, 6)} mnt/unit (laju)`
                  : `${formatNumberId(step.active_duration_minutes, 2)} mnt`}
              </TableCell>
              <TableCell data-label="Durasi tunggu">{formatNumberId(step.wait_duration_minutes, 2)} mnt</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  if (checkingAccess) {
    return (
      <div className="halaman">
        <DataTableSkeleton columnCount={7} rowCount={6} showHeader showToolbar />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <KepalaHalaman remah={[]} judul="Daftar routing" />
        <InlineNotification kind="error" lowContrast hideCloseButton title="Sesi tidak valid" subtitle="Silakan masuk ulang untuk membuka daftar Routing." />
        <Button className="routing-tombol-masuk" onClick={() => router.push('/login?redirectTo=/routing')}>
          Ke halaman masuk
        </Button>
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Product & Engineering' }, { label: 'Routing' }]}
        judul="Daftar routing"
        pengantar={`${routingTersaring.length} routing${adaSaringan ? ` dari ${routings.length} yang tercatat` : ' tercatat'} — urutan tahap produksi per item, sumber data Gantt produksi & dashboard kapasitas di PPIC.`}
      />

      {routingsError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat Routing" subtitle={routingsError} /> : null}
      {archiveActionStatus ? (
        <InlineNotification
          kind={archiveActionStatus.kind === 'success' ? 'success' : 'error'}
          lowContrast
          title={archiveActionStatus.kind === 'success' ? 'Berhasil' : 'Gagal'}
          subtitle={archiveActionStatus.message}
          onClose={() => {
            setArchiveActionStatus(null);
            return true;
          }}
        />
      ) : null}

      {routingsLoading ? (
        <DataTableSkeleton columnCount={7} rowCount={6} showHeader showToolbar />
      ) : (
        <>
          {/* size="lg" — baris 48px. Target sentuh minimal 44px, dan tombol buka-detail di kiri
              tiap baris mengikuti tinggi barisnya. Sama seperti Master Item. */}
          <DataTable rows={baris} headers={kolom} isSortable size="lg">
            {(rp: any) => (
              // TableContainer SENGAJA tanpa title/description: judulnya sudah ada di kepala
              // halaman, dan DataTable Carbon membawa judulnya sendiri kalau diberi.
              <TableContainer {...rp.getTableContainerProps()}>
                <TableToolbar>
                  <TableToolbarContent>
                    {/* MELIPAT, bukan selalu terbuka. `persistent` sengaja TIDAK dipakai:
                        bawaan Carbon adalah ikon kaca pembesar yang melebar saat diklik. */}
                    <TableToolbarSearch
                      placeholder="Cari kode atau nama item…"
                      labelText="Cari Routing"
                      onChange={(e: React.ChangeEvent<HTMLInputElement> | '') => {
                        setCari(typeof e === 'string' ? '' : e.target.value);
                        setHalaman(1);
                      }}
                    />

                    {/* SARINGAN, bukan kotak centang. Kotak centang hanya bisa menjawab
                        "termasuk arsip atau tidak"; saringan bisa menjawab "khusus yang
                        diarsipkan" juga — dan bentuknya sama dengan saringan di Master Item. */}
                    <Dropdown
                      id="routing-saring-status"
                      size="lg"
                      className="halaman__saring"
                      label="Status"
                      titleText="Status"
                      hideLabel
                      items={['aktif', 'diarsipkan', 'semua']}
                      itemToString={(v: string) => (v === 'aktif' ? 'Aktif' : v === 'diarsipkan' ? 'Diarsipkan' : 'Semua status')}
                      selectedItem={saringStatus}
                      onChange={({ selectedItem }: { selectedItem: SaringStatus }) => {
                        setSaringStatus(selectedItem ?? 'aktif');
                        setHalaman(1);
                      }}
                    />

                    {canManage ? (
                      <Button size="lg" renderIcon={Add} onClick={startCreate}>
                        Tambah Routing
                      </Button>
                    ) : null}
                  </TableToolbarContent>
                </TableToolbar>

                <Table {...rp.getTableProps()} className="tabel-responsif">
                  <TableHead>
                    <TableRow>
                      <TableExpandHeader aria-label="Buka detail tahap" />
                      {rp.headers.map((h: any) => {
                        const { key, ...sisa } = rp.getHeaderProps({ header: h }) as { key?: string };
                        void key;
                        return (
                          // "Total durasi aktif" SENGAJA tidak bisa diurut: judulnya memuat
                          // tombol Asal-Usul, dan TableHeader yang bisa diurut adalah <button>.
                          // Tombol di dalam tombol adalah HTML tidak sah — pelajaran yang sudah
                          // dibayar sekali di Master Item lewat galat hydration.
                          <TableHeader key={h.key} {...sisa} isSortable={h.key !== 'total_active' && h.key !== 'aksi'}>
                            {h.header}
                            {h.key === 'total_active' ? (
                              <ProvenanceInfoButton
                                label="Total durasi aktif"
                                envelope={{
                                  formula:
                                    'Jumlah active_duration_minutes semua tahap SOP routing ini (tidak termasuk wait_duration_minutes/waktu tunggu antar tahap) — angka standar dipakai untuk hitung kapasitas & jadwal, bukan durasi aktual tercatat per batch.',
                                  inputs: [{ label: 'Jumlah tahap dijumlah', value: 'Semua tahap di routing ini' }]
                                }}
                              />
                            ) : null}
                          </TableHeader>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rp.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={kolom.length + 1}>
                          {adaSaringan ? 'Tidak ada Routing yang cocok dengan pencarian atau saringan.' : 'Belum ada Routing.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rp.rows.map((row: any) => {
                        const r = routingById.get(row.id);
                        if (!r) return null;
                        const { key, ...sisaBaris } = rp.getRowProps({ row }) as { key?: string };
                        void key;
                        return (
                          <React.Fragment key={row.id}>
                            {/* BARIS YANG BISA DIMEKARKAN, bukan tombol "Detail" yang membuka
                                kartu terpisah di bawah tabel. Kemampuan ini sudah dibawa
                                DataTable Carbon — aturan C.3 melarang menambal sendiri apa
                                yang komponennya sudah punya. */}
                            <TableExpandRow
                              {...sisaBaris}
                              isExpanded={expandedRoutingId === r.routing_id}
                              onExpand={() => setExpandedRoutingId((kini) => (kini === r.routing_id ? null : r.routing_id))}
                              aria-label={`Detail tahap ${r.item_code}`}
                            >
                              {kolom.map((h) => (
                                <TableCell key={h.key} data-label={h.header}>
                                  {isiSel(r, h.key)}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow colSpan={kolom.length + 1}>
                              {expandedRoutingId === r.routing_id ? detailTahap(r) : null}
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
            pageSize={perHalaman}
            pageSizes={[15, 30, 50]}
            totalItems={routingTersaring.length}
            onChange={({ page, pageSize }: { page: number; pageSize: number }) => {
              setHalaman(page);
              setPerHalaman(pageSize);
            }}
            backwardText="Halaman sebelumnya"
            forwardText="Halaman berikutnya"
            itemsPerPageText="Baris per halaman"
            // Teks bawaan Carbon berbahasa Inggris. Aturan hanya membolehkan Inggris untuk
            // LABEL NAVIGASI; ini isi halaman, jadi Bahasa Indonesia.
            itemRangeText={(mulai: number, akhir: number, total: number) => `${mulai}–${akhir} dari ${total} routing`}
            pageRangeText={(_kini: number, total: number) => `dari ${total} halaman`}
            pageNumberText="Nomor halaman"
          />
        </>
      )}

      {canManage ? (
        <ComposedModal
          open={isFormModalOpen}
          size="lg"
          onClose={() => {
            resetForm();
            setIsFormModalOpen(false);
            return true;
          }}
        >
          <ModalHeader
            label="Master data"
            title={editingRoutingId ? `Ubah Routing: ${form.item_id ? itemsById.get(Number(form.item_id))?.item_code ?? '' : ''}` : 'Buat Routing baru'}
            closeModal={() => {
              resetForm();
              setIsFormModalOpen(false);
            }}
          />
          <ModalBody hasForm>
            <div className="routing-form">
              <Dropdown
                id="routing-item"
                titleText="Item"
                label="Pilih item..."
                size="lg"
                disabled={editingRoutingId !== null}
                items={items}
                itemToString={(item: ItemOption | null) => (item ? `${item.item_code} — ${item.name}` : '')}
                selectedItem={items.find((i) => String(i.item_id) === form.item_id) ?? null}
                onChange={({ selectedItem }: { selectedItem: ItemOption | null }) =>
                  setForm((prev) => ({ ...prev, item_id: selectedItem ? String(selectedItem.item_id) : '' }))
                }
                helperText={editingRoutingId ? 'Item tidak bisa diubah lewat ubah — buat Routing baru kalau perlu item lain.' : undefined}
              />

              <div className="routing-tahap">
                <div className="routing-tahap__kepala">
                  <h2 className="halaman__subjudul halaman__subjudul--rapat">Tahap produksi</h2>
                  <Button kind="tertiary" size="sm" renderIcon={Add} onClick={addStep}>
                    Tambah tahap
                  </Button>
                </div>

                {form.steps.map((step, index) => (
                  <div key={index} className="routing-tahap__baris">
                    <NumberInput
                      id={`routing-urutan-${index}`}
                      label="Urutan"
                      min={1}
                      step={1}
                      value={step.sequence_no === '' ? '' : Number(step.sequence_no)}
                      onChange={(_e: unknown, { value }: { value: number | string }) => updateStep(index, { sequence_no: String(value ?? '') })}
                      allowEmpty
                      hideSteppers
                    />
                    <TextInput
                      id={`routing-nama-${index}`}
                      labelText="Nama tahap"
                      size="lg"
                      placeholder="mis. Mixing adonan"
                      value={step.step_name}
                      onChange={(event) => updateStep(index, { step_name: event.target.value })}
                    />
                    <Dropdown
                      id={`routing-wc-${index}`}
                      titleText="Work center"
                      label="(Tidak ada)"
                      size="lg"
                      items={workCenters}
                      itemToString={(wc: WorkCenterOption | null) => (wc ? `${wc.name}${wc.code ? ` (${wc.code})` : ''}` : '')}
                      selectedItem={workCenters.find((wc) => String(wc.work_center_id) === step.work_center_id) ?? null}
                      onChange={({ selectedItem }: { selectedItem: WorkCenterOption | null }) =>
                        updateStep(index, { work_center_id: selectedItem ? String(selectedItem.work_center_id) : '' })
                      }
                    />
                    <NumberInput
                      id={`routing-aktif-${index}`}
                      label="Durasi aktif (mnt)"
                      min={0}
                      step={1}
                      value={step.active_duration_minutes === '' ? '' : Number(step.active_duration_minutes)}
                      onChange={(_e: unknown, { value }: { value: number | string }) => updateStep(index, { active_duration_minutes: String(value ?? '') })}
                      allowEmpty
                      hideSteppers
                      // HUBUNGAN ANTAR FIELD DIBUAT TERLIHAT, bukan hanya diketahui kode:
                      // mengisi Laju membuat isian ini TIDAK DIPAKAI.
                      helperText={step.duration_per_unit_minutes.trim() ? 'Diabaikan — laju di sebelah kanan yang dipakai.' : undefined}
                    />
                    <TextInput
                      id={`routing-laju-${index}`}
                      labelText="Laju (mnt/unit, opsional)"
                      size="lg"
                      placeholder="kosongkan kalau tetap"
                      helperText="Kalau diisi, ini yang dipakai — durasi aktif diabaikan."
                      value={step.duration_per_unit_minutes}
                      onChange={(event) => updateStep(index, { duration_per_unit_minutes: event.target.value })}
                    />
                    <NumberInput
                      id={`routing-tunggu-${index}`}
                      label="Durasi tunggu (mnt)"
                      min={0}
                      step={1}
                      value={step.wait_duration_minutes === '' ? '' : Number(step.wait_duration_minutes)}
                      onChange={(_e: unknown, { value }: { value: number | string }) => updateStep(index, { wait_duration_minutes: String(value ?? '') })}
                      allowEmpty
                      hideSteppers
                    />
                    <Button kind="danger--tertiary" size="sm" renderIcon={TrashCan} disabled={form.steps.length <= 1} onClick={() => removeStep(index)}>
                      Hapus tahap
                    </Button>
                  </div>
                ))}

                <p className="halaman__redup">
                  Durasi aktif = waktu mesin/work center benar-benar sibuk (dipakai apa adanya kalau laju kosong). Laju = durasi PER UNIT qty batch (mis. tahap dengan mesin
                  berkecepatan tetap) — kalau diisi, ini yang dipakai untuk Gantt/kapasitas/kelayakan, bukan durasi aktif. Durasi tunggu = waktu jeda (mis. curing) — tidak
                  menyibukkan mesin, tapi menunda tahap berikutnya.
                </p>
              </div>

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
          {/* TOMBOL DITULIS SEBAGAI CHILDREN: di @carbon/react 1.114, `children` pada
              ModalFooterProps bersifat WAJIB — prop teks tombolnya ada, tapi tidak cukup
              sendirian. Carbon tetap yang mengatur lebar dan urutannya. */}
          <ModalFooter>
            <Button
              kind="secondary"
              onClick={() => {
                resetForm();
                setIsFormModalOpen(false);
              }}
            >
              {formStatus === 'success' ? 'Tutup' : 'Batal'}
            </Button>
            <Button kind="primary" disabled={formStatus === 'pending'} onClick={handleSubmit}>
              {formStatus === 'pending' ? 'Menyimpan...' : editingRoutingId ? 'Simpan perubahan' : 'Buat Routing'}
            </Button>
          </ModalFooter>
        </ComposedModal>
      ) : null}
    </div>
  );
}
