import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function getProfile(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    return { status: 200, body: { user: appUser } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

export async function updateProfile(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser, authUser } = await getCurrentUser(request);
    const body = await request.json();
    const name = String(body.name || '').trim();

    if (!name) {
      return { status: 400, body: { error: 'Nama wajib diisi.' } };
    }

    const adminClient = getAdminClient();
    const { error: updateError } = await adminClient.from('users').update({ name }).eq('auth_uid', authUser.id);

    if (updateError) {
      return { status: 500, body: { error: updateError.message } };
    }

    await adminClient.auth.admin.updateUserById(authUser.id, {
      user_metadata: {
        ...authUser.user_metadata,
        full_name: name
      }
    });

    return { status: 200, body: { success: true, user: { ...appUser, name } } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
