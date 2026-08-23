'use client';

import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
// Urgensi TIDAK dirender sebagai Badge sederajat status (lihat STATUS_BADGE) --
// cuma dua tingkat teratas yang dapat garis tepi kiri kartu, supaya urgensi
// terlihat tanpa bersaing visual dengan warna status.
const URGENCY_BORDER: Record<string, string> = {
  super_urgent: 'border-l-4 border-l-destructive',
  mendesak: 'border-l-4 border-l-warning',
  penting: '',
  bisa_menunggu: '',
  tidak_mendesak: ''
};

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
const STATUS_BADGE: Record<string, 'success' | 'warning' | 'info' | 'secondary' | 'critical'> = {
  menunggu: 'secondary',
  sedang_dikerjakan: 'warning',
  menunggu_persetujuan: 'info',
  selesai: 'success',
  ditunda_sadar: 'secondary',
  dibatalkan: 'secondary'
};
// className tambahan di luar variant Badge, untuk status yang butuh nuansa
// lebih (pudar/dicoret) yang tidak tersedia lewat variant warna biasa.
const STATUS_EXTRA_CLASS: Record<string, string> = {
  menunggu: '',
  sedang_dikerjakan: '',
  menunggu_persetujuan: '',
  selesai: '',
  ditunda_sadar: 'opacity-60',
  dibatalkan: 'line-through opacity-70'
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
              <CardTitle className="text-2xl">Daftar Tugas Pembangunan</CardTitle>
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
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Apa yang Baru</p>
          <h1 className="text-2xl font-semibold text-foreground">Daftar Tugas Pembangunan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Halaman ini hanya menampilkan (baca) — task dibuat/ditutup oleh Claude Code lewat migrasi, bukan dari layar ini.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Tiap task punya 3 jenis label yang berbeda dan bisa bernilai berbeda-beda: <span className="font-medium text-foreground">status</span> (badge warna solid — progres pekerjaan),{' '}
            <span className="font-medium text-foreground">urgensi</span> (badge outline kecil + garis tepi kiri kartu untuk 2 tingkat teratas — seberapa mendesak), dan{' '}
            <span className="font-medium text-foreground">penanda otomatis</span> (teks kecil turunan tag — bukan dicatat manusia). Ketiganya bisa berbeda nilai pada task yang sama; itu bukan kontradiksi.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : (
          <>
            {/* E.2: MENUNGGU PERSETUJUAN — menonjol, terpisah dari daftar modul */}
            {pendingApproval.length > 0 ? (
              <Card className="border-2 border-warning">
                <CardHeader>
                  <CardDescription className="uppercase tracking-[0.2em] text-warning-subtle-foreground">Perlu Perhatian Anda</CardDescription>
                  <CardTitle className="text-xl">MENUNGGU PERSETUJUAN ({pendingApproval.length})</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {pendingApproval.map((t) => (
                    <div key={t.build_task_id} className="rounded-md border bg-background p-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold text-foreground">{t.task_code}</span>
                        <span className="font-medium text-foreground">{t.name}</span>
                        <Badge variant="secondary">{t.module_name}</Badge>
                      </div>
                      <div className="mt-2 flex flex-col gap-1.5">
                        <p><span className="font-medium text-foreground">Apa yang perlu diperiksa:</span> {t.approval_review_steps}</p>
                        <p><span className="font-medium text-foreground">Di mana:</span> {t.approval_location}</p>
                        <p><span className="font-medium text-foreground">Contoh kasus:</span> {t.approval_example_case}</p>
                        <p><span className="font-medium text-foreground">Bila disetujui:</span> {t.approval_if_approved}</p>
                        <p><span className="font-medium text-foreground">Bila ditolak:</span> {t.approval_if_rejected}</p>
                        {t.approval_options ? (
                          <p><span className="font-medium text-foreground">Pilihan & rekomendasi:</span> {t.approval_options}</p>
                        ) : null}
                        {t.link_url ? (
                          <Link href={t.link_url} className="text-primary underline">
                            Buka layar terkait
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {/* D.3: keterangan penjaga, HANYA keterangan, bukan blokir */}
            {unresolvedSuperUrgentCount > AMBANG_SUPER_URGENT ? (
              <p className="rounded-md border border-warning/40 bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">
                Ada {unresolvedSuperUrgentCount} task SUPER URGENT yang belum selesai — makin banyak yang paling mendesak, makin tidak ada yang benar-benar mendesak.
              </p>
            ) : null}

            {/* Ringkasan atas */}
            <Card>
              <CardHeader>
                <CardDescription className="uppercase tracking-[0.2em]">Ringkasan</CardDescription>
                <CardTitle className="text-xl">
                  {totalDone} dari {filteredTasks.length} task selesai ({totalPercent}%){filtersActive ? ' — hasil saringan' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {ALL_TAGS.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}: {tagCounts[tag]}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Saringan */}
            <Card>
              <CardHeader>
                <CardDescription className="uppercase tracking-[0.2em]">Saringan</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Select value={filterPic || '__all__'} onValueChange={(v) => setFilterPic(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="PIC" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Semua PIC</SelectItem>
                      {picOptions.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterStatus || '__all__'} onValueChange={(v) => setFilterStatus(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Semua Status</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterUrgency || '__all__'} onValueChange={(v) => setFilterUrgency(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Urgensi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Semua Urgensi</SelectItem>
                      {URGENCY_ORDER.map((u) => (
                        <SelectItem key={u} value={u}>
                          {URGENCY_LABELS[u]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterModule || '__all__'} onValueChange={(v) => setFilterModule(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Modul" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Semua Modul</SelectItem>
                      {Array.from(new Set(tasks.map((t) => t.module_code))).sort().map((mc) => (
                        <SelectItem key={mc} value={mc}>
                          {tasks.find((t) => t.module_code === mc)?.module_name ?? mc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Select value={filterTag || '__all__'} onValueChange={(v) => setFilterTag(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Semua Tag</SelectItem>
                      {ALL_TAGS.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* C.2: dua cara saring tag, dibedakan jelas */}
                  <div className="flex items-center gap-2 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="tagMode" checked={tagMode === 'contains'} onChange={() => setTagMode('contains')} disabled={!filterTag} />
                      Mengandung tag ini
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="tagMode" checked={tagMode === 'only'} onChange={() => setTagMode('only')} disabled={!filterTag} />
                      Hanya tag ini saja
                    </label>
                  </div>

                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={onlyParallelSafe} onChange={(e) => setOnlyParallelSafe(e.target.checked)} />
                    Tampilkan yang aman dikerjakan paralel saja
                  </label>

                  <Button size="sm" variant="outline" onClick={clearFilters}>
                    Hapus Semua Saringan
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Buka/Tutup semua */}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {modules.length} modul{filtersActive ? ' (mengikuti saringan)' : ''}
                </span>
                {/* II.3 — tombol ini HANYA muncul saat pengguna menyortir manual. Tanpa
                    penanda ini, urutan yang tidak biasa terlihat seperti urutan biasa, dan
                    SUPER URGENT yang tidak lagi di atas bisa terlewat. */}
                {sortKey ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-warning">
                      Urutan diubah manual ({KOLOM_TABEL.find((k) => k.key === sortKey)?.label}
                      {sortDir === 'asc' ? ', naik' : ', turun'}) — SUPER URGENT tidak lagi otomatis di atas.
                    </span>
                    <Button size="sm" variant="outline" onClick={resetSort}>
                      Kembali ke Urutan Default
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={openAll}>
                  Buka Semua
                </Button>
                <Button size="sm" variant="outline" onClick={closeAll}>
                  Tutup Semua
                </Button>
              </div>
            </div>

            {/* F.1: modul bisa dibuka-tutup */}
            <div className="flex flex-col gap-3">
              {modules.map((mod) => {
                const done = mod.tasks.filter((t) => isTaskDone(t.status)).length;
                const pct = mod.tasks.length > 0 ? Math.round((done / mod.tasks.length) * 100) : 0;
                const hasSuperUrgent = mod.tasks.some((t) => t.urgency === 'super_urgent' && isTaskUnresolved(t.status));
                const allDone = mod.tasks.length > 0 && done === mod.tasks.length;
                const open = isModuleOpen(mod.module_code, hasSuperUrgent);
                return (
                  <Card key={mod.module_code} className={hasSuperUrgent ? 'border-2 border-destructive' : allDone ? 'border-2 border-success' : undefined}>
                    <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => toggleModule(mod.module_code)}>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">{open ? '▾' : '▸'}</span>
                        <span className="font-semibold text-foreground">{mod.module_name}</span>
                        {hasSuperUrgent ? <Badge variant="critical">SUPER URGENT</Badge> : null}
                        {!hasSuperUrgent && allDone ? <Badge variant="success">Semua Selesai</Badge> : null}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{mod.tasks.length} task</span>
                        <span>{done} selesai</span>
                        <span className="font-medium text-foreground">{pct}%{filtersActive ? ' (hasil saringan)' : ''}</span>
                      </div>
                    </button>
                    {open ? (
                      <CardContent className="border-t p-0">
                        {/* II.1 — BENTUK TABEL, satu baris satu task. Penjelasan, pengaruh,
                            dan detail pekerjaan TIDAK ikut di baris — itu yang membuat bentuk
                            kartu terasa panjang. Semuanya pindah ke baris yang dimekarkan.

                            II.8 — tabel menggulir DI DALAM wadahnya (overflow-x-auto), BUKAN
                            membuat halaman bergulir menyamping. overflow-hidden DILARANG:
                            itu memotong kolom tanpa ada cara melihatnya. */}
                        <div className="hidden overflow-x-auto md:block">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/40 text-left">
                                {KOLOM_TABEL.map((k) => (
                                  <th key={k.key ?? k.label} className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    {k.key ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleSort(k.key as SortKey)}
                                        className="inline-flex items-center gap-1 hover:text-foreground"
                                      >
                                        {k.label}
                                        <span aria-hidden="true" className="text-[10px]">
                                          {sortKey === k.key ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u21C5'}
                                        </span>
                                      </button>
                                    ) : (
                                      k.label
                                    )}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sortTasks(mod.tasks).map((t) => {
                                const isExpanded = expandedTaskId === t.build_task_id;
                                return (
                                  <Fragment key={t.build_task_id}>
                                    <tr className="border-b align-top">
                                      {/* II.6 — garis tepi kiri urgensi dipertahankan, dipindah ke sel
                                          pertama karena baris tabel tidak punya "tepi kartu". */}
                                      <td className={`px-3 py-2.5 font-mono font-semibold text-foreground ${URGENCY_BORDER[t.urgency]}`}>
                                        {t.task_code}
                                      </td>
                                      <td className="px-3 py-2.5 text-foreground">{t.name}</td>
                                      <td className="px-3 py-2.5">
                                        {/* Teks status WAJIB tetap ada — warna tidak boleh jadi satu-satunya penanda. */}
                                        {/* Label DISENGAJA di baris yang SAMA dengan Badge, mengikuti konvensi yang sudah ada.
                                            Pengawas kebocoran identifier (tests/ui_raw_leak_watchdog.test.ts) memeriksa PER BARIS:
                                            bila STATUS_LABELS pindah ke baris lain, baris ini kehilangan penanda amannya dan
                                            dilaporkan sebagai kebocoran, padahal t.status di sini cuma kunci pencarian warna.
                                            Lihat AUD-23. */}
                                        <Badge variant={STATUS_BADGE[t.status]} className={STATUS_EXTRA_CLASS[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                                      </td>
                                      <td className="px-3 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">
                                        {URGENCY_LABELS[t.urgency]}
                                      </td>
                                      <td className="px-3 py-2.5 text-muted-foreground">{t.pic}</td>
                                      <td className="px-3 py-2.5">
                                        <div className="flex flex-wrap gap-1">
                                          {t.tags.map((tag) => (
                                            <Badge key={tag} variant="outline" className="text-[10px]">
                                              {tag}
                                            </Badge>
                                          ))}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">
                                          {t.aman_paralel ? '\u25CF Aman Paralel' : '\u25CB Menunggu Cetakan UX'}
                                        </span>
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{ageInCurrentStatus(t) ?? '\u2014'}</td>
                                      <td className="whitespace-nowrap px-3 py-2.5">
                                        <button type="button" className="text-primary underline" onClick={() => toggleTaskDetail(t)}>
                                          {isExpanded ? 'Tutup' : 'Detail'}
                                        </button>
                                        {t.link_url ? (
                                          <Link href={t.link_url} className="ml-3 text-primary underline">
                                            Buka layar
                                          </Link>
                                        ) : null}
                                      </td>
                                    </tr>
                                    {isExpanded ? (
                                      <tr className="border-b bg-muted/30">
                                        <td colSpan={KOLOM_TABEL.length} className="px-3 py-3">
                                          {renderDetailTask(t)}
                                        </td>
                                      </tr>
                                    ) : null}
                                  </Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* II.8 — di layar sempit baris menjadi KARTU BERTUMPUK, dan labelnya
                            mengambil judul kolom yang sesungguhnya. */}
                        <div className="flex flex-col gap-3 p-3 md:hidden">
                          {sortTasks(mod.tasks).map((t) => {
                            const isExpanded = expandedTaskId === t.build_task_id;
                            return (
                              <div key={t.build_task_id} className={`border bg-background ${URGENCY_BORDER[t.urgency]}`}>
                                <dl className="divide-y">
                                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2">
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Kode</dt>
                                    <dd className="font-mono font-semibold text-foreground">{t.task_code}</dd>
                                  </div>
                                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2">
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Nama</dt>
                                    <dd className="min-w-0 break-words text-foreground">{t.name}</dd>
                                  </div>
                                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2">
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
                                    <dd>
                                      {/* Label DISENGAJA di baris yang SAMA dengan Badge, mengikuti konvensi yang sudah ada.
                                          Pengawas kebocoran identifier (tests/ui_raw_leak_watchdog.test.ts) memeriksa PER BARIS:
                                          bila STATUS_LABELS pindah ke baris lain, baris ini kehilangan penanda amannya dan
                                          dilaporkan sebagai kebocoran, padahal t.status di sini cuma kunci pencarian warna.
                                          Lihat AUD-23. */}
                                      <Badge variant={STATUS_BADGE[t.status]} className={STATUS_EXTRA_CLASS[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                                    </dd>
                                  </div>
                                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2">
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Urgensi</dt>
                                    <dd className="text-xs uppercase tracking-wide text-muted-foreground">{URGENCY_LABELS[t.urgency]}</dd>
                                  </div>
                                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2">
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">PIC</dt>
                                    <dd className="text-muted-foreground">{t.pic}</dd>
                                  </div>
                                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2">
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Tag</dt>
                                    <dd className="flex flex-wrap gap-1">
                                      {t.tags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-[10px]">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </dd>
                                  </div>
                                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2">
                                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Menggantung</dt>
                                    <dd className="text-muted-foreground">{ageInCurrentStatus(t) ?? '\u2014'}</dd>
                                  </div>
                                  <div className="px-3 py-2">
                                    <button type="button" className="text-primary underline" onClick={() => toggleTaskDetail(t)}>
                                      {isExpanded ? 'Tutup Detail' : 'Detail'}
                                    </button>
                                    {t.link_url ? (
                                      <Link href={t.link_url} className="ml-3 text-primary underline">
                                        Buka layar
                                      </Link>
                                    ) : null}
                                  </div>
                                </dl>
                                {isExpanded ? <div className="border-t bg-muted/30 p-3">{renderDetailTask(t)}</div> : null}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
