import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listCustomerPurchaseOrders(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const canSeeCost = canViewFinancialData(appUser.role);

    const { data: pos, error: posError } = await adminClient
      .from('customer_purchase_orders')
      .select(
        'customer_purchase_order_id, customer_id, po_number, po_date, requested_ship_date, pic_name, pic_position, pic_phone, pic_email, status, payment_terms, payment_status, processed_by, processed_at, created_at, customer_name_snapshot, customer_billing_address_snapshot, customer_npwp_snapshot'
      )
      .eq('company_id', appUser.company_id)
      .order('created_at', { ascending: false });

    if (posError) {
      return { status: 500, body: { error: posError.message } };
    }

    if (!pos || pos.length === 0) {
      return { status: 200, body: { purchaseOrders: [] } };
    }

    const poIds = pos.map((po) => po.customer_purchase_order_id);

    const [customersRes, linesRes, approvalsRes, itemsRes, soRes] = await Promise.all([
      adminClient.from('customers').select('customer_id, name, customer_type').eq('company_id', appUser.company_id),
      adminClient.from('customer_purchase_order_lines').select('customer_purchase_order_line_id, customer_purchase_order_id, item_id, qty_ordered, unit_price').in('customer_purchase_order_id', poIds),
      adminClient.from('customer_po_approvals').select('customer_po_approval_id, customer_purchase_order_id, department, status, approved_by, approved_at, notes').in('customer_purchase_order_id', poIds),
      adminClient.from('items').select('item_id, item_code, name, base_uom').eq('company_id', appUser.company_id),
      adminClient.from('sales_orders').select('sales_order_id, customer_purchase_order_id, so_number, status, production_plant_id').in('customer_purchase_order_id', poIds)
    ]);

    if (customersRes.error) return { status: 500, body: { error: customersRes.error.message } };
    if (linesRes.error) return { status: 500, body: { error: linesRes.error.message } };
    if (approvalsRes.error) return { status: 500, body: { error: approvalsRes.error.message } };
    if (itemsRes.error) return { status: 500, body: { error: itemsRes.error.message } };
    if (soRes.error) return { status: 500, body: { error: soRes.error.message } };

    const customersById = new Map((customersRes.data ?? []).map((c) => [c.customer_id, c]));
    const itemsById = new Map((itemsRes.data ?? []).map((i) => [i.item_id, i]));

    const linesByPoId = new Map<number, typeof linesRes.data>();
    for (const line of linesRes.data ?? []) {
      const list = linesByPoId.get(line.customer_purchase_order_id) ?? [];
      list.push(line);
      linesByPoId.set(line.customer_purchase_order_id, list);
    }

    const approvalsByPoId = new Map<number, typeof approvalsRes.data>();
    for (const approval of approvalsRes.data ?? []) {
      const list = approvalsByPoId.get(approval.customer_purchase_order_id) ?? [];
      list.push(approval);
      approvalsByPoId.set(approval.customer_purchase_order_id, list);
    }

    const soByPoId = new Map((soRes.data ?? []).map((so) => [so.customer_purchase_order_id, so]));

    const result = pos.map((po) => {
      const customer = customersById.get(po.customer_id);
      const lines = (linesByPoId.get(po.customer_purchase_order_id) ?? []).map((line) => {
        const item = itemsById.get(line.item_id);
        return {
          customer_purchase_order_line_id: line.customer_purchase_order_line_id,
          item_id: line.item_id,
          item_code: item?.item_code ?? null,
          item_name: item?.name ?? null,
          item_base_uom: item?.base_uom ?? null,
          qty_ordered: line.qty_ordered,
          unit_price: canSeeCost ? line.unit_price : null
        };
      });

      return {
        customer_purchase_order_id: po.customer_purchase_order_id,
        customer_id: po.customer_id,
        // PMB-07a — utamakan identitas beku saat PO terbit; fallback ke join hidup
        // HANYA untuk PO lama yang dibuat sebelum kolom snapshot ada (snapshot null).
        customer_name: po.customer_name_snapshot ?? customer?.name ?? null,
        customer_billing_address: po.customer_billing_address_snapshot ?? null,
        customer_npwp: po.customer_npwp_snapshot ?? null,
        // V.1 (22 Agu 2026) — PO terbit sebelum kolom snapshot ada: TIDAK diisi
        // dari data client hari ini, ditandai apa adanya.
        identity_predates_snapshot: po.customer_name_snapshot === null,
        customer_type: customer?.customer_type ?? null,
        po_number: po.po_number,
        po_date: po.po_date,
        requested_ship_date: po.requested_ship_date,
        pic_name: po.pic_name,
        pic_position: po.pic_position,
        pic_phone: po.pic_phone,
        pic_email: po.pic_email,
        status: po.status,
        payment_terms: po.payment_terms,
        payment_status: po.payment_status,
        created_at: po.created_at,
        lines,
        approvals: approvalsByPoId.get(po.customer_purchase_order_id) ?? [],
        sales_order: soByPoId.get(po.customer_purchase_order_id) ?? null
      };
    });

    return { status: 200, body: { purchaseOrders: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
