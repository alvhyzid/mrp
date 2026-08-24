import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { cleanupCompanyCascade } from './testCompanyCleanup';
import { ensureAuthUser } from './ensureAuthUser';
import { ambilPathStorage } from '../src/lib/storageSignedUrl';
import { getShipmentByPodToken } from '../src/features/mrp/server/getShipmentByPodToken';

// INF-22 / JJ.1.3 (24 Agu 2026) — BERKAS STORAGE IKUT TERHAPUS BERSAMA BARIS INDUKNYA.
//
// LAHIR DARI KEJADIAN NYATA, bukan kehati-hatian teoretis: 24 Agu 2026 ditemukan 12 berkas
// yatim di project FABRIX-APP (foto POD, foto pengeluaran barang, tanda tangan) — seluruhnya
// sisa fixture test yang barisnya sudah lama dihapus sementara berkasnya tertinggal, dan
// lima di antaranya di bucket yang waktu itu masih PUBLIK.
//
// KENAPA BUKAN TRIGGER DATABASE — sudah dicoba, dan Postgres menolak keras:
//   ERROR 42501: Direct deletion from storage tables is not allowed. Use the Storage API instead.
// Jadi pembersihan HARUS lewat lapisan aplikasi. Test ini yang menjaga janjinya ditepati.
//
// DI LUAR JANGKAUAN TEST INI (aturan II.2):
//   - Hanya menguji jalur cleanupCompanyCascade (pembersihan tenant uji). Penghapusan
//     berkas saat pengguna MENGGANTI tanda tangan diuji dari sisi lain, dan penghapusan
//     lewat migrasi SQL memang MUSTAHIL — itu batas yang disengaja, bukan celah.
//   - Membuktikan berkasnya HILANG; tidak membuktikan tidak ada berkas LAIN yang ikut
//     terbawa. Cakupan yang terlalu luas akan lolos test ini.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const roleTestPassword = process.env.DEBUG_ROLE_TEST_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !roleTestPassword) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEBUG_ROLE_TEST_PASSWORD must be set for tests.');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

// PNG 1x1 sah (bukan sekadar byte acak) supaya penolakan, kalau terjadi, benar-benar soal
// izin/kebijakan bucket dan bukan soal isi berkas.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function berkasAda(bucket: string, path: string): Promise<boolean> {
  const posisi = path.lastIndexOf('/');
  const folder = posisi === -1 ? '' : path.slice(0, posisi);
  const nama = posisi === -1 ? path : path.slice(posisi + 1);
  const { data } = await adminClient.storage.from(bucket).list(folder, { limit: 1000 });
  return (data ?? []).some((b) => b.name === nama);
}

