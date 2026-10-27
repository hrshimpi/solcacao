// Minus and plus buttons around a number. The quantity never goes below the minimum.
interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  min?: number;
  max?: number;
  tone?: "light" | "dark";
}

export default function QuantityStepper({
  value,
  onChange,
  decreaseLabel,
  increaseLabel,
  min = 1,
  max = 99,
  tone = "light",
}: QuantityStepperProps) {
  const border = tone === "dark" ? "border-paper-text/60" : "border-ink-cacao";
  const button =
    "flex h-11 w-11 items-center justify-center font-sans text-base disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className={`inline-flex items-center border ${border}`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={decreaseLabel}
        className={button}
      >
        <span aria-hidden="true">-</span>
      </button>
      <span className={`flex h-11 min-w-11 items-center justify-center border-x px-2 font-sans text-sm ${border}`}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={increaseLabel}
        className={button}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
