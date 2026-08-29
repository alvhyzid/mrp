import { NextRequest, NextResponse } from 'next/server';
import { selesaikanSalesOrder } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await selesaikanSalesOrder(request);
  return NextResponse.json(result.body, { status: result.status });
}
