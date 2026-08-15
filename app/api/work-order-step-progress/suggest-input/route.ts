import { NextRequest, NextResponse } from 'next/server';
import { suggestStepInputQty } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await suggestStepInputQty(request);
  return NextResponse.json(result.body, { status: result.status });
}
