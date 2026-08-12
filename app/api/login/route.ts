import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase environment variables are not fully configured.' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    }
  });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });

  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data?.session || !data.user?.id) {
    return NextResponse.json({ error: error?.message || 'Gagal melakukan login.' }, { status: 401 });
  }

  const authUid = data.user.id;
  const { data: customUser, error: customUserError } = await supabaseAdmin
    .from('users')
    .select('user_id, company_id, role, status, name, email, auth_uid')
    .eq('auth_uid', authUid)
    .single();

  if (customUserError || !customUser) {
    return NextResponse.json({ error: 'Akun tidak valid atau tidak terdaftar di tenant.' }, { status: 401 });
  }

  if (customUser.status !== 'active' && customUser.status !== 'invited') {
    return NextResponse.json({ error: 'Akun Anda belum aktif atau sudah dinonaktifkan.' }, { status: 403 });
  }

  return NextResponse.json({ session: data.session, user: { ...data.user, tenant: customUser } });
}
