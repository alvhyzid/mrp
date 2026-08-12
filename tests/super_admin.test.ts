import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const superAdminPassword = process.env.DEBUG_SUPER_ADMIN_PASSWORD;
const companyAPassword = process.env.DEBUG_COMPANY_A_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !superAdminPassword || !companyAPassword) {
  throw new Error(
    'Environment variables NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEBUG_SUPER_ADMIN_PASSWORD and DEBUG_COMPANY_A_PASSWORD must be set for tests.'
  );
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('super_admin verification', () => {
  let superAdminAuthUid: string;
  let regularCompanyAuthUid: string;
  let superAdminUser: any;
  let fixtureCompanyId: number;

  async function findAuthUserByEmail(email: string) {
    let page = 1;
    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 100, page });
      if (error) {
        throw new Error(`Failed to list auth users: ${error.message}`);
      }
      if (!data?.users?.length) {
        return null;
      }
      const found = data.users.find((user: any) => user.email === email);
      if (found) {
        return found;
      }
      if (!data.nextPage) {
        return null;
      }
      page += 1;
    }
  }

  async function getOrCreateAuthUser(email: string, password: string, fullName: string) {
    const existingUser = await findAuthUserByEmail(email);
    if (existingUser) {
      return existingUser;
    }
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    if (error) {
      throw new Error(`Failed to create auth user ${email}: ${error.message}`);
    }
    return data.user;
  }

  beforeAll(async () => {
    const email = 'superadmin@debug.mrp';
    const password = superAdminPassword;
    const companyName = 'SuperAdminCorp';

    const authUser = await getOrCreateAuthUser(email, password, 'Super Admin');
    superAdminAuthUid = authUser.id;

    const { data: userRow, error: userError } = await adminClient.from('users').upsert([
      { auth_uid: superAdminAuthUid, company_id: null, name: 'Super Admin', email, role: 'super_admin', status: 'active' }
    ], { onConflict: 'auth_uid' }).select().single();
    if (userError) {
      throw new Error(`Failed to create super_admin user row: ${userError.message}`);
    }
    superAdminUser = userRow;

    const normalEmail = 'companya@debug.mrp';
    const normalPassword = companyAPassword;
    const normalAuthUser = await getOrCreateAuthUser(normalEmail, normalPassword, 'Company A Admin');
    regularCompanyAuthUid = normalAuthUser.id;

    const { data: existingCompany, error: existingCompanyError } = await adminClient.from('companies').select('company_id,name').eq('name', companyName).maybeSingle();
    if (existingCompanyError) {
      throw new Error(`Failed to query existing company row: ${existingCompanyError.message}`);
    }

    let companyData = existingCompany;
    if (!companyData) {
      const { data: insertedCompany, error: insertCompanyError } = await adminClient.from('companies').insert([{ name: companyName, industry_type: 'manufacturing', status: 'trial' }]).select('company_id,name').single();
      if (insertCompanyError) {
        throw new Error(`Failed to create company row: ${insertCompanyError.message}`);
      }
      companyData = insertedCompany;
    }
    fixtureCompanyId = companyData.company_id;

    const { error: normalUserError } = await adminClient.from('users').upsert([
      { auth_uid: regularCompanyAuthUid, company_id: companyData.company_id, name: 'Company A Admin', email: normalEmail, role: 'company_admin', status: 'active' }
    ], { onConflict: 'auth_uid' });
    if (normalUserError) {
      throw new Error(`Failed to create company A user row: ${normalUserError.message}`);
    }
  });

  afterAll(async () => {
    await adminClient.from('users').delete().eq('company_id', fixtureCompanyId);
    await adminClient.from('users').delete().eq('auth_uid', superAdminAuthUid);
    await adminClient.from('companies').delete().eq('company_id', fixtureCompanyId);
    await adminClient.auth.admin.deleteUser(superAdminAuthUid);
    await adminClient.auth.admin.deleteUser(regularCompanyAuthUid);
  });

  it('should verify super_admin can be identified from users table', async () => {
    const { data, error } = await adminClient.rpc('is_super_admin_user', { current_auth_uid: superAdminAuthUid });
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it('should not allow non-super_admin to be identified as super_admin', async () => {
    const { data, error } = await adminClient.rpc('is_super_admin_user', { current_auth_uid: regularCompanyAuthUid });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it('should allow super_admin to read subscription_plans', async () => {
    const { data, error } = await adminClient.from('subscription_plans').select('*');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
