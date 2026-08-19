// Formatter mata uang TERPUSAT (Perintah Gabungan A-F, Bagian F, 21 Agu 2026)
// -- SATU-SATUNYA tempat simbol mata uang ("Rp" dkk) boleh ditulis di lapisan
// tampilan. Kode di TEMPAT LAIN wajib panggil formatCurrency() ini, TIDAK
// PERNAH menulis "Rp" sendiri atau memformat angka uang manual.
//
// STANDING INVARIANT proyek ini: pembulatan HANYA terjadi DI SINI (lapisan
// tampilan) -- nilai tersimpan di database & seluruh perhitungan (margin,
// biaya standar, dst) TETAP presisi penuh, tidak pernah dibulatkan sebelum
// disimpan/dihitung ulang.
//
// Kode mata uang per-tenant TERSIMPAN di company_settings ('currency_code',
// default 'IDR') -- fungsi ini menerima currencyCode sebagai parameter
// (bukan hardcode 'IDR' di titik pemanggilan manapun selain default di sini),
// supaya siap kalau nanti ada tenant non-IDR.
const CURRENCY_SYMBOLS: Record<string, string> = {
  IDR: 'Rp'
};

export interface FormatCurrencyOptions {
  currencyCode?: string;
  /** Jumlah digit desimal MAKSIMUM ditampilkan (bukan dipaksa) -- default 2, sesuai format acuan "Rp1.108.255,93". */
  maxDecimals?: number;
}

// null/undefined/NaN sengaja TIDAK dikembalikan sebagai "Rp0" (bisa disalahartikan
// sebagai angka nyata) -- selalu "-" supaya jelas datanya memang belum ada.
export function formatCurrency(value: number | null | undefined, options?: FormatCurrencyOptions): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  const currencyCode = options?.currencyCode ?? 'IDR';
  const maxDecimals = options?.maxDecimals ?? 2;
  const symbol = CURRENCY_SYMBOLS[currencyCode] ?? `${currencyCode} `;
  const formatted = value.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals });
  return `${symbol}${formatted}`;
}

// Varian TANPA simbol mata uang -- utk kolom tabel angka murni yang sudah
// punya label satuan sendiri di header (mis. "Tarif/Jam"), tapi tetap butuh
// format ribuan+desimal Indonesia yang konsisten (bukan toLocaleString manual
// tersebar).
export function formatNumberId(value: number | null | undefined, maxDecimals: number = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return value.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals });
}
