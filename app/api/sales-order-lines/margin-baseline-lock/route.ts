import { NextRequest, NextResponse } from 'next/server';
import { lockMarginBaseline } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await lockMarginBaseline(request);
  return NextResponse.json(result.body, { status: result.status });
}
