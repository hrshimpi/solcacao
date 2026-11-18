// The cart of the whole app. It lives on the server (see api/cart.ts): for a signed in person it belongs to the account, for a
// visitor to a cookie, and after a sign in the cart of the visitor is added to the cart of the person. This file asks for the
// cart, keeps the last answer, and changes it one change at a time, so quick clicks reach the server in the order they were made.
// The server decides what the stock allows, and when it says no, the page says how many there are and adds what fits.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addToCart, emptyCart, fetchCart, mergeCart, removeLine as removeLineCall, setLineQuantity, type Cart, type CartLine } from "../../api/cart";
import { useLang } from "../../i18n/LanguageContext";
import { ApiError } from "../../lib/apiFetch";
import { useAnnounce } from "../../ui/LiveRegion";
import { useAuth } from "../auth/AuthContext";
import { useProducts } from "../catalog/ProductsContext";

export type { CartLine } from "../../api/cart";

export type CartStatus = "loading" | "ready" | "failed";

interface CartValue {
  status: CartStatus;
  lines: CartLine[];
  // the number of units in the cart
  count: number;
  // in dollars
  subtotal: number;
  // the last change did not work, and why (the cart is as it was)
  problem: "network" | "unknown" | null;
  // a change is on its way to the server
  busy: boolean;
  isOpen: boolean;
  addProduct: (productId: string, quantity?: number) => Promise<void>;
  addSampler: (productIds: string[]) => Promise<void>;
  setQuantity: (lineId: string, quantity: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  // asks for the cart again, after it could not be loaded
  retry: () => void;
  open: () => void;
  close: () => void;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { lang, t } = useLang();
  const announce = useAnnounce();
  const { status: authStatus, user, signInCount } = useAuth();
  const { byId } = useProducts();
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [status, setStatus] = useState<CartStatus>("loading");
  const [problem, setProblem] = useState<CartValue["problem"]>(null);
  const [pending, setPending] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // what the changes below need to know without starting again when it changes
  const latest = useRef({ lang, t, announce, byId, cart });
  latest.current = { lang, t, announce, byId, cart };
  // the changes wait for each other
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // the sign in that the cart of the visitor was added for
  const mergedFor = useRef(0);

  const userId = user?.id;

  // the cart of whoever is here: read when the page opens, and again when the language changes (the names are in it),
  // when somebody signs in or out, or after a failure. A sign in adds the cart of the visitor to the one of the person.
  useEffect(() => {
    // who is here is not known yet, and the request would go out without the token of a signed in person
    if (authStatus === "loading") return;

    const controller = new AbortController();
    const merging = signInCount > mergedFor.current && userId !== undefined;
    setStatus((current) => (current === "ready" ? current : "loading"));

    (merging ? mergeCart({ lang }) : fetchCart({ lang, signal: controller.signal }))
      .then((next) => {
        if (merging) mergedFor.current = signInCount;
        setCart(next);
        setStatus("ready");
        setProblem(null);
        void lowerWhatIsTooMuch(next);
      })
      .catch(() => {
        // a cancelled request is not a failure, a newer one is already on its way
        if (!controller.signal.aborted) setStatus("failed");
      });

    return () => controller.abort();
  }, [authStatus, userId, signInCount, lang, attempt]);

  // runs one change after the ones before it, and says that it is busy meanwhile
  const enqueue = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    setPending((count) => count + 1);
    const run = queue.current.then(job, job);
    queue.current = run.catch(() => undefined);
    return run.finally(() => setPending((count) => count - 1));
  }, []);

  const apply = useCallback((next: Cart) => {
    latest.current.cart = next;
    setCart(next);
    setStatus("ready");
    setProblem(null);
  }, []);

  // a change that could not be made, for a reason that is not about the stock: the cart is as it was
  const fail = useCallback((error: unknown) => {
    const kind = error instanceof ApiError && error.status === 0 ? "network" : "unknown";
    setProblem(kind);
    latest.current.announce(latest.current.t(`cart.errors.${kind}`));
  }, []);

  const nameOf = (line: CartLine | undefined) => (line?.kind === "sampler" ? latest.current.t("sampler.cartName") : (line?.products[0]?.name ?? ""));

  // after the stock fell below what is in the cart, the quantity is lowered to what there is, and the person is told
  async function lowerWhatIsTooMuch(next: Cart) {
    for (const line of next.lines) {
      if (line.issue !== "over_stock" || line.available < 1) continue;
      await enqueue(async () => {
        try {
          apply(await setLineQuantity(line.id, line.available, { lang: latest.current.lang }));
          latest.current.announce(latest.current.t("stock.limited", { count: line.available, name: nameOf(line) }));
        } catch (error) {
          fail(error);
        }
      });
    }
  }

  const addProduct = useCallback(
    (productId: string, quantity = 1) =>
      enqueue(async () => {
        const { lang: language, t: translate, announce: say, byId: product } = latest.current;
        const name = product(productId)?.name ?? "";
        try {
          apply(await addToCart({ kind: "product", productId, quantity }, { lang: language }));
          setIsOpen(true);
          say(translate("cart.added", { name }));
        } catch (error) {
          if (!(error instanceof ApiError && error.code === "INSUFFICIENT_STOCK")) return fail(error);

          // the server says how many the line can have: what fits is added, and the person is told
          const available = error.details[0]?.available ?? 0;
          const already = latest.current.cart.lines.find((line) => line.id === `p-${productId}`)?.quantity ?? 0;
          const fits = available - already;
          if (fits < 1) {
            say(available <= 0 ? translate("stock.soldOutNamed", { name }) : translate("stock.limited", { count: available, name }));
            return;
          }
          try {
            apply(await addToCart({ kind: "product", productId, quantity: fits }, { lang: language }));
            setIsOpen(true);
            say(translate("stock.limited", { count: available, name }));
          } catch (second) {
            fail(second);
          }
        }
      }),
    [enqueue, apply, fail],
  );

  const addSampler = useCallback(
    (productIds: string[]) =>
      enqueue(async () => {
        const { lang: language, t: translate, announce: say } = latest.current;
        try {
          apply(await addToCart({ kind: "sampler", productIds }, { lang: language }));
          setIsOpen(true);
          say(translate("cart.added", { name: translate("sampler.cartName") }));
        } catch (error) {
          if (error instanceof ApiError && error.code === "INSUFFICIENT_STOCK") {
            const available = error.details[0]?.available ?? 0;
            const name = translate("sampler.cartName");
            say(available <= 0 ? translate("stock.soldOutNamed", { name }) : translate("stock.limited", { count: available, name }));
            return;
          }
          fail(error);
        }
      }),
    [enqueue, apply, fail],
  );

  const setQuantity = useCallback(
    (lineId: string, quantity: number) =>
      enqueue(async () => {
        const { lang: language, t: translate, announce: say } = latest.current;
        try {
          apply(await setLineQuantity(lineId, quantity, { lang: language }));
        } catch (error) {
          if (!(error instanceof ApiError && error.code === "INSUFFICIENT_STOCK")) return fail(error);

          // the most there can be is the quantity: the line is set to it
          const available = error.details[0]?.available ?? 0;
          const name = nameOf(latest.current.cart.lines.find((line) => line.id === lineId));
          if (available >= 1) {
            try {
              apply(await setLineQuantity(lineId, available, { lang: language }));
            } catch (second) {
              return fail(second);
            }
          }
          say(available <= 0 ? translate("stock.soldOutNamed", { name }) : translate("stock.limited", { count: available, name }));
        }
      }),
    [enqueue, apply, fail],
  );

  const removeLine = useCallback(
    (lineId: string) =>
      enqueue(async () => {
        try {
          apply(await removeLineCall(lineId, { lang: latest.current.lang }));
          latest.current.announce(latest.current.t("cart.removed"));
        } catch (error) {
          fail(error);
        }
      }),
    [enqueue, apply, fail],
  );

  const value = useMemo<CartValue>(
    () => ({
      status,
      lines: cart.lines,
      count: cart.itemCount,
      subtotal: cart.subtotal,
      problem,
      busy: pending > 0,
      isOpen,
      addProduct,
      addSampler,
      setQuantity,
      removeLine,
      retry: () => setAttempt((count) => count + 1),
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }),
    [status, cart, problem, pending, isOpen, addProduct, addSampler, setQuantity, removeLine],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
