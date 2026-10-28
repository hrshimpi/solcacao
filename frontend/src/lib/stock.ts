// Turns a stock count into the label we show. The shop, the product page, the sampler and the cart all use it.
export type StockStatus = "in_stock" | "low" | "out";

export const LOW_STOCK_THRESHOLD = 10;

export function stockStatus(quantity: number, threshold = LOW_STOCK_THRESHOLD): StockStatus {
  if (quantity <= 0) return "out";
  if (quantity <= threshold) return "low";
  return "in_stock";
}