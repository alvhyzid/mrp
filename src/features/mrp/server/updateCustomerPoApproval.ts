import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canApproveDepartment } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function updateCustomerPoApproval(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const approvalId = Number(body.customer_po_approval_id);
    const status = String(body.status ?? '').trim();
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!approvalId) {
      return { status: 400, body: { error: 'ID approval tidak valid.' } };
    }
    if (!['approved', 'rejected'].includes(status)) {
      return { status: 400, body: { error: 'Status approval tidak valid (harus approved/rejected).' } };
    }

    const adminClient = getAdminClient();

    const { data: approval, error: approvalError } = await adminClient
      .from('customer_po_approvals')
      .select('customer_po_approval_id, customer_purchase_order_id, department, status')
      .eq('customer_po_approval_id', approvalId)
      .maybeSingle();

    if (approvalError) {
      return { status: 500, body: { error: approvalError.message } };
    }
    if (!approval) {
      return { status: 404, body: { error: 'Approval tidak ditemukan.' } };
    }

    const { data: po, error: poError } = await adminClient
      .from('customer_purchase_orders')
      .select('company_id, status')
      .eq('customer_purchase_order_id', approval.customer_purchase_order_id)
      .single();

    if (poError) {
      return { status: 500, body: { error: poError.message } };
    }
    if (po.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'PO client tidak ditemukan.' } };
    }

    if (!canApproveDepartment(appUser.role, approval.department)) {
      return { status: 403, body: { error: `Role Anda tidak berwenang approve/reject department '${approval.department}'.` } };
    }

    if (approval.status !== 'pending') {
      return { status: 400, body: { error: 'Approval ini sudah diputuskan sebelumnya.' } };
    }

    const { error: updateError } = await adminClient
      .from('customer_po_approvals')
      .update({ status, approved_by: appUser.user_id, approved_at: new Date().toISOString(), notes })
      .eq('customer_po_approval_id', approvalId);

    if (updateError) {
      return { status: 500, body: { error: updateError.message } };
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
