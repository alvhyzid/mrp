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

    const [customersRes, linesRes, approvalsRes, itemsRes, soRes, jejakRes] = await Promise.all([
      adminClient.from('customers').select('customer_id, name, customer_type').eq('company_id', appUser.company_id),
      adminClient.from('customer_purchase_order_lines').select('customer_purchase_order_line_id, customer_purchase_order_id, item_id, qty_ordered, unit_price').in('customer_purchase_order_id', poIds),
      adminClient.from('customer_po_approvals').select('customer_po_approval_id, customer_purchase_order_id, department, status, approved_by, approved_at, notes').in('customer_purchase_order_id', poIds),
      adminClient.from('items').select('item_id, item_code, name, base_uom').eq('company_id', appUser.company_id),
      adminClient.from('sales_orders').select('sales_order_id, customer_purchase_order_id, so_number, status, production_plant_id').in('customer_purchase_order_id', poIds),
      // WS-S04 -- riwayat keputusan dibaca dari jejak KANONIK (status_transition_log),
      // bukan dari tabel riwayat khusus Sales. Menambah tabel kedua akan melahirkan
      // pertanyaan yang tidak punya jawaban tunggal: riwayat dibaca dari mana.
      adminClient
        .from('status_transition_log')
        .select('status_transition_log_id, record_id, from_status, to_status, changed_at, reason, reason_category, actor_name_snapshot, actor_role_snapshot, actor_department_snapshot, authority_basis, overridden_department')
        .eq('company_id', appUser.company_id)
        .eq('table_name', 'customer_purchase_orders')
        .in('record_id', poIds)
        .order('status_transition_log_id', { ascending: true })
    ]);

    if (customersRes.error) return { status: 500, body: { error: customersRes.error.message } };
    if (linesRes.error) return { status: 500, body: { error: linesRes.error.message } };
    if (approvalsRes.error) return { status: 500, body: { error: approvalsRes.error.message } };
    if (itemsRes.error) return { status: 500, body: { error: itemsRes.error.message } };
    if (soRes.error) return { status: 500, body: { error: soRes.error.message } };
    if (jejakRes.error) return { status: 500, body: { error: jejakRes.error.message } };

    // Label kategori alasan diambil dari katalog, bukan diterjemahkan ulang di layar --
    // supaya kalimat yang dibaca orang gudang dan yang dibaca orang finance sama persis.
    const { data: kategoriRows } = await adminClient
      .from('decision_reason_categories')
      .select('action, code, label')
      .eq('entity', 'customer_purchase_orders');
    const labelKategori = new Map((kategoriRows ?? []).map((k) => [`${k.action}|${k.code}`, k.label]));

    const AKSI_DARI_TRANSISI: Record<string, string> = {
      'new>on_hold': 'hold',
      'on_hold>new': 'release',
      'new>cancelled': 'cancel',
      'on_hold>cancelled': 'cancel',
      'new>processed': 'process'
    };

    const jejakByPoId = new Map<number, Record<string, unknown>[]>();
    for (const j of jejakRes.data ?? []) {
      // DEC-S13 -- pelepasan darurat memakai transisi YANG SAMA dengan pelepasan biasa
      // (on_hold -> new). Yang membedakannya adalah dasar wewenangnya, dan itulah kenapa
      // kolom authority_basis ada: tanpa itu, keputusan yang melampaui wewenang orang lain
      // akan tercatat persis seperti keputusan rutin.
      const aksiDasar = AKSI_DARI_TRANSISI[`${j.from_status}>${j.to_status}`] ?? 'lainnya';
      const aksi = j.authority_basis && aksiDasar === 'release' ? 'emergency_release' : aksiDasar;
      const list = jejakByPoId.get(j.record_id) ?? [];
      list.push({
        id: j.status_transition_log_id,
        aksi,
        dari: j.from_status,
        ke: j.to_status,
        waktu: j.changed_at,
        kategori: j.reason_category,
        // Baris lama yang terbit sebelum katalog ada TIDAK dikarang labelnya.
        kategori_label: j.reason_category ? labelKategori.get(`${aksi}|${j.reason_category}`) ?? null : null,
        catatan: j.reason,
        pelaku_nama: j.actor_name_snapshot,
        pelaku_peran: j.actor_role_snapshot,
        pelaku_departemen: j.actor_department_snapshot,
        // §16 perintah: baris lama boleh tidak lengkap, dan ketidaklengkapannya
        // DITANDAI apa adanya -- bukan diisi tebakan.
        kelengkapan: j.actor_name_snapshot ? 'lengkap' : 'tidak_diketahui',
        dasar_wewenang: j.authority_basis,
        departemen_dilampaui: j.overridden_department
      });
      jejakByPoId.set(j.record_id, list);
    }

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
        sales_order: soByPoId.get(po.customer_purchase_order_id) ?? null,
        riwayat_keputusan: jejakByPoId.get(po.customer_purchase_order_id) ?? []
      };
    });

    return { status: 200, body: { purchaseOrders: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
