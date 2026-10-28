// The requests of the person as a column of links, newest first, in the look of the shop filters: small headings, thin
// lines between the rows. Each row has what is needed to tell requests apart without opening them.
import { formatCents, formatDate } from "../../../i18n/format";
import { useLang } from "../../../i18n/LanguageContext";
import LocaleLink from "../../../ui/LocaleLink";
import { packagingLabel, profileLabel } from "../requestLabels";
import type { QuoteRequest } from "../requestTypes";
import StatusBadge from "./StatusBadge";

interface RequestListProps {
  items: QuoteRequest[];
  selectedId: string | null;
  // called when a request was chosen, so the page can move focus to its details
  onPick: () => void;
}

export default function RequestList({ items, selectedId, onPick }: RequestListProps) {
  const { t, lang } = useLang();

  return (
    <ul className="border-t border-ink-cacao/15">
      {items.map((request) => {
        const selected = request.id === selectedId;
        return (
          <li key={request.id} className="border-b border-ink-cacao/15">
            <LocaleLink
              to={`/account/requests?request=${encodeURIComponent(request.id)}`}
              aria-current={selected ? "true" : undefined}
              onClick={onPick}
              className={`block min-h-11 border-l-2 px-3 py-4 hover:bg-clay-surface/60 ${
                selected ? "border-pod-wine bg-clay-surface" : "border-transparent"
              }`}
            >
              <span className="mb-2 flex items-center justify-between gap-3">
                <span className="font-sans text-xs text-ink-cacao/70">{formatDate(request.createdAt, lang)}</span>
                <StatusBadge status={request.status} />
              </span>
              <span className="block font-spectral text-sm font-semibold text-ink-cacao">{profileLabel(request.cacaoProfile, t)}</span>
              <span className="mt-1 block font-sans text-xs leading-snug text-ink-cacao/70">
                {packagingLabel(request.packagingType, t)} · {t("b2b.requests.units", { count: request.quantityEstimate })}
              </span>
              {request.quoteAmount !== null && (
                <span className="mt-2 block font-sans text-sm font-medium text-ink-cacao">{formatCents(request.quoteAmount, lang)}</span>
              )}
            </LocaleLink>
          </li>
        );
      })}
    </ul>
  );
}
