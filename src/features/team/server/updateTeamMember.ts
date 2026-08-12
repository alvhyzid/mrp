import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { COMPANY_ROLES } from '@/lib/roles';

const allowedStatuses = ['active', 'invited', 'suspended'];
const allowedRoles = COMPANY_ROLES;

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function updateTeamMember(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (appUser.role !== 'company_admin') {
      return { status: 403, body: { error: 'Hanya company_admin yang dapat mengubah anggota tim.' } };
    }

    const body = await request.json();
    const userId = Number(body.user_id);
    const role = body.role;
    const status = body.status;

    if (!userId) {
      return { status: 400, body: { error: 'ID pengguna tidak valid.' } };
    }

    if (userId === appUser.user_id) {
      return { status: 400, body: { error: 'Tidak bisa mengubah role atau status akun Anda sendiri lewat halaman ini.' } };
    }

    const updatePayload: Record<string, unknown> = {};

    if (role !== undefined) {
      if (!allowedRoles.includes(role)) {
        return { status: 400, body: { error: 'Role tidak valid.' } };
      }
      updatePayload.role = role;
    }

    if (status !== undefined) {
      if (!allowedStatuses.includes(status)) {
        return { status: 400, body: { error: 'Status tidak valid.' } };
      }
      updatePayload.status = status;
    }

    if (Object.keys(updatePayload).length === 0) {
      return { status: 400, body: { error: 'Tidak ada perubahan yang dikirim.' } };
    }

    const adminClient = getAdminClient();
    const { data: targetUser, error: targetError } = await adminClient
      .from('users')
      .select('company_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (targetError) {
      return { status: 500, body: { error: targetError.message } };
    }

    if (!targetUser) {
      return { status: 404, body: { error: 'Pengguna tidak ditemukan.' } };
    }

    if (targetUser.company_id !== appUser.company_id) {
      return { status: 403, body: { error: 'Tidak boleh mengubah pengguna di luar perusahaan Anda.' } };
    }

    const { error: updateError } = await adminClient.from('users').update(updatePayload).eq('user_id', userId);

    if (updateError) {
      return { status: 500, body: { error: updateError.message } };
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return {
      status: 401,
      body: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}
