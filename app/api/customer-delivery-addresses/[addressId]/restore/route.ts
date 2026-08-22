import { NextRequest, NextResponse } from 'next/server';
import { restoreCustomerDeliveryAddress } from '@/features/mrp/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ addressId: string }> }) {
  const { addressId } = await params;
  const result = await restoreCustomerDeliveryAddress(request, addressId);
  return NextResponse.json(result.body, { status: result.status });
}
