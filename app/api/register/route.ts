import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase environment variables are not fully configured.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });

  const body = await request.json();
  const { name, email, password, companyName } = body;

  if (!name || !email || !password || !companyName) {
    return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name }
  });

  if (authError || !authData) {
    return NextResponse.json({ error: authError?.message || 'Gagal membuat akun.' }, { status: 500 });
  }

  const userId = authData.user.id;

  const { data: companyData, error: companyError } = await supabaseAdmin
    .from('companies')
    .insert([{ name: companyName, industry_type: 'manufacturing', status: 'trial' }])
    .select('company_id')
    .single();

  if (companyError || !companyData) {
    return NextResponse.json({ error: companyError?.message || 'Gagal membuat perusahaan.' }, { status: 500 });
  }

  const companyId = companyData.company_id;

  const { error: userRowError } = await supabaseAdmin.from('users').insert([
    {
      company_id: companyId,
      name,
      email,
      role: 'company_admin',
      status: 'active',
      created_at: new Date().toISOString(),
      password_hash: ''
    }
  ]);

  if (userRowError) {
    return NextResponse.json({ error: userRowError.message || 'Gagal menyimpan data pengguna.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
