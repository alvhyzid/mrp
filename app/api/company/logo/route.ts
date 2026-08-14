import { NextRequest, NextResponse } from 'next/server';
import { uploadCompanyLogo } from '@/features/company/server';

export async function POST(request: NextRequest) {
  const result = await uploadCompanyLogo(request);
  return NextResponse.json(result.body, { status: result.status });
}
