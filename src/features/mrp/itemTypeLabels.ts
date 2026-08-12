export const itemTypes = ['raw_material', 'wip', 'finished_good', 'packaging'];

export const typeLabels: Record<string, string> = {
  raw_material: 'Bahan Baku',
  wip: 'WIP (Barang Setengah Jadi)',
  finished_good: 'Produk Jadi',
  packaging: 'Kemasan'
};

export const typeBadgeVariant: Record<string, 'info' | 'warning' | 'success' | 'secondary'> = {
  raw_material: 'info',
  wip: 'warning',
  finished_good: 'success',
  packaging: 'secondary'
};
