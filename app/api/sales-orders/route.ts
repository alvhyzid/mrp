import { NextRequest, NextResponse } from 'next/server';
import { listSalesOrders } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listSalesOrders(request);
  return NextResponse.json(result.body, { status: result.status });
}
