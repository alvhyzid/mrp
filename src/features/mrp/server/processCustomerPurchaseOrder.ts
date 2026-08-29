import { NextRequest } from 'next/server';
import { getAdminClient, getCurrentUser, getUserScopedClient, parseBearerToken } from '@/lib/supabaseServer';

// Bentuk balasan lokal, sama seperti berkas server lain di modul ini (mis.
// listSalesOrders.ts) -- proyek ini belum punya tipe bersama untuk itu, dan
// membuatnya sekarang berada di luar lingkup task ini.
interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

// WS-S03 (SC-04 + SC-01b) — SATU jalur kanonik pembuatan Sales Order.
//
// APA YANG BERUBAH DI BERKAS INI, DAN KENAPA.
// Sebelumnya berkas ini adalah implementasi KEDUA yang lengkap dari proses yang
// sama: ia memvalidasi, menomori, meng-insert Sales Order, meng-insert barisnya,
// lalu memperbarui status PO klien -- seluruhnya di aplikasi, dengan `delete`
// manual sebagai kompensasi bila insert baris gagal. Sementara itu fungsi basis
// data process_customer_purchase_order() melakukan hal yang sama dalam SATU
// TRANSAKSI, dan tidak pernah dipanggil aplikasi.
//
// Dua jalur untuk satu proses bukan pilihan, melainkan cacat -- dan cacatnya sudah
// menggigit: snapshot identitas pelanggan (PMB-07a) ditambahkan ke fungsi basis
// data dan TIDAK ke jalur ini, sehingga Sales Order yang lahir lewat layar tidak
// membekukan identitas pelanggannya dan ditandai layar seolah terbit sebelum
// fitur itu ada.
//
// Sekarang berkas ini TIDAK LAGI MENULIS APA PUN. Ia hanya:
//   1. memastikan pemanggilnya pengguna yang sah;
//   2. membaca nomor SO yang sudah ada bila permintaan ini pengulangan;
//   3. MEMANGGIL fungsi kanonik;
//   4. menerjemahkan pesan galat basis data jadi kode status HTTP yang tepat.
//
// KENAPA MEMAKAI KLIEN BER-SESI PENGGUNA, BUKAN service role. Fungsi kanonik itu
// menegakkan wewenangnya SENDIRI lewat klaim JWT (jwt_company_id(),
// jwt_is_company_leadership(), auth.uid()). Dipanggil dengan service role, seluruh
// klaim itu kosong dan fungsinya akan menolak permintaan yang sah. Wewenangnya
// kini ditegakkan DI BASIS DATA -- satu tempat, bukan dua yang harus tetap cocok.
//
// PEMERIKSAAN YANG MENURUNKAN RISIKO PERPINDAHAN INI, diukur bukan diasumsikan:
// kedua jalur memakai gerbang yang sama persis. LEADERSHIP_ROLES di src/lib/roles.ts
// berisi ['company_admin','general_manager']; jwt_is_company_leadership() berisi
// ('company_admin','general_manager'). Gerbang kepemilikan company, status `new`,
// tiga persetujuan, dan validasi pabrik juga identik. Jadi yang berpindah hanyalah
// TEMPAT penegakannya, bukan siapa yang boleh.
//
// YANG TIDAK DICAKUP BERKAS INI: ia tidak menjamin tidak ada jalur ketiga lahir
// kelak. Itu tugas penjaga di tests/jalur_kanonik_sales_order.test.ts, yang gagal
// keras bila ada berkas selain fungsi kanonik yang menulis ke sales_orders.

// Pemetaan pesan basis data -> kode status HTTP. Pesannya sendiri SUDAH Bahasa
// Indonesia dan sudah bisa dibaca orang pabrik (ditulis begitu sejak fungsi itu
// dibuat), jadi yang perlu diterjemahkan hanyalah KODE STATUS-nya -- bukan
// kalimatnya. Menulis ulang kalimatnya di sini akan melahirkan dua sumber pesan
// yang harus tetap cocok, yaitu bentuk cacat yang sama yang sedang ditutup.
function statusUntukPesan(pesan: string): number {
  if (pesan.includes('tidak ditemukan di perusahaan Anda')) return 404;
  if (pesan.includes('Hanya company_admin atau general_manager')) return 403;
  if (pesan.includes('hanya bisa diproses dari status new')) return 400;
  if (pesan.includes('belum disetujui oleh ketiga department')) return 400;
  if (pesan.includes('Lokasi pabrik tidak valid')) return 400;
  return 500;
}

export async function processCustomerPurchaseOrder(request: NextRequest): Promise<ApiResult> {
  try {
    const { appUser } = await getCurrentUser(request);
    const accessToken = await parseBearerToken(request);

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

    // Pemeriksaan pengulangan ini MURNI KOSMETIK -- ia hanya menentukan apakah
    // balasan menyebut `replayed`. Yang benar-benar menjamin satu PO klien cuma
    // punya satu Sales Order adalah kunci pengulangan di dalam fungsi kanonik
    // DITAMBAH kekangan unik di basis data, bukan pemeriksaan ini. Jadi bila
    // pemeriksaan ini meleset karena balapan, hasilnya tetap benar.
    const idempotencyKey = `cpo-${customerPurchaseOrderId}`;
    const { data: existingSo } = await adminClient
      .from('sales_orders')
      .select('sales_order_id, so_number')
      .eq('company_id', appUser.company_id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingSo) {
      return { status: 200, body: { success: true, sales_order_id: existingSo.sales_order_id, so_number: existingSo.so_number, replayed: true } };
    }

    const userClient = getUserScopedClient(accessToken);
    const { data: salesOrderId, error: rpcError } = await userClient.rpc('process_customer_purchase_order', {
      p_customer_purchase_order_id: customerPurchaseOrderId,
      p_production_plant_id: productionPlantId
    });

    if (rpcError) {
      return { status: statusUntukPesan(rpcError.message), body: { error: rpcError.message } };
    }
    if (!salesOrderId) {
      return { status: 500, body: { error: 'Gagal membuat sales order.' } };
    }

    // Nomor SO dibaca SETELAH fungsi kanonik sukses, bukan dihitung ulang di sini.
    // Menghitungnya ulang berarti dua tempat yang menomori, dan format nomor SUDAH
    // pernah jadi sumber cacat di proyek ini.
    const { data: so } = await adminClient
      .from('sales_orders')
      .select('so_number')
      .eq('sales_order_id', salesOrderId)
      .maybeSingle();

    return { status: 200, body: { success: true, sales_order_id: salesOrderId, so_number: so?.so_number ?? null } };
  } catch (error) {
    return { status: 401, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
