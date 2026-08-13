import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { getApprovalDepartmentForRole } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Data SAMA dengan customer_po_approvals yang dipakai halaman /customer-purchase-orders
// (Prinsip Desain #8) — endpoint ini cuma menyaring baris department yang cocok
// dengan role user yang login, dipakai dashboard PPIC/Finance untuk "PO client
// menunggu approval bagian saya".
export async function listPendingApprovalsForMe(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const department = getApprovalDepartmentForRole(appUser.role);
    if (!department) {
      return { status: 200, body: { approvals: [], department: null } };
    }

    const adminClient = getAdminClient();
    const { data: approvals, error } = await adminClient
      .from('customer_po_approvals')
      .select('customer_po_approval_id, customer_purchase_order_id, department, status')
      .eq('department', department)
      .eq('status', 'pending');

    if (error) {
      return { status: 500, body: { error: error.message } };
    }

    if (!approvals || approvals.length === 0) {
      return { status: 200, body: { approvals: [], department } };
    }

    const poIds = approvals.map((a) => a.customer_purchase_order_id);
    const { data: pos, error: posError } = await adminClient
      .from('customer_purchase_orders')
      .select('customer_purchase_order_id, customer_id, po_number, po_date, requested_ship_date, company_id')
      .in('customer_purchase_order_id', poIds)
      .eq('company_id', appUser.company_id);

    if (posError) {
      return { status: 500, body: { error: posError.message } };
    }

    const customerIds = Array.from(new Set((pos ?? []).map((po) => po.customer_id)));
    const { data: customers } = customerIds.length
      ? await adminClient.from('customers').select('customer_id, name').in('customer_id', customerIds)
      : { data: [] as { customer_id: number; name: string }[] };
    const customersById = new Map((customers ?? []).map((c) => [c.customer_id, c]));
    const posById = new Map((pos ?? []).map((po) => [po.customer_purchase_order_id, po]));

    const result = approvals
      .filter((approval) => posById.has(approval.customer_purchase_order_id))
      .map((approval) => {
        const po = posById.get(approval.customer_purchase_order_id)!;
        return {
          customer_po_approval_id: approval.customer_po_approval_id,
          customer_purchase_order_id: po.customer_purchase_order_id,
          po_number: po.po_number,
          po_date: po.po_date,
          requested_ship_date: po.requested_ship_date,
          customer_name: customersById.get(po.customer_id)?.name ?? null
        };
      });

    return { status: 200, body: { approvals: result, department } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
