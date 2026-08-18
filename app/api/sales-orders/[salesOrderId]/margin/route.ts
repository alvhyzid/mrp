import { NextRequest, NextResponse } from 'next/server';
import { getSalesOrderMargin } from '@/features/mrp/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ salesOrderId: string }> }) {
  const { salesOrderId } = await params;
  const parsed = Number(salesOrderId);
  if (!Number.isInteger(parsed)) {
    return NextResponse.json({ error: 'ID sales order tidak valid.' }, { status: 400 });
  }
  const result = await getSalesOrderMargin(request, parsed);
  return NextResponse.json(result.body, { status: result.status });
}
