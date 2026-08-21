import { NextRequest, NextResponse } from 'next/server';
import { deleteSupplier } from '@/features/mrp/server';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const result = await deleteSupplier(request, supplierId);
  return NextResponse.json(result.body, { status: result.status });
}
