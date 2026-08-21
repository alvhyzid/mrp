import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { randomBytes } from 'crypto';
import { INVITABLE_ROLES } from '@/lib/roles';

const validRoles = INVITABLE_ROLES;

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function inviteTeamMember(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (appUser.role !== 'company_admin') {
      return { status: 403, body: { error: 'Hanya Admin Perusahaan yang dapat mengundang anggota.' } };
    }

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || '').trim();

    if (!email || !role) {
      return { status: 400, body: { error: 'Email dan role wajib diisi.' } };
    }

    if (!validRoles.includes(role)) {
      return { status: 400, body: { error: 'Role tidak valid.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: existingUser, error: existingUserError } = await adminClient
      .from('users')
      .select('user_id,status')
      .eq('email', email)
      .eq('company_id', appUser.company_id)
      .maybeSingle();

    if (existingUserError) {
      return { status: 500, body: { error: existingUserError.message } };
    }

    if (existingUser) {
      return { status: 400, body: { error: 'Email sudah diundang atau sudah menjadi anggota perusahaan ini.' } };
    }

    const token = randomBytes(24).toString('hex');
    const exp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/invite/accept?token=${encodeURIComponent(token)}`;

    const inviteResponse = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo
    });

    if (inviteResponse.error || !inviteResponse.data?.user) {
      return { status: 500, body: { error: inviteResponse.error?.message || 'Gagal mengirim undangan lewat Supabase.' } };
    }

    const authUid = inviteResponse.data.user.id;

    const { error: userInsertError } = await adminClient.from('users').insert([
      {
        auth_uid: authUid,
        company_id: appUser.company_id,
        name: '',
        email,
        role,
        status: 'invited',
        created_at: new Date().toISOString()
      }
    ]);

    if (userInsertError) {
      return { status: 500, body: { error: userInsertError.message } };
    }

    const { error: invitationError } = await adminClient.from('invitations').insert([
      {
        company_id: appUser.company_id,
        email,
        role,
        invited_by: appUser.user_id,
        status: 'pending',
        token,
        expires_at: exp.toISOString()
      }
    ]);

    if (invitationError) {
      return { status: 500, body: { error: invitationError.message } };
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return {
      status: 401,
      body: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}
