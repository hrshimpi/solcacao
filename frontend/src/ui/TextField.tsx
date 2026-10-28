import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string;
  hint?: ReactNode;
  error?: string;
  value?: string;
  onChange?: (value: string) => void | ((e: React.ChangeEvent<HTMLInputElement>) => void);
}

export default function TextField({
  label,
  hint,
  error,
  id: explicitId,
  required,
  value = "",
  onChange,
  className = "",
  ...rest
}: TextFieldProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onChange) return;
    // Checks if the consumer's onChange expects the direct string value or standard event
    (onChange as (val: unknown) => void)(e.target.value);
  };

  return (
    <div className="flex flex-col gap-1 text-left">
      <label
        htmlFor={id}
        className="font-sans text-xs font-semibold uppercase tracking-wider text-ink-cacao"
      >
        {label}
        {required && <span className="ml-0.5 text-pod-wine">*</span>}
      </label>

      <input
        id={id}
        value={typeof value === "string" ? value : ""}
        onChange={handleChange}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        className={`w-full border-b border-ink-cacao/40 bg-transparent py-2 font-sans text-sm text-ink-cacao placeholder:text-ink-cacao/40 focus:border-ink-cacao focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-red-600" : ""
        } ${className}`}
        {...rest}
      />

      {hint && (
        <p
          id={hintId}
          className="pointer-events-none mt-1 font-sans text-xs text-ink-cacao/70"
        >
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 font-sans text-xs font-medium text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}