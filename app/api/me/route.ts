import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { appUserUntukClient } from '@/lib/storageSignedUrl';

export async function GET(request: NextRequest) {
  try {
    const { appUser } = await getCurrentUser(request);
    const adminClient = getAdminClient();
    let company = null;

    if (appUser.company_id !== null && appUser.company_id !== undefined) {
      const { data, error } = await adminClient
        .from('companies')
        .select('company_id,name,industry_type,status,logo_url')
        .eq('company_id', appUser.company_id)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      company = data || null;
    }

    return NextResponse.json({ user: await appUserUntukClient(adminClient, appUser), company });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 401 }
    );
  }
}
