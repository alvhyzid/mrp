import { NextRequest, NextResponse } from 'next/server';
import { recordOpeningBalance } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await recordOpeningBalance(request);
  return NextResponse.json(result.body, { status: result.status });
}
