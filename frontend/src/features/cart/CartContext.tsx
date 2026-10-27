// Cart state for the whole app. Lines are saved in localStorage and restored when the page loads.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getProductById } from "../../data/products";
import { useLang } from "../../i18n/LanguageContext";
import { useAnnounce } from "../../ui/LiveRegion";

const STORAGE_KEY = "sc_cart";
const MAX_QUANTITY = 99;

export interface CartLine {
  id: string;
  kind: "product" | "sampler";
  productIds: number[];
  quantity: number;
}

interface CartValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  addProduct: (productId: number, quantity?: number) => void;
  addSampler: (productIds: number[]) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  open: () => void;
  close: () => void;
}

const CartContext = createContext<CartValue | null>(null);

function priceOf(line: CartLine) {
  const each = line.productIds.reduce((sum, id) => sum + (getProductById(id, "en")?.price ?? 0), 0);
  return each * line.quantity;
}

// reads the saved cart and drops anything that is not valid, so a broken value never crashes the app
function loadLines(): CartLine[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(
      (line): line is CartLine =>
        typeof line?.id === "string" &&
        (line.kind === "product" || line.kind === "sampler") &&
        Array.isArray(line.productIds) &&
        line.productIds.length > 0 &&
        line.productIds.every((id: unknown) => typeof id === "number" && getProductById(id, "en")) &&
        Number.isInteger(line.quantity) &&
        line.quantity >= 1 &&
        line.quantity <= MAX_QUANTITY,
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { lang, t } = useLang();
  const announce = useAnnounce();
  const [lines, setLines] = useState<CartLine[]>(loadLines);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // the cart still works for this visit if saving is blocked
    }
  }, [lines]);

  function addLine(next: CartLine, name: string) {
    setLines((current) => {
      const existing = current.find((line) => line.id === next.id);
      if (!existing) return [...current, next];
      return current.map((line) =>
        line.id === next.id ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + next.quantity) } : line,
      );
    });
    setIsOpen(true);
    announce(t("cart.added", { name }));
  }

  const value: CartValue = {
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => sum + priceOf(line), 0),
    isOpen,
    addProduct: (productId, quantity = 1) => {
      const product = getProductById(productId, lang);
      if (!product) return;
      addLine({ id: `p-${productId}`, kind: "product", productIds: [productId], quantity }, product.name);
    },
    addSampler: (productIds) => {
      const sorted = [...productIds].sort((a, b) => a - b);
      addLine({ id: `s-${sorted.join("-")}`, kind: "sampler", productIds: sorted, quantity: 1 }, t("sampler.cartName"));
    },
    setQuantity: (lineId, quantity) => {
      const safe = Math.min(MAX_QUANTITY, Math.max(1, quantity));
      setLines((current) => current.map((line) => (line.id === lineId ? { ...line, quantity: safe } : line)));
    },
    removeLine: (lineId) => {
      setLines((current) => current.filter((line) => line.id !== lineId));
      announce(t("cart.removed"));
    },
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export function linePrice(line: CartLine) {
  return priceOf(line);
}
