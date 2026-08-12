const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const superAdminPassword = process.env.DEBUG_SUPER_ADMIN_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !superAdminPassword) {
  console.error('Environment variables NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEBUG_SUPER_ADMIN_PASSWORD must be set.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function main() {
  const email = 'superadmin@debug.mrp';
  const password = superAdminPassword;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Super Admin' }
  });

  if (authError) {
    console.error('Failed to create super_admin auth user:', authError.message);
    process.exit(1);
  }

  const authUid = authData.user.id;
  const { data: userRow, error: userError } = await admin.from('users').upsert([
    {
      auth_uid: authUid,
      company_id: null,
      name: 'Super Admin',
      email,
      role: 'super_admin',
      status: 'active',
      created_at: new Date().toISOString()
    }
  ], { onConflict: 'auth_uid' }).select().single();

  if (userError) {
    console.error('Failed to create super_admin user row:', userError.message);
    process.exit(1);
  }

  console.log('Super admin created/updated successfully.');
  console.log('Credentials: superadmin@debug.mrp (see DEBUG_SUPER_ADMIN_PASSWORD in your .env.local)');
  console.log('auth_uid:', authUid);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});