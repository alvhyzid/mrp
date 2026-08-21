import { NextRequest, NextResponse } from 'next/server';
import { restoreSupplier } from '@/features/mrp/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const result = await restoreSupplier(request, supplierId);
  return NextResponse.json(result.body, { status: result.status });
}
