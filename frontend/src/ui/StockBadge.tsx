// Small "Low stock" or "Sold out" label. Shows nothing when there is plenty left.
import { useLang } from "../i18n/LanguageContext";
import type { StockStatus } from "../lib/stock";

export default function StockBadge({ status, className = "" }: { status: StockStatus; className?: string }) {
  const { t } = useLang();
  if (status === "in_stock") return null;

  const tone = status === "out" ? "bg-ink-cacao text-paper-text" : "bg-sun-gold text-ink-cacao";
  return (
    <span className={`inline-block px-2 py-1 font-sans text-[11px] font-medium uppercase tracking-wider ${tone} ${className}`}>
      {t(status === "out" ? "stock.out" : "stock.low")}
    </span>
  );
}