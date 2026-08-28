// ============================================================================================
// T-V4 — KONTRAK NAMA FIELD DI BATAS SERVER -> KLIEN
// ============================================================================================
// KENAPA INI ADA, dan kenapa `string` saja TIDAK CUKUP meski TypeScript mengizinkannya:
// jawaban server adalah data RUNTIME. Sebuah nama yang salah ketik menghasilkan bentuk
// kegagalan yang paling sulit ditemukan di seluruh kelas ini —
//
//   server mengirim galat -> nol kontrol cocok -> notifikasi formulir JUGA digerbang mati
//   karena "sudah ada galat field" -> pengguna TIDAK MELIHAT APA PUN -> test tetap hijau.
//
// Galatnya bukan salah tempat; galatnya HILANG. Karena itu batas ini punya DUA lapis: daftar
// nama sebagai satu sumber (dijaga saat kompilasi) DAN pemeriksaan saat berjalan di bawah.

/// Field di TINGKAT ATAS formulir PO. Namanya sama persis dengan kunci state di layar.
export const FIELD_PO = ['supplier_id', 'production_plant_id', 'expected_date'] as const;

/// Field yang hidup DI DALAM baris berulang. Namanya sama persis dengan kunci `FormLine`.
export const FIELD_PO_BARIS = ['item_id', 'qty_ordered', 'unit_price'] as const;

export type FieldPo = (typeof FIELD_PO)[number] | (typeof FIELD_PO_BARIS)[number];

function fieldBaris(nilai: unknown): nilai is (typeof FIELD_PO_BARIS)[number] {
  return typeof nilai === 'string' && (FIELD_PO_BARIS as readonly string[]).includes(nilai);
}

function fieldDikenal(nilai: unknown): nilai is FieldPo {
  return typeof nilai === 'string' && [...FIELD_PO, ...FIELD_PO_BARIS].includes(nilai as FieldPo);
}

/// Hasil pemetaan galat server. `formulir` berarti: tampilkan di tingkat formulir dengan
/// kalimat ASLINYA — galatnya tidak boleh hilang hanya karena pemetaannya tidak bisa dilakukan.
export type GalatPoTerpetakan =
  | { jenis: 'field'; field: FieldPo; line: number | undefined; pesan: string }
  | { jenis: 'formulir'; pesan: string };

/// PEMBANGUN BADAN JAWABAN untuk galat golongan A.
///
/// KENAPA INI ADA, dan ini ditemukan lewat MENJALANKAN mutasi, bukan lewat membaca: lapisan
/// tipe pada hasil validator TIDAK berlaku di `createPurchaseOrder`, karena `ApiResult.body`
/// di sana bertipe `Record<string, unknown>`. Menyalin nama field salah ketik langsung ke
/// dalam objek itu LOLOS typecheck sepenuhnya — diuji: `field: 'supplier'` tidak menghasilkan
/// satu pun galat kompilasi.
///
/// Penjaga runtime tetap menangkapnya (galatnya naik ke tingkat formulir, tidak hilang), tapi
/// itu berarti cacatnya baru ketahuan saat dijalankan. Fungsi ini mengembalikan lapisan
/// kompilasi ke tempat yang tadinya bolong, dengan ongkos satu pemanggilan.
export function galatFieldPo(error: string, field: FieldPo, line?: number): Record<string, unknown> {
  return { error, field, ...(line !== undefined ? { line } : {}) };
}

/// SEMANTIK `line`: indeks baris BERBASIS NOL, mengacu ke urutan baris di formulir SAAT
/// jawaban diterima. Ia hanya bermakna untuk field di `FIELD_PO_BARIS`.
///
/// TIGA KEADAAN YANG SENGAJA DINAIKKAN KE TINGKAT FORMULIR, karena ketiganya berarti
/// "pemetaannya tidak bisa dipercaya" dan menandai kontrol yang salah lebih buruk daripada
/// menampilkan kalimatnya apa adanya:
///   1. `field` tidak ada di daftar (salah ketik, nama lama, atau modul lain)
///   2. field baris tanpa `line` yang sah — barisnya tidak bisa ditebak
///   3. `line` di luar jangkauan baris yang sedang tampil — termasuk setelah baris dihapus
///
/// SATU KEADAAN yang TIDAK dinaikkan, dan ini keputusan sadar: field NON-baris yang membawa
/// `line`. Pemetaannya tidak gagal — `supplier_id` tidak ambigu — dan yang tidak bermakna
/// hanyalah `line`-nya. Menaikkannya justru MEMINDAHKAN galat yang sebenarnya bisa ditunjuk.
export function petakanGalatServerPo(body: Record<string, unknown>, jumlahBaris: number): GalatPoTerpetakan {
  const pesan = typeof body.error === 'string' && body.error ? body.error : 'Isian ini ditolak.';
  const field = body.field;
  if (!fieldDikenal(field)) return { jenis: 'formulir', pesan };

  if (!fieldBaris(field)) return { jenis: 'field', field, line: undefined, pesan };

  const line = body.line;
  const lineSah = typeof line === 'number' && Number.isInteger(line) && line >= 0 && line < jumlahBaris;
  if (!lineSah) return { jenis: 'formulir', pesan };
  return { jenis: 'field', field, line, pesan };
}

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
  field?: FieldPo;
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
