import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function acceptInvitation(request: NextRequest): Promise<ApiResult> {
  try {
    const { authUser } = await getCurrentUser(request, { allowInvited: true });
    const body = await request.json();
    const token = String(body.token || '').trim();

    if (!token) {
      return { status: 400, body: { error: 'Token undangan tidak ditemukan.' } };
    }

    const adminClient = getAdminClient();
    const { data: invitation, error: invitationError } = await adminClient
      .from('invitations')
      .select('invitation_id,company_id,email,role,status,expires_at')
      .eq('token', token)
      .maybeSingle();

    if (invitationError) {
      return { status: 500, body: { error: invitationError.message } };
    }

    if (!invitation || invitation.status !== 'pending') {
      return { status: 404, body: { error: 'Undangan tidak ditemukan atau sudah tidak berlaku.' } };
    }

    if (!authUser.email || invitation.email.toLowerCase() !== authUser.email.toLowerCase()) {
      return { status: 403, body: { error: 'Email undangan tidak cocok dengan akun yang sedang masuk.' } };
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return { status: 400, body: { error: 'Token undangan sudah kadaluarsa.' } };
    }

    const { error: inviteUpdateError } = await adminClient
      .from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('invitation_id', invitation.invitation_id);

    if (inviteUpdateError) {
      return { status: 500, body: { error: inviteUpdateError.message } };
    }

    const { data: existingUser, error: existingUserError } = await adminClient
      .from('users')
      .select('user_id,status')
      .eq('auth_uid', authUser.id)
      .maybeSingle();

    if (existingUserError) {
      return { status: 500, body: { error: existingUserError.message } };
    }

    if (!existingUser) {
      const { error: createUserError } = await adminClient.from('users').insert([
        {
          auth_uid: authUser.id,
          company_id: invitation.company_id,
          name: authUser.user_metadata?.full_name || '',
          email: authUser.email,
          role: invitation.role,
          status: 'active',
          created_at: new Date().toISOString()
        }
      ]);

      if (createUserError) {
        return { status: 500, body: { error: createUserError.message } };
      }
    } else {
      const { error: activateError } = await adminClient
        .from('users')
        .update({ status: 'active', company_id: invitation.company_id })
        .eq('auth_uid', authUser.id);

      if (activateError) {
        return { status: 500, body: { error: activateError.message } };
      }
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return {
      status: 401,
      body: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}
