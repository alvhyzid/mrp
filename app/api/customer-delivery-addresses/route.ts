import { NextRequest, NextResponse } from 'next/server';
import { listCustomerDeliveryAddresses, createCustomerDeliveryAddress, updateCustomerDeliveryAddress } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const customerId = request.nextUrl.searchParams.get('customer_id') ?? undefined;
  const result = await listCustomerDeliveryAddresses(request, customerId);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createCustomerDeliveryAddress(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await updateCustomerDeliveryAddress(request);
  return NextResponse.json(result.body, { status: result.status });
}
