// The orders of a signed in person, newest first, as a list of cards: the number, the date, the status, what was in it and
// what it cost. More orders are added to the list with a button, ten at a time.
import { useCallback, useEffect, useState } from "react";
import { fetchOrders, type Order } from "../../api/orders";
import { formatDate, formatPrice } from "../../i18n/format";
import { useLang } from "../../i18n/LanguageContext";
import { usePageTitle } from "../../lib/usePageTitle";
import LocaleLink from "../../ui/LocaleLink";
import OrderStatusBadge from "./components/OrderStatusBadge";

const PAGE_SIZE = 10;

type Load = { status: "loading" } | { status: "failed" } | { status: "ready"; orders: Order[]; total: number };

// the names of what was bought, "Ecuador 72% (2), Custom sampler"
export function itemNames(order: Order, samplerName: string): string {
  return order.lines.map((line) => `${line.kind === "sampler" ? samplerName : (line.products[0]?.name ?? "")}${line.quantity > 1 ? ` (${line.quantity})` : ""}`).join(", ");
}

export default function OrdersPage() {
  const { t, lang } = useLang();
  usePageTitle(t("titles.orders"));

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const read = useCallback(
    (signal: AbortSignal) => {
      setLoad({ status: "loading" });
      fetchOrders({ page: 1, limit: PAGE_SIZE, lang, signal })
        .then((page) => setLoad({ status: "ready", orders: page.items, total: page.total }))
        .catch(() => {
          if (!signal.aborted) setLoad({ status: "failed" });
        });
    },
    [lang],
  );

  useEffect(() => {
    const controller = new AbortController();
    read(controller.signal);
    return () => controller.abort();
    // attempt asks for the list again after a failure
  }, [read, attempt]);

  async function showMore() {
    if (load.status !== "ready") return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const next = await fetchOrders({ page: Math.floor(load.orders.length / PAGE_SIZE) + 1, limit: PAGE_SIZE, lang });
      // an order can only be on the list once, even if a new one pushed the others down a page
      const known = new Set(load.orders.map((order) => order.id));
      setLoad({ status: "ready", orders: [...load.orders, ...next.items.filter((order) => !known.has(order.id))], total: next.total });
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="bg-stone-paper">
      <div className="border-b border-ink-cacao">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
          <p className="mb-3 font-sans text-[11px] uppercase tracking-[0.18em] text-pod-wine">{t("orders.eyebrow")}</p>
          <h1 className="font-spectral text-4xl font-semibold tracking-tight text-ink-cacao md:text-5xl">{t("orders.title")}</h1>
          <p className="mt-3 max-w-xl font-spectral text-ink-cacao/70">{t("orders.intro")}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
        <LocaleLink to="/profile" className="mb-8 inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
          {t("orders.back")}
        </LocaleLink>

        {load.status === "loading" && (
          <p role="status" className="font-sans text-sm text-ink-cacao/70">
            {t("orders.loading")}
          </p>
        )}

        {load.status === "failed" && (
          <div role="alert" className="flex flex-wrap items-center gap-4 border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
            <span>{t("orders.loadError")}</span>
            <button type="button" onClick={() => setAttempt((count) => count + 1)} className="min-h-11 underline underline-offset-4 hover:text-pod-wine">
              {t("common.retry")}
            </button>
          </div>
        )}

        {load.status === "ready" && load.orders.length === 0 && (
          <div className="border border-ink-cacao/30 p-8 text-center">
            <p className="font-spectral text-lg text-ink-cacao">{t("orders.empty")}</p>
            <LocaleLink to="/shop" className="mt-5 inline-flex min-h-11 items-center bg-sun-gold px-8 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90">
              {t("orders.emptyLink")}
            </LocaleLink>
          </div>
        )}

        {load.status === "ready" && load.orders.length > 0 && (
          <>
            <ul className="space-y-5">
              {load.orders.map((order) => (
                <li key={order.id}>
                  <article aria-labelledby={`order-${order.id}`} className="border border-ink-cacao/30 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 id={`order-${order.id}`} className="font-spectral text-xl font-semibold text-ink-cacao">
                          {t("orders.number", { number: order.number })}
                        </h2>
                        <p className="mt-1 font-sans text-xs text-ink-cacao/70">{t("orders.placedOn", { date: formatDate(order.createdAt, lang) })}</p>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </div>

                    <div className="mt-4 flex gap-3">
                      <ul className="flex shrink-0 gap-2" aria-hidden="true">
                        {order.lines.slice(0, 4).map((line, index) => (
                          <li key={index}>
                            {line.products[0]?.thumbnail && <img src={line.products[0].thumbnail} alt="" width={48} height={60} loading="lazy" className="h-[60px] w-12 object-cover" />}
                          </li>
                        ))}
                      </ul>
                      <p className="min-w-0 flex-1 font-sans text-sm text-ink-cacao/80">{itemNames(order, t("orders.sampler"))}</p>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-cacao/20 pt-4">
                      <p className="font-sans text-sm text-ink-cacao">
                        <span className="text-ink-cacao/70">{t("orders.items", { count: order.itemCount })} · </span>
                        <span className="font-medium">
                          {t("orders.total")}: {formatPrice(order.totals.total, lang)}
                        </span>
                      </p>
                      <LocaleLink to={`/account/orders/${order.id}`} aria-label={`${t("orders.view")}, ${t("orders.number", { number: order.number })}`} className="inline-flex min-h-11 items-center border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-clay-surface">
                        {t("orders.view")}
                      </LocaleLink>
                    </div>
                  </article>
                </li>
              ))}
            </ul>

            {load.orders.length < load.total && (
              <div className="mt-8 text-center">
                <button type="button" onClick={() => void showMore()} disabled={loadingMore} className="min-h-11 border border-ink-cacao px-6 py-2 font-sans text-sm font-medium text-ink-cacao hover:bg-clay-surface disabled:opacity-60">
                  {loadingMore ? t("orders.loading") : t("orders.more")}
                </button>
                {moreFailed && (
                  <p role="alert" className="mt-3 font-sans text-sm text-pod-wine">
                    {t("orders.loadError")}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
