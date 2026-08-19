import { NextRequest, NextResponse } from 'next/server';
import { listKamusTerms } from '@/features/kamus/server';

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status') ?? undefined;
  const priorityRaw = request.nextUrl.searchParams.get('priority');
  const domain = request.nextUrl.searchParams.get('domain') ?? undefined;
  const assignedToRole = request.nextUrl.searchParams.get('assigned_to_role') ?? undefined;
  const scope = request.nextUrl.searchParams.get('scope') ?? undefined;
  const result = await listKamusTerms(request, {
    status,
    priority: priorityRaw ? Number(priorityRaw) : undefined,
    domain,
    assignedToRole,
    scope
  });
  return NextResponse.json(result.body, { status: result.status });
}
