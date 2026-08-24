import { NextRequest, NextResponse } from 'next/server';
import { getCompanySettings, updateCompanySettings } from '@/features/company/server';

export async function GET(request: NextRequest) {
  const result = await getCompanySettings(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await updateCompanySettings(request);
  return NextResponse.json(result.body, { status: result.status });
}
