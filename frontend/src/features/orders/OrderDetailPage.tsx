// One order of a signed in person: what was bought, where it goes, how it was paid and how far along it is. Right after a
// purchase the page says thank you. An order that nobody started to pack can be cancelled (after asking).
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router";
import { cancelOrder, fetchOrder, orderStatuses, type Order } from "../../api/orders";
import { formatDate, formatPrice } from "../../i18n/format";
import { useLang } from "../../i18n/LanguageContext";
import { ApiError } from "../../lib/apiFetch";
import { usePageTitle } from "../../lib/usePageTitle";
import { CheckIcon } from "../../ui/Icons";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import PageLoading from "../../ui/PageLoading";
import OrderStatusBadge from "./components/OrderStatusBadge";

type Load = { status: "loading" } | { status: "failed" } | { status: "missing" } | { status: "ready"; order: Order };

export default function OrderDetailPage() {
  const { id = "" } = useParams();
  const { t, lang } = useLang();
  const announce = useAnnounce();
  const location = useLocation();
  usePageTitle(t("titles.order"));

  // the checkout sends the person here with this note, only once
  const justPlaced = (location.state as { placed?: boolean } | null)?.placed === true;

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoad((current) => (current.status === "ready" ? current : { status: "loading" }));
    fetchOrder(id, { lang, signal: controller.signal })
      .then((order) => setLoad({ status: "ready", order }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoad(error instanceof ApiError && (error.status === 404 || error.status === 400) ? { status: "missing" } : { status: "failed" });
      });
    return () => controller.abort();
  }, [id, lang, attempt]);

  // after a purchase the keyboard and the screen reader start at the thank you
  useEffect(() => {
    if (justPlaced && load.status === "ready") headingRef.current?.focus();
  }, [justPlaced, load.status]);

  async function cancel() {
    setCancelling(true);
    setProblem("");
    try {
      const order = await cancelOrder(id, { lang });
      setLoad({ status: "ready", order });
      setAsking(false);
      announce(t("orders.detail.cancelled"));
    } catch {
      setProblem(t("orders.detail.cancelError"));
      setAsking(false);
      // the order may have moved on in the meantime
      setAttempt((count) => count + 1);
    } finally {
      setCancelling(false);
    }
  }

  if (load.status === "loading") return <PageLoading label={t("orders.detail.loading")} />;

  if (load.status === "failed" || load.status === "missing") {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 bg-stone-paper px-4 text-center">
        <p role="alert" className="font-spectral text-xl text-ink-cacao">
          {load.status === "missing" ? t("orders.detail.notFound") : t("orders.detail.loadError")}
        </p>
        {load.status === "failed" && (
          <button type="button" onClick={() => setAttempt((count) => count + 1)} className="min-h-11 border border-ink-cacao px-5 font-sans text-sm text-ink-cacao hover:bg-ink-cacao hover:text-stone-paper">
            {t("common.retry")}
          </button>
        )}
        <LocaleLink to="/account/orders" className="inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
          {t("orders.detail.back")}
        </LocaleLink>
      </div>
    );
  }

  const { order } = load;
  const address = order.shippingAddress;
  const brand = t(`orders.brands.${["visa", "mastercard", "amex", "discover"].includes(order.payment.brand) ? (order.payment.brand as "visa") : "card"}`);
  // the steps of an order that went the whole way, with the time of each one that happened
  const steps = order.status === "cancelled" ? order.history.map((entry) => entry.status) : orderStatuses.filter((status) => status !== "cancelled");
  const reached = new Map(order.history.map((entry) => [entry.status, entry.at]));

  const dl = "grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 font-sans text-sm text-ink-cacao";

  return (
    <div className="bg-stone-paper">
      <div className="border-b border-ink-cacao">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
          <p className="mb-3 font-sans text-[11px] uppercase tracking-[0.18em] text-pod-wine">{t("orders.detail.eyebrow")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <h1 ref={headingRef} tabIndex={-1} className="font-spectral text-4xl font-semibold tracking-tight text-ink-cacao md:text-5xl">
              {order.number}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-3 font-sans text-sm text-ink-cacao/70">{t("orders.placedOn", { date: formatDate(order.createdAt, lang) })}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
        <LocaleLink to="/account/orders" className="mb-8 inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
          {t("orders.detail.back")}
        </LocaleLink>

        {justPlaced && (
          <div role="status" className="mb-8 flex gap-3 border-l-4 border-canopy-green bg-clay-surface px-4 py-4 text-ink-cacao">
            <CheckIcon size={20} className="mt-0.5 shrink-0 text-canopy-green" />
            <div>
              <p className="font-spectral text-lg font-semibold">{t("orders.detail.placedTitle")}</p>
              <p className="mt-1 font-sans text-sm">{t("orders.detail.placedBody")}</p>
            </div>
          </div>
        )}

        {problem && (
          <div role="alert" className="mb-8 border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
            {problem}
          </div>
        )}

        <div className="grid gap-12 md:grid-cols-[3fr_2fr]">
          <section aria-labelledby="order-items">
            <h2 id="order-items" className="mb-4 border-b border-ink-cacao pb-3 font-spectral text-2xl font-semibold text-ink-cacao">
              {t("orders.detail.items")}
            </h2>
            <ul className="divide-y divide-ink-cacao/15">
              {order.lines.map((line, index) => (
                <li key={index} className="flex gap-4 py-4">
                  {line.products[0]?.thumbnail && <img src={line.products[0].thumbnail} alt="" width={64} height={80} loading="lazy" className="h-20 w-16 shrink-0 object-cover" />}
                  <div className="min-w-0 flex-1">
                    {line.kind === "sampler" ? (
                      <>
                        <p className="font-spectral text-lg font-semibold text-ink-cacao">{t("orders.sampler")}</p>
                        <p className="mt-0.5 font-sans text-xs text-ink-cacao/70">{line.products.map((product) => product.name).join(", ")}</p>
                      </>
                    ) : (
                      <LocaleLink to={`/shop/${line.products[0].slug}`} className="font-spectral text-lg font-semibold text-ink-cacao underline-offset-4 hover:text-pod-wine hover:underline">
                        {line.products[0].name}
                      </LocaleLink>
                    )}
                    <p className="mt-1 font-sans text-xs text-ink-cacao/70">
                      {t("orders.detail.quantity", { count: line.quantity })} · {t("orders.detail.each", { price: formatPrice(line.unitPrice, lang) })}
                    </p>
                  </div>
                  <p className="shrink-0 font-sans text-sm font-medium text-ink-cacao">{formatPrice(line.lineTotal, lang)}</p>
                </li>
              ))}
            </ul>

            <h2 className="mb-4 mt-12 border-b border-ink-cacao pb-3 font-spectral text-2xl font-semibold text-ink-cacao">{t("orders.detail.progress")}</h2>
            <ol className="space-y-3">
              {steps.map((status) => {
                const at = reached.get(status);
                return (
                  <li key={status} className={`flex items-center gap-3 font-sans text-sm ${at ? "text-ink-cacao" : "text-ink-cacao/60"}`}>
                    <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full border ${at ? (status === "cancelled" ? "border-pod-wine bg-pod-wine text-paper-text" : "border-canopy-green bg-canopy-green text-paper-text") : "border-ink-cacao/40"}`}>
                      {at && <CheckIcon size={12} />}
                    </span>
                    <span className={at ? "font-medium" : ""}>{t(`orders.status.${status}`)}</span>
                    {at && <span className="text-ink-cacao/70">{formatDate(at, lang)}</span>}
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="space-y-10">
            <section aria-labelledby="order-summary" className="border border-ink-cacao bg-clay-surface p-6">
              <h2 id="order-summary" className="mb-4 border-b border-ink-cacao pb-3 font-spectral text-xl font-semibold text-ink-cacao">
                {t("orders.detail.summary")}
              </h2>
              <dl className="space-y-2 font-sans text-sm text-ink-cacao">
                <div className="flex justify-between">
                  <dt>{t("orders.detail.subtotal")}</dt>
                  <dd>{formatPrice(order.totals.subtotal, lang)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t("orders.detail.shipping")}</dt>
                  <dd>{order.totals.shipping === 0 ? t("orders.detail.free") : formatPrice(order.totals.shipping, lang)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t("orders.detail.tax")}</dt>
                  <dd>{formatPrice(order.totals.tax, lang)}</dd>
                </div>
                <div className="flex justify-between border-t border-ink-cacao/30 pt-3 text-base font-semibold">
                  <dt>{t("orders.detail.total")}</dt>
                  <dd>{formatPrice(order.totals.total, lang)}</dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="order-shipping">
              <h2 id="order-shipping" className="mb-3 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
                {t("orders.detail.shippingTo")}
              </h2>
              <address className="font-sans text-sm not-italic leading-relaxed text-ink-cacao">
                {address.fullName}
                <br />
                {address.street}
                {address.street2 ? `, ${address.street2}` : ""}
                <br />
                {address.city}, {address.state} {address.postalCode}
                <br />
                {address.country}
              </address>
              <p className="mt-3 font-sans text-sm text-ink-cacao/80">{t(`orders.detail.${order.shippingMethod}`)}</p>
            </section>

            <section aria-labelledby="order-payment">
              <h2 id="order-payment" className="mb-3 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
                {t("orders.detail.payment")}
              </h2>
              <dl className={dl}>
                <dt className="text-ink-cacao/70">{t("orders.detail.payment")}</dt>
                <dd>{t("orders.detail.paidWith", { brand, last4: order.payment.last4 })}</dd>
                <dt className="sr-only">{t("orders.detail.payment")}</dt>
                <dd className="col-span-2 text-ink-cacao/70">{order.payment.status === "refunded" ? t("orders.detail.refunded") : t("orders.detail.paid")}</dd>
              </dl>
            </section>

            {order.note && (
              <section aria-labelledby="order-note">
                <h2 id="order-note" className="mb-3 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
                  {t("orders.detail.note")}
                </h2>
                <p className="font-sans text-sm text-ink-cacao">{order.note}</p>
              </section>
            )}

            {order.canCancel &&
              (asking ? (
                <div role="group" aria-label={t("orders.detail.cancel")} className="border border-pod-wine p-4">
                  <p className="font-sans text-sm text-ink-cacao">{t("orders.detail.cancelAsk")}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button type="button" onClick={() => void cancel()} disabled={cancelling} className="min-h-11 bg-pod-wine px-4 py-2 font-sans text-xs font-medium text-paper-text hover:bg-ink-cacao disabled:opacity-60">
                      {t("orders.detail.cancelYes")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAsking(false);
                        requestAnimationFrame(() => cancelButton.current?.focus());
                      }}
                      className="min-h-11 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-clay-surface"
                    >
                      {t("orders.detail.cancelNo")}
                    </button>
                  </div>
                </div>
              ) : (
                <button ref={cancelButton} type="button" onClick={() => setAsking(true)} className="min-h-11 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-clay-surface">
                  {t("orders.detail.cancel")}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
