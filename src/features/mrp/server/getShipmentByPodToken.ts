import { getAdminClient } from '@/lib/supabaseServer';

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// Endpoint PUBLIK (Sesi 3, /pod/[token]) — TIDAK ADA pemeriksaan JWT/getCurrentUser
// sama sekali di sini, SENGAJA, karena pengunjung halaman ini (client di lapangan)
// tidak login. Satu-satunya kontrol akses adalah pod_token acak itu sendiri.
//
// Field yang dikembalikan SENGAJA dibatasi ketat — TIDAK PERNAH menyentuh
// sales_order_lines.unit_price, lots.unit_cost, atau items.standard_cost (field
// finansial sensitif, lihat "Kontrol Akses Data Finansial" di
// docs/rancangan-skema-database-mrp.md). Kalau nanti ada kebutuhan menambah field
// baru ke halaman ini, WAJIB dicek ulang tidak ada apa pun yang berbau harga/biaya
// ikut terekspos — ini permukaan publik tanpa autentikasi.
//
// Pesan error SENGAJA generik (tidak pernah meneruskan error.message mentah dari
// Postgres) — supaya tidak membocorkan detail skema/internal ke pengunjung publik.
export async function getShipmentByPodToken(token: string): Promise<ApiResult> {
  if (!token || typeof token !== 'string') {
    return { status: 400, body: { valid: false } };
  }

  try {
    const adminClient = getAdminClient();

    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .select('shipment_id, shipment_number, shipment_date, status, delivery_address')
      .eq('pod_token', token)
      .maybeSingle();

    if (shipmentError) {
      return { status: 500, body: { valid: false } };
    }

    // Token tidak ditemukan ATAU status BUKAN 'shipped' (belum pernah dikirim, atau
    // sudah dikonfirmasi diterima sebelumnya, atau dibatalkan) -> SATU pesan generik
    // yang sama untuk semua kasus, tidak membedakan "token salah" vs "sudah dipakai"
    // supaya tidak jadi oracle bagi siapa pun yang mencoba menebak-nebak token.
    if (!shipment || shipment.status !== 'shipped') {
      return { status: 404, body: { valid: false } };
    }

    const { data: lines, error: linesError } = await adminClient
      .from('shipment_lines')
      .select('shipment_line_id, item_id, qty_shipped')
      .eq('shipment_id', shipment.shipment_id);

    if (linesError) {
      return { status: 500, body: { valid: false } };
    }

    const itemIds = Array.from(new Set((lines ?? []).map((l) => l.item_id)));
    const { data: items, error: itemsError } =
      itemIds.length > 0
        ? await adminClient.from('items').select('item_id, item_code, name, base_uom').in('item_id', itemIds)
        : { data: [], error: null };

    if (itemsError) {
      return { status: 500, body: { valid: false } };
    }

    const itemsById = new Map((items ?? []).map((i) => [i.item_id, i]));

    return {
      status: 200,
      body: {
        valid: true,
        shipment_number: shipment.shipment_number,
        shipment_date: shipment.shipment_date,
        delivery_address: shipment.delivery_address,
        lines: (lines ?? []).map((line) => {
          const item = itemsById.get(line.item_id);
          return {
            item_code: item?.item_code ?? null,
            item_name: item?.name ?? null,
            qty: line.qty_shipped,
            uom: item?.base_uom ?? null
          };
        })
      }
    };
  } catch {
    return { status: 500, body: { valid: false } };
  }
}
