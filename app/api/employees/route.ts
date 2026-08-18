import { NextRequest, NextResponse } from 'next/server';
import { listEmployees, createEmployee, updateEmployee } from '@/features/hr/server';

export async function GET(request: NextRequest) {
  const result = await listEmployees(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await createEmployee(request);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  const result = await updateEmployee(request);
  return NextResponse.json(result.body, { status: result.status });
}
