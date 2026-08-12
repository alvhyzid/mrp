import { NextRequest, NextResponse } from 'next/server';
import { listEmployees } from '@/features/hr/server';

export async function GET(request: NextRequest) {
  const result = await listEmployees(request);
  return NextResponse.json(result.body, { status: result.status });
}
