export const IMPORT_FIELD_DEFS = [
  { key: 'name', label: 'Nome do produto', required: true },
  { key: 'barcode', label: 'Código de Barras (referência)', required: false },
  { key: 'price', label: 'Preço', required: true },
  { key: 'description', label: 'Descrição', required: false },
  { key: 'min_stock', label: 'Estoque mínimo', required: false },
  { key: 'max_stock', label: 'Estoque máximo', required: false },
  { key: 'stock_quantity', label: 'Quantidade em estoque', required: false },
  { key: 'category', label: 'Categoria', required: false },
];

const IMPORT_PATTERNS = {
  name: ['nome', 'nome do produto', 'produto', 'name'],
  barcode: ['codigo de barras', 'código de barras', 'barcode', 'codigo', 'código', 'ean'],
  price: ['preco', 'preço', 'price', 'valor'],
  description: ['descricao', 'descrição', 'description'],
  min_stock: ['estoque minimo', 'estoque mínimo', 'min_stock', 'minimo', 'mínimo'],
  max_stock: ['estoque maximo', 'estoque máximo', 'max_stock', 'maximo', 'máximo'],
  stock_quantity: ['quantidade em estoque', 'quantidade', 'estoque', 'stock', 'qtd'],
  category: ['categoria', 'category'],
};

export function guessColumnForField(fieldKey, headers) {
  const normalized = headers.map((header) => header.toLowerCase().trim());
  const candidates = IMPORT_PATTERNS[fieldKey] || [];
  for (const candidate of candidates) {
    const index = normalized.findIndex((header) => header === candidate);
    if (index !== -1) return headers[index];
  }
  for (const candidate of candidates) {
    const index = normalized.findIndex((header) => header.includes(candidate));
    if (index !== -1) return headers[index];
  }
  return '';
}

export function categoriesText(product) {
  const categories = Array.isArray(product.categories) ? product.categories : [];
  if (!categories.length) return '—';
  return categories.map((category) => (typeof category === 'string' ? category : category.path || category.name)).join(', ');
}

export function stockStatusLabel(product) {
  const stock = Number(product.stock ?? 0);
  if (stock <= 0) return 'Sem estoque';
  if (product.min_stock !== null && product.min_stock !== undefined && stock <= Number(product.min_stock)) return 'Estoque baixo';
  return 'Normal';
}

export const EXPORT_FIELD_DEFS = [
  { key: 'id', label: 'ID', value: (p) => p.id },
  { key: 'name', label: 'Nome', value: (p) => p.name || '' },
  { key: 'description', label: 'Descrição', value: (p) => p.description || '' },
  { key: 'barcode', label: 'Código de Barras', value: (p) => p.barcode || '' },
  { key: 'categories', label: 'Categoria', value: (p) => (categoriesText(p) === '—' ? '' : categoriesText(p)) },
  { key: 'price', label: 'Preço', value: (p) => Number(p.price || 0).toFixed(2) },
  { key: 'stock', label: 'Estoque Atual', value: (p) => p.stock ?? '' },
  { key: 'min_stock', label: 'Estoque Mínimo', value: (p) => p.min_stock ?? '' },
  { key: 'max_stock', label: 'Estoque Máximo', value: (p) => p.max_stock ?? '' },
  { key: 'stock_status', label: 'Status do Estoque', value: (p) => stockStatusLabel(p) },
];

export function escapeCsvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildProductsCsv(products, selectedKeys) {
  const fields = EXPORT_FIELD_DEFS.filter((field) => selectedKeys.includes(field.key));
  const header = fields.map((field) => escapeCsvValue(field.label)).join(',');
  const rows = products.map((product) => fields.map((field) => escapeCsvValue(field.value(product))).join(','));
  return `﻿${[header, ...rows].join('\r\n')}`;
}

export function isLowStock(product) {
  const stock = Number(product.stock || 0);
  const minStock = product.min_stock === null || product.min_stock === undefined ? null : Number(product.min_stock);
  return minStock !== null && Number.isFinite(stock) && Number.isFinite(minStock) && stock <= minStock;
}
