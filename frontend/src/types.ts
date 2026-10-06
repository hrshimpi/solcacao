export interface Product {
  id: number;
  slug: string;
  name: string;
  origin: string;
  percentage: number;
  category: "Bars" | "Truffles" | "Seasonal";
  price: number;
  notes: string[];
  caption: string;
  tastingSummary: string;
  image: string;
  batchCode: string;
  harvestDate: string;
  farm: string;
  roastDate: string;
  description: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
