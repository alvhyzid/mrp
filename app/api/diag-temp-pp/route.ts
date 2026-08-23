import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// DIAGNOSTIK SEMENTARA (insiden PP) -- DIHAPUS setelah dipakai. Tidak pernah mengembalikan nilai kunci.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const out: Record<string, unknown> = { projectRef: url.replace('https://', '').split('.')[0] };

  // A. lewat supabase-js
  try {
    const admin = createClient(url, svc, { auth: { persistSession: false } });
    const { data, error } = await admin.from('users').select('user_id, company_id').limit(50);
    out.sdk_rows = data ? data.length : 'null';
    out.sdk_err = error ? `${error.code ?? ''} ${error.message}` : '';
  } catch (e) {
    out.sdk_err = e instanceof Error ? e.message : String(e);
  }

  // B. raw fetch ke PostgREST (mengisolasi pustaka vs kunci)
  try {
    const r = await fetch(`${url}/rest/v1/users?select=user_id&limit=50`, {
      headers: { apikey: svc, Authorization: `Bearer ${svc}` }
    });
    const txt = await r.text();
    out.raw_status = r.status;
    out.raw_body = txt.slice(0, 200);
  } catch (e) {
    out.raw_err = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(out);
}
