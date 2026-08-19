import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Perintah Gabungan A-F, Bagian E (21 Agu 2026) -- keputusan pemilik produk:
// Laba Operasional bulanan IKUT periode gajian (26 bulan sebelumnya s/d 25
// bulan berjalan), BUKAN bulan kalender -- supaya biaya gaji (komponen
// terbesar) tidak "salah periode" dibanding pendapatan pengiriman.
// company_settings.payroll_period_start_day BELUM diisi = tetap bulan
// kalender (fallback, zero regresi utk tenant lain).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for tests.');
}
const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

describe('get_monthly_operating_profit — periode gajian (payroll_period_start_day) vs bulan kalender', () => {
  let companyId: number;
  let plantId: number;
  let itemId: number;
  let customerId: number;
  let adminAuthUid: string;

  async function makeShipment(qty: number, unitPrice: number, unitCost: number, shipmentDate: string) {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: cpo, error: cpoError } = await adminClient
      .from('customer_purchase_orders')
      .insert([{ company_id: companyId, customer_id: customerId, po_number: `PERIODTEST-PO-${shipmentDate}-${Math.random().toString(36).slice(2, 8)}`, requested_ship_date: futureDate, status: 'processed' }])
      .select('customer_purchase_order_id')
      .single();
    if (cpoError) throw new Error(cpoError.message);

    const { data: so, error: soError } = await adminClient
      .from('sales_orders')
      .insert([{ company_id: companyId, customer_purchase_order_id: cpo.customer_purchase_order_id, customer_id: customerId, production_plant_id: plantId, status: 'confirmed' }])
      .select('sales_order_id')
      .single();
    if (soError) throw new Error(soError.message);
    const { data: line, error: lineError } = await adminClient
      .from('sales_order_lines')
      .insert([{ sales_order_id: so.sales_order_id, item_id: itemId, qty_ordered: qty, unit_price: unitPrice }])
      .select('sales_order_line_id')
      .single();
    if (lineError) throw new Error(lineError.message);
    const { data: lot, error: lotError } = await adminClient
      .from('lots')
      .insert([{ company_id: companyId, production_plant_id: plantId, item_id: itemId, lot_number: `LOT-PERIOD-${shipmentDate}-${line.sales_order_line_id}`, quantity_on_hand: qty, source_type: 'produced', status: 'available', unit_cost: unitCost }])
      .select('lot_id')
      .single();
    if (lotError) throw new Error(lotError.message);
    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .insert([{ company_id: companyId, sales_order_id: so.sales_order_id, shipment_date: shipmentDate, status: 'delivered', delivery_address: 'Alamat Uji Periode' }])
      .select('shipment_id')
      .single();
    if (shipmentError) throw new Error(shipmentError.message);
    const { error: shipmentLineError } = await adminClient
      .from('shipment_lines')
      .insert([{ shipment_id: shipment.shipment_id, sales_order_line_id: line.sales_order_line_id, item_id: itemId, qty_shipped: qty, lot_id: lot.lot_id }]);
    if (shipmentLineError) throw new Error(shipmentLineError.message);
  }

  async function loginAsAdmin(): Promise<string> {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const client: SupabaseClient = createClient(supabaseUrl!, anonKey, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email: 'admin.periodtest@debug.mrp', password: process.env.DEBUG_ROLE_TEST_PASSWORD! });
    if (error) throw new Error(error.message);
    return data.session.access_token;
  }

  beforeAll(async () => {
    const { data: company } = await adminClient
      .from('companies')
      .insert([{ name: 'OperatingProfitPeriodTestCorp', industry_type: 'manufacturing', status: 'trial' }])
      .select('company_id')
      .single();
    companyId = company!.company_id;

    const { data: plant } = await adminClient
      .from('production_plants')
      .insert([{ company_id: companyId, name: 'Plant OperatingProfitPeriodTest', is_active: true }])
      .select('production_plant_id')
      .single();
    plantId = plant!.production_plant_id;

    const { data: item } = await adminClient
      .from('items')
      .insert([{ company_id: companyId, item_code: 'PERIOD-FG', name: 'Item Uji Periode', type: 'finished_good', base_uom: 'pcs', purchase_uom: 'pcs', uom_conversion_factor: 1 }])
      .select('item_id')
      .single();
    itemId = item!.item_id;

    const { data: customer } = await adminClient.from('customers').insert([{ company_id: companyId, name: 'Customer Uji Periode' }]).select('customer_id').single();
    customerId = customer!.customer_id;

    const { data: authUser, error: authUserError } = await adminClient.auth.admin.createUser({
      email: 'admin.periodtest@debug.mrp',
      password: process.env.DEBUG_ROLE_TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Admin PeriodTest' }
    });
    if (authUserError && !authUserError.message.includes('already been registered')) throw new Error(authUserError.message);
    if (authUser?.user) {
      adminAuthUid = authUser.user.id;
    } else {
      const { data } = await adminClient.auth.admin.listUsers({ perPage: 100, page: 1 });
      adminAuthUid = data!.users.find((u: any) => u.email === 'admin.periodtest@debug.mrp')!.id;
    }
    await adminClient.from('users').upsert([{ auth_uid: adminAuthUid, company_id: companyId, name: 'Admin PeriodTest', email: 'admin.periodtest@debug.mrp', role: 'company_admin', status: 'active' }], { onConflict: 'auth_uid' });
  });

  afterAll(async () => {
    await adminClient.from('shipment_lines').delete().in('shipment_id', (await adminClient.from('shipments').select('shipment_id').eq('company_id', companyId)).data?.map((s) => s.shipment_id) ?? [-1]);
    await adminClient.from('shipments').delete().eq('company_id', companyId);
    await adminClient.from('sales_order_lines').delete().in('sales_order_id', (await adminClient.from('sales_orders').select('sales_order_id').eq('company_id', companyId)).data?.map((s) => s.sales_order_id) ?? [-1]);
    await adminClient.from('sales_orders').delete().eq('company_id', companyId);
    await adminClient.from('customer_purchase_orders').delete().eq('company_id', companyId);
    await adminClient.from('lots').delete().eq('company_id', companyId);
    await adminClient.from('customers').delete().eq('company_id', companyId);
    await adminClient.from('items').delete().eq('company_id', companyId);
    await adminClient.from('production_plants').delete().eq('company_id', companyId);
    await adminClient.from('company_settings').delete().eq('company_id', companyId);
    await adminClient.from('users').delete().eq('company_id', companyId);
    await adminClient.auth.admin.deleteUser(adminAuthUid);
    await adminClient.from('companies').delete().eq('company_id', companyId);
  });

  it('(NEGATIF/FALLBACK) company TANPA payroll_period_start_day -> tetap bulan KALENDER (perilaku lama, zero regresi)', async () => {
    await makeShipment(10, 10000, 6000, '2026-08-01'); // awal bulan kalender Agustus
    const token = await loginAsAdmin();
    const res = await fetch('http://localhost:3000/api/reports/monthly-operating-profit?year=2026&month=8', { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Number(body.total_margin)).toBeCloseTo(40000, 2); // 10*(10000-6000)
    expect(body.period_start).toBe('2026-08-01');
    expect(body.period_end).toBe('2026-08-31');
  });

  it('SETELAH payroll_period_start_day=26 diisi -> pengiriman tgl 20 Agustus masuk periode "Juli 2026" (26 Jul - 25 Agu), BUKAN "Agustus 2026"', async () => {
    await adminClient.from('company_settings').insert([{ company_id: companyId, setting_key: 'payroll_period_start_day', setting_value: '26' }]);
    await makeShipment(5, 20000, 8000, '2026-08-20'); // sebelum tgl 26 -> masuk periode "Agustus" (26 Jul-25 Agu)

    const token = await loginAsAdmin();
    const resAug = await fetch('http://localhost:3000/api/reports/monthly-operating-profit?year=2026&month=8', { headers: { Authorization: `Bearer ${token}` } });
    const bodyAug = await resAug.json();
    expect(bodyAug.period_start).toBe('2026-07-26');
    expect(bodyAug.period_end).toBe('2026-08-25');
    // Margin periode "Agustus" (26 Jul-25 Agu) sekarang berisi shipment 1 Agu (40rb) + shipment 20 Agu (5*(20000-8000)=60rb) = 100rb.
    expect(Number(bodyAug.total_margin)).toBeCloseTo(100000, 2);

    const resSep = await fetch('http://localhost:3000/api/reports/monthly-operating-profit?year=2026&month=9', { headers: { Authorization: `Bearer ${token}` } });
    const bodySep = await resSep.json();
    expect(bodySep.period_start).toBe('2026-08-26');
    expect(bodySep.period_end).toBe('2026-09-25');
    expect(Number(bodySep.total_margin)).toBeCloseTo(0, 2); // belum ada shipment di periode ini
  });

  it('(NEGATIF/BATAS) pengiriman TEPAT di tanggal mulai periode (26) masuk periode BARU, tanggal 25 masuk periode LAMA', async () => {
    await makeShipment(1, 50000, 30000, '2026-08-25'); // masuk periode "Agustus" (s/d 25 Agu)
    await makeShipment(1, 50000, 30000, '2026-08-26'); // masuk periode "September" (mulai 26 Agu)

    const token = await loginAsAdmin();
    const resAug = await fetch('http://localhost:3000/api/reports/monthly-operating-profit?year=2026&month=8', { headers: { Authorization: `Bearer ${token}` } });
    const bodyAug = await resAug.json();
    // total sebelumnya 100rb + tambahan 20rb (tgl 25) = 120rb, TIDAK termasuk tgl 26.
    expect(Number(bodyAug.total_margin)).toBeCloseTo(120000, 2);

    const resSep = await fetch('http://localhost:3000/api/reports/monthly-operating-profit?year=2026&month=9', { headers: { Authorization: `Bearer ${token}` } });
    const bodySep = await resSep.json();
    expect(Number(bodySep.total_margin)).toBeCloseTo(20000, 2); // cuma shipment tgl 26
  });
});
