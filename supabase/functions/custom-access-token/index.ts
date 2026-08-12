import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const hookSecretEnvNames = [
  'CUSTOM_ACCESS_TOKEN_HOOK_SECRETS',
  'CUSTOM_ACCESS_TOKEN_HOOK_SECRET',
  'CUSTOM_ACCESS_TOKEN_SECRET'
];

function getHookSecrets() {
  const rawValue = hookSecretEnvNames
    .map((name) => Deno.env.get(name))
    .filter(Boolean)
    .join('|');

  return rawValue
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (value.startsWith('v1,whsec_')) {
        return value.replace('v1,whsec_', '');
      }
      if (value.startsWith('whsec_')) {
        return value.replace('whsec_', '');
      }
      return value;
    });
}

function getAuthUid(payload: any) {
  return (
    payload?.user_id ||
    payload?.user?.id ||
    payload?.user?.sub ||
    payload?.user?.raw?.id ||
    payload?.user?.raw?.sub ||
    payload?.request?.user?.id ||
    payload?.request?.user?.sub ||
    payload?.session?.user?.id ||
    payload?.session?.user?.sub
  );
}

serve(async (req) => {
  try {
    const hookSecrets = getHookSecrets();
    if (hookSecrets.length === 0) {
      return new Response(JSON.stringify({ error: 'Hook secret is not configured.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = await req.text();
    const headers = Object.fromEntries(req.headers.entries());

    let verifiedPayload: any = null;
    let verificationError: Error | null = null;

    for (const secret of hookSecrets) {
      try {
        verifiedPayload = new Webhook(secret).verify(payload, headers);
        break;
      } catch (error) {
        verificationError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (!verifiedPayload) {
      return new Response(JSON.stringify({ error: 'Invalid hook signature.', detail: verificationError?.message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = typeof verifiedPayload === 'string' ? JSON.parse(verifiedPayload) : verifiedPayload;
    const authUid = getAuthUid(body);

    if (!authUid || typeof authUid !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing auth.uid in request body.', payload: body }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const claims = body?.claims;
    if (!claims || typeof claims !== 'object' || Array.isArray(claims)) {
      return new Response(JSON.stringify({ error: 'Missing or invalid claims object in request body.', payload: body }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!serviceRoleKey || !supabaseUrl) {
      return new Response(JSON.stringify({ error: 'Supabase service env not configured.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?select=company_id,role&auth_uid=eq.${encodeURIComponent(authUid)}`,
      {
        method: 'GET',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return new Response(JSON.stringify({ error: 'Failed to query user company_id.', detail: text }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const users = await response.json();
    const user = Array.isArray(users) ? users[0] : null;

    if (!user || !Object.prototype.hasOwnProperty.call(user, 'company_id')) {
      return new Response(JSON.stringify({ error: 'company_id not found for auth_uid.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updatedClaims = {
      ...claims,
      company_id: user.company_id,
      app_role: user.role
    };

    return new Response(JSON.stringify({ claims: updatedClaims }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Hook execution failed.', detail: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
