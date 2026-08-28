import { buatKontrakGalatField } from '@/lib/kontrakGalatField';

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

// T-V5 — MEKANISMENYA TIDAK LAGI HIDUP DI SINI. Yang tinggal di modul ini hanyalah DAFTAR
// NAMA-nya; pemeriksaan nama, pemeriksaan indeks baris, dan keputusan field-atau-formulir
// datang dari kontrak bersama. Menyalinnya ke modul kedua akan melahirkan dua pintu yang
// menyimpang — kelas "dua jalur hidup" yang justru sedang diberantas.
//
// Perilakunya TIDAK berubah sedikit pun: kesembilan penjaga T-V4 tetap hijau tanpa disunting.
const kontrak = buatKontrakGalatField(FIELD_PO, FIELD_PO_BARIS);

/// Lihat `KontrakGalatField.galatField`. Dipertahankan namanya supaya pemanggil tidak ikut
/// berubah saat mekanismenya dipindahkan.
export const galatFieldPo = kontrak.galatField;

/// Lihat `KontrakGalatField.petakan`. SEMANTIK `line`: indeks BERBASIS NOL, hanya bermakna
/// untuk nama di `FIELD_PO_BARIS`.
export const petakanGalatServerPo = kontrak.petakan;

export type GalatPoTerpetakan = ReturnType<typeof petakanGalatServerPo>;

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
