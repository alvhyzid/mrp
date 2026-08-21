import { describe, it, expect } from 'vitest';
import { getKamusTermTitle, humanizeKamusDraft, humanizeProvenanceText, getRoleLabel, getFieldLabel, getEntityLabel } from '../src/lib/glossary';

// Sesi 6 (21 Agu 2026) — glossary terpusat, sumber tunggal label manusia utk
// identifier teknis. Keluhan nyata pemilik produk yang melatari sesi ini:
// "Kolom `unit_price` di tabel `customer_purchase_order_lines` (numeric)" dan
// halaman Kamus yang menampilkan "customer_purchase_order_lines.unit_price"
// sebagai judul kartu -- test ini membuktikan PERSIS kasus itu sudah benar.

describe('glossary.ts — label manusia utk identifier teknis (Sesi 6)', () => {
  it('getKamusTermTitle: contoh persis dari keluhan pemilik produk -> "Harga Satuan (Baris PO Klien)"', () => {
    const title = getKamusTermTitle({
      scope: 'FIELD',
      entity: 'customer_purchase_order_lines',
      field: 'unit_price',
      term_key: 'customer_purchase_order_lines.unit_price'
    });
    expect(title).toBe('Harga Satuan (Baris PO Klien)');
  });

  it('getKamusTermTitle: field yang BELUM terdaftar di glossary tetap dirapikan (Title Case), TIDAK PERNAH underscore mentah', () => {
    const title = getKamusTermTitle({
      scope: 'FIELD',
      entity: 'ai_capability_requirements',
      field: 'threshold',
      term_key: 'ai_capability_requirements.threshold'
    });
    expect(title).toBe('Threshold (Prasyarat Kemampuan AI)');
    expect(title).not.toContain('_');
  });

  it('getKamusTermTitle: scope RELATION -> nama tabel saja, tanpa titik/underscore', () => {
    const title = getKamusTermTitle({ scope: 'RELATION', entity: 'kamus_routing_rules', field: null, term_key: 'kamus_routing_rules' });
    expect(title).toBe('Aturan Penugasan Kamus');
    expect(title).not.toContain('_');
  });

  it('getKamusTermTitle: scope METRIC -> title-case dari bagian setelah titik', () => {
    const title = getKamusTermTitle({ scope: 'METRIC', entity: null, field: null, term_key: 'metric.margin_kontribusi' });
    expect(title).toBe('Margin Kontribusi');
  });

  it('humanizeKamusDraft: pola draf otomatis generator DISUSUN ULANG dari entity/field -- tidak ada backtick, tidak ada nama tabel/kolom mentah, tidak ada tipe data', () => {
    const raw = '[PERLU KONFIRMASI] Kolom `unit_price` di tabel `customer_purchase_order_lines` (numeric). Draf otomatis dari nama kolom & tipe data -- belum ada penjelasan makna bisnis dari manusia.';
    const result = humanizeKamusDraft({ ai_draft: raw, entity: 'customer_purchase_order_lines', field: 'unit_price' });
    expect(result).not.toBeNull();
    expect(result).not.toContain('`');
    expect(result).not.toContain('customer_purchase_order_lines');
    expect(result).not.toContain('unit_price');
    expect(result).not.toContain('numeric');
    expect(result).toContain('Harga Satuan');
    expect(result).toContain('Baris PO Klien');
  });

  it('humanizeKamusDraft: null ai_draft -> null (tidak memaksa render apa pun)', () => {
    expect(humanizeKamusDraft({ ai_draft: null, entity: 'items', field: 'standard_cost' })).toBeNull();
  });

  it('humanizeProvenanceText: mengganti token snake_case yang dikenal, membiarkan yang tidak dikenal apa adanya (tidak memperburuk)', () => {
    const raw = 'Kebutuhan = qty_per_unit_output (BOM) × qty batch × (1 + buffer_percentage BOM ÷ 100).';
    const result = humanizeProvenanceText(raw);
    expect(result).toContain('Rasio Bahan per Unit Hasil');
    expect(result).toContain('Persentase Buffer');
    expect(result).not.toContain('qty_per_unit_output');
    expect(result).not.toContain('buffer_percentage');
  });

  it('humanizeProvenanceText: token entity.field digabung jadi "Field (Entity)"', () => {
    const raw = 'Diambil langsung dari items.standard_cost milik item komponen ini.';
    const result = humanizeProvenanceText(raw);
    expect(result).toContain('Biaya Standar (Item)');
    expect(result).not.toContain('items.standard_cost');
  });

  it('getRoleLabel: seluruh peran resmi (COMPANY_ROLES) punya label, tidak ada yang jatuh balik ke slug mentah', () => {
    const roles = ['company_admin', 'general_manager', 'admin_staff', 'production_manager', 'production_staff', 'ppic_manager', 'ppic_staff', 'finance_manager', 'finance_staff', 'purchasing_manager', 'purchasing_staff', 'warehouse_manager', 'warehouse_staff', 'hr_manager', 'hr_staff', 'viewer'];
    for (const role of roles) {
      const label = getRoleLabel(role);
      expect(label).not.toBe(role); // label HARUS beda dari slug mentah
      expect(label).not.toContain('_');
    }
  });

  it('getFieldLabel & getEntityLabel: field/entity tidak dikenal tetap tidak pernah mengandung underscore', () => {
    expect(getFieldLabel('kolom_yang_belum_terdaftar')).not.toContain('_');
    expect(getEntityLabel('tabel_yang_belum_terdaftar')).not.toContain('_');
  });
});
