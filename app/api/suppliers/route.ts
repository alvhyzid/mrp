import { NextRequest, NextResponse } from 'next/server';
import { listSuppliers, createSupplier, updateSupplier } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listSuppliers(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createSupplier(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await updateSupplier(request);
  return NextResponse.json(result.body, { status: result.status });
}
