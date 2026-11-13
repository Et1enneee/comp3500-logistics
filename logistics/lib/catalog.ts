export interface CatalogProduct { sku: string; name: string; priceCents: number; stock: number; lowStockThreshold: number }
export const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
