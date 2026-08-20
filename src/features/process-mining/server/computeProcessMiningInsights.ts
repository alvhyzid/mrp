import type { SupabaseClient } from '@supabase/supabase-js';
import { formatNumberId } from '@/lib/currency';

// Process mining (Fase 0.4, docs/langkah-membangun-fitur-ai.md) -- TANPA LLM,
// murni query & agregasi atas status_transition_log yang SUDAH ADA (tidak
// perlu tabel baru). PRINSIP UTAMA (instruksi eksplisit): "data transisi masih
// sedikit -- tampilkan jumlah data pendasar eksplisit, JANGAN angka
// menyesatkan kalau data belum cukup."
//
// Ambang "data belum cukup" -- KEPUTUSAN EKSPLISIT (bukan tebakan): minimal 3
// transisi KELUAR dari suatu status utk durasi status itu dianggap layak
// ditampilkan (2 titik data belum cukup menyimpulkan pola, cuma kebetulan).
const MIN_SAMPLES_FOR_DURATION = 3;

export interface StatusDurationInsight {
  table_name: string;
  status: string;
  sample_count: number;
  avg_duration_hours: number | null; // null kalau sample_count < MIN_SAMPLES_FOR_DURATION
}

export interface TransitionCountInsight {
  table_name: string;
  from_status: string;
  to_status: string;
  count: number;
}

export interface ProcessMiningResult {
  total_transitions: number;
  earliest_transition_at: string | null;
  latest_transition_at: string | null;
  data_sufficient_for_trend_analysis: boolean; // ambang: >=14 hari data (KPI baseline juga pakai 14 hari, konsisten)
  status_durations: StatusDurationInsight[];
  transition_counts: TransitionCountInsight[];
  backward_or_cancelled_transitions: TransitionCountInsight[];
  notes: string[];
}

const BACKWARD_OR_CANCEL_STATUSES = ['cancelled', 'rejected', 'batal', 'draft'];

export async function computeProcessMiningInsights(adminClient: SupabaseClient, companyId: number): Promise<ProcessMiningResult> {
  const { data: rows, error } = await adminClient
    .from('status_transition_log')
    .select('table_name, record_id, from_status, to_status, changed_at')
    .eq('company_id', companyId)
    .order('changed_at', { ascending: true });
  if (error) throw new Error(`Gagal mengambil status_transition_log: ${error.message}`);

  const notes: string[] = [];
  if (!rows || rows.length === 0) {
    return {
      total_transitions: 0,
      earliest_transition_at: null,
      latest_transition_at: null,
      data_sufficient_for_trend_analysis: false,
      status_durations: [],
      transition_counts: [],
      backward_or_cancelled_transitions: [],
      notes: ['Belum ada satu pun transisi status tercatat -- data belum cukup utk analisis apa pun.']
    };
  }

  const earliestAt = rows[0].changed_at;
  const latestAt = rows[rows.length - 1].changed_at;
  const daySpan = (new Date(latestAt).getTime() - new Date(earliestAt).getTime()) / (1000 * 60 * 60 * 24);
  const dataSufficientForTrend = daySpan >= 14;
  if (!dataSufficientForTrend) {
    notes.push(`Rentang data cuma ${formatNumberId(daySpan, 1)} hari (sejak ${earliestAt.slice(0, 10)}) -- BELUM CUKUP utk analisis tren (ambang 14 hari, konsisten dgn KPI baseline). Angka di bawah tetap dihitung dari data yang ADA, bukan diprediksi.`);
  }

  // Durasi tiap status: cari pasangan transisi BERURUTAN utk record yang sama
  // (table_name, record_id), durasi = changed_at transisi berikutnya - changed_at transisi ini.
  const byRecord = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.table_name}:${row.record_id}`;
    if (!byRecord.has(key)) byRecord.set(key, []);
    byRecord.get(key)!.push(row);
  }

  const durationSamples = new Map<string, number[]>(); // "table.status" -> [jam, jam, ...]
  const transitionCounts = new Map<string, TransitionCountInsight>();

  for (const [, recordRows] of byRecord) {
    for (let i = 0; i < recordRows.length; i++) {
      const current = recordRows[i];
      const key = `${current.table_name}.${current.from_status}->${current.to_status}`;
      if (!transitionCounts.has(key)) {
        transitionCounts.set(key, { table_name: current.table_name, from_status: current.from_status, to_status: current.to_status, count: 0 });
      }
      transitionCounts.get(key)!.count += 1;

      const next = recordRows[i + 1];
      if (next) {
        const durationHours = (new Date(next.changed_at).getTime() - new Date(current.changed_at).getTime()) / (1000 * 60 * 60);
        const durationKey = `${current.table_name}.${current.to_status}`;
        if (!durationSamples.has(durationKey)) durationSamples.set(durationKey, []);
        durationSamples.get(durationKey)!.push(durationHours);
      }
    }
  }

  const statusDurations: StatusDurationInsight[] = Array.from(durationSamples.entries()).map(([key, samples]) => {
    const [table_name, status] = key.split('.');
    const sufficient = samples.length >= MIN_SAMPLES_FOR_DURATION;
    return {
      table_name,
      status,
      sample_count: samples.length,
      avg_duration_hours: sufficient ? samples.reduce((s, v) => s + v, 0) / samples.length : null
    };
  });
  const insufficientCount = statusDurations.filter((d) => d.avg_duration_hours === null).length;
  if (insufficientCount > 0) {
    notes.push(`${insufficientCount} status punya kurang dari ${MIN_SAMPLES_FOR_DURATION} sampel durasi -- ditandai "data belum cukup" (avg_duration_hours=null), BUKAN dihitung seolah pasti.`);
  }

  const transitionCountsArr = Array.from(transitionCounts.values()).sort((a, b) => b.count - a.count);
  const backwardOrCancelled = transitionCountsArr.filter((t) => BACKWARD_OR_CANCEL_STATUSES.includes(t.to_status.toLowerCase()));

  return {
    total_transitions: rows.length,
    earliest_transition_at: earliestAt,
    latest_transition_at: latestAt,
    data_sufficient_for_trend_analysis: dataSufficientForTrend,
    status_durations: statusDurations.sort((a, b) => (b.avg_duration_hours ?? 0) - (a.avg_duration_hours ?? 0)),
    transition_counts: transitionCountsArr,
    backward_or_cancelled_transitions: backwardOrCancelled,
    notes
  };
}
