import { NextRequest, NextResponse } from 'next/server';
import { deleteCustomer } from '@/features/mrp/server';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const result = await deleteCustomer(request, customerId);
  return NextResponse.json(result.body, { status: result.status });
}
