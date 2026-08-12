import { NextRequest, NextResponse } from 'next/server';
import { getCompany, updateCompany } from '@/features/company/server';

export async function GET(request: NextRequest) {
  const result = await getCompany(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await updateCompany(request);
  return NextResponse.json(result.body, { status: result.status });
}
