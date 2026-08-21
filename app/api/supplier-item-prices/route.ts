import { NextRequest, NextResponse } from 'next/server';
import { listSupplierItemPrices, upsertSupplierItemPrice } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listSupplierItemPrices(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await upsertSupplierItemPrice(request);
  return NextResponse.json(result.body, { status: result.status });
}
