import { NextRequest, NextResponse } from 'next/server';
import { deleteOrArchiveCustomerDeliveryAddress } from '@/features/mrp/server';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ addressId: string }> }) {
  const { addressId } = await params;
  const result = await deleteOrArchiveCustomerDeliveryAddress(request, addressId);
  return NextResponse.json(result.body, { status: result.status });
}
