import { NextRequest, NextResponse } from 'next/server';
import { archiveCustomer } from '@/features/mrp/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const result = await archiveCustomer(request, customerId);
  return NextResponse.json(result.body, { status: result.status });
}
