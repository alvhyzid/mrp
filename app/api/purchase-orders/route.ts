import { NextRequest, NextResponse } from 'next/server';
import { listPurchaseOrders, createPurchaseOrder } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listPurchaseOrders(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createPurchaseOrder(request);
  return NextResponse.json(result.body, { status: result.status });
}
