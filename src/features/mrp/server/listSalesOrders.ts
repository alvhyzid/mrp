import type { NextRequest } from 'next/server';
import { turunkanEksekusiSo } from './eksekusiSalesOrder';
import { getCurrentUser, getAdminClient, getUserScopedClient, parseBearerToken } from '@/lib/supabaseServer';
import { canViewFinancialData } from '@/lib/roles';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function listSalesOrders(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();
    const canSeeCost = canViewFinancialData(appUser.role);

    // DEC-S05 -- jadwal pembayaran DIBACA, tidak pernah dihitung ulang di sini.
    // Baris-baris ini SNAPSHOT: nilainya dibekukan saat termin diterapkan, sehingga
    // mengubah master kelak tidak mengubah angka yang sudah disepakati.
    const { data: kewajibanRows, error: kewajibanError } = await adminClient
      .from('sales_order_payment_obligations')
      .select('sales_order_payment_obligation_id, sales_order_id, sequence_no, payment_term_name_snapshot, label_snapshot, percentage_snapshot, trigger_event_snapshot, due_offset_days_snapshot, amount')
      .eq('company_id', appUser.company_id)
      .order('sequence_no', { ascending: true });
    if (kewajibanError) return { status: 500, body: { error: kewajibanError.message } };

    const kewajibanBySoId = new Map<number, Record<string, unknown>[]>();
    for (const k of kewajibanRows ?? []) {
      const list = kewajibanBySoId.get(k.sales_order_id) ?? [];
      list.push({
        id: k.sales_order_payment_obligation_id,
        urutan: k.sequence_no,
        termin: k.payment_term_name_snapshot,
        label: k.label_snapshot,
        persen: k.percentage_snapshot,
        pemicu: k.trigger_event_snapshot,
        tempo_hari: k.due_offset_days_snapshot,
        nilai: k.amount,
        // STATUS SENGAJA TIDAK ADA. Domain Finance untuk piutang pelanggan BELUM ADA
        // di FABRIX -- nol tabel pembayaran, nol piutang. Menurunkan status dari
        // ketiadaan berarti mengarang, dan menyimpannya berarti membangun sumber
        // kebenaran pembayaran kedua. Layar menyebutkan keterbatasan ini apa adanya.
        pembayaran_belum_tercatat: true
      });
      kewajibanBySoId.set(k.sales_order_id, list);
    }

    // WS-SALES-CANCEL -- permintaan pembatalan dibaca dari tabel KANONIK
    // (cancellation_requests), bukan dari salinan di modul Sales.
    const { data: permintaanRows, error: permintaanError } = await adminClient
      .from('cancellation_requests')
      .select('cancellation_request_id, record_id, status, requested_at, reason_category, reason_note, requester_name_snapshot, requester_role_snapshot, requester_department_snapshot, decided_at, decision_reason_category, decision_note, decider_name_snapshot, decider_role_snapshot, execution_snapshot')
      .eq('company_id', appUser.company_id)
      .eq('entity', 'sales_orders')
      .order('cancellation_request_id', { ascending: true });
    if (permintaanError) return { status: 500, body: { error: permintaanError.message } };

    const { data: kategoriRows } = await adminClient
      .from('decision_reason_categories')
      .select('action, code, label')
      .eq('entity', 'sales_orders');
    const labelKategori = new Map((kategoriRows ?? []).map((k) => [`${k.action}|${k.code}`, k.label]));

    const permintaanBySoId = new Map<number, Record<string, unknown>[]>();
    for (const p of permintaanRows ?? []) {
      const list = permintaanBySoId.get(p.record_id) ?? [];
      list.push({
        id: p.cancellation_request_id,
        status: p.status,
        diajukan: p.requested_at,
        kategori_label: labelKategori.get(`cancel_request|${p.reason_category}`) ?? p.reason_category,
        catatan: p.reason_note,
        pemohon_nama: p.requester_name_snapshot,
        pemohon_peran: p.requester_role_snapshot,
        pemohon_departemen: p.requester_department_snapshot,
        diputuskan: p.decided_at,
        keputusan_label: p.decision_reason_category ? labelKategori.get(`cancel_decision|${p.decision_reason_category}`) ?? p.decision_reason_category : null,
        keputusan_catatan: p.decision_note,
        pemutus_nama: p.decider_name_snapshot,
        pemutus_peran: p.decider_role_snapshot,
        eksekusi_saat_diajukan: p.execution_snapshot
      });
      permintaanBySoId.set(p.record_id, list);
    }

    // PJL-03 — KELAYAKAN PENUTUPAN dihitung SERVER, oleh fungsi yang sama yang menegakkannya
    // saat penutupan dijalankan. Layar TIDAK menghitung ulang dengan rumusnya sendiri: dua rumus
    // untuk satu hal akan menyimpang, dan yang terlihat di layar bukan yang ditegakkan server.
    //
    // Dipanggil lewat klien ber-lingkup PENGGUNA, bukan admin: fungsinya bersandar pada
    // auth.uid() dan jwt_company_id(), dan service role tidak membawa klaim apa pun.
    const accessToken = await parseBearerToken(request);
    const { data: kelayakanRows, error: kelayakanError } = await getUserScopedClient(accessToken)
      .rpc('kelayakan_penyelesaian_so_semua');
    if (kelayakanError) return { status: 500, body: { error: kelayakanError.message } };
    const kelayakanBySoId = new Map<number, Record<string, unknown>>(
      (kelayakanRows ?? []).map((k: { sales_order_id: number; kelayakan: Record<string, unknown> }) => [k.sales_order_id, k.kelayakan])
    );

    // Konfirmasi menuju penutupan — dibaca apa adanya, termasuk yang sudah ditutup, supaya
    // riwayat siapa mengonfirmasi dan siapa menutup tetap terlihat sesudahnya.
    const { data: konfirmasiRows, error: konfirmasiError } = await adminClient
      .from('sales_order_completion_approvals')
      .select('sales_order_id, department, approver_name_snapshot, approver_role_snapshot, approved_at, reason_category, notes')
      .eq('company_id', appUser.company_id)
      .order('approved_at', { ascending: true });
    if (konfirmasiError) return { status: 500, body: { error: konfirmasiError.message } };
    const konfirmasiBySoId = new Map<number, Record<string, unknown>[]>();
    for (const k of konfirmasiRows ?? []) {
      const list = konfirmasiBySoId.get(k.sales_order_id) ?? [];
      list.push({
        departemen: k.department,
        nama: k.approver_name_snapshot,
        peran: k.approver_role_snapshot,
        waktu: k.approved_at,
        kategori_label: labelKategori.get(`${k.department === 'ppic' ? 'fulfillment_confirm' : 'completion'}|${k.reason_category}`) ?? k.reason_category,
        catatan: k.notes
      });
      konfirmasiBySoId.set(k.sales_order_id, list);
    }

    const { data: salesOrders, error: soError } = await adminClient
      .from('sales_orders')
      .select('sales_order_id, so_number, customer_id, customer_purchase_order_id, production_plant_id, status, created_at, customer_name_snapshot, customer_billing_address_snapshot, customer_npwp_snapshot')
      .eq('company_id', appUser.company_id)
      .order('created_at', { ascending: false });

    if (soError) return { status: 500, body: { error: soError.message } };
    if (!salesOrders || salesOrders.length === 0) {
      return { status: 200, body: { salesOrders: [] } };
    }

    const soIds = salesOrders.map((so) => so.sales_order_id);
    const customerIds = Array.from(new Set(salesOrders.map((so) => so.customer_id)));
    const plantIds = Array.from(new Set(salesOrders.map((so) => so.production_plant_id)));
    const poIds = Array.from(new Set(salesOrders.map((so) => so.customer_purchase_order_id).filter((id): id is number => !!id)));

    const [linesRes, customersRes, itemsRes, workOrdersRes, plantsRes, posRes, shipmentsRes] = await Promise.all([
      adminClient.from('sales_order_lines').select('sales_order_line_id, sales_order_id, item_id, qty_ordered, qty_shipped, unit_price').in('sales_order_id', soIds),
      adminClient.from('customers').select('customer_id, name').in('customer_id', customerIds),
      adminClient.from('items').select('item_id, item_code, name, base_uom').eq('company_id', appUser.company_id),
      // `status` ikut dibaca untuk MENURUNKAN visibilitas produksi (DEC-S11). Ia TIDAK
      // disalin ke sales_orders -- kebenaran produksi tetap milik Work Order.
      adminClient.from('work_orders').select('sales_order_line_id, planned_qty, status').not('sales_order_line_id', 'is', null),
      adminClient.from('production_plants').select('production_plant_id, name').in('production_plant_id', plantIds),
      poIds.length
        ? adminClient.from('customer_purchase_orders').select('customer_purchase_order_id, po_number').in('customer_purchase_order_id', poIds)
        : Promise.resolve({ data: [] as { customer_purchase_order_id: number; po_number: string }[], error: null }),
      // Riwayat pengiriman (Sesi 3B) — ditambahkan di sini murni sebagai INFO
      // read-only untuk detail SO, bukan pengelolaan (BATAS Sesi 3B: halaman ini
      // tidak boleh diubah selain menambah info status pengiriman).
      adminClient
        .from('shipments')
        .select('shipment_id, sales_order_id, shipment_number, status, shipment_date, delivery_address, created_at')
        .in('sales_order_id', soIds)
        .order('created_at', { ascending: false })
    ]);

    if (linesRes.error) return { status: 500, body: { error: linesRes.error.message } };
    if (customersRes.error) return { status: 500, body: { error: customersRes.error.message } };
    if (itemsRes.error) return { status: 500, body: { error: itemsRes.error.message } };
    if (workOrdersRes.error) return { status: 500, body: { error: workOrdersRes.error.message } };
    if (plantsRes.error) return { status: 500, body: { error: plantsRes.error.message } };
    if (posRes.error) return { status: 500, body: { error: posRes.error.message } };
    if (shipmentsRes.error) return { status: 500, body: { error: shipmentsRes.error.message } };

    const customersById = new Map((customersRes.data ?? []).map((c) => [c.customer_id, c]));
    const itemsById = new Map((itemsRes.data ?? []).map((i) => [i.item_id, i]));
    const plantsById = new Map((plantsRes.data ?? []).map((p) => [p.production_plant_id, p]));
    const posById = new Map((posRes.data ?? []).map((p) => [p.customer_purchase_order_id, p]));

    const shipmentsBySoId = new Map<number, typeof shipmentsRes.data>();
    for (const shipment of shipmentsRes.data ?? []) {
      const list = shipmentsBySoId.get(shipment.sales_order_id) ?? [];
      list.push(shipment);
      shipmentsBySoId.set(shipment.sales_order_id, list);
    }

    const woPlannedByLineId = new Map<number, number>();
    const woStatusByLineId = new Map<number, string[]>();
    for (const wo of workOrdersRes.data ?? []) {
      if (!wo.sales_order_line_id) continue;
      woPlannedByLineId.set(wo.sales_order_line_id, (woPlannedByLineId.get(wo.sales_order_line_id) ?? 0) + Number(wo.planned_qty));
      woStatusByLineId.set(wo.sales_order_line_id, [...(woStatusByLineId.get(wo.sales_order_line_id) ?? []), String(wo.status)]);
    }

    const linesBySoId = new Map<number, typeof linesRes.data>();
    for (const line of linesRes.data ?? []) {
      const list = linesBySoId.get(line.sales_order_id) ?? [];
      list.push(line);
      linesBySoId.set(line.sales_order_id, list);
    }

    const result = salesOrders.map((so) => ({
      sales_order_id: so.sales_order_id,
      so_number: so.so_number,
      customer_id: so.customer_id,
      // PMB-07a — utamakan identitas beku saat SO terbit (diwarisi dari CPO);
      // fallback ke join hidup HANYA untuk SO lama sebelum kolom snapshot ada.
      customer_name: so.customer_name_snapshot ?? customersById.get(so.customer_id)?.name ?? null,
      customer_billing_address: so.customer_billing_address_snapshot ?? null,
      customer_npwp: so.customer_npwp_snapshot ?? null,
      // V.1 (22 Agu 2026) — SO terbit sebelum kolom snapshot ada: TIDAK diisi
      // dari data client hari ini, ditandai apa adanya.
      identity_predates_snapshot: so.customer_name_snapshot === null,
      customer_purchase_order_id: so.customer_purchase_order_id,
      po_number: so.customer_purchase_order_id ? (posById.get(so.customer_purchase_order_id)?.po_number ?? null) : null,
      production_plant_id: so.production_plant_id,
      production_plant_name: plantsById.get(so.production_plant_id)?.name ?? null,
      status: so.status,
      // PJL-03 — kelayakan penutupan beserta SEBAB-SEBABNYA, apa adanya dari server.
      kelayakan_penutupan: kelayakanBySoId.get(so.sales_order_id) ?? null,
      konfirmasi_penutupan: konfirmasiBySoId.get(so.sales_order_id) ?? [],
      // VISIBILITAS EKSEKUSI — DITURUNKAN saat dibaca, bukan disimpan (DEC-S11).
      // `status` di atas adalah kebenaran KOMERSIAL milik Sales; `eksekusi` di bawah adalah
      // cerminan kebenaran domain lain, dan tidak pernah ditulis balik ke sales_orders.
      eksekusi: turunkanEksekusiSo(
        linesBySoId.get(so.sales_order_id) ?? [],
        (linesBySoId.get(so.sales_order_id) ?? []).flatMap((l) => woStatusByLineId.get(l.sales_order_line_id) ?? [])
      ),
      created_at: so.created_at,
      lines: (linesBySoId.get(so.sales_order_id) ?? []).map((line) => {
        const item = itemsById.get(line.item_id);
        const qtyShipped = Number(line.qty_shipped ?? 0);
        return {
          sales_order_line_id: line.sales_order_line_id,
          item_id: line.item_id,
          item_code: item?.item_code ?? null,
          item_name: item?.name ?? null,
          item_base_uom: item?.base_uom ?? null,
          qty_ordered: line.qty_ordered,
          unit_price: canSeeCost ? line.unit_price : null,
          qty_already_planned_in_wo: woPlannedByLineId.get(line.sales_order_line_id) ?? 0,
          qty_shipped: qtyShipped,
          qty_remaining_to_ship: Number(line.qty_ordered) - qtyShipped
        };
      }),
      // Riwayat pengiriman (Sesi 3B) — read-only, dipakai halaman detail SO DAN
      // halaman Shipments (untuk saring SO mana yang masih punya sisa qty).
      shipments: (shipmentsBySoId.get(so.sales_order_id) ?? []).map((shipment) => ({
        shipment_id: shipment.shipment_id,
        shipment_number: shipment.shipment_number,
        status: shipment.status,
        shipment_date: shipment.shipment_date,
        delivery_address: shipment.delivery_address,
        created_at: shipment.created_at
      }))
    }));

    return { status: 200, body: { salesOrders: result } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
