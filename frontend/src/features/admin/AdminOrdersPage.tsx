// Every order of the shop, newest first, with a filter by status and a search by number, email or name. Fifteen to a page.
import { useEffect, useState } from "react";
import { fetchAdminOrders } from "../../api/admin";
import { orderStatuses, type OrderStatus } from "../../api/orders";
import { formatDate, formatPrice } from "../../i18n/format";
import { useLang } from "../../i18n/LanguageContext";
import LocaleLink from "../../ui/LocaleLink";
import OrderStatusBadge from "../orders/components/OrderStatusBadge";
import { LoadState, useLoad } from "./useLoad";

const PAGE_SIZE = 15;

export default function AdminOrdersPage() {
  const { t, lang } = useLang();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // the search starts when the person stops typing for a moment, not for every letter
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(typed);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [typed]);

  const { load, reload } = useLoad((signal) => fetchAdminOrders({ status: status || undefined, q: query, page, limit: PAGE_SIZE, lang, signal }), [lang, status, query, page]);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end gap-6">
        <div className="min-w-64 flex-1">
          <label htmlFor="admin-orders-search" className="block font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
            {t("admin.orders.search")}
          </label>
          <input
            id="admin-orders-search"
            type="search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            className="mt-1 block w-full border-b border-ink-cacao/60 bg-transparent py-2 font-sans text-sm text-ink-cacao focus:border-ink-cacao focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="admin-orders-status" className="block font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
            {t("admin.orders.statusFilter")}
          </label>
          <select
            id="admin-orders-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as OrderStatus | "");
              setPage(1);
            }}
            className="mt-1 block min-h-11 border-b border-ink-cacao/60 bg-transparent py-2 font-sans text-sm text-ink-cacao focus:border-ink-cacao focus:outline-none"
          >
            <option value="">{t("admin.orders.all")}</option>
            {orderStatuses.map((value) => (
              <option key={value} value={value}>
                {t(`orders.status.${value}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <LoadState load={load} reload={reload}>
        {({ items, total }) => {
          const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
          return (
            <>
              <p role="status" className="mb-3 font-sans text-xs text-ink-cacao/70">
                {t("admin.orders.count", { count: total })}
              </p>
              {items.length === 0 ? (
                <p className="border border-ink-cacao/30 p-6 font-spectral text-ink-cacao">{t("admin.orders.empty")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] border-collapse text-left font-sans text-sm text-ink-cacao">
                    <thead>
                      <tr className="border-b border-ink-cacao text-[11px] uppercase tracking-widest text-ink-cacao/70">
                        <th scope="col" className="py-3 pr-4 font-normal">{t("admin.orders.number")}</th>
                        <th scope="col" className="py-3 pr-4 font-normal">{t("admin.orders.date")}</th>
                        <th scope="col" className="py-3 pr-4 font-normal">{t("admin.orders.customer")}</th>
                        <th scope="col" className="py-3 pr-4 text-right font-normal">{t("admin.orders.items")}</th>
                        <th scope="col" className="py-3 pr-4 text-right font-normal">{t("admin.orders.total")}</th>
                        <th scope="col" className="py-3 font-normal">{t("admin.orders.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((order) => (
                        <tr key={order.id} className="border-b border-ink-cacao/15">
                          <th scope="row" className="py-3 pr-4 font-medium">
                            <LocaleLink to={`/admin/orders/${order.id}`} className="underline-offset-4 hover:text-pod-wine hover:underline">
                              {order.number}
                            </LocaleLink>
                          </th>
                          <td className="py-3 pr-4 text-ink-cacao/80">{formatDate(order.createdAt, lang)}</td>
                          <td className="py-3 pr-4">
                            <span className="block">{order.customer.name}</span>
                            <span className="block text-xs text-ink-cacao/70">{order.customer.email}</span>
                          </td>
                          <td className="py-3 pr-4 text-right">{order.itemCount}</td>
                          <td className="py-3 pr-4 text-right font-medium">{formatPrice(order.totals.total, lang)}</td>
                          <td className="py-3">
                            <OrderStatusBadge status={order.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {pages > 1 && (
                <nav aria-label={t("admin.orders.pageOf", { page, pages })} className="mt-6 flex items-center justify-between gap-4 font-sans text-sm text-ink-cacao">
                  <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} className="min-h-11 border border-ink-cacao px-4 py-2 text-xs font-medium hover:bg-clay-surface disabled:opacity-40">
                    {t("admin.orders.previous")}
                  </button>
                  <span>{t("admin.orders.pageOf", { page, pages })}</span>
                  <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pages} className="min-h-11 border border-ink-cacao px-4 py-2 text-xs font-medium hover:bg-clay-surface disabled:opacity-40">
                    {t("admin.orders.next")}
                  </button>
                </nav>
              )}
            </>
          );
        }}
      </LoadState>
    </div>
  );
}
