// All shop filters in one panel: cacao percentage, origin, category and the flavor compass.
import { useId } from "react";
import { categoryIds, getOriginIds, originName, type NoteId, type OriginId } from "../../../data/products";
import { useLang } from "../../../i18n/LanguageContext";
import { CheckIcon } from "../../../ui/Icons";
import type { Filters } from "../filters";
import CacaoRange from "./CacaoRange";
import FlavorCompass from "./FlavorCompass";

interface FilterPanelProps {
  filters: Filters;
  onChange: (next: Filters) => void;
}

const heading = "mb-3 font-sans text-[11px] font-medium uppercase tracking-widest text-ink-cacao/70";
const focusRing = "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pod-wine";

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

export default function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const { t, lang } = useLang();
  const ids = { percent: useId(), origin: useId(), category: useId(), compass: useId() };
  const categoryName = useId();

  return (
    <div className="w-full space-y-7">
      <div role="group" aria-labelledby={ids.percent} className="border-b border-ink-cacao/15 pb-6">
        <p id={ids.percent} className={heading}>
          {t("filters.percentage")}
        </p>
        <CacaoRange min={filters.min} max={filters.max} onChange={(range) => onChange({ ...filters, ...range })} />
      </div>

      <div role="group" aria-labelledby={ids.origin} className="border-b border-ink-cacao/15 pb-4">
        <p id={ids.origin} className={heading}>
          {t("filters.origin")}
        </p>
        {getOriginIds().map((origin: OriginId) => {
          const checked = filters.origins.includes(origin);
          return (
            <label key={origin} className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange({ ...filters, origins: toggle(filters.origins, origin) })}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center border ${focusRing} ${
                  checked ? "border-pod-wine bg-pod-wine text-white" : "border-ink-cacao bg-transparent"
                }`}
              >
                {checked && <CheckIcon size={14} />}
              </span>
              <span className="font-sans text-sm text-ink-cacao">{originName(origin, lang)}</span>
            </label>
          );
        })}
      </div>

      <div role="radiogroup" aria-labelledby={ids.category} className="border-b border-ink-cacao/15 pb-4">
        <p id={ids.category} className={heading}>
          {t("filters.category")}
        </p>
        {(["all", ...categoryIds] as const).map((category) => {
          const selected = filters.category === category;
          return (
            <label key={category} className="flex min-h-11 cursor-pointer items-center">
              <input
                type="radio"
                name={categoryName}
                checked={selected}
                onChange={() => onChange({ ...filters, category })}
                className="peer sr-only"
              />
              <span
                className={`px-1 font-sans text-sm ${focusRing} ${
                  selected ? "font-medium text-pod-wine underline underline-offset-4" : "text-ink-cacao/70"
                }`}
              >
                {category === "all" ? t("filters.all") : t(`categories.${category}`)}
              </span>
            </label>
          );
        })}
      </div>

      <div role="group" aria-labelledby={ids.compass}>
        <p id={ids.compass} className={heading}>
          {t("filters.compass")}
        </p>
        <FlavorCompass
          selected={filters.notes}
          onToggle={(note: NoteId) => onChange({ ...filters, notes: toggle(filters.notes, note) })}
          onClear={() => onChange({ ...filters, notes: [] })}
        />
      </div>
    </div>
  );
}
