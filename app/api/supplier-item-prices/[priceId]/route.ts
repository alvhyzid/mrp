import { NextRequest, NextResponse } from 'next/server';
import { deleteSupplierItemPrice } from '@/features/mrp/server';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ priceId: string }> }) {
  const { priceId } = await params;
  const result = await deleteSupplierItemPrice(request, priceId);
  return NextResponse.json(result.body, { status: result.status });
}
