// The cacao percentage filter: two sliders (arrow keys work) and two number boxes (no dragging needed).
import { useEffect, useId, useState } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { PCT_GAP, PCT_MAX, PCT_MIN } from "../filters";

interface CacaoRangeProps {
  min: number;
  max: number;
  onChange: (range: { min: number; max: number }) => void;
}

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

export default function CacaoRange({ min, max, onChange }: CacaoRangeProps) {
  const { t } = useLang();
  const minId = useId();
  const maxId = useId();
  const [draft, setDraft] = useState({ min: String(min), max: String(max) });

  useEffect(() => {
    setDraft({ min: String(min), max: String(max) });
  }, [min, max]);

  function commitMin(text: string) {
    const value = Number(text);
    if (text.trim() !== "" && Number.isFinite(value)) {
      onChange({ min: clamp(Math.round(value), PCT_MIN, max - PCT_GAP), max });
    }
    setDraft((current) => ({ ...current, min: String(min) }));
  }

  function commitMax(text: string) {
    const value = Number(text);
    if (text.trim() !== "" && Number.isFinite(value)) {
      onChange({ min, max: clamp(Math.round(value), min + PCT_GAP, PCT_MAX) });
    }
    setDraft((current) => ({ ...current, max: String(max) }));
  }

  const numberBox =
    "w-16 border-b border-ink-cacao/60 bg-transparent py-1 text-center font-mono text-sm text-ink-cacao";

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <label htmlFor={minId} className="block font-sans text-xs text-ink-cacao/70">
            {t("filters.minShort")}
          </label>
          <div className="flex items-baseline gap-1">
            <input
              id={minId}
              type="number"
              inputMode="numeric"
              min={PCT_MIN}
              max={max - PCT_GAP}
              step={1}
              value={draft.min}
              onChange={(event) => setDraft({ ...draft, min: event.target.value })}
              onBlur={(event) => commitMin(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && commitMin(draft.min)}
              aria-label={t("filters.min")}
              className={numberBox}
            />
            <span aria-hidden="true" className="font-mono text-xs">%</span>
          </div>
        </div>
        <div>
          <label htmlFor={maxId} className="block text-right font-sans text-xs text-ink-cacao/70">
            {t("filters.maxShort")}
          </label>
          <div className="flex items-baseline gap-1">
            <input
              id={maxId}
              type="number"
              inputMode="numeric"
              min={min + PCT_GAP}
              max={PCT_MAX}
              step={1}
              value={draft.max}
              onChange={(event) => setDraft({ ...draft, max: event.target.value })}
              onBlur={(event) => commitMax(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && commitMax(draft.max)}
              aria-label={t("filters.max")}
              className={numberBox}
            />
            <span aria-hidden="true" className="font-mono text-xs">%</span>
          </div>
        </div>
      </div>
      <input
        type="range"
        min={PCT_MIN}
        max={PCT_MAX}
        step={1}
        value={min}
        aria-label={t("filters.min")}
        aria-valuetext={`${min}%`}
        onChange={(event) => onChange({ min: Math.min(Number(event.target.value), max - PCT_GAP), max })}
      />
      <input
        type="range"
        min={PCT_MIN}
        max={PCT_MAX}
        step={1}
        value={max}
        aria-label={t("filters.max")}
        aria-valuetext={`${max}%`}
        onChange={(event) => onChange({ min, max: Math.max(Number(event.target.value), min + PCT_GAP) })}
      />
    </div>
  );
}
