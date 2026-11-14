// Turns a stock count into the label the shop shows. The same rule as the one in the frontend, so the page and the
// API never disagree about what "low stock" means.
export type Availability = "in_stock" | "low" | "out";

export const DEFAULT_LOW_STOCK = 10;

export function availabilityOf(quantity: number, lowStockThreshold = DEFAULT_LOW_STOCK): Availability {
  if (quantity <= 0) return "out";
  if (quantity <= lowStockThreshold) return "low";
  return "in_stock";
}
