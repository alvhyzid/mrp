import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { isCompanyLeadership } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Reimplementasi TypeScript dari fungsi DB process_customer_purchase_order()
// (supabase/migrations/20260813100000_po_so_customer_schema_updates.sql). Fungsi DB
// itu SECURITY DEFINER dan membaca auth.jwt() milik user yang memanggilnya lewat
// PostgREST — tapi API route ini (seperti semua endpoint lain di aplikasi) memanggil
// Supabase pakai service-role client, yang TIDAK punya konteks JWT user biasa,
// jadi tidak bisa langsung .rpc() fungsi itu dari sini. Fungsi DB tetap ada sebagai
// pengaman lapis kedua kalau ada yang panggil langsung lewat anon key + JWT sendiri;
// logikanya (termasuk format so_number) HARUS tetap sinkron dengan versi ini.
export async function processCustomerPurchaseOrder(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!(isCompanyLeadership(appUser.role) || appUser.role === 'ppic_manager')) {
      return { status: 403, body: { error: 'Hanya company_admin, general_manager, atau ppic_manager yang boleh memproses PO client.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const customerPurchaseOrderId = Number(body.customer_purchase_order_id);
    const productionPlantId = Number(body.production_plant_id);

    if (!customerPurchaseOrderId || !productionPlantId) {
      return { status: 400, body: { error: 'PO client dan lokasi pabrik wajib dipilih.' } };
    }

    const adminClient = getAdminClient();

    const { data: po, error: poError } = await adminClient
      .from('customer_purchase_orders')
      .select('*')
      .eq('customer_purchase_order_id', customerPurchaseOrderId)
      .maybeSingle();

    if (poError) {
      return { status: 500, body: { error: poError.message } };
    }
    if (!po || po.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'PO client tidak ditemukan di perusahaan Anda.' } };
    }

    if (po.status !== 'new') {
      return { status: 400, body: { error: `PO client hanya bisa diproses dari status new (status saat ini: ${po.status}).` } };
    }

    const { data: approvals, error: approvalsError } = await adminClient
      .from('customer_po_approvals')
      .select('status')
      .eq('customer_purchase_order_id', customerPurchaseOrderId)
      .eq('status', 'approved');

    if (approvalsError) {
      return { status: 500, body: { error: approvalsError.message } };
    }
    if ((approvals?.length ?? 0) < 3) {
      return { status: 400, body: { error: `PO client belum disetujui oleh ketiga department (baru ${approvals?.length ?? 0} dari 3).` } };
    }

    const { data: plant, error: plantError } = await adminClient
      .from('production_plants')
      .select('company_id')
      .eq('production_plant_id', productionPlantId)
      .maybeSingle();

    if (plantError) {
      return { status: 500, body: { error: plantError.message } };
    }
    if (!plant || plant.company_id !== po.company_id) {
      return { status: 400, body: { error: 'Lokasi pabrik tidak valid untuk perusahaan Anda.' } };
    }

    const so_number = await generateSoNumber(adminClient, po.company_id);

    const { data: insertedSo, error: soInsertError } = await adminClient
      .from('sales_orders')
      .insert([
        {
          company_id: po.company_id,
          customer_purchase_order_id: po.customer_purchase_order_id,
          customer_id: po.customer_id,
          production_plant_id: productionPlantId,
          status: 'confirmed',
          so_number
        }
      ])
      .select('sales_order_id')
      .single();

    if (soInsertError || !insertedSo) {
      return { status: 500, body: { error: soInsertError?.message ?? 'Gagal membuat sales order.' } };
    }

    const { data: poLines, error: poLinesError } = await adminClient
      .from('customer_purchase_order_lines')
      .select('item_id, qty_ordered, unit_price')
      .eq('customer_purchase_order_id', po.customer_purchase_order_id);

    if (poLinesError) {
      return { status: 500, body: { error: poLinesError.message } };
    }

    const { error: soLinesInsertError } = await adminClient.from('sales_order_lines').insert(
      (poLines ?? []).map((line) => ({
        sales_order_id: insertedSo.sales_order_id,
        item_id: line.item_id,
        qty_ordered: line.qty_ordered,
        unit_price: line.unit_price
      }))
    );

    if (soLinesInsertError) {
      await adminClient.from('sales_orders').delete().eq('sales_order_id', insertedSo.sales_order_id);
      return { status: 500, body: { error: soLinesInsertError.message } };
    }

    const { error: poUpdateError } = await adminClient
      .from('customer_purchase_orders')
      .update({ status: 'processed', processed_by: appUser.user_id, processed_at: new Date().toISOString() })
      .eq('customer_purchase_order_id', po.customer_purchase_order_id);

    if (poUpdateError) {
      return { status: 500, body: { error: poUpdateError.message } };
    }

    return { status: 200, body: { success: true, sales_order_id: insertedSo.sales_order_id, so_number } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

// Format & aturan HARUS identik dengan fungsi DB process_customer_purchase_order():
// "<urutan 3-digit>/<bulan>-<kode company>/<tahun>", urutan reset tiap tahun per company.
async function generateSoNumber(adminClient: ReturnType<typeof getAdminClient>, companyId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: company } = await adminClient.from('companies').select('name').eq('company_id', companyId).single();
  const { data: setting } = await adminClient
    .from('company_settings')
    .select('setting_value')
    .eq('company_id', companyId)
    .eq('setting_key', 'so_number_company_code')
    .maybeSingle();

  const companyCode = setting?.setting_value?.trim()
    ? setting.setting_value.trim()
    : (company?.name ?? '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'CO';

  const yearStart = new Date(Date.UTC(year, 0, 1)).toISOString();
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1)).toISOString();

  const { count } = await adminClient
    .from('sales_orders')
    .select('sales_order_id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', yearStart)
    .lt('created_at', yearEnd);

  const sequence = (count ?? 0) + 1;
  const sequenceStr = String(sequence).padStart(3, '0');

  return `${sequenceStr}/${month}-${companyCode}/${year}`;
}
