import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { cleanupCompanyCascade } from './testCompanyCleanup';

// B.2 — LOT KEDALUWARSA. Yang dijaga bukan tampilan, melainkan JAMINAN bahwa bahan yang
// lewat tanggal kedaluwarsa TIDAK BISA masuk produk.
//
// Latar: status 'expired' terdaftar sejak awal dan TIDAK PERNAH BISA TERCAPAI — nol kode
// menulisnya. Bahan kedaluwarsa tetap tampil sebagai stok tersedia dan tetap bisa dipakai.
// Untuk pabrik ber-NIE BPOM dan bersertifikat halal, itu jalur di mana bahan kedaluwarsa
// bisa masuk produk yang dikonsumsi orang.
//
// KENAPA DIUJI DI TINGKAT DATABASE, bukan lewat layar: menyembunyikan tombol tidak
// membuktikan apa pun. Siapa pun yang memanggil API langsung akan menembusnya. Test ini
// sengaja MEMAKSA lewat jalur paling rendah.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY wajib diset.');
const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('Lot kedaluwarsa: penegakan di database, bukan di layar (B.2)', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let lotKedaluwarsa: number;
  let lotTanpaTanggal: number;
  let lotMasihBerlaku: number;

  beforeAll(async () => {
    const { data: company } = await adminClient
      .from('companies')
      .insert([{ name: 'LotExpiredTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant Uji Expired', is_active: true }])
      .select('production_plant_id')
      .single();
    plantId = plant!.production_plant_id;

    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'EXPTEST-01', name: 'Bahan Uji Kedaluwarsa', type: 'raw_material', base_uom: 'g', purchase_uom: 'kg', uom_conversion_factor: 1000, min_stock_level: 0, is_active: true }])
      .select('item_id')
      .single();
    itemId = item!.item_id;

    const dasar = { company_id: companyId, production_plant_id: plantId, item_id: itemId, source_type: 'purchased', status: 'available' };
    const kemarin = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const nanti = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const hariIni = new Date().toISOString().slice(0, 10);

    const { data: lots } = await adminClient
      .from('lots')
      .insert([
        { ...dasar, lot_number: 'LOT-EXP-A', produced_or_received_date: hariIni, expiry_date: kemarin, quantity_on_hand: 100 },
        { ...dasar, lot_number: 'LOT-EXP-B', produced_or_received_date: hariIni, expiry_date: null, quantity_on_hand: 200 },
        { ...dasar, lot_number: 'LOT-EXP-C', produced_or_received_date: hariIni, expiry_date: nanti, quantity_on_hand: 300 }
      ])
      .select('lot_id, lot_number');
    lotKedaluwarsa = lots!.find((l) => l.lot_number === 'LOT-EXP-A')!.lot_id;
    lotTanpaTanggal = lots!.find((l) => l.lot_number === 'LOT-EXP-B')!.lot_id;
    lotMasihBerlaku = lots!.find((l) => l.lot_number === 'LOT-EXP-C')!.lot_id;
  }, 60000);

  afterAll(async () => {
    await cleanupCompanyCascade(adminClient, companyId, [
      ['stock_movements', async () => await adminClient.from('stock_movements').delete().eq('company_id', companyId)],
      ['lots', async () => await adminClient.from('lots').delete().eq('company_id', companyId)],
      ['items', async () => await adminClient.from('items').delete().eq('company_id', companyId)],
      ['production_plants', async () => await adminClient.from('production_plants').delete().eq('company_id', companyId)]
    ]);
  }, 60000);

  it('penanda memindahkan HANYA lot yang lewat tanggal ke status expired', async () => {
    const { data } = await adminClient.rpc('tandai_lot_kedaluwarsa', { p_company_id: companyId });
    expect((data ?? []).map((r: { lot_number: string }) => r.lot_number)).toEqual(['LOT-EXP-A']);

    const { data: lots } = await adminClient.from('lots').select('lot_number, status').eq('company_id', companyId).order('lot_number');
    expect(lots).toEqual([
      { lot_number: 'LOT-EXP-A', status: 'expired' },
      { lot_number: 'LOT-EXP-B', status: 'available' },
      { lot_number: 'LOT-EXP-C', status: 'available' }
    ]);
  }, 30000);

  it('lot TANPA tanggal TIDAK ikut ditandai — ia bukan kedaluwarsa, ia tidak diketahui', async () => {
    // Keputusan GDG-06. Menandainya kedaluwarsa berarti sistem mengarang fakta yang tidak
    // diketahuinya, dan FEFO akan mempercayainya.
    const { data } = await adminClient.from('lots').select('status').eq('lot_id', lotTanpaTanggal).single();
    expect(data!.status).toBe('available');
  }, 30000);

  it('lot kedaluwarsa HILANG dari stok tersedia — satu perubahan menutup sembilan pintu', async () => {
    // Kesembilan tempat yang membaca stok tersedia menyaring dengan status='available'.
    const { data } = await adminClient
      .from('lots')
      .select('lot_number')
      .eq('company_id', companyId)
      .eq('status', 'available');
    const terlihat = (data ?? []).map((r) => r.lot_number).sort();
    expect(terlihat).toEqual(['LOT-EXP-B', 'LOT-EXP-C']);
  }, 30000);

  it('(NEGATIF) PEMAKAIAN PRODUKSI dari lot kedaluwarsa DITOLAK DATABASE, bukan sekadar disembunyikan', async () => {
    const { error } = await adminClient
      .from('stock_movements')
      .insert([{ company_id: companyId, lot_id: lotKedaluwarsa, movement_type: 'production_issue', qty: 10 }]);
    expect(error).toBeTruthy();
    expect(error!.message).toContain('KEDALUWARSA');
  }, 30000);

  it('(NEGATIF) PENGIRIMAN dari lot kedaluwarsa DITOLAK DATABASE', async () => {
    const { error } = await adminClient
      .from('stock_movements')
      .insert([{ company_id: companyId, lot_id: lotKedaluwarsa, movement_type: 'shipment', qty: 10 }]);
    expect(error).toBeTruthy();
    expect(error!.message).toContain('KEDALUWARSA');
  }, 30000);

  it('PENYESUAIAN STOK atas lot kedaluwarsa TETAP DIIZINKAN — itu jalur pemusnahan', async () => {
    // Bila penyesuaian ikut ditolak, barang kedaluwarsa tidak akan pernah bisa dinolkan
    // dan akan mengendap selamanya sebagai angka yang tidak bisa disentuh siapa pun.
    const { error } = await adminClient
      .from('stock_movements')
      .insert([{ company_id: companyId, lot_id: lotKedaluwarsa, movement_type: 'adjustment', qty: -100, reason_code: 'damaged' }]);
    expect(error).toBeNull();
  }, 30000);

  it('lot yang MASIH BERLAKU tetap boleh dipakai — penjaga tidak kelebaran', async () => {
    const { error } = await adminClient
      .from('stock_movements')
      .insert([{ company_id: companyId, lot_id: lotMasihBerlaku, movement_type: 'production_issue', qty: 10 }]);
    expect(error).toBeNull();
  }, 30000);

  it('saran FEFO mengecualikan lot kedaluwarsa, dan menandai yang tanggalnya tidak diketahui', async () => {
    const { data } = await adminClient.rpc('suggest_fefo_lots', { p_item_id: itemId, p_production_plant_id: plantId });
    const baris = (data ?? []) as { lot_number: string; tanggal_belum_diketahui: boolean }[];
    expect(baris.map((r) => r.lot_number).sort()).toEqual(['LOT-EXP-B', 'LOT-EXP-C']);
    expect(baris.find((r) => r.lot_number === 'LOT-EXP-B')!.tanggal_belum_diketahui).toBe(true);
    expect(baris.find((r) => r.lot_number === 'LOT-EXP-C')!.tanggal_belum_diketahui).toBe(false);
  }, 30000);
});
