import { NextRequest, NextResponse } from 'next/server';
import { listSuppliers, createSupplier } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listSuppliers(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createSupplier(request);
  return NextResponse.json(result.body, { status: result.status });
}
