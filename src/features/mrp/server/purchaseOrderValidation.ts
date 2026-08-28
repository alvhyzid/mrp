export interface PurchaseOrderLineInput {
  item_id: number;
  qty_ordered: number;
  unit_price: number | null;
}

export interface PurchaseOrderInput {
  supplier_id: number;
  production_plant_id: number;
  expected_date: string | null;
  lines: PurchaseOrderLineInput[];
}

/// Hasil validasi. `field` dan `line` mengikuti STANDAR VALIDASI FABRIX
/// (docs/ux/FABRIX_FIELD_VALIDATION_CLASS_STANDARD.md §3):
///
///   `field` diisi HANYA untuk galat GOLONGAN A — galat yang bisa diperbaiki pengguna dengan
///   mengubah satu isian yang terlihat. Ketiadaannya BERMAKNA: "ini bukan golongan A", dan
///   halaman menampilkannya di tingkat formulir.
///
///   `line` diisi hanya bila field itu hidup di baris berulang, dan berisi indeks mulai 0.
///
/// KENAPA FIELD-NYA DIKIRIM SEBAGAI DATA DAN BUKAN DITEBAK DARI KALIMATNYA: memetakan pesan
/// ke field dengan mencocokkan teks adalah kelas "kebetulan benar" yang sudah empat kali
/// menggigit proyek ini. Ia bekerja sampai seseorang memperbaiki satu kalimat, lalu galatnya
/// pindah diam-diam ke kontrol yang salah — tanpa satu pun test berubah merah.
export interface PurchaseOrderParseResult {
  data?: PurchaseOrderInput;
  error?: string;
  field?: string;
  line?: number;
}

export function parsePurchaseOrderInput(body: Record<string, unknown>): PurchaseOrderParseResult {
  const supplierId = Number(body.supplier_id);
  if (!supplierId || !Number.isInteger(supplierId) || supplierId <= 0) {
    return { error: 'Supplier wajib dipilih.', field: 'supplier_id' };
  }

  const productionPlantId = Number(body.production_plant_id);
  if (!productionPlantId || !Number.isInteger(productionPlantId) || productionPlantId <= 0) {
    return { error: 'Lokasi pabrik (alamat kirim) wajib dipilih.', field: 'production_plant_id' };
  }

  const expectedDate = body.expected_date ? String(body.expected_date).trim() : null;

  // GOLONGAN B, dan itu disengaja: penggunanya harus MENAMBAH baris, bukan memperbaiki
  // sesuatu yang terlihat. Menandainya di sebuah kontrol akan menunjuk isian yang bukan
  // penyebabnya.
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return { error: 'Minimal 1 baris item wajib diisi.' };
  }

  const lines: PurchaseOrderLineInput[] = [];
  for (const [indeks, raw] of (body.lines as Record<string, unknown>[]).entries()) {
    const itemId = Number(raw.item_id);
    if (!itemId || !Number.isInteger(itemId) || itemId <= 0) {
      return { error: 'Item pada salah satu baris tidak valid.', field: 'item_id', line: indeks };
    }

    const qtyOrdered = Number(raw.qty_ordered);
    if (!Number.isFinite(qtyOrdered) || qtyOrdered <= 0) {
      return { error: 'Jumlah pesan harus angka positif.', field: 'qty_ordered', line: indeks };
    }

    let unitPrice: number | null = null;
    if (raw.unit_price !== undefined && raw.unit_price !== null && raw.unit_price !== '') {
      const parsed = Number(raw.unit_price);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return { error: 'Harga satuan harus angka positif.', field: 'unit_price', line: indeks };
      }
      unitPrice = parsed;
    }

    lines.push({ item_id: itemId, qty_ordered: qtyOrdered, unit_price: unitPrice });
  }

  return { data: { supplier_id: supplierId, production_plant_id: productionPlantId, expected_date: expectedDate, lines } };
}
