'use client';

import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import {
  Button,
  Checkbox,
  DataTableSkeleton,
  Dropdown,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile
} from '@carbon/react';
import { ChevronDown, ChevronRight } from '@carbon/icons-react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
// Aturan urutan hidup di modul tersendiri supaya bisa diuji tanpa merender halaman --
// lihat src/features/mrp/buildTaskSorting.ts dan tests/build_task_sorting.test.ts.
import { sortBuildTasks, URGENCY_RANK, type SortKey } from '@/features/mrp/buildTaskSorting';

// Halaman Daftar Tugas Pembangunan (21 Agu 2026) — HALAMAN HANYA BACA (A.2).
// Tidak ada tombol tambah/ubah/hapus di sini sama sekali — task hanya dibuat/
// ditutup lewat migrasi oleh Claude Code (ditegakkan di server: build_tasks
// tidak punya policy RLS insert/update/delete untuk authenticated/anon).

type BuildTask = {
  build_task_id: number;
  task_code: string;
  name: string;
  module_code: string;
  module_name: string;
  description: string;
  effect_description: string;
  urgency: 'super_urgent' | 'mendesak' | 'penting' | 'bisa_menunggu' | 'tidak_mendesak';
  tags: string[];
  pic: string;
  status: 'menunggu' | 'sedang_dikerjakan' | 'menunggu_persetujuan' | 'selesai' | 'ditunda_sadar' | 'dibatalkan';
  link_url: string | null;
  origin: 'pemilik_produk' | 'temuan_claude' | 'perencanaan_awal';
  detail_pekerjaan: string;
  notes: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  approved_at: string | null;
  super_urgent_since: string | null;
  approval_review_steps: string | null;
  approval_location: string | null;
  approval_example_case: string | null;
  approval_if_approved: string | null;
  approval_if_rejected: string | null;
  approval_options: string | null;
  aman_paralel: boolean;
};

const URGENCY_ORDER = ['super_urgent', 'mendesak', 'penting', 'bisa_menunggu', 'tidak_mendesak'] as const;
const URGENCY_LABELS: Record<string, string> = {
  super_urgent: 'SUPER URGENT',
  mendesak: 'Mendesak',
  penting: 'Penting',
  bisa_menunggu: 'Bisa Menunggu',
  tidak_mendesak: 'Tidak Mendesak'
};
// Urgensi TIDAK dirender sebagai Tag sederajat status -- cuma dua tingkat teratas yang
// dapat garis tepi kiri baris, supaya urgensi terlihat tanpa bersaing visual dengan warna
// status. Garisnya kini hidup di build-tasks.scss lewat kelas `tugas-baris--<urgensi>`,
// bukan sebagai kelas utilitas di dalam TSX.

const STATUS_LABELS: Record<string, string> = {
  menunggu: 'Menunggu',
  sedang_dikerjakan: 'Sedang Dikerjakan',
  menunggu_persetujuan: 'MENUNGGU PERSETUJUAN',
  selesai: 'Selesai',
  ditunda_sadar: 'Ditunda Sadar',
  dibatalkan: 'Dibatalkan'
};
// Satu sumber warna status (Y.3-style -- satu tempat, bukan disebar). Hijau =
// selesai, biru = menunggu persetujuan, kuning = sedang dikerjakan, abu-abu
// netral = menunggu, abu-abu pudar = ditunda sadar, abu-abu dicoret = dibatalkan.
/// Satu sumber warna status. "Ditunda sadar" dan "dibatalkan" SENGAJA abu-abu dingin, bukan
/// merah: keduanya keputusan yang sah dan tercatat, bukan kegagalan.
const STATUS_WARNA_TAG: Record<string, 'gray' | 'magenta' | 'blue' | 'green' | 'cool-gray'> = {
  menunggu: 'gray',
  sedang_dikerjakan: 'magenta',
  menunggu_persetujuan: 'blue',
  selesai: 'green',
  ditunda_sadar: 'cool-gray',
  dibatalkan: 'cool-gray'
};

const ORIGIN_LABELS: Record<string, string> = {
  pemilik_produk: 'Dari Pemilik Produk',
  temuan_claude: 'Temuan Claude Code',
  perencanaan_awal: 'Perencanaan Awal'
};

