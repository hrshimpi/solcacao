// The status of an order as a small label: a coloured dot and the word, so it never depends on the colour alone.
import type { OrderStatus } from "../../../api/orders";
import { useLang } from "../../../i18n/LanguageContext";

const dots: Record<OrderStatus, string> = {
  paid: "bg-sun-gold",
  processing: "bg-gold-deep",
  shipped: "bg-canopy-green",
  delivered: "bg-canopy-green",
  cancelled: "bg-pod-wine",
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useLang();

  return (
    <span className="inline-flex items-center gap-2 border border-ink-cacao/30 px-2.5 py-1 font-sans text-[11px] uppercase tracking-widest text-ink-cacao">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dots[status]}`} />
      {t(`orders.status.${status}`)}
    </span>
  );
}
