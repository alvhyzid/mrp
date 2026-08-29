import { NextRequest, NextResponse } from 'next/server';
import { konfirmasiPemenuhanSalesOrder } from '@/features/mrp/server';

export async function POST(request: NextRequest) {
  const result = await konfirmasiPemenuhanSalesOrder(request);
  return NextResponse.json(result.body, { status: result.status });
}
