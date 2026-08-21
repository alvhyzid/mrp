import { NextRequest, NextResponse } from 'next/server';
import { getBuildTasks } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const result = await getBuildTasks(request);
  return NextResponse.json(result.body, { status: result.status });
}
