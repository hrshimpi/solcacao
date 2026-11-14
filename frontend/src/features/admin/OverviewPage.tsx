// The first page of the dashboard: the money and the orders in numbers, the orders by status, what is low on stock, and
// the latest orders. Everything comes from GET /api/admin/stats.
import { fetchAdminStats, type AdminStats } from "../../api/admin";
import { orderStatuses } from "../../api/orders";
import { formatDate, formatPrice } from "../../i18n/format";
import { useLang } from "../../i18n/LanguageContext";
import LocaleLink from "../../ui/LocaleLink";
import OrderStatusBadge from "../orders/components/OrderStatusBadge";
import { LoadState, useLoad } from "./useLoad";

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border border-ink-cacao/30 p-5">
      <dt className="font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">{label}</dt>
      <dd className="mt-2 font-spectral text-3xl font-semibold text-ink-cacao">{value}</dd>
      <dd className="mt-1 font-sans text-xs text-ink-cacao/70">{note}</dd>
    </div>
  );
}

function Overview({ stats }: { stats: AdminStats }) {
  const { t, lang } = useLang();
  const most = Math.max(1, ...orderStatuses.map((status) => stats.byStatus[status]));

  return (
    <div className="space-y-14">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label={t("admin.overview.revenue")} value={formatPrice(stats.revenue, lang)} note={t("admin.overview.revenueNote")} />
        <Card label={t("admin.overview.orders")} value={String(stats.orders)} note={t("admin.overview.ordersNote", { count: stats.today.orders })} />
        <Card label={t("admin.overview.average")} value={formatPrice(stats.averageOrder, lang)} note={t("admin.overview.averageNote")} />
        <Card label={t("admin.overview.customers")} value={String(stats.customers)} note={t("admin.overview.customersNote", { count: stats.products })} />
      </dl>

      <div className="grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="overview-status">
          <h2 id="overview-status" className="mb-4 border-b border-ink-cacao pb-3 font-spectral text-2xl font-semibold text-ink-cacao">
            {t("admin.overview.byStatus")}
          </h2>
          <ul className="space-y-3">
            {orderStatuses.map((status) => (
              <li key={status} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-3">
                <OrderStatusBadge status={status} />
                <span aria-hidden="true" className="h-2 bg-clay-surface">
                  <span className="block h-2 bg-ink-cacao" style={{ width: `${(stats.byStatus[status] / most) * 100}%` }} />
                </span>
                <span className="text-right font-sans text-sm font-medium text-ink-cacao">{stats.byStatus[status]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="overview-stock">
          <h2 id="overview-stock" className="mb-4 border-b border-ink-cacao pb-3 font-spectral text-2xl font-semibold text-ink-cacao">
            {t("admin.overview.lowStock")}
          </h2>
          {stats.lowStock.length === 0 ? (
            <p className="font-sans text-sm text-ink-cacao/70">{t("admin.overview.lowStockNone")}</p>
          ) : (
            <ul className="divide-y divide-ink-cacao/15">
              {stats.lowStock.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-4 py-3 font-sans text-sm text-ink-cacao">
                  <span>{product.name}</span>
                  <span className={product.quantity === 0 ? "font-medium text-pod-wine" : "text-ink-cacao/80"}>{product.quantity === 0 ? t("admin.overview.soldOut") : t("admin.overview.left", { count: product.quantity })}</span>
                </li>
              ))}
            </ul>
          )}
          <LocaleLink to="/admin/products" className="mt-4 inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
            {t("admin.overview.manageStock")}
          </LocaleLink>
        </section>
      </div>

      <section aria-labelledby="overview-recent">
        <h2 id="overview-recent" className="mb-4 border-b border-ink-cacao pb-3 font-spectral text-2xl font-semibold text-ink-cacao">
          {t("admin.overview.recent")}
        </h2>
        {stats.recentOrders.length === 0 ? (
          <p className="font-sans text-sm text-ink-cacao/70">{t("admin.overview.recentNone")}</p>
        ) : (
          <ul className="divide-y divide-ink-cacao/15">
            {stats.recentOrders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
                <div>
                  <LocaleLink to={`/admin/orders/${order.id}`} className="font-sans text-sm font-medium text-ink-cacao underline-offset-4 hover:text-pod-wine hover:underline">
                    {order.number}
                  </LocaleLink>
                  <p className="font-sans text-xs text-ink-cacao/70">
                    {order.customer.name || order.customer.email} · {formatDate(order.createdAt, lang)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <OrderStatusBadge status={order.status} />
                  <span className="min-w-16 text-right font-sans text-sm font-medium text-ink-cacao">{formatPrice(order.totals.total, lang)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <LocaleLink to="/admin/orders" className="mt-4 inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
          {t("admin.overview.seeAll")}
        </LocaleLink>
      </section>
    </div>
  );
}

export default function OverviewPage() {
  const { lang } = useLang();
  const { load, reload } = useLoad((signal) => fetchAdminStats({ lang, signal }), [lang]);

  return <LoadState load={load} reload={reload}>{(stats) => <Overview stats={stats} />}</LoadState>;
}
