import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Ringkasan KPI lintas-department untuk halaman /dashboard company_admin/
// general_manager — dihitung langsung dari tabel yang sudah ada (customer_purchase_orders,
// sales_orders, employees, lots+items), bukan tabel baru, sama seperti prinsip
// listStockSummary/listPendingPurchaseOrders. Khusus leadership: department lain
// sudah punya dashboard sendiri sebagai halaman utama mereka.
export async function getDashboardSummary(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!isCompanyLeadership(appUser.role)) {
      return { status: 403, body: { error: 'Ringkasan KPI ini khusus Admin Perusahaan/General Manager.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const [newPoResult, activeSoResult, activeEmployeeResult, lotsResult, itemsResult] = await Promise.all([
      adminClient.from('customer_purchase_orders').select('customer_purchase_order_id', { count: 'exact', head: true }).eq('company_id', appUser.company_id).eq('status', 'new'),
      adminClient.from('sales_orders').select('sales_order_id', { count: 'exact', head: true }).eq('company_id', appUser.company_id)// AD-03 (30 Agu 2026): `in_production` DICABUT sebagai status Sales Order -- ia tidak pernah
      // ditulis kode mana pun, dan kebenaran produksi milik Manufacturing. Yang tersisa untuk
      // "order yang masih berjalan" adalah `confirmed`.
      .eq('status', 'confirmed'),
      adminClient.from('employees').select('employee_id', { count: 'exact', head: true }).eq('company_id', appUser.company_id).eq('is_active', true),
      adminClient.from('lots').select('item_id, quantity_on_hand').eq('company_id', appUser.company_id).eq('status', 'available'),
      adminClient.from('items').select('item_id, min_stock_level').eq('company_id', appUser.company_id)
    ]);

    for (const result of [newPoResult, activeSoResult, activeEmployeeResult, lotsResult, itemsResult]) {
      if (result.error) {
        return { status: 500, body: { error: result.error.message } };
      }
    }

    // Sama persis logikanya dengan is_below_min_stock di listStockSummary — jumlah
    // stok dijumlah lintas plant per item, dibandingkan ke min_stock_level.
    const qtyByItem = new Map<number, number>();
    for (const lot of lotsResult.data ?? []) {
      qtyByItem.set(lot.item_id, (qtyByItem.get(lot.item_id) ?? 0) + Number(lot.quantity_on_hand));
    }
    let belowMinStockCount = 0;
    for (const item of itemsResult.data ?? []) {
      const minStock = item.min_stock_level ? Number(item.min_stock_level) : 0;
      const qty = qtyByItem.get(item.item_id) ?? 0;
      if (minStock > 0 && qty < minStock) {
        belowMinStockCount += 1;
      }
    }

    return {
      status: 200,
      body: {
        newPoCount: newPoResult.count ?? 0,
        activeSoCount: activeSoResult.count ?? 0,
        activeEmployeeCount: activeEmployeeResult.count ?? 0,
        belowMinStockCount
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
