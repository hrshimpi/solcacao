// The cart. The rules, which the client cannot change:
//   - the price of a line is the price of the product when it was added, and stays
//   - a line can only have as many units as there are in stock, counting what the other lines take of the same product
//   - a cart has at most 30 lines and a line at most 99 units
//   - a sampler is 4 to 6 different products, and one unit of it takes one of each
//   - two changes made at the same moment are both kept (see the cart store), or one is asked to try again
//   - after a sign in the cart of the visitor is added to the cart of the user, and no line is lost
import { createHash } from "node:crypto";
import { AppError } from "../errors/AppError.ts";
import type { Lang } from "../middleware/language.ts";
import { localize } from "../middleware/language.ts";
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "../models/cart.model.ts";
import type { AddItemInput } from "../schemas/cart.schema.ts";
import type { CartOwner, CartStore, StoredCart, StoredCartLine } from "./cart.store.ts";
import type { ProductStore, StoredProduct } from "./product.store.ts";
import { availabilityOf, type Availability } from "./stock.ts";

export const GUEST_CART_DAYS = 30;

// what is wrong with a line, when something is
export type LineIssue = "unavailable" | "out_of_stock" | "over_stock";

export interface CartLineView {
  lineId: string;
  kind: "product" | "sampler";
  quantity: number;
  // whole cents for one unit, the price of when it was added
  unitPrice: number;
  lineTotal: number;
  // the most units this line can have right now
  available: number;
  issue: LineIssue | null;
  // the price of the products today is not the price that was locked
  priceChanged: boolean;
  products: { id: string; slug: string; name: string; thumbnail: string; imageAlt: string; price: number; stock: number; availability: Availability }[];
}

export interface CartView {
  lines: CartLineView[];
  // the number of units in the cart
  itemCount: number;
  // whole cents, at the locked prices
  subtotal: number;
  updatedAt: string | null;
}

export interface CartServiceDeps {
  carts: CartStore;
  products: ProductStore;
  now?: () => Date;
}

type ProductMap = Map<string, StoredProduct>;

const isGuest = (owner: CartOwner): owner is { guestId: string } => "guestId" in owner;

// the same things always make the same id, so adding a product twice is one line
export function lineIdFor(kind: "product" | "sampler", productIds: string[]): string {
  const ids = [...productIds].map((id) => id.toLowerCase()).sort();
  if (kind === "product") return `p-${ids[0]}`;
  return `s-${createHash("sha1").update(ids.join(",")).digest("hex").slice(0, 20)}`;
}

const notInCart = () => new AppError("NOT_FOUND", 404, "That item isn't in your cart.");
const noSuchProduct = () => new AppError("NOT_FOUND", 404, "That product wasn't found.");