const ALL_TAGS = ['Visual', 'Teks/Bahasa', 'Fungsi', 'Database', 'Formula', 'Keamanan', 'Data', 'Integrasi', 'Dokumentasi'];

// II.1 — Kode dan Status paling kiri: itu yang paling sering dicari. Kolom tanpa `key`
// tidak bisa disortir (Tag berisi banyak nilai, Aksi bukan data).
const KOLOM_TABEL: { key: SortKey | null; label: string }[] = [
  { key: 'task_code', label: 'Kode' },
  { key: 'name', label: 'Nama' },
  { key: 'status', label: 'Status' },
  { key: 'urgency', label: 'Urgensi' },
  { key: 'pic', label: 'PIC' },
  { key: null, label: 'Tag' },
  { key: 'age', label: 'Menggantung' },
  { key: null, label: 'Aksi' }
];

// D.3 — ambang jumlah SUPER URGENT belum selesai sebelum keterangan penjaga
// muncul. Keputusan teknis (bisa diubah kapan saja): 3.
const AMBANG_SUPER_URGENT = 3;

function isTaskDone(status: string) {
  // F.3: task Menunggu Persetujuan dihitung BELUM SELESAI.
  return status === 'selesai';
}

function isTaskUnresolved(status: string) {
  return status !== 'selesai' && status !== 'dibatalkan';
}

// B.2 — "menggantung di status sekarang", bahasa manusia, bukan timestamp
// mentah. Keputusan teknis: ambil timestamp yang paling relevan dengan status
// AKTIF saat ini (menunggu->created_at, sedang_dikerjakan->started_at,
// menunggu_persetujuan->completed_at, selesai->approved_at).
function ageInCurrentStatus(task: BuildTask): string | null {
  let since: string | null = null;
  if (task.status === 'menunggu') since = task.created_at;
  else if (task.status === 'sedang_dikerjakan') since = task.started_at ?? task.created_at;
  else if (task.status === 'menunggu_persetujuan') since = task.completed_at ?? task.created_at;
  else if (task.status === 'selesai') since = task.approved_at ?? task.completed_at;
  else return null;
  if (!since) return null;

  const days = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'hari ini';
  if (days === 1) return '1 hari';
  return `${days} hari`;
}

