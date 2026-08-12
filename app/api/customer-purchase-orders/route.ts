import { NextRequest, NextResponse } from 'next/server';
import { listCustomerPurchaseOrders, createCustomerPurchaseOrder } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listCustomerPurchaseOrders(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createCustomerPurchaseOrder(request);
  return NextResponse.json(result.body, { status: result.status });
}