describe('INF-22 — berkas Storage ikut terhapus saat baris induknya dihapus', () => {
  let companyId: number;
  let authUid: string;
  let pathTandaTangan: string;
  let urlTandaTangan: string;

  beforeAll(async () => {
    const { data: company } = await adminClient
      .from('companies')
      .insert([{ name: 'StorageYatimTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyId = company!.company_id;

    authUid = await ensureAuthUser(adminClient, `storage.yatim.${Date.now()}@debug.mrp`, roleTestPassword);

    await adminClient
      .from('users')
      .insert([{ company_id: companyId, auth_uid: authUid, email: `storage.yatim.${Date.now()}@debug.mrp`, name: 'Storage Yatim', role: 'company_admin', status: 'active' }]);

    pathTandaTangan = `${authUid}/signature-${Date.now()}.png`;
    const { error: uploadError } = await adminClient.storage
      .from('user-signatures')
      .upload(pathTandaTangan, PNG_1X1, { contentType: 'image/png', upsert: false });
    expect(uploadError).toBeNull();

    const { data: publicUrlData } = adminClient.storage.from('user-signatures').getPublicUrl(pathTandaTangan);
    urlTandaTangan = publicUrlData.publicUrl;

    await adminClient.from('users').update({ signature_url: urlTandaTangan }).eq('auth_uid', authUid);
  });

  afterAll(async () => {
    // Sabuk pengaman: kalau test-nya sendiri gagal di tengah, jangan ikut meninggalkan yatim.
    await adminClient.storage.from('user-signatures').remove([pathTandaTangan]);
    await adminClient.auth.admin.deleteUser(authUid).catch(() => undefined);
  });

  it('berkas benar-benar ADA sebelum pembersihan — kalau tidak, test sesudahnya tidak membuktikan apa pun', async () => {
    expect(await berkasAda('user-signatures', pathTandaTangan)).toBe(true);
  });

  it('URL tersimpan bisa diterjemahkan kembali jadi path Storage', () => {
    expect(ambilPathStorage(urlTandaTangan, 'user-signatures')).toBe(pathTandaTangan);
    expect(ambilPathStorage(`${urlTandaTangan}?v=123`, 'user-signatures')).toBe(pathTandaTangan);
  });

  it('BUKTI NEGATIF: setelah company-nya dibersihkan, berkasnya IKUT HILANG dari Storage', async () => {
    await cleanupCompanyCascade(adminClient, companyId, [
      ['users', async () => await adminClient.from('users').delete().eq('company_id', companyId)]
    ]);

    expect(await berkasAda('user-signatures', pathTandaTangan)).toBe(false);

    const { data: sisaUser } = await adminClient.from('users').select('user_id').eq('company_id', companyId);
    expect(sisaUser ?? []).toHaveLength(0);
  });
});

// ============================================================================
// JJ.1.2 — TIGA BUCKET WAJIB TETAP PRIVAT, DAN HALAMAN POD WAJIB TETAP TERBUKA.
//
// Dua janji ini HARUS benar BERSAMAAN, dan gampang sekali salah satunya dikorbankan
// diam-diam: menutup bucket demi privasi bisa mematikan halaman yang dipakai penerima
// barang di lapangan, dan membuka kembali bucket demi halaman itu membocorkan tanda
// tangan orang. Test ini menahan keduanya sekaligus.
//
// Yang membuat keduanya bisa benar bersamaan: halaman POD TIDAK PERNAH menampilkan
// foto atau tanda tangan. Ia mengirim data pengiriman dan MENERIMA unggahan. Jadi
// menutup akses baca publik tidak memutus apa pun di sisi penerima barang.
// ============================================================================
describe('JJ.1.2 — bucket privat DAN halaman POD tetap terbuka tanpa akun', () => {
  const BUCKET_WAJIB_PRIVAT = ['user-signatures', 'delivery-confirmation-photos', 'shipment-dispatch-photos'];
  const BUCKET_SENGAJA_PUBLIK = ['company-logos', 'user-avatars'];

  let companyId2: number;
  let customerId: number;
  let plantId: number;
  let cpoId: number;
  let soId: number;
  let podToken: string;

  // Setiap insert diperiksa errornya secara eksplisit. Percobaan pertama memakai tanda
  // seru non-null (`cpo!.customer_purchase_order_id`) dan hasilnya persis kelas cacat yang
  // sedang diberantas di proyek ini: kolomnya salah nama (`order_date`, seharusnya `po_date`),
  // tapi yang muncul di layar adalah "Cannot read properties of null" — pesan yang menyembunyikan
  // sebab sebenarnya dan mengirim pembacanya ke arah yang keliru.
  async function sisipkan(tabel: string, baris: Record<string, unknown>, kolom: string): Promise<number> {
    const { data, error } = await adminClient.from(tabel).insert([baris] as never).select(kolom).single();
    if (error) throw new Error(`Gagal menyiapkan fixture ${tabel}: ${error.message}`);
    if (!data) throw new Error(`Fixture ${tabel} tidak mengembalikan baris.`);
    return (data as unknown as Record<string, number>)[kolom];
  }

  beforeAll(async () => {
    const penanda = Date.now();
    companyId2 = await sisipkan('companies', { name: 'PodBucketTestCorp', industry_type: 'manufacturing', status: 'trial' }, 'company_id');
    plantId = await sisipkan('production_plants', { company_id: companyId2, name: 'Plant PodBucket', is_active: true }, 'production_plant_id');
    customerId = await sisipkan('customers', { company_id: companyId2, name: 'Customer PodBucket', customer_type: 'company' }, 'customer_id');
    cpoId = await sisipkan(
      'customer_purchase_orders',
      { company_id: companyId2, customer_id: customerId, po_number: `PO-PODBUCKET-${penanda}` },
      'customer_purchase_order_id'
    );
    soId = await sisipkan(
      'sales_orders',
      { company_id: companyId2, customer_id: customerId, production_plant_id: plantId, customer_purchase_order_id: cpoId, so_number: `SO-PODBUCKET-${penanda}` },
      'sales_order_id'
    );

    podToken = `podbucket-${penanda}-${Math.random().toString(36).slice(2)}`;
    const { error: errKirim } = await adminClient.from('shipments').insert([
      {
        company_id: companyId2,
        sales_order_id: soId,
        delivery_address: 'Jl. Uji Bucket Privat No. 1',
        shipment_number: `SJ-PODBUCKET-${penanda}`,
        shipment_date: '2026-08-24',
        status: 'shipped',
        pod_token: podToken
      }
    ]);
    if (errKirim) throw new Error(`Gagal menyiapkan fixture shipments: ${errKirim.message}`);
  });

  afterAll(async () => {
    await cleanupCompanyCascade(adminClient, companyId2, [
      ['shipments', async () => await adminClient.from('shipments').delete().eq('company_id', companyId2)],
      ['sales_orders', async () => await adminClient.from('sales_orders').delete().eq('company_id', companyId2)],
      // customer_po_approvals lahir SENDIRI dari trigger saat PO client dibuat -- tidak
      // pernah disisipkan fixture ini, jadi mudah terlewat. Run pertama memang tersandung di sini.
      ['customer_po_approvals', async () => await adminClient.from('customer_po_approvals').delete().in('customer_purchase_order_id', [cpoId])],
      ['customer_purchase_orders', async () => await adminClient.from('customer_purchase_orders').delete().eq('company_id', companyId2)],
      ['customers', async () => await adminClient.from('customers').delete().eq('company_id', companyId2)],
      ['production_plants', async () => await adminClient.from('production_plants').delete().eq('company_id', companyId2)]
    ]);
  });

  it('ketiga bucket berisi data pribadi & bukti pengiriman TIDAK publik', async () => {
    const { data } = await adminClient.storage.listBuckets();
    const perNama = new Map((data ?? []).map((b) => [b.name, b.public]));
    for (const nama of BUCKET_WAJIB_PRIVAT) {
      expect(perNama.get(nama), `bucket ${nama} harus privat`).toBe(false);
    }
  });

  it('bucket yang memang untuk ditampilkan TETAP publik — menutup semuanya bukan tujuannya', async () => {
    const { data } = await adminClient.storage.listBuckets();
    const perNama = new Map((data ?? []).map((b) => [b.name, b.public]));
    for (const nama of BUCKET_SENGAJA_PUBLIK) {
      expect(perNama.get(nama), `bucket ${nama} sengaja publik`).toBe(true);
    }
  });

  it('halaman POD tetap terbuka TANPA akun — dipanggil tanpa token login sama sekali', async () => {
    const hasil = await getShipmentByPodToken(podToken);
    expect(hasil.status).toBe(200);
    expect((hasil.body as Record<string, unknown>).valid).toBe(true);
    expect((hasil.body as Record<string, unknown>).delivery_address).toBe('Jl. Uji Bucket Privat No. 1');
  });

  it('halaman POD tidak pernah mengirim foto atau tanda tangan — sebab itulah bucket boleh ditutup', async () => {
    const hasil = await getShipmentByPodToken(podToken);
    const kunci = Object.keys(hasil.body as Record<string, unknown>).join(' ');
    expect(kunci).not.toMatch(/photo|signature|foto|tanda_tangan/i);
  });
});
