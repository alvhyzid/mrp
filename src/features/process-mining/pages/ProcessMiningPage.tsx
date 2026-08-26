'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, hasSupabaseConfig } from '@/lib/supabaseClient';
import { InlineNotification, SkeletonText, Tag, Tile } from '@carbon/react';
import { KepalaHalaman } from '@/components/ui/kepala-halaman';
import { ProvenanceInfoButton } from '@/components/ui/provenance-info-button';
import { formatNumberId } from '@/lib/currency';
import { getEntityLabel, COMMON_STATUS_LABELS } from '@/lib/glossary';

function statusLabel(s: string): string {
  return COMMON_STATUS_LABELS[s] ?? s;
}

type ProcessMiningResult = {
  total_transitions: number;
  earliest_transition_at: string | null;
  latest_transition_at: string | null;
  data_sufficient_for_trend_analysis: boolean;
  status_durations: { table_name: string; status: string; sample_count: number; avg_duration_hours: number | null }[];
  transition_counts: { table_name: string; from_status: string; to_status: string; count: number }[];
  backward_or_cancelled_transitions: { table_name: string; from_status: string; to_status: string; count: number }[];
  notes: string[];
};

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} menit`;
  if (hours < 48) return `${formatNumberId(hours, 1)} jam`;
  return `${formatNumberId(hours / 24, 1)} hari`;
}

export default function ProcessMiningPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [data, setData] = useState<ProcessMiningResult | null>(null);
  const [error, setError] = useState('');

  const getAccessToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    const checkAccessAndLoad = async () => {
      if (!hasSupabaseConfig || !supabase) {
        setCheckingAccess(false);
        setAccessDenied(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.replace('/login?redirectTo=/process-mining');
        return;
      }
      const accessToken = await getAccessToken();
      const response = await fetch('/api/process-mining', { headers: { Authorization: `Bearer ${accessToken}` } });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || 'Gagal memuat.');
        setAccessDenied(response.status === 403);
        setCheckingAccess(false);
        return;
      }
      setData(body);
      setCheckingAccess(false);
    };
    checkAccessAndLoad();
  }, [router, getAccessToken]);

  if (checkingAccess) {
    return (
      <div className="halaman">
        <SkeletonText heading width="16rem" />
        <SkeletonText paragraph lineCount={4} />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="halaman">
        <h1 className="halaman__judul">Process mining</h1>
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="Halaman internal ini khusus pimpinan perusahaan"
          subtitle="Akun Anda tidak punya izin membukanya."
        />
      </div>
    );
  }

  // Tiga daftar yang bentuknya sama persis disusun dari satu bentuk, bukan tiga blok yang
  // disalin. Menyalinnya berarti tiga tempat yang harus ikut berubah tiap kali bentuknya
  // diperbaiki.
  const daftarTransisi = (
    baris: { table_name: string; from_status: string; to_status: string; count: number }[],
    kosong: string
  ) =>
    baris.length === 0 ? (
      <p className="halaman__redup">{kosong}</p>
    ) : (
      <div className="proses-daftar">
        {baris.map((t, idx) => (
          <div key={idx} className="proses-baris">
            <span>
              {getEntityLabel(t.table_name)}: {statusLabel(t.from_status)} → {statusLabel(t.to_status)}
            </span>
            <strong>{formatNumberId(t.count, 0)}×</strong>
          </div>
        ))}
      </div>
    );

  return (
    <div className="halaman">
      <KepalaHalaman
        remah={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Data & Analytics" },
          { label: "Process Mining" }
        ]}
        judul="Process mining"
        pengantar="Melihat bagaimana pekerjaan benar-benar mengalir di sistem — dari jejak perubahan status, bukan dari bagaimana alurnya seharusnya berjalan di atas kertas."
      />

      {error ? <InlineNotification kind="error" lowContrast title="Gagal memuat" subtitle={error} hideCloseButton /> : null}

      {data ? (
        <>
          <Tile className="proses-kartu">
            <span className="metrik__label proses-judul">
              Dasar data
              <ProvenanceInfoButton
                label="Dasar Data Process Mining"
                envelope={{
                  formula:
                    'COUNT seluruh baris status_transition_log perusahaan ini (semua tabel/status digabung). Rentang hari = tanggal transisi terbaru − tanggal transisi tertua. Analisis tren di bawah baru ditampilkan kalau rentang ≥14 hari (konsisten dengan ambang KPI baseline lain di sistem ini).',
                  inputs: [
                    { label: 'Total transisi', value: String(data.total_transitions) },
                    { label: 'Sejak', value: data.earliest_transition_at?.slice(0, 10) ?? '-' },
                    { label: 'Terbaru', value: data.latest_transition_at?.slice(0, 10) ?? '-' }
                  ]
                }}
              />
            </span>
            <span className="proses-dasar">
              Berdasarkan {formatNumberId(data.total_transitions, 0)} perubahan status
              {data.earliest_transition_at ? ` sejak ${data.earliest_transition_at.slice(0, 10)}` : ''}
            </span>
            {!data.data_sufficient_for_trend_analysis ? (
              <Tag type="magenta">Data belum cukup untuk analisis tren (rentang di bawah 14 hari)</Tag>
            ) : null}
            {data.notes.map((note, idx) => (
              <p key={idx} className="proses-catatan" data-catatan={idx}>
                {note}
              </p>
            ))}
          </Tile>

          <Tile className="proses-kartu">
            <span className="metrik__label proses-judul">
              Durasi rata-rata per status, terlama di atas
              <ProvenanceInfoButton
                label="Durasi Rata-Rata per Status"
                envelope={{
                  formula:
                    'Rata-rata selisih waktu antar transisi status berurutan di status_transition_log, per kombinasi tabel+status. Hanya ditampilkan sebagai angka kalau sampelnya ≥3 (ambang MIN_SAMPLES_FOR_DURATION) — di bawah itu ditandai "data belum cukup", BUKAN dirata-rata dari sampel terlalu sedikit yang bisa kebetulan.',
                  inputs: [{ label: 'Ambang minimal sampel', value: '3 per status' }],
                  sourceDocument: 'computeProcessMiningInsights.ts'
                }}
              />
            </span>
            {data.status_durations.length === 0 ? (
              <p className="halaman__redup">Belum ada pasangan transisi berurutan untuk dihitung durasinya.</p>
            ) : (
              <div className="proses-daftar">
                {data.status_durations.map((d, idx) => (
                  <div key={idx} className="proses-baris">
                    <span>
                      {getEntityLabel(d.table_name)} — {statusLabel(d.status)}
                    </span>
                    <strong>
                      {d.avg_duration_hours === null ? (
                        <span className="proses-catatan">data belum cukup ({formatNumberId(d.sample_count, 0)} sampel)</span>
                      ) : (
                        `${formatHours(d.avg_duration_hours)} (${formatNumberId(d.sample_count, 0)} sampel)`
                      )}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </Tile>

          <Tile className="proses-kartu">
            <span className="metrik__label proses-judul">
              Perpindahan status paling sering
              <ProvenanceInfoButton
                label="Transisi Paling Sering"
                envelope={{
                  formula:
                    'Jumlah baris status_transition_log dikelompokkan per tabel+status asal+status tujuan, diurutkan dari yang paling sering, ditampilkan 10 teratas.',
                  inputs: [{ label: 'Ditampilkan', value: '10 kombinasi tersering' }],
                  sourceDocument: 'computeProcessMiningInsights.ts'
                }}
              />
            </span>
            {daftarTransisi(data.transition_counts.slice(0, 10), 'Belum ada perpindahan status tercatat.')}
          </Tile>

          <Tile className="proses-kartu">
            <span className="metrik__label proses-judul">
              Perpindahan mundur atau dibatalkan
              <ProvenanceInfoButton
                label="Transisi Mundur / Dibatalkan"
                envelope={{
                  formula:
                    'Dari daftar "Transisi Paling Sering", disaring hanya yang status TUJUANnya salah satu dari: cancelled, rejected, batal, draft — daftar tetap di kode (bukan dari data), supaya mudah diaudit.',
                  inputs: [{ label: 'Status tujuan yang dihitung', value: 'cancelled, rejected, batal, draft' }],
                  sourceDocument: 'computeProcessMiningInsights.ts'
                }}
              />
            </span>
            {daftarTransisi(data.backward_or_cancelled_transitions, 'Tidak ada perpindahan mundur atau dibatalkan tercatat.')}
          </Tile>
        </>
      ) : null}
    </div>
  );
}
