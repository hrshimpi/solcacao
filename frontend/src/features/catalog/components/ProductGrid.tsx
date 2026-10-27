// A responsive grid of product cards: 1 column on phones, 2 from sm, 3 from lg, 4 from xl.
import type { Product } from "../../../data/products";
import ProductCard from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  variant?: "full" | "compact";
  className?: string;
}

export default function ProductGrid({
  products,
  variant = "full",
  className = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
}: ProductGridProps) {
  return (
    <ul className={`grid gap-4 ${className}`}>
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} variant={variant} priority={index < 2} />
        </li>
      ))}
    </ul>
  );
}
