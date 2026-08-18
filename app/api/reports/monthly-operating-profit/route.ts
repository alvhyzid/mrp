import { NextRequest, NextResponse } from 'next/server';
import { getMonthlyOperatingProfit } from '@/features/mrp/server';

export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get('year'));
  const month = Number(request.nextUrl.searchParams.get('month'));
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return NextResponse.json({ error: 'Parameter year dan month wajib diisi angka.' }, { status: 400 });
  }
  const result = await getMonthlyOperatingProfit(request, year, month);
  return NextResponse.json(result.body, { status: result.status });
}
