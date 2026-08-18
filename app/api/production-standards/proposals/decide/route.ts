import { NextRequest, NextResponse } from 'next/server';
import { decideProductionStandardProposal } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await decideProductionStandardProposal(request);
  return NextResponse.json(result.body, { status: result.status });
}
