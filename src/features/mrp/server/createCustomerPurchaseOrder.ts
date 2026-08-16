import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { canManageCustomerPo } from '@/lib/roles';
import { parseCustomerPoInput } from './customerPurchaseOrderValidation';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

export async function createCustomerPurchaseOrder(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);

    if (!canManageCustomerPo(appUser.role)) {
      return { status: 403, body: { error: 'Role Anda tidak punya izin membuat PO client.' } };
    }

    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const body = await request.json();
    const { input, error } = parseCustomerPoInput(body);
    if (error || !input) {
      return { status: 400, body: { error } };
    }

    const adminClient = getAdminClient();

    // Idempotency: kalau client mengirim idempotency_key yang PERNAH sukses dipakai
    // sebelumnya (submit ganda — double-click atau retry jaringan mengulang request
    // yang sama persis), kembalikan PO yang sudah ada itu sebagai sukses — jangan
    // buat baris baru, jangan juga dianggap error.
    if (input.idempotency_key) {
      const { data: existingPo, error: existingPoError } = await adminClient
        .from('customer_purchase_orders')
        .select('customer_purchase_order_id')
        .eq('company_id', appUser.company_id)
        .eq('idempotency_key', input.idempotency_key)
        .maybeSingle();
      if (existingPoError) return { status: 500, body: { error: existingPoError.message } };
      if (existingPo) {
        return { status: 200, body: { success: true, customer_purchase_order_id: existingPo.customer_purchase_order_id, replayed: true } };
      }
    }

    const { data: customer, error: customerError } = await adminClient
      .from('customers')
      .select('customer_id')
      .eq('customer_id', input.customer_id)
      .eq('company_id', appUser.company_id)
      .maybeSingle();

    if (customerError) {
      return { status: 500, body: { error: customerError.message } };
    }
    if (!customer) {
      return { status: 400, body: { error: 'Client tidak ditemukan di perusahaan Anda.' } };
    }

    const itemIds = input.lines.map((line) => line.item_id);
    const { data: items, error: itemsError } = await adminClient
      .from('items')
      .select('item_id')
      .in('item_id', itemIds)
      .eq('company_id', appUser.company_id);

    if (itemsError) {
      return { status: 500, body: { error: itemsError.message } };
    }

    const validItemIds = new Set((items ?? []).map((item) => item.item_id));
    for (const itemId of itemIds) {
      if (!validItemIds.has(itemId)) {
        return { status: 400, body: { error: 'Salah satu item di baris PO tidak ditemukan di perusahaan Anda.' } };
      }
    }

    const { data: insertedPo, error: poInsertError } = await adminClient
      .from('customer_purchase_orders')
      .insert([
        {
          company_id: appUser.company_id,
          customer_id: input.customer_id,
          po_number: input.po_number,
          // supabase-js mengirim `undefined` sebagai literal null lewat request body-nya
          // (bukan menghilangkan key seperti JSON.stringify biasa), jadi DEFAULT
          // current_date di kolom ini TIDAK pernah kepakai kalau cuma diandalkan lewat
          // undefined — isi eksplisit tanggal hari ini kalau user tidak mengisi po_date.
          po_date: input.po_date ?? new Date().toISOString().slice(0, 10),
          requested_ship_date: input.requested_ship_date,
          pic_name: input.pic_name,
          pic_position: input.pic_position,
          pic_phone: input.pic_phone,
          pic_email: input.pic_email,
          payment_terms: input.payment_terms,
          status: 'new',
          idempotency_key: input.idempotency_key
        }
      ])
      .select('customer_purchase_order_id')
      .single();

    if (poInsertError || !insertedPo) {
      // 23505 = unique_violation. Dulu ini bocor sebagai raw 500 dari Postgres
      // ("duplicate key value violates unique constraint ..."). Sekarang: pesan
      // yang jelas, DAN kalau pemicunya idempotency_key (bukan po_number), berarti
      // request lain dengan key yang sama barusan menang race — kembalikan PO yang
      // dia buat sebagai sukses, bukan error, supaya tetap idempotent walau
      // pre-check di atas kebetulan tidak sempat menangkapnya.
      if (poInsertError?.code === '23505') {
        if (input.idempotency_key && poInsertError.message.includes('idempotency_key')) {
          const { data: winnerPo } = await adminClient
            .from('customer_purchase_orders')
            .select('customer_purchase_order_id')
            .eq('company_id', appUser.company_id)
            .eq('idempotency_key', input.idempotency_key)
            .maybeSingle();
          if (winnerPo) {
            return { status: 200, body: { success: true, customer_purchase_order_id: winnerPo.customer_purchase_order_id, replayed: true } };
          }
        }
        return { status: 409, body: { error: `Nomor PO client "${input.po_number}" sudah dipakai — coba nomor lain.` } };
      }
      return { status: 500, body: { error: poInsertError?.message ?? 'Gagal membuat PO client.' } };
    }

    const { error: linesInsertError } = await adminClient.from('customer_purchase_order_lines').insert(
      input.lines.map((line) => ({
        customer_purchase_order_id: insertedPo.customer_purchase_order_id,
        item_id: line.item_id,
        qty_ordered: line.qty_ordered,
        unit_price: line.unit_price
      }))
    );

    if (linesInsertError) {
      await adminClient.from('customer_purchase_orders').delete().eq('customer_purchase_order_id', insertedPo.customer_purchase_order_id);
      return { status: 500, body: { error: linesInsertError.message } };
    }

    return { status: 200, body: { success: true, customer_purchase_order_id: insertedPo.customer_purchase_order_id } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
