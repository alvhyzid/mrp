import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function ensureEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} environment variable is not configured.`);
  }
  return value;
}

export function getPublicClient(): SupabaseClient {
  return createClient(ensureEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl), ensureEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', supabaseAnonKey), {
    auth: {
      persistSession: false
    }
  });
}

export function getAdminClient(): SupabaseClient {
  return createClient(ensureEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl), ensureEnv('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey), {
    auth: {
      persistSession: false
    }
  });
}

export async function parseBearerToken(request: NextRequest): Promise<string> {
  const authorization = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('Missing or invalid Authorization header. Token harus dikirim sebagai Bearer token.');
  }
  return authorization.slice(7).trim();
}

export async function getCurrentUser(request: NextRequest, options: { allowInvited?: boolean } = {}) {
  const token = await parseBearerToken(request);
  const adminClient = getAdminClient();
  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData?.user) {
    throw new Error(authError?.message || 'Token tidak valid.');
  }

  const authUid = authData.user.id;
  const { data: userRow, error: userRowError } = await adminClient
    .from('users')
    .select('user_id,company_id,role,status,name,email,auth_uid,avatar_url')
    .eq('auth_uid', authUid)
    .single();

  if (userRowError || !userRow) {
    throw new Error('Pengguna tidak ditemukan di basis data aplikasi.');
  }

  const allowedStatuses = options.allowInvited ? ['active', 'invited'] : ['active'];
  if (!allowedStatuses.includes(userRow.status)) {
    throw new Error('Akun Anda belum aktif atau telah dinonaktifkan.');
  }

  return { authUser: authData.user, appUser: userRow };
}
