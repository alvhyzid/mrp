'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import {
  Tile,
  Tag,
  Button,
  TextInput,
  Dropdown,
  InlineNotification,
  SkeletonText,
  Accordion,
  AccordionItem,
  CodeSnippet
} from '@carbon/react';
import { ChevronDown, ChevronRight } from '@carbon/icons-react';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { formatNumberId } from '@/lib/currency';
import { getKamusTermTitle, humanizeKamusDraft } from '@/lib/glossary';
import { useIsCompanyAdmin } from '@/lib/useIsCompanyAdmin';

// HALAMAN KAMUS — dimigrasikan ke Carbon 26 Agu 2026 (DS-09).
//
// POLA: Carbon TIDAK punya pola untuk "antrean pertanyaan yang harus dijawab orang".
// Disebut terbuka sesuai aturan B.2 — jangan diam-diam merancang sendiri lalu mengaku
// mengikuti pola. Acuan terdekat yang dipakai: pola Forms (tiap kartu adalah satu formulir
// pendek berisi tiga pertanyaan), digabung dengan Filtering, Empty state, dan Notifications.
//
// KENAPA BUKAN DataTable: tiap baris di sini butuh TIGA isian teks bebas yang dijawab di
// tempat. Tabel dengan sel yang bisa diketik akan menyempitkan jawaban jadi satu baris kecil,
// padahal jawabannya justru inti halaman ini. Tile per istilah memberi ruang menulis.
//
// KEPALA HALAMAN mengikuti cetakan Master Item — itu layar yang sudah disetujui pemilik
// produk, dan bentuknya berlaku untuk semua layar berikutnya: remah roti (Dashboard >
// workspace yang TIDAK bisa diklik > halaman ini), satu judul, lalu satu baris pengantar
// yang menyebut BERAPA BANYAK yang sedang dilihat.
//
// Versi pertama halaman ini melewatkan remah roti dengan alasan "Kamus item tingkat atas".
// Itu keliru: ia anak workspace Administration di menu akun, persis seperti Items anak
// Product & Engineering.

type KamusTerm = {
  kamus_term_id: number;
  scope: string;
  entity: string | null;
  field: string | null;
  term_key: string;
  priority: number;
  domain: string;
  suggested_role: string | null;
  status: string;
  ai_draft: string | null;
  answer_plain: string | null;
  answer_pitfall: string | null;
  answer_range: string | null;
  assigned_to_role: string | null;
  assigned_note: string | null;
};

const statusLabels: Record<string, string> = {
  BELUM: 'Belum',
  DRAF_AI: 'Draf AI (belum dijawab)',
  DIJAWAB: 'Sudah dijawab',
  DIKONFIRMASI: 'Dikonfirmasi',
  TIDAK_RELEVAN: 'Tidak relevan'
};
/// Warna Tag per status. TIDAK_RELEVAN SENGAJA BUKAN MERAH: ia berarti "sudah diputuskan
/// tidak perlu dijawab", bukan kegagalan. Warna merah akan membuat keputusan yang benar
/// terlihat seperti masalah, dan orang akan mencoba "memperbaikinya".
const statusWarnaTag: Record<string, 'gray' | 'purple' | 'blue' | 'green' | 'cool-gray'> = {
  BELUM: 'gray',
  DRAF_AI: 'purple',
  DIJAWAB: 'blue',
  DIKONFIRMASI: 'green',
  TIDAK_RELEVAN: 'cool-gray'
};
const domainLabels: Record<string, string> = { uang: 'Uang', kuantitas: 'Kuantitas', status: 'Status', standar: 'Standar', proses: 'Proses', lainnya: 'Lainnya' };
type PilihanDropdown = { id: string; label: string };
const departmentLabels: Record<string, string> = {
  finance: 'Finance',
  production: 'SPV Produksi',
  ppic: 'PPIC',
  warehouse: 'Kepala Gudang',
  purchasing: 'Purchasing',
  management: 'Pemilik Produk / Manajemen',
  hr: 'HRD',
  qc: 'QC'
};

