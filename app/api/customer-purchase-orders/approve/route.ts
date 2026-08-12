import { NextRequest, NextResponse } from 'next/server';
import { updateCustomerPoApproval } from '@/features/mrp/server';

export async function PATCH(request: NextRequest) {
  const result = await updateCustomerPoApproval(request);
  return NextResponse.json(result.body, { status: result.status });
}
