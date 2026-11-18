// One order for the team: what was bought, who bought it, where it goes, and the buttons that move it along. A button only
// shows the steps that the rules allow from the status of the order (the server decides, and answers 400 for anything else).
import { useState } from "react";
import { useParams } from "react-router";
import { fetchAdminOrder, setOrderStatus } from "../../api/admin";
import type { Order, OrderStatus } from "../../api/orders";
import { formatDate, formatPrice } from "../../i18n/format";
import { useLang } from "../../i18n/LanguageContext";
import { ApiError } from "../../lib/apiFetch";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import OrderStatusBadge from "../orders/components/OrderStatusBadge";
import { LoadState, useLoad } from "./useLoad";

const stepKeys = { processing: "admin.order.start", shipped: "admin.order.ship", delivered: "admin.order.deliver", cancelled: "admin.order.cancel" } as const;

function OrderView({ order, onChange }: { order: Order; onChange: (order: Order) => void }) {
  const { t, lang } = useLang();
  const announce = useAnnounce();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function move(status: OrderStatus) {
    setBusy(true);
    setProblem("");
    try {
      const changed = await setOrderStatus(order.id, status, { lang });
      onChange(changed);
      setAsking(false);
      announce(t("admin.order.moved", { status: t(`orders.status.${changed.status}`) }));
    } catch (error) {
      setProblem(error instanceof ApiError && error.status === 0 ? t("admin.loadError") : t("admin.order.moveError"));
      setAsking(false);
    } finally {
      setBusy(false);
    }
  }

  const address = order.shippingAddress;
  const forward = order.nextStatuses.filter((status) => status !== "cancelled");
  const canCancel = order.nextStatuses.includes("cancelled");

  return (
    <div>
      <LocaleLink to="/admin/orders" className="mb-8 inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
        {t("admin.order.back")}
      </LocaleLink>

      <div className="mb-10 flex flex-wrap items-center gap-4">
        <h2 className="font-spectral text-3xl font-semibold text-ink-cacao">{order.number}</h2>
        <OrderStatusBadge status={order.status} />
        <span className="font-sans text-sm text-ink-cacao/70">{formatDate(order.createdAt, lang)}</span>
      </div>

      <div className="grid gap-12 md:grid-cols-[3fr_2fr]">
        <section aria-labelledby="admin-order-items">
          <h3 id="admin-order-items" className="mb-4 border-b border-ink-cacao pb-3 font-spectral text-xl font-semibold text-ink-cacao">
            {t("orders.detail.items")}
          </h3>
          <ul className="divide-y divide-ink-cacao/15">
            {order.lines.map((line, index) => (
              <li key={index} className="flex gap-4 py-3">
                {line.products[0]?.thumbnail && <img src={line.products[0].thumbnail} alt="" width={48} height={60} loading="lazy" className="h-[60px] w-12 shrink-0 object-cover" />}
                <div className="min-w-0 flex-1 font-sans text-sm text-ink-cacao">
                  <p className="font-medium">{line.kind === "sampler" ? t("orders.sampler") : line.products[0].name}</p>
                  {line.kind === "sampler" && <p className="text-xs text-ink-cacao/70">{line.products.map((product) => product.name).join(", ")}</p>}
                  <p className="text-xs text-ink-cacao/70">{t("orders.detail.quantity", { count: line.quantity })}</p>
                </div>
                <p className="shrink-0 font-sans text-sm font-medium text-ink-cacao">{formatPrice(line.lineTotal, lang)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-ink-cacao pt-3 font-sans text-sm text-ink-cacao">
            <div className="flex justify-between"><dt>{t("orders.detail.subtotal")}</dt><dd>{formatPrice(order.totals.subtotal, lang)}</dd></div>
            <div className="flex justify-between"><dt>{t("orders.detail.shipping")}</dt><dd>{order.totals.shipping === 0 ? t("orders.detail.free") : formatPrice(order.totals.shipping, lang)}</dd></div>
            <div className="flex justify-between"><dt>{t("orders.detail.tax")}</dt><dd>{formatPrice(order.totals.tax, lang)}</dd></div>
            <div className="flex justify-between text-base font-semibold"><dt>{t("orders.detail.total")}</dt><dd>{formatPrice(order.totals.total, lang)}</dd></div>
          </dl>
        </section>

        <div className="space-y-10">
          <section aria-labelledby="admin-order-actions" className="border border-ink-cacao bg-clay-surface p-5">
            <h3 id="admin-order-actions" className="mb-4 font-spectral text-xl font-semibold text-ink-cacao">
              {t("admin.order.actions")}
            </h3>
            {problem && (
              <p role="alert" className="mb-4 border-l-4 border-pod-wine bg-stone-paper px-3 py-2 font-sans text-xs text-ink-cacao">
                {problem}
              </p>
            )}
            {order.nextStatuses.length === 0 && <p className="font-sans text-sm text-ink-cacao/80">{t("admin.order.finished")}</p>}
            <div className="flex flex-wrap gap-3">
              {forward.map((status) => (
                <button key={status} type="button" disabled={busy} onClick={() => void move(status)} className="min-h-11 bg-sun-gold px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-sun-gold/90 disabled:opacity-60">
                  {t(stepKeys[status as keyof typeof stepKeys])}
                </button>
              ))}
              {canCancel && !asking && (
                <button type="button" onClick={() => setAsking(true)} className="min-h-11 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-stone-paper">
                  {t("admin.order.cancel")}
                </button>
              )}
            </div>
            {canCancel && asking && (
              <div role="group" aria-label={t("admin.order.cancel")} className="mt-4 border-t border-ink-cacao/30 pt-4">
                <p className="font-sans text-sm text-ink-cacao">{t("admin.order.cancelAsk")}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" disabled={busy} onClick={() => void move("cancelled")} className="min-h-11 bg-pod-wine px-4 py-2 font-sans text-xs font-medium text-paper-text hover:bg-ink-cacao disabled:opacity-60">
                    {t("admin.order.cancelYes")}
                  </button>
                  <button type="button" onClick={() => setAsking(false)} className="min-h-11 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-stone-paper">
                    {t("admin.order.cancelNo")}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="admin-order-customer">
            <h3 id="admin-order-customer" className="mb-3 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
              {t("admin.order.customer")}
            </h3>
            <p className="font-sans text-sm text-ink-cacao">{order.customer.name}</p>
            <a href={`mailto:${order.customer.email}`} className="font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
              {order.customer.email}
            </a>
          </section>

          <section aria-labelledby="admin-order-address">
            <h3 id="admin-order-address" className="mb-3 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
              {t("orders.detail.shippingTo")}
            </h3>
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
            {order.note && <p className="mt-3 border-l-2 border-ink-cacao/30 pl-3 font-sans text-sm text-ink-cacao">{order.note}</p>}
          </section>

          <section aria-labelledby="admin-order-payment">
            <h3 id="admin-order-payment" className="mb-3 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
              {t("orders.detail.payment")}
            </h3>
            <p className="font-sans text-sm text-ink-cacao">{t("orders.detail.paidWith", { brand: t(`orders.brands.${["visa", "mastercard", "amex", "discover"].includes(order.payment.brand) ? (order.payment.brand as "visa") : "card"}`), last4: order.payment.last4 })}</p>
            <p className="font-sans text-sm text-ink-cacao/70">{order.payment.status === "refunded" ? t("orders.detail.refunded") : t("orders.detail.paid")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrderPage() {
  const { id = "" } = useParams();
  const { lang } = useLang();
  const { load, reload, setData } = useLoad((signal) => fetchAdminOrder(id, { lang, signal }), [id, lang]);

  return <LoadState load={load} reload={reload}>{(order) => <OrderView order={order} onChange={setData} />}</LoadState>;
}
