// A group of cards where exactly one can be chosen. They are real radio buttons, so the arrow keys work.
import { useId } from "react";

interface Choice {
  id: string;
  label: string;
  sub: string;
  color?: string;
}

interface ChoiceCardsProps {
  name: string;
  labelledBy: string;
  choices: Choice[];
  value: string | null;
  onChange: (id: string) => void;
  className: string;
  error?: string;
}

export default function ChoiceCards({ name, labelledBy, choices, value, onChange, className, error }: ChoiceCardsProps) {
  const errorId = useId();

  return (
    <div>
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className={`grid gap-4 ${className}`}
      >
        {choices.map((choice) => {
          const selected = value === choice.id;
          return (
            <label key={choice.id} className="block cursor-pointer">
              <input
                type="radio"
                name={name}
                value={choice.id}
                checked={selected}
                onChange={() => onChange(choice.id)}
                className="peer sr-only"
              />
              <span
                className={`block h-full border p-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pod-wine ${
                  selected ? "border-2 border-pod-wine bg-clay-surface" : "border-ink-cacao/60 bg-stone-paper hover:border-ink-cacao"
                }`}
              >
                {choice.color && (
                  <span aria-hidden="true" className="mb-4 block h-16 w-full border border-ink-cacao/20" style={{ backgroundColor: choice.color }} />
                )}
                <span className="block font-spectral text-sm font-semibold text-ink-cacao">{choice.label}</span>
                <span className="mt-1 block font-sans text-xs leading-snug text-ink-cacao/70">{choice.sub}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="mt-3 font-sans text-sm font-medium text-pod-wine">
          {error}
        </p>
      )}
    </div>
  );
}
