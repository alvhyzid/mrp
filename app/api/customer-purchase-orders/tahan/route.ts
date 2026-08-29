import { NextRequest, NextResponse } from 'next/server';
import { aksiCustomerPurchaseOrder } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await aksiCustomerPurchaseOrder(request, 'tahan');
  return NextResponse.json(result.body, { status: result.status });
}
