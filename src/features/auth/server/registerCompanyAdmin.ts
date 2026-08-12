import { createClient } from '@supabase/supabase-js';

interface RegisterInput {
  name?: string;
  email?: string;
  password?: string;
  companyName?: string;
  origin: string;
}

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function registerCompanyAdmin(input: RegisterInput): Promise<ApiResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return { status: 500, body: { error: 'Supabase environment variables are not fully configured.' } };
  }

  const { name, email, password, companyName, origin } = input;

  if (!name || !email || !password || !companyName) {
    return { status: 400, body: { error: 'Semua field wajib diisi.' } };
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

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${origin}/login`
    }
  });

  if (signUpError || !signUpData.user) {
    return { status: 500, body: { error: signUpError?.message || 'Gagal membuat akun.' } };
  }

  const authUid = signUpData.user.id;

  const { data: companyData, error: companyError } = await supabaseAdmin
    .from('companies')
    .insert([{ name: companyName, industry_type: 'manufacturing', status: 'trial' }])
    .select('company_id')
    .single();

  if (companyError || !companyData) {
    return { status: 500, body: { error: companyError?.message || 'Gagal membuat perusahaan.' } };
  }

  const companyId = companyData.company_id;

  const { error: userRowError } = await supabaseAdmin.from('users').insert([
    {
      company_id: companyId,
      auth_uid: authUid,
      name,
      email,
      role: 'company_admin',
      status: 'active',
      created_at: new Date().toISOString()
    }
  ]);

  if (userRowError) {
    return { status: 500, body: { error: userRowError.message || 'Gagal menyimpan data pengguna.' } };
  }

  return { status: 200, body: { success: true } };
}
