import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewKpi, isCompanyLeadership, canManageHr, getDepartmentForRole, getManagedDepartmentForRole } from '@/lib/roles';
import {
  fetchOperatingProfitRpc,
  computeMarginKontribusiFromRpc,
  computeMarginKontribusiPersen,
  computeLabaOperasionalFromRpc,
  computeBiayaProduksiPerUnit,
  computeYieldPerTahapProduk,
  computeNilaiPersediaan
} from './computeKpiValues';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// "KPI Saya" (revisi §1.2, ditarik masuk cakupan sesi KPI-1) -- CATATAN JUJUR:
// kelima KPI kategori A SEMUA attribution_level TIM/LINI/PERUSAHAAN (instruksi
// eksplisit: yield JANGAN individu), jadi halaman ini BELUM bisa menampilkan
// "nilai dirinya vs rata-rata tim" yang literal per orang -- itu perlu KPI
// attribution_level=INDIVIDU (KPI DISIPLIN, KPI-2, belum dibangun). Yang
// sungguh personal & perlu gerbang akses di sini: kpi_actions yang secara
// eksplisit ditugaskan ke user itu (owner_user_id) -- bagian INI yang diuji
// skenario negatif (c2), bukan nilai KPI-nya (nilai KPI sama untuk siapa pun
// dengan role/departemen yang sama, karena memang belum ada pemisahan individu).
export async function getMyKpi(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const requestedUserIdParam = request.nextUrl.searchParams.get('user_id');
    const requestedUserId = requestedUserIdParam ? Number(requestedUserIdParam) : appUser.user_id;

    let targetRole = appUser.role;
    let targetDepartment = getDepartmentForRole(appUser.role);

    if (requestedUserId !== appUser.user_id) {
      // Skenario negatif (c2): user LAIN diminta -- hanya boleh kalau pemohon
      // leadership/HR, ATAU manager departemen yang employee target berada di
      // dalamnya (pola SAMA employee_attendance_select: manager -> staf DI
      // department mereka sendiri saja).
      const { data: targetEmployee } = await adminClient.from('employees').select('employee_id, department, linked_user_id').eq('linked_user_id', requestedUserId).eq('company_id', appUser.company_id).maybeSingle();
      const { data: targetUser } = await adminClient.from('users').select('user_id, role').eq('user_id', requestedUserId).eq('company_id', appUser.company_id).maybeSingle();
      if (!targetUser) return { status: 404, body: { error: 'User tidak ditemukan.' } };

      const managedDept = getManagedDepartmentForRole(appUser.role);
      const isManagerOfTarget = !!managedDept && !!targetEmployee?.department && managedDept === targetEmployee.department;
      if (!isCompanyLeadership(appUser.role) && !canManageHr(appUser.role) && !isManagerOfTarget) {
        return { status: 403, body: { error: 'Anda tidak berwenang melihat "KPI Saya" milik user lain.' } };
      }
      targetRole = targetUser.role;
      targetDepartment = targetEmployee?.department ?? getDepartmentForRole(targetUser.role);
    }

    const { data: registryRows } = await adminClient
      .from('kpi_registry')
      .select('kpi_registry_id, metric_key, kind, pillar, owner_role, frequency, attribution_level, target_value, benchmark_value')
      .eq('company_id', appUser.company_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    // Relevan = target user PEMILIK/KONTRIBUTOR (kpi_responsibilities), ATAU
    // owner_role KPI itu = role target, ATAU departemen owner_role KPI = departemen
    // target -- cakupan cukup luas supaya halaman tidak kosong utk role terkait.
    const registryIds = (registryRows ?? []).map((r) => r.kpi_registry_id);
    const { data: respRows } = registryIds.length ? await adminClient.from('kpi_responsibilities').select('kpi_registry_id, role').in('kpi_registry_id', registryIds) : { data: [] as { kpi_registry_id: number; role: string | null }[] };
    const relevantRegistryIds = new Set((respRows ?? []).filter((r) => r.role === targetRole).map((r) => r.kpi_registry_id));

    const relevantKpis = (registryRows ?? []).filter(
      (k) => relevantRegistryIds.has(k.kpi_registry_id) || k.owner_role === targetRole || getDepartmentForRole(k.owner_role) === targetDepartment
    );

    const rpcCache: { value: Awaited<ReturnType<typeof fetchOperatingProfitRpc>> | undefined } = { value: undefined };
    const kpis = [];
    for (const kpi of relevantKpis) {
      if (!canViewKpi(targetRole, kpi)) continue; // tetap hormati canViewKpi utk role target, bukan cuma "relevan"
      let result;
      if (kpi.metric_key === 'metric.margin_kontribusi' || kpi.metric_key === 'metric.margin_kontribusi_persen' || kpi.metric_key === 'metric.laba_operasional_bulanan') {
        if (rpcCache.value === undefined) rpcCache.value = await fetchOperatingProfitRpc(request, appUser.company_id);
        if (kpi.metric_key === 'metric.margin_kontribusi') result = computeMarginKontribusiFromRpc(rpcCache.value);
        else if (kpi.metric_key === 'metric.margin_kontribusi_persen') result = await computeMarginKontribusiPersen(adminClient, appUser.company_id, rpcCache.value);
        else result = computeLabaOperasionalFromRpc(rpcCache.value);
      } else if (kpi.metric_key === 'metric.biaya_produksi_per_unit') {
        result = await computeBiayaProduksiPerUnit(adminClient, appUser.company_id);
      } else if (kpi.metric_key === 'metric.yield_per_tahap_produk') {
        result = await computeYieldPerTahapProduk(adminClient, appUser.company_id);
      } else {
        result = await computeNilaiPersediaan(adminClient, appUser.company_id);
      }
      kpis.push({
        kpi_registry_id: kpi.kpi_registry_id,
        metric_key: kpi.metric_key,
        pillar: kpi.pillar,
        attribution_level: kpi.attribution_level,
        value: result.value,
        target_value: kpi.target_value !== null ? Number(kpi.target_value) : null,
        note: 'Angka ini agregat departemen/perusahaan -- belum ada pemecahan per individu untuk KPI ini (attribution_level bukan INDIVIDU).'
      });
    }

    const { data: myActions } = await adminClient
      .from('kpi_actions')
      .select('kpi_action_id, kpi_registry_id, period, finding, action_text, due_date, status')
      .eq('company_id', appUser.company_id)
      .eq('owner_user_id', requestedUserId)
      .in('status', ['TERBUKA', 'BERJALAN']);

    return { status: 200, body: { role: targetRole, department: targetDepartment, kpis, open_actions: myActions ?? [] } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
