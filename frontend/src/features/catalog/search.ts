// The search box of the header: the products whose name or origin country contains what was typed, ignoring capitals and accents.
import type { Product } from "../../api/products";

const plain = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function searchProducts(products: Product[], query: string): Product[] {
  const needle = plain(query.trim());
  // a search of only accents (like "^") is a search for nothing, and finds nothing
  if (!needle) return [];
  return products.filter((product) => plain(product.name).includes(needle) || plain(product.originName).includes(needle));
}
