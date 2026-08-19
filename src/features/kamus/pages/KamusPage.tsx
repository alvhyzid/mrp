'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  DIJAWAB: 'Sudah Dijawab',
  DIKONFIRMASI: 'Dikonfirmasi',
  TIDAK_RELEVAN: 'Tidak Relevan'
};
const statusBadgeVariant: Record<string, 'success' | 'warning' | 'secondary' | 'critical' | 'info'> = {
  BELUM: 'secondary',
  DRAF_AI: 'warning',
  DIJAWAB: 'info',
  DIKONFIRMASI: 'success',
  TIDAK_RELEVAN: 'critical'
};
const domainLabels: Record<string, string> = { uang: 'Uang', kuantitas: 'Kuantitas', status: 'Status', standar: 'Standar', proses: 'Proses', lainnya: 'Lainnya' };
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

export default function KamusPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isLeadership, setIsLeadership] = useState(false);

  const [terms, setTerms] = useState<KamusTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('DRAF_AI');
  const [priorityFilter, setPriorityFilter] = useState('');

  const [drafts, setDrafts] = useState<Record<number, { plain: string; pitfall: string; range: string }>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [generateStatus, setGenerateStatus] = useState('');
  const [exportOutput, setExportOutput] = useState<Record<string, string> | null>(null);

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
  }, [getAccessToken, statusFilter, priorityFilter]);

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
  }, [statusFilter, priorityFilter]);

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
    return (
      <main className="min-h-screen bg-muted/30 py-16">
        <div className="px-6 text-center text-sm text-muted-foreground">Memuat...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="flex w-full flex-col gap-6 px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Internal</p>
          <h1 className="text-2xl font-semibold text-foreground">Kamus — Antrean Penjelasan Data</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jelaskan makna kolom/metrik data supaya sistem (dan tim baru) bisa memahami tanpa bertanya berulang. Jawab yang Anda tahu, tugaskan ke departemen lain kalau tidak.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-1 pt-6">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Progres Prioritas 1-2</span>
            <span className="text-2xl font-semibold text-foreground">
              {progressByPriority.answered} dari {progressByPriority.total} terisi
            </span>
          </CardContent>
        </Card>

        {isLeadership ? (
          <Card>
            <CardHeader>
              <CardDescription className="uppercase tracking-[0.2em]">Admin</CardDescription>
              <CardTitle className="text-lg">Generator & Ekspor</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" variant="outline" onClick={handleGenerate}>
                  Jalankan Generator Backlog
                </Button>
                <Button size="sm" variant="outline" onClick={handleExport}>
                  Ekspor Kamus Terkonfirmasi
                </Button>
                {generateStatus ? <span className="text-xs text-muted-foreground">{generateStatus}</span> : null}
              </div>
              {exportOutput ? (
                <div className="flex flex-col gap-2">
                  {Object.entries(exportOutput).map(([filename, content]) => (
                    <details key={filename} className="rounded-md border p-2">
                      <summary className="cursor-pointer text-sm font-medium">docs/kamus/{filename}</summary>
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">{content}</pre>
                    </details>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="flex flex-wrap gap-3 pt-6">
            <Select value={statusFilter || undefined} onValueChange={(value) => setStatusFilter(value)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter || undefined} onValueChange={(value) => setPriorityFilter(value)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Semua prioritas" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    Prioritas {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : terms.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada istilah yang cocok dengan filter ini.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {terms.map((term) => {
              const draft = drafts[term.kamus_term_id] ?? { plain: term.answer_plain ?? '', pitfall: term.answer_pitfall ?? '', range: term.answer_range ?? '' };
              return (
                <Card key={term.kamus_term_id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base font-mono">{term.term_key}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="secondary">Prioritas {term.priority}</Badge>
                        <Badge variant="secondary">{domainLabels[term.domain] ?? term.domain}</Badge>
                        <Badge variant={statusBadgeVariant[term.status] ?? 'secondary'}>{statusLabels[term.status] ?? term.status}</Badge>
                      </div>
                    </div>
                    {term.suggested_role ? (
                      <CardDescription>Sebaiknya dijawab: {departmentLabels[term.suggested_role] ?? term.suggested_role}</CardDescription>
                    ) : (
                      <CardDescription>Departemen belum ditentukan</CardDescription>
                    )}
                    {term.assigned_to_role ? (
                      <CardDescription>Ditugaskan ke: {departmentLabels[term.assigned_to_role] ?? term.assigned_to_role}{term.assigned_note ? ` — ${term.assigned_note}` : ''}</CardDescription>
                    ) : null}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {term.ai_draft ? <p className="rounded-md border border-warning/40 bg-warning-subtle p-2 text-xs text-warning-subtle-foreground">Draf AI (perlu konfirmasi manusia): {term.ai_draft}</p> : null}

                    {term.status !== 'DIKONFIRMASI' ? (
                      <>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-foreground">Kalau menjelaskan ke karyawan baru, Anda bilang apa?</span>
                          <Input value={draft.plain} onChange={(e) => updateDraft(term.kamus_term_id, { plain: e.target.value })} />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-foreground">Kesalahpahaman apa yang biasa terjadi?</span>
                          <Input value={draft.pitfall} onChange={(e) => updateDraft(term.kamus_term_id, { pitfall: e.target.value })} />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-foreground">Berapa nilai wajar, berapa yang mencurigakan?</span>
                          <Input value={draft.range} onChange={(e) => updateDraft(term.kamus_term_id, { range: e.target.value })} />
                        </label>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" disabled={savingId === term.kamus_term_id} onClick={() => handleAnswer(term)}>
                            Simpan dan Lanjut
                          </Button>
                          <Button size="sm" variant="outline" disabled={savingId === term.kamus_term_id} onClick={() => handleSkip(term)}>
                            Lewati (Tidak Relevan)
                          </Button>
                          <Select onValueChange={(value) => handleAssign(term, value)}>
                            <SelectTrigger className="w-64">
                              <SelectValue placeholder="Saya tidak tahu — tanyakan ke..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(departmentLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col gap-1 text-sm">
                        <p>
                          <span className="font-medium">Penjelasan:</span> {term.answer_plain}
                        </p>
                        {term.answer_pitfall ? (
                          <p>
                            <span className="font-medium">Kesalahpahaman:</span> {term.answer_pitfall}
                          </p>
                        ) : null}
                        {term.answer_range ? (
                          <p>
                            <span className="font-medium">Nilai wajar:</span> {term.answer_range}
                          </p>
                        ) : null}
                      </div>
                    )}

                    {isLeadership && term.status === 'DIJAWAB' ? (
                      <Button size="sm" variant="outline" disabled={savingId === term.kamus_term_id} onClick={() => handleConfirm(term)}>
                        Konfirmasi Jawaban Ini
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
