import { NextRequest, NextResponse } from 'next/server';
import { listDecisionReasonCategories } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const result = await listDecisionReasonCategories(request, searchParams.get('entity') ?? '', searchParams.get('action') ?? '');
  return NextResponse.json(result.body, { status: result.status });
}
