import { NextRequest, NextResponse } from 'next/server';
import { listCustomers, createCustomer } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await listCustomers(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createCustomer(request);
  return NextResponse.json(result.body, { status: result.status });
}
