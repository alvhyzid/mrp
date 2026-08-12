import { NextRequest, NextResponse } from 'next/server';
import { listPurchaseOrdersPendingReceipt } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listPurchaseOrdersPendingReceipt(request);
  return NextResponse.json(result.body, { status: result.status });
}
