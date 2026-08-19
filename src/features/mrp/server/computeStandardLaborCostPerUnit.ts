import type { SupabaseClient } from '@supabase/supabase-js';
import { getEmployerCostConfig, computeMonthlyEmployerUplift } from './computeEmployerCostUplift';

export interface LaborCostResult {
  costPerUnit: number;
  complete: boolean;
  notes: string[];
}

// Margin Watch Lapis 1 — biaya SDM standar per unit. Basis (keputusan pemilik
// produk, 20 Agu 2026): biaya kru HARIAN lini produksi ÷ batches_per_day standar
// -- BUKAN dijumlah dari active_duration_minutes tiap tahap (itu waktu proses
// mesin/tahap, BUKAN waktu kru dibayar -- kru PHL/kontrak dibayar penuh 1 hari
// terlepas berapa menit tiap tahap makan waktu).
//
// Untuk item dengan BOM 2-tingkat (mis. Box Drinkme <- WIP Sachet <- bahan),
// SETIAP level yang punya routing+kru SENDIRI menyumbang biaya SDM-nya sendiri
// (per unit level itu, dikali rasio kebutuhan ke 1 unit item PALING ATAS) --
// bukan cuma level teratas. Level yang tidak punya routing/kru/standar
// (production_standards) dilewati (tidak dihitung, TIDAK dianggap 0 diam-diam)
// -- notes mencatat level mana yang dilewati dan kenapa.
export async function computeStandardLaborCostPerUnit(adminClient: SupabaseClient, companyId: number, topItemId: number): Promise<LaborCostResult> {
  const { data: activeBoms } = await adminClient.from('boms').select('bom_id, parent_item_id').eq('company_id', companyId).eq('status', 'active');
  const bomByParent = new Map((activeBoms ?? []).map((b) => [b.parent_item_id, b]));
  const bomIds = (activeBoms ?? []).map((b) => b.bom_id);
  const { data: bomLines } = bomIds.length
    ? await adminClient.from('bom_lines').select('bom_id, component_item_id, qty_per_unit_output').in('bom_id', bomIds)
    : { data: [] as { bom_id: number; component_item_id: number; qty_per_unit_output: number }[] };
  const linesByBom = new Map<number, { bom_id: number; component_item_id: number; qty_per_unit_output: number }[]>();
  for (const line of bomLines ?? []) {
    if (!linesByBom.has(line.bom_id)) linesByBom.set(line.bom_id, []);
    linesByBom.get(line.bom_id)!.push(line);
  }

  // itemId -> rasio kebutuhan per 1 unit item PALING ATAS (cuma utk item yang
  // PUNYA BOM sendiri, yaitu kandidat penyumbang biaya SDM level itu). SENGAJA
  // TIDAK di-pre-set di sini utk topItemId -- explode(topItemId, 1) di bawah
  // sudah menanganinya sendiri; pre-set di sini dulu pernah bikin rasio topItemId
  // dobel jadi 2 (ditemukan lewat verifikasi nyata SAS001/SAS005).
  const producedRatioPerTopUnit = new Map<number, number>();
  const visiting = new Set<number>();
  function explode(itemId: number, ratio: number) {
    if (visiting.has(itemId)) return;
    visiting.add(itemId);
    const bom = bomByParent.get(itemId);
    if (bom) {
      producedRatioPerTopUnit.set(itemId, (producedRatioPerTopUnit.get(itemId) ?? 0) + ratio);
      for (const line of linesByBom.get(bom.bom_id) ?? []) {
        explode(line.component_item_id, ratio * Number(line.qty_per_unit_output));
      }
    }
    visiting.delete(itemId);
  }
  explode(topItemId, 1);

  if (producedRatioPerTopUnit.size === 0) {
    const { data: topItem } = await adminClient.from('items').select('item_code').eq('item_id', topItemId).maybeSingle();
    return {
      costPerUnit: 0,
      complete: false,
      notes: [`${topItem?.item_code ?? `item#${topItemId}`}: item ini tidak punya BOM aktif — tidak ada level produksi untuk dihitung biaya SDM-nya.`]
    };
  }

  const { data: calendarSettings } = await adminClient
    .from('company_settings')
    .select('setting_key, setting_value')
    .eq('company_id', companyId)
    .in('setting_key', ['work_calendar_weekday_hours', 'standard_hours_per_month']);
  const weekdayHours = Number(calendarSettings?.find((s) => s.setting_key === 'work_calendar_weekday_hours')?.setting_value ?? 7);
  const hoursPerMonth = Number(calendarSettings?.find((s) => s.setting_key === 'standard_hours_per_month')?.setting_value ?? 173.3333);

  const { config: employerCostConfig, missingKeys: employerCostMissingKeys } = await getEmployerCostConfig(adminClient, companyId);

  let totalCostPerUnit = 0;
  const notes: string[] = [];
  let anyLevelCounted = false;

  for (const [itemId, ratio] of producedRatioPerTopUnit) {
    const { data: item } = await adminClient.from('items').select('item_code').eq('item_id', itemId).maybeSingle();
    const itemLabel = item?.item_code ?? `item#${itemId}`;

    const { data: routing } = await adminClient.from('routings').select('routing_id').eq('company_id', companyId).eq('item_id', itemId).maybeSingle();
    if (!routing) {
      notes.push(`${itemLabel}: belum punya routing — SDM level ini tidak dihitung.`);
      continue;
    }

    const { data: crew } = await adminClient.from('routing_step_standard_crew').select('*').eq('routing_id', routing.routing_id);
    if (!crew || crew.length === 0) {
      notes.push(`${itemLabel}: routing sudah ada tapi komposisi kru standar belum diisi — SDM level ini tidak dihitung.`);
      continue;
    }

    const { data: standards } = await adminClient
      .from('production_standards')
      .select('metric_key, value')
      .eq('company_id', companyId)
      .eq('item_id', itemId)
      .is('routing_step_id', null)
      .in('metric_key', ['unit_per_batch', 'batches_per_day']);
    const unitPerBatch = Number(standards?.find((s) => s.metric_key === 'unit_per_batch')?.value ?? 0);
    const batchesPerDay = Number(standards?.find((s) => s.metric_key === 'batches_per_day')?.value ?? 0);
    if (!unitPerBatch || !batchesPerDay) {
      notes.push(`${itemLabel}: kru sudah ada tapi unit_per_batch/batches_per_day belum ada — SDM level ini tidak dihitung.`);
      continue;
    }

    let dailyCrewCost = 0;
    for (const c of crew) {
      const headcount = Number(c.headcount);
      const hoursPerDay = Number(c.hours_per_day);
      let dailyCostPerPerson = 0;
      // wage_rate representatif diambil dari rata-rata karyawan AKTIF perusahaan
      // ini dengan wage_type yang sama (data nyata, bukan angka bebas) --
      // kalau tidak ada satu pun, level ini dicatat sebagai tidak lengkap.
      const { data: employeesOfType } = await adminClient
        .from('employees')
        .select('wage_rate, bpjs_kesehatan_enrolled, daily_meal_allowance, daily_transport_allowance')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .eq('wage_type', c.wage_type);
      if (!employeesOfType || employeesOfType.length === 0) {
        notes.push(`${itemLabel}/${c.role_label}: tidak ada karyawan aktif wage_type=${c.wage_type} sebagai acuan tarif — baris kru ini dilewati.`);
        continue;
      }
      const avgWageRate = employeesOfType.reduce((s, e) => s + Number(e.wage_rate), 0) / employeesOfType.length;
      // Tunjangan makan+transport per hari HADIR -- rata-rata dari karyawan yang
      // datanya sudah terisi (null dihitung 0, BUKAN dikeluarkan dari rata-rata --
      // kalau belum ada satu pun yang terisi, hasilnya memang 0 sampai datanya diisi,
      // bukan angka karangan).
      const avgDailyAllowance =
        employeesOfType.reduce((s, e) => s + Number(e.daily_meal_allowance ?? 0) + Number(e.daily_transport_allowance ?? 0), 0) / employeesOfType.length;

      // Iuran pemberi kerja (BPJS Kesehatan+JKK+JKM+JHT, Bagian D 21 Agu 2026) --
      // HANYA utk wage_type=monthly (satu-satunya kasus yang dicontohkan pemilik
      // produk, basis bulanan) -- wage_type lain dibiarkan seperti semula, TIDAK
      // ditebak diperluas ke sana.
      let avgMonthlyEmployerUplift = 0;
      if (c.wage_type === 'monthly') {
        if (employerCostConfig) {
          const uplifts = employeesOfType.map((e) => computeMonthlyEmployerUplift(Number(e.wage_rate), e.bpjs_kesehatan_enrolled, employerCostConfig));
          avgMonthlyEmployerUplift = uplifts.reduce((s, u) => s + u.upliftAmount, 0) / uplifts.length;
          const unconfirmedBpjsCount = uplifts.filter((u) => u.notes.length > 0).length;
          if (unconfirmedBpjsCount > 0) {
            notes.push(
              `${itemLabel}/${c.role_label}: ${unconfirmedBpjsCount} dari ${uplifts.length} karyawan acuan belum dikonfirmasi keikutsertaan BPJS Kesehatan-nya — iuran Kesehatan TIDAK diikutkan untuk mereka (bukan ditebak ikut).`
            );
          }
        } else {
          notes.push(`${itemLabel}/${c.role_label}: konfigurasi biaya pemberi kerja (BPJS/JKK/JKM/JHT) belum lengkap di company_settings (kunci hilang: ${employerCostMissingKeys.join(', ')}) — iuran pemberi kerja TIDAK diikutkan, cuma gaji pokok+tunjangan.`);
        }
      }
      const avgWageRateWithUplift = avgWageRate + avgMonthlyEmployerUplift;

      if (c.wage_type === 'daily') {
        dailyCostPerPerson = avgWageRate; // PHL: dibayar penuh 1 hari terlepas jam
      } else if (c.wage_type === 'monthly') {
        dailyCostPerPerson =
          (c.is_full_day_dedicated
            ? (avgWageRateWithUplift / hoursPerMonth) * weekdayHours // dikhususkan penuh 1 hari -> setara upah 1 hari kerja penuh
            : (avgWageRateWithUplift / hoursPerMonth) * hoursPerDay) + avgDailyAllowance; // dialokasikan proporsional jam (mis. SPV lintas lini); tunjangan per hari HADIR ditambah utuh (bukan diprorata jam)
      } else if (c.wage_type === 'hourly') {
        dailyCostPerPerson = avgWageRate * hoursPerDay;
      } else {
        notes.push(`${itemLabel}/${c.role_label}: wage_type=${c.wage_type} belum didukung kalkulasi SDM standar — baris kru ini dilewati.`);
        continue;
      }
      dailyCrewCost += dailyCostPerPerson * headcount;
    }

    const costPerUnitThisLevel = dailyCrewCost / batchesPerDay / unitPerBatch;
    totalCostPerUnit += costPerUnitThisLevel * ratio;
    anyLevelCounted = true;
    notes.push(`${itemLabel}: kru harian Rp${Math.round(dailyCrewCost).toLocaleString('id-ID')} ÷ ${batchesPerDay} batch/hari ÷ ${unitPerBatch} unit/batch = Rp${costPerUnitThisLevel.toFixed(2)}/unit level ini × rasio ${ratio.toFixed(6)} ke unit teratas.`);
  }

  return { costPerUnit: totalCostPerUnit, complete: anyLevelCounted && notes.every((n) => !n.includes('tidak dihitung') && !n.includes('dilewati')), notes };
}
