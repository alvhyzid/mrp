'use client';

import { Fragment } from 'react';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
}

export function DataTable<TData, TValue>({ columns, data, emptyMessage = 'Tidak ada data.', getRowId, expandedRowId, renderExpandedRow }: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <div className="overflow-hidden rounded-none border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => {
              const rowId = getRowId?.(row.original);
              const isExpanded = !!renderExpandedRow && rowId !== undefined && rowId === expandedRowId;
              return (
                <Fragment key={row.id}>
                  <TableRow>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                  {isExpanded ? (
                    <TableRow>
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
  );
}
