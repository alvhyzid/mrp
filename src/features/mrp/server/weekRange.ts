// Helper tanggal minggu (Senin-Minggu) yang dipakai BERSAMA oleh Dashboard
// Kapasitas (getWorkCenterCapacity) dan Gantt Produksi (getWorkCenterGantt) —
// sengaja satu sumber, supaya definisi "minggu ini" TIDAK PERNAH bisa
// menyimpang antara kedua fitur itu.

export function getWeekRange(weekOffset = 0): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Minggu, 1 = Senin, ... 6 = Sabtu
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + weekOffset * 7);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  return { weekStart, weekEnd };
}

// Format YYYY-MM-DD dari waktu LOKAL (bukan toISOString, yang bisa mundur/maju
// 1 hari kalau dikonversi ke UTC dulu).
export function dateToDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
