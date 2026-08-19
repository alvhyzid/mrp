import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageWorkCenterCapacity } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function updateWorkCenterCapacity(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageWorkCenterCapacity(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin mengubah kapasitas Work Center.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const workCenterId = Number(body.work_center_id);
    if (!workCenterId) {
      return { status: 400, body: { error: 'work_center_id wajib diisi.' } };
    }

    const capacityRaw = body.capacity_hours_per_day;
    const capacity = capacityRaw === null || capacityRaw === '' || capacityRaw === undefined ? null : Number(capacityRaw);
    if (capacity !== null && (!Number.isFinite(capacity) || capacity < 0)) {
      return { status: 400, body: { error: 'Kapasitas jam/hari harus angka positif (atau dikosongkan).' } };
    }

    // unit_count: jumlah unit mesin identik di Work Center ini (mis. 2 mesin
    // Filling Sachet) -- opsional di request supaya form kapasitas lama (yang
    // tidak tahu field ini) tetap jalan tanpa mengubah unit_count yang sudah ada.
    let unitCount: number | undefined;
    if (body.unit_count !== undefined) {
      const parsedUnitCount = Number(body.unit_count);
      if (!Number.isInteger(parsedUnitCount) || parsedUnitCount < 1) {
        return { status: 400, body: { error: 'Jumlah unit harus bilangan bulat 1 atau lebih.' } };
      }
      unitCount = parsedUnitCount;
    }

    const adminClient = getAdminClient();
    const { data: wc, error: wcError } = await adminClient.from('work_centers').select('work_center_id, company_id').eq('work_center_id', workCenterId).maybeSingle();
    if (wcError) return { status: 500, body: { error: wcError.message } };
    if (!wc || wc.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Work Center tidak ditemukan.' } };
    }

    const updatePayload: Record<string, unknown> = { capacity_hours_per_day: capacity };
    if (unitCount !== undefined) updatePayload.unit_count = unitCount;

    const { error: updateError } = await adminClient.from('work_centers').update(updatePayload).eq('work_center_id', workCenterId);
    if (updateError) return { status: 500, body: { error: updateError.message } };

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
