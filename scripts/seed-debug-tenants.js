const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const companyAPassword = process.env.DEBUG_COMPANY_A_PASSWORD;
const companyBPassword = process.env.DEBUG_COMPANY_B_PASSWORD;
const companyAStaffPassword = process.env.DEBUG_COMPANY_A_STAFF_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !companyAPassword || !companyBPassword || !companyAStaffPassword) {
  console.error(
    'Environment variables NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEBUG_COMPANY_A_PASSWORD, DEBUG_COMPANY_B_PASSWORD and DEBUG_COMPANY_A_STAFF_PASSWORD must be set.'
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function findOrCreateCompany(company) {
  const { data: existingCompany, error: selectError } = await admin.from('companies').select('company_id,name').eq('name', company.name).maybeSingle();
  if (selectError) {
    throw new Error(`Failed to search company ${company.name}: ${selectError.message}`);
  }

  if (existingCompany) {
    return existingCompany;
  }

  const { data: insertedCompany, error: insertError } = await admin.from('companies').insert([company]).select('company_id,name').single();
  if (insertError) {
    throw new Error(`Failed to create company ${company.name}: ${insertError.message}`);
  }

  return insertedCompany;
}

async function findOrCreateAuthUser(user) {
  const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({ perPage: 100, page: 1 });
  if (listError) {
    throw new Error(`Failed to list auth users: ${listError.message}`);
  }

  const existingUser = existingUsers.users.find((item) => item.email === user.email);
  if (existingUser) {
    return existingUser;
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: user.name }
  });

  if (authError) {
    throw new Error(`Failed to create auth user ${user.email}: ${authError.message}`);
  }

  return authData.user;
}

async function main() {
  const companyA = await findOrCreateCompany({ name: 'Company A', industry_type: 'manufacturing', status: 'trial' });
  const companyB = await findOrCreateCompany({ name: 'Company B', industry_type: 'manufacturing', status: 'trial' });

  const users = [
    { name: 'Company A User', email: 'company.a@debug.mrp', password: companyAPassword, role: 'company_admin', status: 'active', companyId: companyA.company_id },
    { name: 'Company B User', email: 'company.b@debug.mrp', password: companyBPassword, role: 'company_admin', status: 'active', companyId: companyB.company_id },
    // Akun peran terbatas permanen (bukan sekali-pakai) supaya Anda bisa login sendiri
    // di browser dan lihat langsung bagaimana tampilan berubah untuk role yang TIDAK
    // termasuk company_admin/general_manager/finance_manager — mis. field/kolom
    // finansial (standard_cost, dst) tidak akan muncul untuk akun ini.
    { name: 'Company A Production Staff', email: 'staff.a@debug.mrp', password: companyAStaffPassword, role: 'production_staff', status: 'active', companyId: companyA.company_id }
  ];

  for (const user of users) {
    const authUser = await findOrCreateAuthUser(user);
    const authUid = authUser.id;

    const insertPayload = {
      company_id: user.companyId,
      auth_uid: authUid,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: new Date().toISOString()
    };

    const { error: userError } = await admin.from('users').upsert([insertPayload], { onConflict: 'auth_uid' });
    if (userError) {
      throw new Error(`Failed to insert application user row for: ${user.email} - ${userError.message}`);
    }

    console.log(`Ensured user ${user.email} (${user.role}) for company_id=${user.companyId}`);
  }

  console.log('\nLogin credentials (see DEBUG_COMPANY_A_PASSWORD / DEBUG_COMPANY_B_PASSWORD / DEBUG_COMPANY_A_STAFF_PASSWORD in your .env.local):');
  console.log('Company A admin (full access): company.a@debug.mrp');
  console.log('Company A production_staff (restricted access): staff.a@debug.mrp');
  console.log('Company B admin (isolation check): company.b@debug.mrp');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
