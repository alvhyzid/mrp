import { NextRequest, NextResponse } from 'next/server';
import { recordStockAdjustment } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await recordStockAdjustment(request);
  return NextResponse.json(result.body, { status: result.status });
}
