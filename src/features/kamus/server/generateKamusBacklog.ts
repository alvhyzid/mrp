import type { SupabaseClient } from '@supabase/supabase-js';

// Generator backlog Kamus (K1, docs/rencana-modul-kamus-paralel.md §3.2) --
// memindai SKEMA NYATA (lewat debug_schema_snapshot(), fungsi introspeksi yang
// SUDAH ADA dari audit sebelumnya -- tidak membangun mekanisme baru) dan
// membuat 1 baris kamus_terms per kolom yang layak dijelaskan. IDEMPOTEN:
// dipanggil ulang cuma menambah baris kolom BARU (on conflict do nothing),
// tidak pernah menghapus/menimpa jawaban yang sudah ada.

// Kolom bermuatan gaji -- DIKECUALIKAN TOTAL dari backlog & dari contoh nilai
// nyata di mana pun (instruksi eksplisit §4 dokumen). Daftar ini SENGAJA
// eksplisit per kolom (bukan pola nama otomatis) supaya mudah diaudit --
// kalau ada kolom gaji baru ditambahkan, WAJIB ditambahkan di sini juga
// (lihat skenario negatif 2 di test).
const SALARY_COLUMNS = new Set([
  'employees.wage_rate',
  'employees.wage_type',
  'employees.ptkp_status',
  'employees.ter_category',
  'employees.ter_rate_percent',
  'employees.daily_meal_allowance',
  'employees.daily_transport_allowance',
  'employees.bpjs_kesehatan_enrolled',
  'employees.bpjs_contribution_basis',
  'employees.allowance_frequency'
]);

// Kolom teknis/audit murni -- tidak ada makna BISNIS untuk dijelaskan (beda
// dari FK yang punya makna, mis. parent_item_id/component_item_id TETAP masuk
// backlog karena menjawab "item apa yang dimaksud" itu bermakna).
const TECHNICAL_COLUMN_NAMES = new Set([
  'created_at',
  'updated_at',
  'version',
  'company_id',
  'tenant_id',
  'auth_uid',
  'linked_user_id',
  'created_by',
  'updated_by',
  'answered_by',
  'answered_at',
  'confirmed_by',
  'confirmed_at',
  'assigned_to_role',
  'assigned_note'
]);

const EXCLUDED_TABLE_PREFIXES = ['kamus_'];

interface RoutingRule {
  domain: string | null;
  entity_pattern: string | null;
  suggested_role: string;
}

function classify(table: string, column: string): { priority: number; domain: string } | null {
  const name = column.toLowerCase();

  if (/(cost|price|margin|valuation|harga|biaya|overhead|threshold)/.test(name)) {
    return { priority: 1, domain: 'uang' };
  }
  if (/^qty|uom|conversion|yield|buffer|_basis$/.test(name)) {
    return { priority: 2, domain: 'kuantitas' };
  }
  if (name === 'status' || /transition|approval|_status$/.test(name)) {
    return { priority: 3, domain: 'status' };
  }
  if (table === 'production_standards' || table === 'routing_step_standard_crew' || /source|sample_count/.test(name)) {
    return { priority: 4, domain: 'standar' };
  }
  return { priority: 5, domain: 'lainnya' };
}

function suggestRole(table: string, column: string, domain: string, rules: RoutingRule[]): string | null {
  const haystack = `${table}.${column}`.toLowerCase();
  for (const rule of rules) {
    const domainMatches = !rule.domain || rule.domain === domain;
    const patternMatches = !rule.entity_pattern || haystack.includes(rule.entity_pattern.toLowerCase().replace(/%/g, ''));
    if (domainMatches && patternMatches) return rule.suggested_role;
  }
  return null;
}

export interface GenerateBacklogResult {
  inserted: number;
  skippedExisting: number;
  totalScanned: number;
  excludedSalaryCount: number;
  countsByPriority: Record<number, number>;
  countsByDomain: Record<string, number>;
}

export async function generateKamusBacklog(adminClient: SupabaseClient, companyId: number): Promise<GenerateBacklogResult> {
  const { data: columns, error: columnsError } = await adminClient.rpc('kamus_list_columns');
  if (columnsError) throw new Error(`Gagal mengambil daftar kolom: ${columnsError.message}`);
  const { data: pks, error: pkError } = await adminClient.rpc('kamus_list_primary_keys');
  if (pkError) throw new Error(`Gagal mengambil daftar primary key: ${pkError.message}`);

  const pkColumns = new Set<string>((pks as { table_name: string; column_name: string }[]).map((r) => `${r.table_name}.${r.column_name}`));

  const { data: rules } = await adminClient.from('kamus_routing_rules').select('domain, entity_pattern, suggested_role').eq('company_id', companyId);
  const routingRules: RoutingRule[] = rules ?? [];

  const rowsToInsert: Record<string, unknown>[] = [];
  let totalScanned = 0;
  let excludedSalaryCount = 0;
  const countsByPriority: Record<number, number> = {};
  const countsByDomain: Record<string, number> = {};

  for (const row of columns as { table_name: string; column_name: string; data_type: string; is_nullable: boolean }[]) {
    const table = row.table_name;
    const column = row.column_name;
    if (EXCLUDED_TABLE_PREFIXES.some((p) => table.startsWith(p))) continue;

    totalScanned += 1;
    const key = `${table}.${column}`;

    if (SALARY_COLUMNS.has(key)) {
      excludedSalaryCount += 1;
      continue;
    }
    if (TECHNICAL_COLUMN_NAMES.has(column)) continue;
    if (pkColumns.has(key)) continue; // PK tabel itu sendiri (id surrogate, tidak bermakna bisnis)

    const classification = classify(table, column);
    if (!classification) continue;

    const suggested = suggestRole(table, column, classification.domain, routingRules);
    const typeDetail = `${row.data_type}${row.is_nullable ? ', nullable' : ''}`;

    rowsToInsert.push({
      company_id: companyId,
      scope: 'FIELD',
      entity: table,
      field: column,
      term_key: key,
      priority: classification.priority,
      domain: classification.domain,
      suggested_role: suggested,
      status: 'DRAF_AI',
      ai_draft: `[PERLU KONFIRMASI] Kolom \`${column}\` di tabel \`${table}\` (${typeDetail}). Draf otomatis dari nama kolom & tipe data -- belum ada penjelasan makna bisnis dari manusia.`
    });

    countsByPriority[classification.priority] = (countsByPriority[classification.priority] ?? 0) + 1;
    countsByDomain[classification.domain] = (countsByDomain[classification.domain] ?? 0) + 1;
  }

  if (rowsToInsert.length === 0) {
    return { inserted: 0, skippedExisting: 0, totalScanned, excludedSalaryCount, countsByPriority, countsByDomain };
  }

  const { data: inserted, error: insertError } = await adminClient
    .from('kamus_terms')
    .upsert(rowsToInsert, { onConflict: 'company_id,term_key', ignoreDuplicates: true })
    .select('kamus_term_id');
  if (insertError) throw new Error(`Gagal insert kamus_terms: ${insertError.message}`);

  return {
    inserted: inserted?.length ?? 0,
    skippedExisting: rowsToInsert.length - (inserted?.length ?? 0),
    totalScanned,
    excludedSalaryCount,
    countsByPriority,
    countsByDomain
  };
}
