// A short row of real radio buttons styled as text choices. Used for the contact category and the account type.
interface Option<T extends string> {
  id: T;
  label: string;
}

interface RadioRowProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: Option<T>[];
  onChange: (id: T) => void;
  hideLegend?: boolean;
}

export default function RadioRow<T extends string>({ legend, name, value, options, onChange, hideLegend }: RadioRowProps<T>) {
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "mb-2 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70"}>{legend}</legend>
      <div className="flex flex-wrap gap-x-4">
        {options.map((option) => (
          <label key={option.id} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              className="peer sr-only"
            />
            <span className="inline-flex min-h-11 items-center px-1 font-sans text-sm text-ink-cacao/70 hover:text-ink-cacao peer-checked:font-medium peer-checked:text-ink-cacao peer-checked:underline peer-checked:decoration-2 peer-checked:underline-offset-8 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pod-wine">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
