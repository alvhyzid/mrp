import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';
import { computeStandardCostPerUnit } from './computeStandardCostPerUnit';
import { computeStandardLaborCostPerUnit } from './computeStandardLaborCostPerUnit';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Sesi 0C (21 Agu 2026) — aksi EKSPLISIT terpisah dari getMarginWatch.ts (yang
// sekarang murni membaca/menghitung, tidak pernah menulis). Mengunci baseline
// margin adalah keputusan bisnis ("kami menerima biaya standar ini sebagai
// acuan pembanding order ini"), jadi butuh klik tersendiri + peran finansial +
// data biaya lengkap -- bukan efek samping dari sekadar membuka panel.
export async function lockMarginBaseline(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!canViewFinancialData(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya kewenangan finansial untuk mengunci baseline Margin Watch.' } };
    }
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const salesOrderLineId = Number(body.sales_order_line_id);
    if (!salesOrderLineId) {
      return { status: 400, body: { error: 'sales_order_line_id wajib diisi.' } };
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    const adminClient = getAdminClient();

    const { data: soLine, error: soLineError } = await adminClient
      .from('sales_order_lines')
      .select('sales_order_line_id, sales_order_id, item_id, unit_price')
      .eq('sales_order_line_id', salesOrderLineId)
      .maybeSingle();
    if (soLineError) return { status: 500, body: { error: soLineError.message } };
    if (!soLine) return { status: 404, body: { error: 'Baris sales order tidak ditemukan.' } };

    const { data: so, error: soError } = await adminClient.from('sales_orders').select('company_id').eq('sales_order_id', soLine.sales_order_id).maybeSingle();
    if (soError) return { status: 500, body: { error: soError.message } };
    if (!so || so.company_id !== appUser.company_id) return { status: 404, body: { error: 'Sales order tidak ditemukan di perusahaan Anda.' } };

    const { data: existingActive, error: existingError } = await adminClient
      .from('sales_order_line_margin_snapshots')
      .select('sales_order_line_margin_snapshot_id')
      .eq('sales_order_line_id', salesOrderLineId)
      .is('archived_at', null)
      .maybeSingle();
    if (existingError) return { status: 500, body: { error: existingError.message } };

    // 0C.5: kunci ULANG (baseline sudah ada) hanya company_admin, DAN alasan wajib.
    if (existingActive) {
      if (appUser.role !== 'company_admin') {
        return { status: 403, body: { error: 'Baseline Margin Watch untuk baris ini sudah terkunci -- hanya company_admin yang boleh mengunci ulang.' } };
      }
      if (!reason) {
        return { status: 400, body: { error: 'Alasan wajib diisi untuk mengunci ulang baseline yang sudah ada.' } };
      }
    }

    // 0C.4: gerbang kelengkapan -- tolak kalau data biaya standar diketahui belum lengkap.
    const cost = await computeStandardCostPerUnit(adminClient, appUser.company_id, soLine.item_id);
    if (!cost.complete) {
      return {
        status: 400,
        body: { error: `Belum bisa dikunci: ${cost.missingCostItemCodes.length} bahan/kemasan belum punya harga standar (standard_cost) -- ${cost.missingCostItemCodes.join(', ')}.` }
      };
    }
    const labor = await computeStandardLaborCostPerUnit(adminClient, appUser.company_id, soLine.item_id);

    if (existingActive) {
      const { error: archiveError } = await adminClient
        .from('sales_order_line_margin_snapshots')
        .update({ archived_at: new Date().toISOString(), archived_reason: reason })
        .eq('sales_order_line_margin_snapshot_id', existingActive.sales_order_line_margin_snapshot_id);
      if (archiveError) return { status: 500, body: { error: archiveError.message } };
    }

    const { data: inserted, error: insertError } = await adminClient
      .from('sales_order_line_margin_snapshots')
      .insert([
        {
          company_id: appUser.company_id,
          sales_order_line_id: salesOrderLineId,
          unit_price: soLine.unit_price,
          standard_material_cost_per_unit: cost.materialCostPerUnit,
          standard_packaging_cost_per_unit: cost.packagingCostPerUnit,
          standard_labor_cost_per_unit: labor.costPerUnit,
          cost_data_complete: cost.complete,
          missing_cost_item_codes: cost.missingCostItemCodes,
          unverified_cost_item_codes: cost.unverifiedCostItemCodes,
          labor_cost_complete: labor.complete,
          labor_cost_notes: labor.notes,
          locked_by: appUser.user_id,
          relock_reason: existingActive ? reason : null
        }
      ])
      .select('sales_order_line_margin_snapshot_id, created_at')
      .single();
    if (insertError) return { status: 500, body: { error: insertError.message } };

    return { status: 200, body: { success: true, locked_at: inserted.created_at, was_relock: !!existingActive } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
