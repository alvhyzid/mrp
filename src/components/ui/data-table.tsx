'use client';

import { Fragment, useMemo, useState } from 'react';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  // Baris bisa diperluas (pola Carbon Design System "Expandable Data Table",
  // https://carbondesignsystem.com/components/data-table/usage/#expansion) — panel
  // tambahan tampil LANGSUNG di bawah baris terkait, bukan modal terpisah. Opsional:
  // tabel tanpa 3 prop ini tetap berperilaku persis seperti sebelumnya.
  getRowId?: (row: TData) => string;
  expandedRowId?: string | null;
  renderExpandedRow?: (row: TData) => React.ReactNode;
  // Toolbar pencarian Carbon-style — HANYA muncul kalau `searchPlaceholder` diisi.
  // Cocok untuk tabel yang datanya bisa banyak/tumbuh (master data, riwayat) — tabel
  // kecil/terbatas (antrian approval, daftar tim) sengaja TIDAK perlu ini, sesuai
  // fungsi masing-masing tabel, bukan dipasang seragam di semua tempat.
  searchPlaceholder?: string;
  getSearchText?: (row: TData) => string;
  // Pagination Carbon-style — HANYA muncul kalau `paginated` true. Sama seperti
  // pencarian, dipasang selektif di tabel yang datanya realistis bisa melebihi 1 layar.
  paginated?: boolean;
  pageSize?: number;
  // Tombol aksi utama toolbar (Carbon "DataTable with toolbar",
  // https://carbondesignsystem.com/components/data-table/usage/#toolbar) — dipakai
  // buat "tambah baru" yang sebelumnya form/card inline di bawah tabel. Opsional:
  // toolbar tetap tampil tanpa tombol ini kalau tidak diisi (mis. tabel yang cuma
  // butuh pencarian, tanpa aksi "tambah baru").
  primaryAction?: { label: string; onClick: () => void };
}

