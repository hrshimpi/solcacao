// The cart as a dialog that slides in from the right: lines, quantities, subtotal and checkout note.
// It shows what the server holds: a loading message while the cart is on its way, and a problem with a way to try again.
import { formatPrice } from "../../i18n/format";
import { useLang } from "../../i18n/LanguageContext";
import Drawer from "../../ui/Drawer";
import LocaleLink from "../../ui/LocaleLink";
import QuantityStepper from "../../ui/QuantityStepper";
import { useCart, type CartLine } from "./CartContext";

export default function CartDrawer() {
  const { t, lang } = useLang();
  const { status, lines, subtotal, problem, busy, isOpen, close, setQuantity, removeLine, retry } = useCart();

  function describe(line: CartLine) {
    if (line.kind === "sampler") {
      return { name: t("sampler.cartName"), detail: line.products.map((product) => product.name).join(", ") };
    }
    return { name: line.products[0]?.name ?? "", detail: "" };
  }

  return (
    <Drawer open={isOpen} onClose={close} title={t("cart.title")}>
      <div aria-busy={busy} className="flex-1 px-6 py-4">
        {problem && (
          <div role="alert" className="mb-4 border-l-4 border-sun-gold bg-paper-text/10 px-4 py-3 font-sans text-xs text-paper-text">
            {t(`cart.errors.${problem}`)}
          </div>
        )}

        {status === "loading" && lines.length === 0 && (
          <p role="status" className="mt-8 text-center font-spectral text-sm text-paper-text/70">
            {t("cart.loading")}
          </p>
        )}

        {status === "failed" && lines.length === 0 && (
          <div role="alert" className="mt-8 text-center">
            <p className="font-spectral text-sm text-paper-text/70">{t("cart.loadError")}</p>
            <button type="button" onClick={retry} className="mt-4 inline-flex min-h-11 items-center font-sans text-sm underline underline-offset-4">
              {t("common.retry")}
            </button>
          </div>
        )}

        {status === "ready" && lines.length === 0 && (
          <div className="mt-8 text-center">
            <p className="font-spectral text-sm text-paper-text/70">{t("cart.empty")}</p>
            <LocaleLink to="/shop" onClick={close} className="mt-4 inline-flex min-h-11 items-center font-sans text-sm underline underline-offset-4">
              {t("cart.browse")}
            </LocaleLink>
          </div>
        )}

        {lines.length > 0 && (
          <ul className="space-y-4">
            {lines.map((line) => {
              const { name, detail } = describe(line);
              // a line that cannot be bought: it can only be taken out
              const blockedIssue = line.issue === "out_of_stock" || line.issue === "unavailable" ? line.issue : null;
              const blocked = blockedIssue !== null;
              return (
                <li key={line.id} className="border-b border-paper-text/20 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-spectral text-sm font-semibold">{name}</p>
                      {detail && <p className="mt-0.5 font-sans text-xs text-paper-text/70">{detail}</p>}
                      {blockedIssue && <p className="mt-1 font-sans text-xs font-medium text-sun-gold">{t(`cart.issue.${blockedIssue}`)}</p>}
                    </div>
                    <p className="shrink-0 font-sans text-sm font-medium text-sun-gold">{formatPrice(line.lineTotal, lang)}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    {!blocked && (
                      <QuantityStepper
                        tone="dark"
                        value={line.quantity}
                        onChange={(quantity) => void setQuantity(line.id, quantity)}
                        max={Math.max(1, line.available)}
                        decreaseLabel={t("cart.decrease", { name })}
                        increaseLabel={t("cart.increase", { name })}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => void removeLine(line.id)}
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
          {/* a link, because it goes to another page. Somebody who is not signed in is sent to sign in, and then comes back */}
          <LocaleLink
            to="/checkout"
            onClick={close}
            className="flex min-h-11 w-full items-center justify-center bg-sun-gold py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90"
          >
            {t("cart.checkout")}
          </LocaleLink>
          <p className="mt-3 text-center font-sans text-xs text-paper-text/70">{t("cart.shippingNote")}</p>
        </div>
      )}
    </Drawer>
  );
}
