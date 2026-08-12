import { NextRequest, NextResponse } from 'next/server';
import { processCustomerPurchaseOrder } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await processCustomerPurchaseOrder(request);
  return NextResponse.json(result.body, { status: result.status });
}