/// PILIHAN "SEMUA" DITULIS SEBAGAI BARIS TERSENDIRI, bukan hanya sebagai placeholder.
/// Versi sebelumnya memakai placeholder "Semua status" yang TIDAK BISA DIPILIH KEMBALI:
/// begitu satu status dipilih, tidak ada jalan kembali ke seluruhnya selain memuat ulang
/// halaman. Placeholder menerangkan keadaan awal; ia bukan pilihan.
const pilihanStatus: PilihanDropdown[] = [
  { id: '', label: 'Semua status' },
  ...Object.entries(statusLabels).map(([id, label]) => ({ id, label }))
];
const pilihanPrioritas: PilihanDropdown[] = [
  { id: '', label: 'Semua prioritas' },
  ...[1, 2, 3, 4, 5].map((p) => ({ id: String(p), label: `Prioritas ${p}` }))
];
const pilihanDepartemen: PilihanDropdown[] = Object.entries(departmentLabels).map(([id, label]) => ({ id, label }));

export default function KamusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isLeadership, setIsLeadership] = useState(false);

  const [terms, setTerms] = useState<KamusTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Nilai awal filter BOLEH datang dari URL (mis. ?status=DRAF_AI&priority=1&scope=METRIC) --
  // dipakai halaman /ai-readiness utk deep-link "buka antrean tepat pada baris terkait" (BAGIAN F §3.4).
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'DRAF_AI');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || '');
  const [scopeFilter, setScopeFilter] = useState(searchParams.get('scope') || '');

  const [drafts, setDrafts] = useState<Record<number, { plain: string; pitfall: string; range: string }>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [generateStatus, setGenerateStatus] = useState('');
  const [exportOutput, setExportOutput] = useState<Record<string, string> | null>(null);
  // Sesi 6 (21 Agu 2026, 6.4) — identifier teknis (term_key) tetap ada, tapi
  // di balik "Detail Teknis" tertutup, hanya company_admin.
  const isCompanyAdmin = useIsCompanyAdmin();
  const [expandedTechDetail, setExpandedTechDetail] = useState<Record<number, boolean>>({});

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  const loadTerms = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (scopeFilter) params.set('scope', scopeFilter);
    const response = await fetch(`/api/kamus?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Gagal memuat antrean kamus.');
      setLoading(false);
      return;
    }
    setTerms(data.terms || []);
    setError('');
    setLoading(false);
  }, [getAccessToken, statusFilter, priorityFilter, scopeFilter]);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/kamus');
        return;
      }
      const accessToken = sessionData.session.access_token;
      const meResponse = await fetch('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const meData = await meResponse.json();
      setIsLeadership(meData?.user?.role === 'company_admin' || meData?.user?.role === 'general_manager');
      setCheckingAccess(false);
      await loadTerms();
    };
    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!checkingAccess) loadTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, scopeFilter]);

  const progressByPriority = useMemo(() => {
    const p1and2 = terms.filter((t) => t.priority <= 2);
    const answered = p1and2.filter((t) => t.status === 'DIJAWAB' || t.status === 'DIKONFIRMASI').length;
    return { total: p1and2.length, answered };
  }, [terms]);

  const handleGenerate = async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setGenerateStatus('Menjalankan generator...');
    const response = await fetch('/api/kamus/generate', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setGenerateStatus(data.error || 'Gagal menjalankan generator.');
      return;
    }
    setGenerateStatus(
      `Selesai. ${data.field.inserted} kolom baru + ${data.metric.inserted} metrik baru ditambahkan (${data.field.skippedExisting} kolom sudah ada sebelumnya, dilewati). Total prioritas 1-2: ${data.priority1And2Total}.${data.stopConditionTriggered ? ' PERINGATAN: melebihi 200, lihat HANDOFF.' : ''}`
    );
    await loadTerms();
  };

  const handleExport = async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const response = await fetch('/api/kamus/export', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Gagal mengekspor kamus.');
      return;
    }
    setExportOutput(data.files);
  };

  const updateDraft = (id: number, patch: Partial<{ plain: string; pitfall: string; range: string }>) => {
    setDrafts((prev) => {
      const existing = prev[id] ?? { plain: '', pitfall: '', range: '' };
      return { ...prev, [id]: { ...existing, ...patch } };
    });
  };

  const handleAnswer = async (term: KamusTerm) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const draft = drafts[term.kamus_term_id] ?? { plain: '', pitfall: '', range: '' };
    setSavingId(term.kamus_term_id);
    const response = await fetch(`/api/kamus/terms/${term.kamus_term_id}/answer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ action: 'answer', answer_plain: draft.plain, answer_pitfall: draft.pitfall, answer_range: draft.range })
    });
    const data = await response.json();
    setSavingId(null);
    if (!response.ok) {
      setError(data.error || 'Gagal menyimpan jawaban.');
      return;
    }
    await loadTerms();
  };

  const handleSkip = async (term: KamusTerm) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setSavingId(term.kamus_term_id);
    await fetch(`/api/kamus/terms/${term.kamus_term_id}/answer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ action: 'skip' })
    });
    setSavingId(null);
    await loadTerms();
  };

  const handleAssign = async (term: KamusTerm, role: string) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setSavingId(term.kamus_term_id);
    await fetch(`/api/kamus/terms/${term.kamus_term_id}/answer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ action: 'assign', assigned_to_role: role })
    });
    setSavingId(null);
    await loadTerms();
  };

  const handleConfirm = async (term: KamusTerm) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    setSavingId(term.kamus_term_id);
    const response = await fetch(`/api/kamus/terms/${term.kamus_term_id}/confirm`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    setSavingId(null);
    if (!response.ok) {
      setError(data.error || 'Gagal mengonfirmasi.');
      return;
    }
    await loadTerms();
  };


  if (checkingAccess) {
    // SkeletonText, bukan tulisan "Memuat...". Rangkanya menunjukkan APA yang sedang datang;
    // kalimat "memuat" hanya menyatakan bahwa sesuatu sedang terjadi.
    return (
      <div className="halaman">
        <SkeletonText heading width="22rem" />
        <SkeletonText paragraph lineCount={2} />
      </div>
    );
  }

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Administration' }, { label: 'Glossary Queue' }]}
        judul="Antrean istilah"
        pengantar={`${terms.length} istilah sesuai saringan — jelaskan maknanya supaya tim baru paham tanpa bertanya berulang. Jawab yang Anda tahu, tugaskan ke departemen lain kalau tidak.`}
      />

      <div className="kisi-metrik">
        <Tile>
          <span className="metrik__label">
            Progres prioritas 1-2
            <ProvenanceInfoButton
              label="Progres prioritas 1-2"
              envelope={{
                formula:
                  'Dari baris kamus_terms yang saat ini termuat di halaman (sesuai filter status/prioritas/scope aktif): jumlah prioritas 1-2 berstatus DIJAWAB atau DIKONFIRMASI, dibagi total baris prioritas 1-2 yang termuat. Angka ini mengikuti filter yang sedang aktif, BUKAN selalu total keseluruhan perusahaan.',
                inputs: [
                  { label: 'Terisi (DIJAWAB/DIKONFIRMASI)', value: formatNumberId(progressByPriority.answered, 0) },
                  { label: 'Total prioritas 1-2 (sesuai filter)', value: formatNumberId(progressByPriority.total, 0) }
                ]
              }}
            />
          </span>
          <span className="metrik__angka">
            {formatNumberId(progressByPriority.answered, 0)} dari {formatNumberId(progressByPriority.total, 0)} terisi
          </span>
        </Tile>
      </div>

      {isLeadership ? (
        <Tile className="kamus-alat">
          <h2 className="halaman__subjudul halaman__subjudul--rapat">Generator &amp; ekspor</h2>
          <div className="kamus-alat__tombol">
            <Button kind="tertiary" size="md" onClick={handleGenerate}>
              Jalankan generator backlog
            </Button>
            <Button kind="tertiary" size="md" onClick={handleExport}>
              Ekspor kamus terkonfirmasi
            </Button>
            {generateStatus ? <span className="halaman__redup">{generateStatus}</span> : null}
          </div>
          {exportOutput ? (
            // Accordion + CodeSnippet menggantikan <details> + <pre> mentah. CodeSnippet
            // type="multi" memang komponen Carbon untuk teks berbaris banyak, dan ia SUDAH
            // membawa tombol salin serta batas tinggi sendiri — jadi tidak perlu ditambal.
            <Accordion className="kamus-ekspor">
              {Object.entries(exportOutput).map(([filename, content]) => (
                <AccordionItem key={filename} title={`docs/kamus/${filename}`}>
                  <CodeSnippet type="multi" feedback="Tersalin" wrapText>
                    {content}
                  </CodeSnippet>
                </AccordionItem>
              ))}
            </Accordion>
          ) : null}
        </Tile>
      ) : null}

      {/* `.halaman__saring` adalah kelas untuk KONTROLNYA (membatasi lebar), BUKAN untuk
          pembungkusnya. Dipakai sebagai pembungkus, kedua saringan tertumpuk selebar 14rem
          dan tidak terbaca sebagai satu baris saringan. */}
      <div className="kamus-saring">
        <Dropdown
          id="kamus-saring-status"
          className="halaman__saring"
          // titleText DIISI lalu disembunyikan, BUKAN dikosongkan: string kosong tetap
          // merender elemen labelnya dan mendorong kotaknya turun. hideLabel menyembunyikan
          // secara visual sambil tetap memberi nama bagi pembaca layar.
          titleText="Status"
          hideLabel
          size="md"
          label="Semua status"
          items={pilihanStatus}
          itemToString={(item: PilihanDropdown | null) => item?.label ?? ''}
          selectedItem={pilihanStatus.find((p) => p.id === statusFilter) ?? pilihanStatus[0]}
          onChange={({ selectedItem }: { selectedItem: PilihanDropdown | null }) => setStatusFilter(selectedItem?.id ?? '')}
        />
        <Dropdown
          id="kamus-saring-prioritas"
          className="halaman__saring"
          titleText="Prioritas"
          hideLabel
          size="md"
          label="Semua prioritas"
          items={pilihanPrioritas}
          itemToString={(item: PilihanDropdown | null) => item?.label ?? ''}
          selectedItem={pilihanPrioritas.find((p) => p.id === priorityFilter) ?? pilihanPrioritas[0]}
          onChange={({ selectedItem }: { selectedItem: PilihanDropdown | null }) => setPriorityFilter(selectedItem?.id ?? '')}
        />
      </div>

      {error ? <InlineNotification kind="error" lowContrast title="Gagal memuat kamus" subtitle={error} hideCloseButton /> : null}

      {loading ? (
        <Tile>
          <SkeletonText heading width="16rem" />
          <SkeletonText paragraph lineCount={3} />
        </Tile>
      ) : terms.length === 0 ? (
        <Tile>
          <p className="halaman__redup">Tidak ada istilah yang cocok dengan filter ini.</p>
        </Tile>
      ) : (
        <div className="kamus-daftar">
          {terms.map((term) => {
            const draft = drafts[term.kamus_term_id] ?? { plain: term.answer_plain ?? '', pitfall: term.answer_pitfall ?? '', range: term.answer_range ?? '' };
            const terbuka = Boolean(expandedTechDetail[term.kamus_term_id]);
            return (
              <Tile key={term.kamus_term_id} className="kamus-kartu">
                <div className="kamus-kartu__kepala">
                  <h2 className="halaman__subjudul halaman__subjudul--rapat">{getKamusTermTitle(term)}</h2>
                  <div className="kamus-kartu__tag">
                    {/* Tag dipakai untuk MENGGOLONGKAN — prioritas, domain, dan status memang
                        kategori baris ini, dan itulah konteks pemakaian Tag menurut Carbon. */}
                    <Tag type="outline">Prioritas {term.priority}</Tag>
                    <Tag type="outline">{domainLabels[term.domain] ?? term.domain}</Tag>
                    <Tag type={statusWarnaTag[term.status] ?? 'gray'}>{statusLabels[term.status] ?? term.status}</Tag>
                  </div>
                </div>

                {isCompanyAdmin ? (
                  <div className="kamus-kartu__teknis">
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={terbuka ? ChevronDown : ChevronRight}
                      onClick={() => setExpandedTechDetail((prev) => ({ ...prev, [term.kamus_term_id]: !prev[term.kamus_term_id] }))}
                    >
                      Detail teknis
                    </Button>
                    {terbuka ? (
                      <div className="kamus-kartu__teknis-isi">
                        {/* penjaga-kebocoran:mulai identifier mentah SENGAJA ditampilkan di
                            sini, dan hanya untuk company_admin (Sesi 6, 6.4). */}
                        <p>{term.term_key}</p>
                        {term.ai_draft ? <p>{term.ai_draft}</p> : null}
                        {/* penjaga-kebocoran:selesai */}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <p className="halaman__redup">
                  {term.suggested_role
                    ? `Sebaiknya dijawab: ${departmentLabels[term.suggested_role] ?? term.suggested_role}`
                    : 'Departemen belum ditentukan'}
                </p>
                {term.assigned_to_role ? (
                  <p className="halaman__redup">
                    Ditugaskan ke: {departmentLabels[term.assigned_to_role] ?? term.assigned_to_role}
                    {term.assigned_note ? ` — ${term.assigned_note}` : ''}
                  </p>
                ) : null}

                {term.ai_draft ? (
                  <InlineNotification
                    kind="warning"
                    lowContrast
                    hideCloseButton
                    title="Draf AI — perlu konfirmasi manusia"
                    subtitle={humanizeKamusDraft(term) ?? ''}
                  />
                ) : null}

                {term.status !== 'DIKONFIRMASI' ? (
                  <>
                    <TextInput
                      id={`kamus-plain-${term.kamus_term_id}`}
                      size="lg"
                      labelText="Kalau menjelaskan ke karyawan baru, Anda bilang apa?"
                      value={draft.plain}
                      onChange={(e) => updateDraft(term.kamus_term_id, { plain: e.target.value })}
                    />
                    <TextInput
                      id={`kamus-pitfall-${term.kamus_term_id}`}
                      size="lg"
                      labelText="Kesalahpahaman apa yang biasa terjadi?"
                      value={draft.pitfall}
                      onChange={(e) => updateDraft(term.kamus_term_id, { pitfall: e.target.value })}
                    />
                    <TextInput
                      id={`kamus-range-${term.kamus_term_id}`}
                      size="lg"
                      labelText="Berapa nilai wajar, berapa yang mencurigakan?"
                      value={draft.range}
                      onChange={(e) => updateDraft(term.kamus_term_id, { range: e.target.value })}
                    />

                    <div className="kamus-kartu__aksi">
                      <Button size="md" disabled={savingId === term.kamus_term_id} onClick={() => handleAnswer(term)}>
                        Simpan dan lanjut
                      </Button>
                      <Button kind="tertiary" size="md" disabled={savingId === term.kamus_term_id} onClick={() => handleSkip(term)}>
                        Lewati (tidak relevan)
                      </Button>
                      <Dropdown
                        id={`kamus-tugaskan-${term.kamus_term_id}`}
                        titleText="Tugaskan ke departemen"
                        hideLabel
                        size="md"
                        label="Saya tidak tahu — tanyakan ke..."
                        items={pilihanDepartemen}
                        itemToString={(item: PilihanDropdown | null) => item?.label ?? ''}
                        // selectedItem SENGAJA null: ini bukan saringan yang menyimpan pilihan,
                        // melainkan tindakan. Begitu dipilih, kartunya berpindah status dan
                        // pilihan yang menempel di kotak akan berbohong tentang keadaan sekarang.
                        selectedItem={null}
                        onChange={({ selectedItem }: { selectedItem: PilihanDropdown | null }) => {
                          if (selectedItem) handleAssign(term, selectedItem.id);
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="kamus-kartu__jawaban">
                    <p>
                      <strong>Penjelasan:</strong> {term.answer_plain}
                    </p>
                    {term.answer_pitfall ? (
                      <p>
                        <strong>Kesalahpahaman:</strong> {term.answer_pitfall}
                      </p>
                    ) : null}
                    {term.answer_range ? (
                      <p>
                        <strong>Nilai wajar:</strong> {term.answer_range}
                      </p>
                    ) : null}
                  </div>
                )}

                {isLeadership && term.status === 'DIJAWAB' ? (
                  <div className="kamus-kartu__aksi">
                    <Button kind="tertiary" size="md" disabled={savingId === term.kamus_term_id} onClick={() => handleConfirm(term)}>
                      Konfirmasi jawaban ini
                    </Button>
                  </div>
                ) : null}
              </Tile>
            );
          })}
        </div>
      )}
    </div>
  );
}
