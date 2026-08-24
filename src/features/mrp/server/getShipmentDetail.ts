import type { NextRequest } from 'next/server';
import { getCurrentUser, getAdminClient } from '@/lib/supabaseServer';
import { buatSignedUrl, BUCKET_TANDA_TANGAN } from '@/lib/storageSignedUrl';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Dipakai halaman cetak Surat Jalan (print-friendly, DI LUAR (shell) supaya tidak
// ikut nav/sidebar saat dicetak) — beda dari listShipments.ts karena JUGA menyertakan
// tanda tangan (document_signatures) untuk shipment ini, dipakai menampilkan gambar
// tanda tangan ASLI (signature_url_snapshot, BUKAN users.signature_url langsung, sesuai
// docs/rancangan-skema-database-mrp.md) di dokumen cetak.
export async function getShipmentDetail(request: NextRequest, shipmentId: number): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    if (!appUser.company_id) {
      return { status: 400, body: { error: 'User belum terkait dengan perusahaan yang valid.' } };
    }

    const adminClient = getAdminClient();

    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .select(
        'shipment_id, sales_order_id, shipment_number, shipment_date, status, delivery_address, recipient_name, recipient_phone, vehicle_number, driver_name, pod_token, created_at, customer_name_snapshot, customer_billing_address_snapshot, customer_npwp_snapshot'
      )
      .eq('shipment_id', shipmentId)
      .maybeSingle();
    if (shipmentError) return { status: 500, body: { error: shipmentError.message } };
    if (!shipment) return { status: 404, body: { error: 'Pengiriman tidak ditemukan.' } };

    const { data: so, error: soError } = await adminClient
      .from('sales_orders')
      .select('sales_order_id, so_number, customer_id, company_id')
      .eq('sales_order_id', shipment.sales_order_id)
      .single();
    if (soError) return { status: 500, body: { error: soError.message } };
    if (so.company_id !== appUser.company_id) {
      return { status: 404, body: { error: 'Pengiriman tidak ditemukan di perusahaan Anda.' } };
    }

    const [linesRes, customerRes, companyRes, signatureRes] = await Promise.all([
      adminClient.from('shipment_lines').select('shipment_line_id, item_id, qty_shipped, lot_id').eq('shipment_id', shipmentId),
      adminClient.from('customers').select('customer_id, name, billing_address, npwp').eq('customer_id', so.customer_id).single(),
      adminClient.from('companies').select('company_id, name, logo_url').eq('company_id', appUser.company_id).single(),
      adminClient
        .from('document_signatures')
        .select('document_signature_id, signed_by, signer_role_at_signing, signature_url_snapshot, signed_at')
        .eq('document_type', 'shipment')
        .eq('document_id', shipmentId)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);
    if (linesRes.error) return { status: 500, body: { error: linesRes.error.message } };
    if (customerRes.error) return { status: 500, body: { error: customerRes.error.message } };
    if (companyRes.error) return { status: 500, body: { error: companyRes.error.message } };
    if (signatureRes.error) return { status: 500, body: { error: signatureRes.error.message } };

    const itemIds = Array.from(new Set((linesRes.data ?? []).map((l) => l.item_id)));
    const lotIds = Array.from(new Set((linesRes.data ?? []).map((l) => l.lot_id)));
    const [itemsRes, lotsRes, signerRes] = await Promise.all([
      itemIds.length ? adminClient.from('items').select('item_id, item_code, name, base_uom').in('item_id', itemIds) : Promise.resolve({ data: [], error: null }),
      lotIds.length ? adminClient.from('lots').select('lot_id, lot_number').in('lot_id', lotIds) : Promise.resolve({ data: [], error: null }),
      signatureRes.data ? adminClient.from('users').select('user_id, name').eq('user_id', signatureRes.data.signed_by).maybeSingle() : Promise.resolve({ data: null, error: null })
    ]);
    if (itemsRes.error) return { status: 500, body: { error: itemsRes.error.message } };
    if (lotsRes.error) return { status: 500, body: { error: lotsRes.error.message } };
    if (signerRes.error) return { status: 500, body: { error: signerRes.error.message } };

    const itemsById = new Map((itemsRes.data ?? []).map((i) => [i.item_id, i]));
    const lotsById = new Map((lotsRes.data ?? []).map((l) => [l.lot_id, l]));

    return {
      status: 200,
      body: {
        shipment: {
          ...shipment,
          so_number: so.so_number,
          // Alur 1 (3.1b) — utamakan snapshot BEKU (identitas client persis
          // saat shipment ini dibuat). Fallback ke join hidup HANYA untuk
          // shipment lama dari sebelum kolom snapshot ini ada (customer_name_snapshot
          // null) — shipment baru selalu punya snapshot, tidak pernah ikut
          // berubah kalau data client diedit belakangan.
          customer_name: shipment.customer_name_snapshot ?? customerRes.data.name,
          customer_billing_address: shipment.customer_billing_address_snapshot ?? customerRes.data.billing_address ?? null,
          customer_npwp: shipment.customer_npwp_snapshot ?? customerRes.data.npwp ?? null,
          lines: (linesRes.data ?? []).map((line) => {
            const item = itemsById.get(line.item_id);
            const lot = lotsById.get(line.lot_id);
            return {
              shipment_line_id: line.shipment_line_id,
              item_code: item?.item_code ?? null,
              item_name: item?.name ?? null,
              item_base_uom: item?.base_uom ?? null,
              qty_shipped: line.qty_shipped,
              lot_number: lot?.lot_number ?? null
            };
          })
        },
        company: companyRes.data,
        signature: signatureRes.data
          ? {
              // Nilai TERSIMPAN tidak diubah (ia snapshot untuk ketertelusuran dokumen
              // terbit); yang dikirim ke layar adalah signed URL berumur pendek.
              signature_url_snapshot: await buatSignedUrl(adminClient, BUCKET_TANDA_TANGAN, signatureRes.data.signature_url_snapshot),
              signer_role_at_signing: signatureRes.data.signer_role_at_signing,
              signer_name: signerRes.data?.name ?? null,
              signed_at: signatureRes.data.signed_at
            }
          : null
      }
    };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
