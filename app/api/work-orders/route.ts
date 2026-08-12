import { NextRequest, NextResponse } from 'next/server';
import { listWorkOrders, createWorkOrder } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listWorkOrders(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createWorkOrder(request);
  return NextResponse.json(result.body, { status: result.status });
}