// Baris selang-seling (Carbon "zebra striping") — SATU gaya baku dipakai SEMUA
// DataTable di aplikasi ini (bukan opsional), supaya tampilan tabel konsisten di
// seluruh halaman sesuai permintaan "terapkan style data table Carbon ke seluruh
// data table kita". Dihitung dari index baris YANG TAMPIL (setelah filter/pagination),
// bukan lewat CSS :nth-child, supaya tetap benar walau ada baris expand di antaranya.
const ZEBRA_ROW_CLASS = 'bg-muted/25';

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = 'Tidak ada data.',
  getRowId,
  expandedRowId,
  renderExpandedRow,
  searchPlaceholder,
  getSearchText,
  paginated = false,
  pageSize = 10,
  primaryAction
}: DataTableProps<TData, TValue>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [pageIndex, setPageIndex] = useState(0);

  const filteredData = useMemo(() => {
    if (!searchPlaceholder || !getSearchText || !searchTerm.trim()) return data;
    const needle = searchTerm.trim().toLowerCase();
    return data.filter((row) => getSearchText(row).toLowerCase().includes(needle));
  }, [data, searchPlaceholder, getSearchText, searchTerm]);

  const pageCount = paginated ? Math.max(1, Math.ceil(filteredData.length / pageSize)) : 1;
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  // WAJIB di-memo — tanstack-table's useReactTable menyimpan referensi `data` untuk
  // deteksi perubahan; array baru tiap render (mis. dari .slice() langsung) memicu
  // reset internal berulang, menyebabkan re-render ratusan kali/detik (dikonfirmasi
  // lewat instrumentasi render-counter, bukan cuma dugaan).
  const pagedData = useMemo(
    () => (paginated ? filteredData.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize) : filteredData),
    [paginated, filteredData, safePageIndex, pageSize]
  );

  const table = useReactTable({
    data: pagedData,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  // Peta header per kolom, dipakai kartu layar sempit untuk menampilkan judul kolom
  // yang SAMA PERSIS dengan yang tampil di kepala tabel layar lebar.
  const headerByColumnId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof table.getHeaderGroups>[number]['headers'][number]>();
    table.getHeaderGroups().forEach((g) => g.headers.forEach((h) => map.set(h.column.id, h)));
    return map;
  }, [table]);

  const searchEnabled = !!searchPlaceholder && !!getSearchText;
  const showToolbar = searchEnabled || !!primaryAction;

  return (
    <div className="flex flex-col gap-0">
      {/* RSP-01: di layar sempit toolbar BERTUMPUK (cari di atas, tombol di bawah).
          Penyebab gulir menyamping di halaman Item Master ternyata BUKAN tabelnya,
          melainkan baris ini: kolom cari + tombol aksi berdampingan butuh lebih dari
          360 px, dan tombolnya `whitespace-nowrap` sehingga tidak bisa menyusut.
          Tingginya juga dilepas dari h-12 tetap supaya dua baris tidak tergencet. */}
      {showToolbar ? (
        <div className="flex flex-col items-stretch gap-0 border border-b-0 sm:h-12 sm:flex-row">
          {searchEnabled ? (
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                name="data-table-search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPageIndex(0);
                }}
                placeholder={searchPlaceholder}
                className="h-12 border-0 pl-9 sm:h-full"
              />
            </div>
          ) : (
            <div className="flex-1 bg-background" />
          )}
          {primaryAction ? (
            <Button className="h-12 rounded-none px-4 sm:h-full" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      ) : null}
      {/* KARTU BERTUMPUK UNTUK LAYAR SEMPIT (RSP-01, 24 Agu 2026).
          Aturan responsive proyek: tabel banyak kolom TIDAK diperkecil sampai muat --
          susunannya BERUBAH BENTUK. Satu baris jadi satu kartu, kolomnya tersusun ke
          bawah dengan label di kiri dan isinya di kanan.

          DIPASANG DI KOMPONEN BERSAMA, bukan di satu halaman: seluruh tabel di aplikasi
          ini memakai DataTable, dan semuanya punya penyakit yang sama di layar sempit.
          Tampilan layar lebar TIDAK tersentuh sedikit pun -- yang berubah hanya apa yang
          dirender di bawah breakpoint md, yang sebelumnya memang rusak (meluber ke
          samping). Jadi ini bukan perubahan berisiko di layar besar, melainkan mengganti
          sesuatu yang sudah rusak di layar kecil.

          Tiap halaman TETAP perlu bukti visualnya sendiri di 4 lebar -- label kolom yang
          masuk akal di header tabel belum tentu masuk akal sebagai label kartu. */}
      <div className="flex flex-col gap-3 md:hidden">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const rowId = getRowId?.(row.original);
            const isExpanded = !!renderExpandedRow && rowId !== undefined && rowId === expandedRowId;
            return (
              <div key={row.id} className="border bg-background">
                <dl className="divide-y">
                  {row.getVisibleCells().map((cell) => {
                    // Label kartu diambil dari HEADER SUNGGUHAN kolom itu, dirender apa
                    // adanya. Versi pertama cuma menerima header bertipe string, dan
                    // akibatnya kolom yang judulnya mengandung elemen (mis. "Biaya Standar"
                    // yang bersanding dengan ikon Asal-Usul) muncul sebagai angka telanjang
                    // tanpa keterangan apa pun -- Rp15.000 tanpa penjelasan itu angka yang
                    // tidak bisa dibaca.
                    const headerCell = headerByColumnId.get(cell.column.id);
                    const label =
                      cell.column.id === 'actions' || !headerCell || headerCell.isPlaceholder
                        ? null
                        : flexRender(headerCell.column.columnDef.header, headerCell.getContext());
                    // Kolom aksi sengaja tanpa label -- memberi judul "Aksi" pada sebaris
                    // tombol cuma menambah kata tanpa menambah arti.
                    if (!label) {
                      return (
                        <div key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      );
                    }
                    return (
                      <div key={cell.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-4 py-3">
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                        <dd className="min-w-0 break-words text-data">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                {isExpanded ? <div className="border-t bg-muted/30 p-4">{renderExpandedRow!(row.original)}</div> : null}
              </div>
            );
          })
        ) : (
          <div className="border bg-background px-4 py-8 text-center text-data text-muted-foreground">{emptyMessage}</div>
        )}
      </div>
      {/* overflow-x-auto, BUKAN overflow-hidden. Sebelumnya kolom yang tidak muat
          DIPOTONG diam-diam tanpa ada cara melihatnya -- di layar 768 px dengan menu
          samping terpasang, itu berarti kolom paling kanan hilang tanpa jejak. Kini
          tabel lebar menggulir DI DALAM wadahnya sendiri, jadi halamannya tetap tidak
          bergulir menyamping tapi datanya tetap bisa dijangkau. */}
      <div className="hidden overflow-x-auto rounded-none border md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row, index) => {
                const rowId = getRowId?.(row.original);
                const isExpanded = !!renderExpandedRow && rowId !== undefined && rowId === expandedRowId;
                const zebraClass = index % 2 === 1 ? ZEBRA_ROW_CLASS : undefined;
                return (
                  <Fragment key={row.id}>
                    <TableRow className={zebraClass}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                    {isExpanded ? (
                      <TableRow className={zebraClass}>
                        <TableCell colSpan={columns.length} className="bg-muted/30 p-0">
                          <div className="p-4">{renderExpandedRow!(row.original)}</div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-20 text-center text-data text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {paginated && filteredData.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-t-0 bg-background px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            {safePageIndex * pageSize + 1}–{Math.min((safePageIndex + 1) * pageSize, filteredData.length)} dari {filteredData.length} item
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={safePageIndex === 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))} aria-label="Halaman sebelumnya">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Halaman {safePageIndex + 1} dari {pageCount}
            </span>
            <Button size="sm" variant="outline" disabled={safePageIndex >= pageCount - 1} onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))} aria-label="Halaman berikutnya">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
