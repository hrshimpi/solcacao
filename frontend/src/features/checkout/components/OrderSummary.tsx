// The order summary beside the checkout: what is in the cart, what it costs, and the button that places the order.
// The numbers are the ones of the server. The shipping depends on the choice of the person, so it is picked from the options.
import type { Checkout, ShippingMethod } from "../../../api/orders";
import { formatPrice } from "../../../i18n/format";
import { useLang } from "../../../i18n/LanguageContext";
import LocaleLink from "../../../ui/LocaleLink";
import { useCart } from "../../cart/CartContext";

interface OrderSummaryProps {
  checkout: Checkout;
  shipping: ShippingMethod;
  busy: boolean;
}

export default function OrderSummary({ checkout, shipping, busy }: OrderSummaryProps) {
  const { t, lang } = useLang();
  const cart = useCart();

  const { subtotal } = checkout.cart;
  const shippingPrice = checkout.shippingOptions.find((option) => option.id === shipping)?.price ?? 0;
  // whole cents, so that adding dollars never shows a cent too many
  const total = Math.round((subtotal + shippingPrice + checkout.tax) * 100) / 100;
  const count = checkout.cart.itemCount;

  return (
    <aside aria-labelledby="checkout-summary" className="border border-ink-cacao bg-clay-surface p-6 lg:sticky lg:top-20 lg:self-start">
      <div className="flex items-baseline justify-between gap-4 border-b border-ink-cacao pb-3">
        <h2 id="checkout-summary" className="font-spectral text-2xl font-semibold text-ink-cacao">
          {t("checkout.summary.title")}
        </h2>
        <span className="font-sans text-xs text-ink-cacao/70">{t("checkout.summary.items", { count })}</span>
      </div>

      <ul className="divide-y divide-ink-cacao/15">
        {checkout.cart.lines.map((line) => {
          const name = line.kind === "sampler" ? t("sampler.cartName") : (line.products[0]?.name ?? "");
          const detail = line.kind === "sampler" ? line.products.map((product) => product.name).join(", ") : "";
          return (
            <li key={line.id} className="flex gap-3 py-3">
              {line.products[0]?.thumbnail && <img src={line.products[0].thumbnail} alt="" width={56} height={70} loading="lazy" className="h-[70px] w-14 shrink-0 object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="font-spectral text-base font-semibold text-ink-cacao">{name}</p>
                {detail && <p className="mt-0.5 font-sans text-xs text-ink-cacao/70">{detail}</p>}
                <p className="mt-1 font-sans text-xs text-ink-cacao/70">{t("orders.detail.quantity", { count: line.quantity })}</p>
                {line.issue && line.issue !== "over_stock" && <p className="mt-1 font-sans text-xs font-medium text-pod-wine">{t(`cart.issue.${line.issue}`)}</p>}
              </div>
              <p className="shrink-0 font-sans text-sm font-medium text-ink-cacao">{formatPrice(line.lineTotal, lang)}</p>
            </li>
          );
        })}
      </ul>

      <dl className="space-y-2 border-t border-ink-cacao pt-4 font-sans text-sm text-ink-cacao">
        <div className="flex justify-between">
          <dt>{t("checkout.summary.subtotal")}</dt>
          <dd>{formatPrice(subtotal, lang)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{t("checkout.summary.shipping")}</dt>
          <dd>{shippingPrice === 0 ? t("checkout.summary.free") : formatPrice(shippingPrice, lang)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{t("checkout.summary.tax")}</dt>
          <dd>{formatPrice(checkout.tax, lang)}</dd>
        </div>
        <div className="flex justify-between border-t border-ink-cacao/30 pt-3 text-base font-semibold">
          <dt>{t("checkout.summary.total")}</dt>
          <dd>{formatPrice(total, lang)}</dd>
        </div>
      </dl>

      {!checkout.ready && (
        <div role="alert" className="mt-5 border-l-4 border-pod-wine bg-stone-paper px-4 py-3 font-sans text-xs text-ink-cacao">
          <p>{t("checkout.summary.problem")}</p>
          <button type="button" onClick={cart.open} className="mt-2 min-h-11 underline underline-offset-4 hover:text-pod-wine">
            {t("checkout.summary.change")}
          </button>
        </div>
      )}

      <button
        type="submit"
        form="checkout-form"
        disabled={busy || !checkout.ready}
        className="mt-6 min-h-12 w-full bg-sun-gold py-3.5 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? t("checkout.placing") : `${t("checkout.place")} · ${formatPrice(total, lang)}`}
      </button>
      <p className="mt-3 text-center font-sans text-xs text-ink-cacao/70">{t("checkout.terms")}</p>
      <LocaleLink to="/shop" className="mt-2 flex min-h-11 items-center justify-center font-sans text-xs text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
        {t("checkout.emptyLink")}
      </LocaleLink>
    </aside>
  );
}
