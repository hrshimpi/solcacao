// The flavor compass: five tasting notes arranged in a circle. Each note is a real toggle button.
import { noteIds, type NoteId } from "../../../data/products";
import { useLang } from "../../../i18n/LanguageContext";

interface FlavorCompassProps {
  selected: NoteId[];
  onToggle: (note: NoteId) => void;
  onClear: () => void;
}

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 66;

export default function FlavorCompass({ selected, onToggle, onClear }: FlavorCompassProps) {
  const { t } = useLang();

  const points = noteIds.map((note, index) => {
    const angle = ((index * 72 - 90) * Math.PI) / 180;
    return { note, x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
  });

  return (
    <div>
      <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0" aria-hidden="true" focusable="false">
          {[28, 48].map((radius) => (
            <circle key={radius} cx={CENTER} cy={CENTER} r={radius} fill="none" stroke="#1c1310" strokeWidth="0.5" opacity="0.2" />
          ))}
          <circle cx={CENTER} cy={CENTER} r="3" fill="#1c1310" opacity="0.4" />
          {points.map(({ note, x, y }) => (
            <line
              key={note}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke={selected.includes(note) ? "#6b1f2e" : "#1c1310"}
              strokeWidth={selected.includes(note) ? 1.5 : 0.8}
              opacity={selected.includes(note) ? 1 : 0.35}
            />
          ))}
        </svg>
        {points.map(({ note, x, y }) => {
          const active = selected.includes(note);
          return (
            <button
              key={note}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(note)}
              className="absolute h-11 w-14 -translate-x-1/2 -translate-y-1/2"
              style={{ left: x, top: y }}
            >
              <span
                aria-hidden="true"
                className={`absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                  active ? "border-pod-wine bg-pod-wine" : "border-ink-cacao/70 bg-stone-paper"
                }`}
              />
              <span
                className={`absolute left-1/2 top-[calc(50%+10px)] -translate-x-1/2 whitespace-nowrap font-sans text-xs ${
                  active ? "font-medium text-pod-wine" : "text-ink-cacao/70"
                }`}
              >
                {t(`notes.${note}`)}
              </span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="mx-auto mt-1 block min-h-11 px-3 font-sans text-xs text-ink-cacao/70 underline underline-offset-4 hover:text-ink-cacao"
        >
          {t("filters.clear")}
        </button>
      )}
    </div>
  );
}
