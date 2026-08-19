// Satu sumber logika durasi tahap (migration 20260820150000) -- dipakai oleh
// Gantt, Dashboard Kapasitas, dan detail blok Gantt supaya konsisten. Tahap
// BERBASIS LAJU (mis. Filling Sachet: 2 mesin x 15-20 pcs/menit) diberi
// duration_per_unit_minutes; durasi aktifnya = qty x nilai itu, BUKAN
// active_duration_minutes tetap. Tahap tanpa laju (duration_per_unit_minutes
// NULL) tetap pakai active_duration_minutes seperti sebelumnya -- tidak ada
// regresi untuk routing yang sudah ada.
export interface DurationCapableStep {
  active_duration_minutes: number | null;
  duration_per_unit_minutes?: number | null;
}

export function getEffectiveStepDurationMinutes(step: DurationCapableStep, qty: number): number {
  if (step.duration_per_unit_minutes !== null && step.duration_per_unit_minutes !== undefined) {
    return Number(step.duration_per_unit_minutes) * qty;
  }
  return step.active_duration_minutes ?? 0;
}
