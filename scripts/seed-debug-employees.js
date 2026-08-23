const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });


// INF-14 (23 Agu 2026) -- pengawas tingkat project: skrip ini MENULIS data,
// jadi WAJIB gagal keras bila diarahkan ke project berisi data nyata.
require('./guard-real-project').assertNotRealProject('scripts/seed-debug-employees.js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

// linkedToDebugEmail: employee_id ini ditautkan ke user debug tsb (linked_user_id) —
// dipakai buat demo "karyawan bisa lihat data dirinya sendiri" dengan akun nyata.
const employees = [
  { name: 'Budi Santoso', position: 'Operator Produksi', department: 'production', wage_type: 'daily', wage_rate: 150000, linkedToDebugEmail: 'staff.a@debug.mrp' },
  { name: 'Siti Aminah', position: 'QC Produksi', department: 'production', wage_type: 'daily', wage_rate: 160000, linkedToDebugEmail: null },
  { name: 'Dewi Lestari', position: 'Staf Gudang', department: 'warehouse', wage_type: 'monthly', wage_rate: 4500000, linkedToDebugEmail: null },
  { name: 'Ahmad Fadli', position: 'Staf Finance', department: 'finance', wage_type: 'monthly', wage_rate: 5000000, linkedToDebugEmail: null },
  { name: 'Rina Kartika', position: 'Staf HRD', department: 'hr', wage_type: 'monthly', wage_rate: 4800000, linkedToDebugEmail: null },
  { name: 'Hendra Wijaya', position: 'Staf PPIC', department: 'ppic', wage_type: 'monthly', wage_rate: 4700000, linkedToDebugEmail: null }
];

// name -> status absensi hari ini. Sengaja tidak semua diisi (mencerminkan kondisi
// nyata: belum semua orang check-in saat dashboard dibuka).
const todayAttendance = {
  'Budi Santoso': { status: 'present', checkInHour: 7 },
  'Siti Aminah': { status: 'late', checkInHour: 8 },
  'Dewi Lestari': { status: 'present', checkInHour: 7 },
  'Ahmad Fadli': { status: 'present', checkInHour: 8 }
};

async function main() {
  const { data: debugUser, error: debugUserError } = await admin.from('users').select('company_id').eq('email', 'company.a@debug.mrp').maybeSingle();
  if (debugUserError) throw new Error(`Failed to find Company A debug user: ${debugUserError.message}`);
  if (!debugUser) throw new Error('Company A debug user (company.a@debug.mrp) not found. Run npm run seed:test-tenants first.');
  const companyId = debugUser.company_id;

  const { data: plant, error: plantError } = await admin.from('production_plants').select('production_plant_id').eq('company_id', companyId).limit(1).maybeSingle();
  if (plantError) throw new Error(`Failed to find production plant: ${plantError.message}`);
  const plantId = plant?.production_plant_id ?? null;

  const today = new Date().toISOString().slice(0, 10);

  for (const emp of employees) {
    let linkedUserId = null;
    if (emp.linkedToDebugEmail) {
      const { data: linkedUser } = await admin.from('users').select('user_id').eq('email', emp.linkedToDebugEmail).maybeSingle();
      linkedUserId = linkedUser?.user_id ?? null;
    }

    const { data: existing } = await admin.from('employees').select('employee_id').eq('company_id', companyId).eq('name', emp.name).maybeSingle();

    let employeeId;
    if (existing) {
      const { error: updateError } = await admin
        .from('employees')
        .update({ position: emp.position, department: emp.department, wage_type: emp.wage_type, wage_rate: emp.wage_rate, linked_user_id: linkedUserId, production_plant_id: plantId, is_active: true })
        .eq('employee_id', existing.employee_id);
      if (updateError) throw new Error(`Failed to update employee ${emp.name}: ${updateError.message}`);
      employeeId = existing.employee_id;
    } else {
      const { data: inserted, error: insertError } = await admin
        .from('employees')
        .insert([{ company_id: companyId, production_plant_id: plantId, department: emp.department, name: emp.name, position: emp.position, wage_type: emp.wage_type, wage_rate: emp.wage_rate, linked_user_id: linkedUserId, is_active: true }])
        .select('employee_id')
        .single();
      if (insertError) throw new Error(`Failed to insert employee ${emp.name}: ${insertError.message}`);
      employeeId = inserted.employee_id;
    }

    console.log(`Ensured employee ${emp.name} (${emp.department}${linkedUserId ? ', linked to ' + emp.linkedToDebugEmail : ''})`);

    const attendance = todayAttendance[emp.name];
    if (attendance) {
      const checkInAt = new Date(`${today}T${String(attendance.checkInHour).padStart(2, '0')}:00:00Z`).toISOString();
      const { error: attendanceError } = await admin
        .from('employee_attendance')
        .upsert([{ company_id: companyId, employee_id: employeeId, attendance_date: today, check_in_at: checkInAt, status: attendance.status }], { onConflict: 'employee_id,attendance_date' });
      if (attendanceError) throw new Error(`Failed to upsert attendance for ${emp.name}: ${attendanceError.message}`);
      console.log(`  -> absensi hari ini: ${attendance.status}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