export default function BuildTasksPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterPic, setFilterPic] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [tagMode, setTagMode] = useState<'contains' | 'only'>('contains');
  const [onlyParallelSafe, setOnlyParallelSafe] = useState(false);

  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  // II.3 — sortKey null berarti URUTAN DEFAULT (bukan "belum disortir"): urgensi dari
  // atas, belum selesai lebih dulu, SUPER URGENT selalu paling atas.
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [taskHistory, setTaskHistory] = useState<Record<number, { urgencyHistory: any[]; approvalHistory: any[] }>>({});

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const authedFetch = useCallback(
    async (path: string) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error('Sesi tidak valid.');
      const response = await fetch(path, { headers: { Authorization: `Bearer ${accessToken}` } });
      return { ok: response.ok, body: await response.json() };
    },
    [getAccessToken]
  );

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/build-tasks');
        return;
      }
      setCheckingAccess(false);
      setLoading(true);
      const { ok, body } = await authedFetch('/api/build-tasks');
      if (!ok) {
        setError(body.error || 'Gagal memuat Daftar Tugas Pembangunan.');
        setLoading(false);
        return;
      }
      setTasks(body.tasks || []);
      setLoading(false);
    };
    checkAccessAndLoad();
  }, [router, authedFetch]);

  const toggleTaskDetail = async (task: BuildTask) => {
    if (expandedTaskId === task.build_task_id) {
      setExpandedTaskId(null);
      return;
    }
    setExpandedTaskId(task.build_task_id);
    if (!taskHistory[task.build_task_id]) {
      const { ok, body } = await authedFetch(`/api/build-tasks/${task.build_task_id}/history`);
      if (ok) setTaskHistory((prev) => ({ ...prev, [task.build_task_id]: body }));
    }
  };

  // Isi baris yang DIMEKARKAN. Satu fungsi dipakai tabel (layar lebar) dan kartu
  // (layar sempit) supaya isinya tidak pernah berbeda antar bentuk.
  const renderDetailTask = (t: BuildTask) => {
    const history = taskHistory[t.build_task_id];
    return (
      <div className="flex flex-col gap-2 text-xs">
        <p>
          <span className="font-medium text-foreground">Penjelasan:</span> {t.description}
        </p>
        <p>
          <span className="font-medium text-foreground">Pengaruh ke sistem:</span> {t.effect_description}
        </p>
        <p>
          <span className="font-medium text-foreground">Detail pekerjaan:</span> {t.detail_pekerjaan}
        </p>
        {t.notes ? (
          <p>
            <span className="font-medium text-foreground">Catatan:</span> {t.notes}
          </p>
        ) : null}
        <p>
          <span className="font-medium text-foreground">Asal task:</span> {ORIGIN_LABELS[t.origin]}
        </p>
        {history ? (
          <>
            {history.urgencyHistory.length > 0 ? (
              <div>
                <p className="font-medium text-foreground">Riwayat perubahan urgensi:</p>
                <ul className="list-disc pl-4">
                  {history.urgencyHistory.map((h: any, i: number) => (
                    <li key={i}>
                      {URGENCY_LABELS[h.old_urgency] ?? h.old_urgency ?? '(baru dibuat)'} &rarr; {URGENCY_LABELS[h.new_urgency] ?? h.new_urgency} — {new Date(h.changed_at).toLocaleDateString('id-ID')} atas permintaan {h.requested_by}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {history.approvalHistory.length > 0 ? (
              <div>
                <p className="font-medium text-foreground">Riwayat persetujuan:</p>
                <ul className="list-disc pl-4">
                  {history.approvalHistory.map((h: any, i: number) => (
                    <li key={i}>
                      {h.action} — {new Date(h.at).toLocaleDateString('id-ID')}
                      {h.note ? `: ${h.note}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };
  const resetSort = () => {
    setSortKey(null);
    setSortDir('asc');
  };

  // Satu tempat untuk seluruh aturan urutan. Dipakai di dalam TIAP modul.
  const sortTasks = useCallback((list: BuildTask[]) => sortBuildTasks(list, sortKey, sortDir), [sortKey, sortDir]);

  const clearFilters = () => {
    setFilterPic('');
    setFilterModule('');
    setFilterStatus('');
    setFilterUrgency('');
    setFilterTag('');
    setTagMode('contains');
    setOnlyParallelSafe(false);
  };

  const filtersActive = !!(filterPic || filterModule || filterStatus || filterUrgency || filterTag || onlyParallelSafe);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterPic && t.pic !== filterPic) return false;
      if (filterModule && t.module_code !== filterModule) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterUrgency && t.urgency !== filterUrgency) return false;
      if (onlyParallelSafe && !t.aman_paralel) return false;
      if (filterTag) {
        if (tagMode === 'only') {
          // C.2(b) "hanya tag ini saja" -- task campuran TIDAK ikut muncul.
          if (!(t.tags.length === 1 && t.tags[0] === filterTag)) return false;
        } else {
          // C.2(a) "mengandung tag ini" -- task campuran ikut muncul.
          if (!t.tags.includes(filterTag)) return false;
        }
      }
      return true;
    });
  }, [tasks, filterPic, filterModule, filterStatus, filterUrgency, filterTag, tagMode, onlyParallelSafe]);

  const picOptions = useMemo(() => Array.from(new Set(tasks.map((t) => t.pic))).sort(), [tasks]);

  const modules = useMemo(() => {
    const map = new Map<string, { module_code: string; module_name: string; tasks: BuildTask[] }>();
    for (const t of filteredTasks) {
      if (!map.has(t.module_code)) map.set(t.module_code, { module_code: t.module_code, module_name: t.module_name, tasks: [] });
      map.get(t.module_code)!.tasks.push(t);
    }
    const list = Array.from(map.values());
    // D.2: modul berisi SUPER URGENT naik ke atas, dan task SUPER URGENT-nya
    // sendiri jadi baris pertama di dalam modul itu.
    for (const mod of list) {
      mod.tasks.sort((a, b) => {
        const aSuper = a.urgency === 'super_urgent' && isTaskUnresolved(a.status);
        const bSuper = b.urgency === 'super_urgent' && isTaskUnresolved(b.status);
        if (aSuper !== bSuper) return aSuper ? -1 : 1;
        return 0;
      });
    }
    list.sort((a, b) => {
      const aSuper = a.tasks.some((t) => t.urgency === 'super_urgent' && isTaskUnresolved(t.status));
      const bSuper = b.tasks.some((t) => t.urgency === 'super_urgent' && isTaskUnresolved(t.status));
      if (aSuper !== bSuper) return aSuper ? -1 : 1;
      return a.module_code.localeCompare(b.module_code);
    });
    return list;
  }, [filteredTasks]);

  const pendingApproval = useMemo(() => tasks.filter((t) => t.status === 'menunggu_persetujuan'), [tasks]);
  const unresolvedSuperUrgentCount = useMemo(() => tasks.filter((t) => t.urgency === 'super_urgent' && isTaskUnresolved(t.status)).length, [tasks]);

  const totalDone = filteredTasks.filter((t) => isTaskDone(t.status)).length;
  const totalPercent = filteredTasks.length > 0 ? Math.round((totalDone / filteredTasks.length) * 100) : 0;

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tag of ALL_TAGS) counts[tag] = tasks.filter((t) => t.tags.includes(tag)).length;
    return counts;
  }, [tasks]);

  // PENGECUALIAN YANG DISENGAJA — JANGAN "dirapikan" jadi seragam tertutup.
  //
  // Aturan tampilan: default seluruh modul TERTUTUP (II.2). Dua pengecualian di bawah
  // bukan kelalaian, dan keduanya ditegaskan ulang oleh pemilik produk 24 Agu 2026
  // setelah melihat hasilnya:
  //
  // - Modul ber-SUPER URGENT terbuka otomatis (D.2). Menyembunyikan hal yang paling
  //   genting di balik baris yang harus diklik dulu melawan tujuan penandaan itu sendiri.
  // - Modul yang cocok dengan saringan aktif terbuka otomatis (F.2). Hasil saringan yang
  //   tersembunyi sama saja dengan saringan yang tidak bekerja.
  //
  // Lihat juga bagian "Daftar Tugas — Modul ber-SUPER URGENT SENGAJA Terbuka Otomatis"
  // di CLAUDE.md.
  const isModuleOpen = (moduleCode: string, hasSuperUrgent: boolean) => {
    if (filtersActive) return true;
    if (hasSuperUrgent) return true;
    return openModules.has(moduleCode);
  };
  const toggleModule = (moduleCode: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleCode)) next.delete(moduleCode);
      else next.add(moduleCode);
      return next;
    });
  };
  const openAll = () => setOpenModules(new Set(modules.map((m) => m.module_code)));
  const closeAll = () => setOpenModules(new Set());


  if (checkingAccess) {
    return (
      <div className="halaman">
        <DataTableSkeleton columnCount={8} rowCount={8} showHeader showToolbar />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <KepalaHalaman remah={[]} judul="Daftar tugas pembangunan" />
        <InlineNotification kind="error" lowContrast hideCloseButton title="Akses ditolak" subtitle="Halaman ini khusus pemilik produk dan tim internal." />
        <Button className="tugas-tombol-kembali" onClick={() => router.push('/dashboard')}>
          Kembali ke ringkasan
        </Button>
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Internal' }, { label: 'Build Tasks' }]}
        judul="Daftar tugas pembangunan"
        pengantar={`${totalDone} dari ${filteredTasks.length} task selesai (${totalPercent}%)${filtersActive ? ' — hasil saringan' : ''}, tersebar di ${modules.length} modul.`}
      />

      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title="Halaman ini hanya menampilkan"
        subtitle="Task dibuat dan ditutup lewat migrasi, bukan dari layar ini. Tiap task punya tiga label berbeda yang bisa bernilai berbeda pada task yang sama: status (progres pekerjaan), urgensi (seberapa mendesak), dan tag (jenis pekerjaan). Itu bukan kontradiksi."
      />

      {error ? <InlineNotification kind="error" lowContrast hideCloseButton title="Gagal memuat" subtitle={error} /> : null}

      {loading ? (
        <DataTableSkeleton columnCount={8} rowCount={8} showHeader showToolbar />
      ) : (
        <>
          {/* MENUNGGU PERSETUJUAN — menonjol, terpisah dari daftar modul. */}
          {pendingApproval.length > 0 ? (
            <>
              <h2 className="halaman__subjudul">Menunggu persetujuan Anda ({pendingApproval.length})</h2>
              {pendingApproval.map((t) => (
                <Tile key={t.build_task_id} className="tugas-persetujuan">
                  <div className="tugas-persetujuan__kepala">
                    <span className="tugas-kode">{t.task_code}</span>
                    <span>{t.name}</span>
                    <Tag type="cool-gray">{t.module_name}</Tag>
                  </div>
                  <StructuredListWrapper isCondensed aria-label={`Persetujuan ${t.task_code}`}>
                    <StructuredListBody>
                      {[
                        ['Apa yang perlu diperiksa', t.approval_review_steps],
                        ['Di mana', t.approval_location],
                        ['Contoh kasus', t.approval_example_case],
                        ['Bila disetujui', t.approval_if_approved],
                        ['Bila ditolak', t.approval_if_rejected],
                        ...(t.approval_options ? [['Pilihan & rekomendasi', t.approval_options]] : [])
                      ].map(([label, nilai]) => (
                        <StructuredListRow key={String(label)}>
                          <StructuredListCell noWrap>{label}</StructuredListCell>
                          <StructuredListCell>{nilai}</StructuredListCell>
                        </StructuredListRow>
                      ))}
                    </StructuredListBody>
                  </StructuredListWrapper>
                  {t.link_url ? (
                    <Link href={t.link_url} className="cds--link">
                      Buka layar terkait
                    </Link>
                  ) : null}
                </Tile>
              ))}
            </>
          ) : null}

          {/* Keterangan penjaga, HANYA keterangan — bukan blokir. */}
          {unresolvedSuperUrgentCount > AMBANG_SUPER_URGENT ? (
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title={`${unresolvedSuperUrgentCount} task SUPER URGENT belum selesai`}
              subtitle="Makin banyak yang paling mendesak, makin tidak ada yang benar-benar mendesak."
            />
          ) : null}

          <div className="tugas-hitung-tag">
            {ALL_TAGS.map((tag) => (
              <Tag key={tag} type="cool-gray">
                {tag}: {tagCounts[tag]}
              </Tag>
            ))}
          </div>

          <h2 className="halaman__subjudul">Saringan</h2>
          <div className="tugas-saringan">
            <Dropdown
              id="tugas-saring-pic"
              size="lg"
              titleText="PIC"
              label="Semua PIC"
              items={['', ...picOptions]}
              itemToString={(v: string) => (v === '' ? 'Semua PIC' : v)}
              selectedItem={filterPic}
              onChange={({ selectedItem }: { selectedItem: string | null }) => setFilterPic(selectedItem ?? '')}
            />
            <Dropdown
              id="tugas-saring-status"
              size="lg"
              titleText="Status"
              label="Semua status"
              items={['', ...Object.keys(STATUS_LABELS)]}
              itemToString={(v: string) => (v === '' ? 'Semua status' : STATUS_LABELS[v] ?? v)}
              selectedItem={filterStatus}
              onChange={({ selectedItem }: { selectedItem: string | null }) => setFilterStatus(selectedItem ?? '')}
            />
            <Dropdown
              id="tugas-saring-urgensi"
              size="lg"
              titleText="Urgensi"
              label="Semua urgensi"
              items={['', ...URGENCY_ORDER]}
              itemToString={(v: string) => (v === '' ? 'Semua urgensi' : URGENCY_LABELS[v] ?? v)}
              selectedItem={filterUrgency}
              onChange={({ selectedItem }: { selectedItem: string | null }) => setFilterUrgency(selectedItem ?? '')}
            />
            <Dropdown
              id="tugas-saring-modul"
              size="lg"
              titleText="Modul"
              label="Semua modul"
              items={['', ...Array.from(new Set(tasks.map((t) => t.module_code))).sort()]}
              itemToString={(v: string) => (v === '' ? 'Semua modul' : tasks.find((t) => t.module_code === v)?.module_name ?? v)}
              selectedItem={filterModule}
              onChange={({ selectedItem }: { selectedItem: string | null }) => setFilterModule(selectedItem ?? '')}
            />
            <Dropdown
              id="tugas-saring-tag"
              size="lg"
              titleText="Tag"
              label="Semua tag"
              items={['', ...ALL_TAGS]}
              itemToString={(v: string) => (v === '' ? 'Semua tag' : v)}
              selectedItem={filterTag}
              onChange={({ selectedItem }: { selectedItem: string | null }) => setFilterTag(selectedItem ?? '')}
            />
            {/* DUA CARA MENYARING TAG dibedakan tegas. RadioButtonGroup Carbon menggantikan
                dua <input type="radio"> mentah — perilakunya sama, tapi ia ikut berubah saat
                komponen bersamanya diperbaiki. */}
            <RadioButtonGroup
              legendText="Cara menyaring tag"
              name="tugas-mode-tag"
              valueSelected={tagMode}
              disabled={!filterTag}
              onChange={(v: string | number | undefined) => setTagMode(v === 'only' ? 'only' : 'contains')}
            >
              <RadioButton labelText="Mengandung tag ini" value="contains" id="tugas-tag-contains" />
              <RadioButton labelText="Hanya tag ini saja" value="only" id="tugas-tag-only" />
            </RadioButtonGroup>
            <Checkbox
              id="tugas-paralel"
              labelText="Hanya yang aman dikerjakan paralel"
              checked={onlyParallelSafe}
              onChange={(_e: unknown, { checked }: { checked: boolean }) => setOnlyParallelSafe(checked)}
            />
            <Button kind="tertiary" size="lg" onClick={clearFilters}>
              Hapus semua saringan
            </Button>
          </div>

          <div className="tugas-alat">
            {/* Penanda urutan manual HANYA muncul saat pengguna menyortir sendiri. Tanpa
                penanda ini, urutan yang tidak biasa terlihat seperti urutan biasa, dan
                SUPER URGENT yang tidak lagi di atas bisa terlewat. */}
            {sortKey ? (
              <div className="tugas-alat__urutan">
                <Tag type="magenta">
                  Urutan diubah manual ({KOLOM_TABEL.find((k) => k.key === sortKey)?.label}
                  {sortDir === 'asc' ? ', naik' : ', turun'}) — SUPER URGENT tidak lagi otomatis di atas
                </Tag>
                <Button kind="ghost" size="sm" onClick={resetSort}>
                  Kembali ke urutan bawaan
                </Button>
              </div>
            ) : (
              <span className="halaman__redup">
                {modules.length} modul{filtersActive ? ' (mengikuti saringan)' : ''}
              </span>
            )}
            <div className="tugas-alat__buka-tutup">
              <Button kind="ghost" size="sm" onClick={openAll}>
                Buka semua
              </Button>
              <Button kind="ghost" size="sm" onClick={closeAll}>
                Tutup semua
              </Button>
            </div>
          </div>

          {/* MODUL BISA DIBUKA-TUTUP.
              Accordion Carbon TIDAK dipakai di sini, dan itu disengaja: modul yang memuat
              SUPER URGENT belum selesai WAJIB terbuka otomatis (keputusan D.2, ditegaskan
              ulang pemilik produk 24 Agu 2026), dan Accordion Carbon tidak menyediakan
              "terbuka karena isinya genting" — hanya terbuka karena diklik. Yang dipakai
              tetap tombol Carbon + panel, dengan keadaan terbuka dihitung sendiri. */}
          <div className="tugas-modul-daftar">
            {modules.map((mod) => {
              const done = mod.tasks.filter((t) => isTaskDone(t.status)).length;
              const pct = mod.tasks.length > 0 ? Math.round((done / mod.tasks.length) * 100) : 0;
              const hasSuperUrgent = mod.tasks.some((t) => t.urgency === 'super_urgent' && isTaskUnresolved(t.status));
              const allDone = mod.tasks.length > 0 && done === mod.tasks.length;
              const open = isModuleOpen(mod.module_code, hasSuperUrgent);
              return (
                <div key={mod.module_code} className={`tugas-modul${hasSuperUrgent ? ' tugas-modul--genting' : allDone ? ' tugas-modul--selesai' : ''}`}>
                  <Button
                    kind="ghost"
                    className="tugas-modul__tombol"
                    renderIcon={open ? ChevronDown : ChevronRight}
                    onClick={() => toggleModule(mod.module_code)}
                  >
                    <span className="tugas-modul__nama">{mod.module_name}</span>
                    {hasSuperUrgent ? <Tag type="red">SUPER URGENT</Tag> : null}
                    {!hasSuperUrgent && allDone ? <Tag type="green">Semua selesai</Tag> : null}
                    <span className="tugas-modul__angka">
                      {mod.tasks.length} task · {done} selesai · {pct}%{filtersActive ? ' (hasil saringan)' : ''}
                    </span>
                  </Button>

                  {open ? (
                    <Table size="lg" className="tabel-responsif">
                      <TableHead>
                        <TableRow>
                          {KOLOM_TABEL.map((k) => (
                            <TableHeader
                              key={k.label}
                              isSortable={Boolean(k.key)}
                              onClick={k.key ? () => toggleSort(k.key as SortKey) : undefined}
                              sortDirection={sortKey === k.key ? (sortDir === 'asc' ? 'ASC' : 'DESC') : 'NONE'}
                              isSortHeader={sortKey === k.key}
                            >
                              {k.label}
                            </TableHeader>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortTasks(mod.tasks).map((t) => {
                          const isExpanded = expandedTaskId === t.build_task_id;
                          return (
                            <Fragment key={t.build_task_id}>
                              <TableRow className={`tugas-baris tugas-baris--${t.urgency}`}>
                                <TableCell data-label="Kode">
                                  <span className="tugas-kode">{t.task_code}</span>
                                </TableCell>
                                <TableCell data-label="Nama">{t.name}</TableCell>
                                <TableCell data-label="Status">
                                  {/* Teks status WAJIB tetap ada — warna tidak boleh jadi satu-satunya
                                      penanda. Label DISENGAJA di baris yang SAMA dengan Tag: pengawas
                                      kebocoran identifier memeriksa PER BARIS, dan memisahnya membuat
                                      baris ini kehilangan penanda amannya (lihat AUD-23). */}
                                  <Tag type={STATUS_WARNA_TAG[t.status] ?? 'gray'}>{STATUS_LABELS[t.status]}</Tag>
                                </TableCell>
                                <TableCell data-label="Urgensi">{URGENCY_LABELS[t.urgency]}</TableCell>
                                <TableCell data-label="PIC">{t.pic}</TableCell>
                                <TableCell data-label="Tag">
                                  <div className="tugas-tag-sel">
                                    {t.tags.map((tag) => (
                                      <Tag key={tag} type="outline">
                                        {tag}
                                      </Tag>
                                    ))}
                                    <span className="halaman__redup">{t.aman_paralel ? 'Aman paralel' : 'Menunggu cetakan UX'}</span>
                                  </div>
                                </TableCell>
                                <TableCell data-label="Menggantung">{ageInCurrentStatus(t) ?? '—'}</TableCell>
                                <TableCell data-label="Aksi">
                                  <div className="tugas-aksi-sel">
                                    <Button kind="ghost" size="sm" onClick={() => toggleTaskDetail(t)}>
                                      {isExpanded ? 'Tutup' : 'Detail'}
                                    </Button>
                                    {t.link_url ? (
                                      <Link href={t.link_url} className="cds--link">
                                        Buka layar
                                      </Link>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                              {isExpanded ? (
                                <TableRow className="cds--expandable-row">
                                  <TableCell colSpan={KOLOM_TABEL.length}>{renderDetailTask(t)}</TableCell>
                                </TableRow>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
