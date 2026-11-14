// The cart as a dialog that slides in from the right: lines, quantities, subtotal and checkout note.
import { useState } from "react";
import { getProductById } from "../../data/products";
import { formatPrice } from "../../i18n/format";
import { useLang } from "../../i18n/LanguageContext";
import Drawer from "../../ui/Drawer";
import LocaleLink from "../../ui/LocaleLink";
import QuantityStepper from "../../ui/QuantityStepper";
import { lineLimit, linePrice, useCart, type CartLine } from "./CartContext";

export default function CartDrawer() {
  const { t, lang } = useLang();
  const { lines, subtotal, isOpen, close, setQuantity, removeLine } = useCart();
  const [showCheckoutNote, setShowCheckoutNote] = useState(false);

  function describe(line: CartLine) {
    const products = line.productIds.map((id) => getProductById(id, lang)).filter((p) => p !== undefined);
    if (line.kind === "sampler") {
      return { name: t("sampler.cartName"), detail: products.map((p) => p.name).join(", ") };
    }
    return { name: products[0]?.name ?? "", detail: products[0]?.caption ?? "" };
  }

  return (
    <Drawer open={isOpen} onClose={close} title={t("cart.title")}>
      <div className="flex-1 px-6 py-4">
        {lines.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="font-spectral text-sm text-paper-text/70">{t("cart.empty")}</p>
            <LocaleLink
              to="/shop"
              onClick={close}
              className="mt-4 inline-flex min-h-11 items-center font-sans text-sm underline underline-offset-4"
            >
              {t("cart.browse")}
            </LocaleLink>
          </div>
        ) : (
          <ul className="space-y-4">
            {lines.map((line) => {
              const { name, detail } = describe(line);
              return (
                <li key={line.id} className="border-b border-paper-text/20 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-spectral text-sm font-semibold">{name}</p>
                      <p className="mt-0.5 font-sans text-xs text-paper-text/70">{detail}</p>
                    </div>
                    <p className="shrink-0 font-sans text-sm font-medium text-sun-gold">
                      {formatPrice(linePrice(line), lang)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <QuantityStepper
                      tone="dark"
                      value={line.quantity}
                      onChange={(quantity) => setQuantity(line.id, quantity)}
                      max={lineLimit(line)}
                      decreaseLabel={t("cart.decrease", { name })}
                      increaseLabel={t("cart.increase", { name })}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      aria-label={t("cart.removeItem", { name })}
                      className="min-h-11 px-2 font-sans text-xs underline underline-offset-4 text-paper-text/70 hover:text-paper-text"
                    >
                      {t("cart.remove")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {lines.length > 0 && (
        <div className="border-t border-paper-text/20 px-6 py-6">
          <div className="mb-4 flex justify-between">
            <span className="font-sans text-xs text-paper-text/70">{t("cart.subtotal")}</span>
            <span className="font-sans text-lg font-medium text-sun-gold">{formatPrice(subtotal, lang)}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowCheckoutNote(true)}
            className="min-h-11 w-full bg-sun-gold py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90"
          >
            {t("cart.checkout")}
          </button>
          <p role="status" className="mt-3 text-center font-sans text-xs text-paper-text/70">
            {showCheckoutNote ? t("cart.checkoutNote") : t("cart.shippingNote")}
          </p>
        </div>
      )}
    </Drawer>
  );
}
