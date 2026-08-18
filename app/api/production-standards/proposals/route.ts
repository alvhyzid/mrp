import { NextRequest, NextResponse } from 'next/server';
import { listProductionStandardProposals } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listProductionStandardProposals(request);
  return NextResponse.json(result.body, { status: result.status });
}