export function createCartService({ carts, products, now = () => new Date() }: CartServiceDeps) {
  async function load(ids: string[]): Promise<ProductMap> {
    const found = await products.findByIds([...new Set(ids)], { includeInactive: true });
    return new Map(found.map((product) => [product.id, product]));
  }

  // how many units this line can have: for each product of the line, its stock minus what the other lines take of it
  function limitOf(line: StoredCartLine, lines: StoredCartLine[], known: ProductMap): { available: number; limiting?: StoredProduct } {
    let available = MAX_LINE_QUANTITY;
    let limiting: StoredProduct | undefined;

    for (const id of line.productIds) {
      const product = known.get(id);
      if (!product || !product.active) return { available: 0, limiting: product };
      const takenByOthers = lines.filter((other) => other.lineId !== line.lineId && other.productIds.includes(id)).reduce((sum, other) => sum + other.quantity, 0);
      const left = Math.max(0, product.quantity - takenByOthers);
      if (left < available) {
        available = left;
        limiting = product;
      }
    }
    return { available, limiting };
  }

  async function view(cart: StoredCart | null, lang: Lang): Promise<CartView> {
    const lines = cart?.lines ?? [];
    const known = await load(lines.flatMap((line) => line.productIds));

    const views = lines.map((line): CartLineView => {
      const items = line.productIds.map((id) => known.get(id)).filter((product): product is StoredProduct => product !== undefined);
      const { available } = limitOf(line, lines, known);
      const unavailable = items.length < line.productIds.length || items.some((product) => !product.active);
      const sold = items.some((product) => product.quantity <= 0);

      return {
        lineId: line.lineId,
        kind: line.kind,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.unitPrice * line.quantity,
        available,
        issue: unavailable ? "unavailable" : sold ? "out_of_stock" : line.quantity > available ? "over_stock" : null,
        priceChanged: !unavailable && items.reduce((sum, product) => sum + product.price, 0) !== line.unitPrice,
        products: items.map((product) => ({
          id: product.id,
          slug: product.slug,
          name: localize(product.name, lang),
          thumbnail: product.thumbnail,
          imageAlt: localize(product.imageAlt, lang),
          price: product.price,
          stock: product.quantity,
          availability: availabilityOf(product.quantity, product.lowStockThreshold),
        })),
      };
    });

    return {
      lines: views,
      itemCount: views.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: views.reduce((sum, line) => sum + line.lineTotal, 0),
      updatedAt: cart?.updatedAt ?? null,
    };
  }

  // reads the cart, lets the change make the new lines, and saves them. When somebody changed the cart in between,
  // it starts again from what they saved, so no change is lost.
  async function mutate(owner: CartOwner, change: (lines: StoredCartLine[]) => Promise<StoredCartLine[]>): Promise<StoredCart> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await carts.find(owner);
      const lines = await change(structuredClone(current?.lines ?? []));
      const expiresAt = isGuest(owner) ? new Date(now().getTime() + GUEST_CART_DAYS * 24 * 60 * 60 * 1000) : undefined;
      const saved = await carts.save(owner, lines, current ? current.version : null, expiresAt);
      if (saved) return saved;
    }
    throw new AppError("CART_BUSY", 409, "Your cart was changed at the same time. Please try again.");
  }

  // refuses a quantity that the stock cannot cover, and says how many there can be
  function checkStock(line: StoredCartLine, lines: StoredCartLine[], known: ProductMap, lang: Lang) {
    const { available, limiting } = limitOf(line, lines, known);
    if (line.quantity <= available) return;

    const name = limiting ? localize(limiting.name, lang) : "That";
    const message = available <= 0 ? `${name} is sold out.` : `Only ${available} left of ${name}.`;
    throw new AppError("INSUFFICIENT_STOCK", 409, message, [{ field: "quantity", available, message }]);
  }

  return {
    async get(owner: CartOwner | null, lang: Lang): Promise<CartView> {
      return view(owner ? await carts.find(owner) : null, lang);
    },

    async addItem(owner: CartOwner, input: AddItemInput, lang: Lang): Promise<CartView> {
      const ids = input.kind === "product" ? [input.productId] : input.productIds;
      const known = await load(ids);
      const chosen = ids.map((id) => known.get(id));
      if (chosen.some((product) => !product || !product.active)) throw noSuchProduct();
      const unitPrice = (chosen as StoredProduct[]).reduce((sum, product) => sum + product.price, 0);
      const lineId = lineIdFor(input.kind, ids);

      const saved = await mutate(owner, async (lines) => {
        const index = lines.findIndex((line) => line.lineId === lineId);
        if (index < 0 && lines.length >= MAX_CART_LINES) {
          throw new AppError("CART_FULL", 409, `Your cart can have up to ${MAX_CART_LINES} different items.`);
        }

        // the price stays what it was when the line was made, and only the quantity grows
        const next: StoredCartLine = index >= 0 ? lines[index] : { lineId, kind: input.kind, productIds: [...ids].sort(), quantity: 0, unitPrice };
        next.quantity += input.quantity;
        const updated = index >= 0 ? lines : [...lines, next];

        // the stock is read again each time, so a retry sees what the other change did
        checkStock(next, updated, await load(updated.flatMap((line) => line.productIds)), lang);
        return updated;
      });
      return view(saved, lang);
    },

    async setQuantity(owner: CartOwner, lineId: string, quantity: number, lang: Lang): Promise<CartView> {
      const saved = await mutate(owner, async (lines) => {
        const line = lines.find((entry) => entry.lineId === lineId);
        if (!line) throw notInCart();

        line.quantity = quantity;
        checkStock(line, lines, await load(lines.flatMap((entry) => entry.productIds)), lang);
        return lines;
      });
      return view(saved, lang);
    },

    async removeItem(owner: CartOwner, lineId: string, lang: Lang): Promise<CartView> {
      const saved = await mutate(owner, async (lines) => {
        if (!lines.some((line) => line.lineId === lineId)) throw notInCart();
        return lines.filter((line) => line.lineId !== lineId);
      });
      return view(saved, lang);
    },

    async clear(owner: CartOwner, lang: Lang): Promise<CartView> {
      await carts.remove(owner);
      return view(null, lang);
    },

    // Adds the cart of a visitor to the cart of the user: the quantities of the same item are added and the prices
    // already in the user's cart stay. No line is lost. A line that the stock cannot cover is kept with the units
    // there are (at least one, so a sold out line stays in the cart, marked as sold out). Then the visitor's cart is removed.
    async merge(userId: string, guestId: string, lang: Lang): Promise<CartView> {
      const guest = await carts.find({ guestId });
      const owner = { userId };
      if (!guest || guest.lines.length === 0) {
        await carts.remove({ guestId });
        return view(await carts.find(owner), lang);
      }

      const saved = await mutate(owner, async (lines) => {
        for (const incoming of guest.lines) {
          const existing = lines.find((line) => line.lineId === incoming.lineId);
          if (existing) existing.quantity = Math.min(MAX_LINE_QUANTITY, existing.quantity + incoming.quantity);
          else if (lines.length < MAX_CART_LINES) lines.push({ ...incoming });
        }

        const known = await load(lines.flatMap((line) => line.productIds));
        for (const line of lines) {
          const { available } = limitOf(line, lines, known);
          line.quantity = Math.max(1, Math.min(line.quantity, available));
        }
        return lines;
      });

      await carts.remove({ guestId });
      return view(saved, lang);
    },
  };
}

export type CartService = ReturnType<typeof createCartService>;
