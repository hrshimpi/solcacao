// A form field with a visible label, a hint, a warning, an error message and the right aria attributes.
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useId } from "react";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  hint?: ReactNode;
  // a gentle note about a value that is allowed, unlike an error it does not mark the field as invalid
  warning?: string;
  error?: string;
  value?: string;
  // gets the text, not the event
  onChange?: (value: string) => void;
  // a box of several lines instead of one line
  multiline?: boolean;
  rows?: number;
  // for a field that sits on a dark background, like the one in the footer
  tone?: "light" | "dark";
}

export default function TextField({
  label,
  hint,
  warning,
  error,
  id: explicitId,
  required,
  value = "",
  onChange,
  multiline,
  rows = 4,
  tone = "light",
  className = "",
  ...rest
}: TextFieldProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const warningId = warning ? `${id}-warning` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const dark = tone === "dark";

  const describedBy = [hintId, warningId, errorId].filter(Boolean).join(" ") || undefined;

  const common = {
    id,
    value: typeof value === "string" ? value : "",
    onChange: (event: { target: { value: string } }) => onChange?.(event.target.value),
    required,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    className: `w-full border-b bg-transparent py-2 font-sans text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
      dark
        ? "text-paper-text placeholder:text-paper-text/70 focus:border-paper-text"
        : "text-ink-cacao placeholder:text-ink-cacao/70 focus:border-ink-cacao"
    } ${error ? "border-pod-wine" : dark ? "border-paper-text/60" : "border-ink-cacao/40"} ${className}`,
  };

  return (
    <div className="flex flex-col gap-1 text-left">
      <label
        htmlFor={id}
        className={`font-sans text-xs font-semibold uppercase tracking-wider ${dark ? "text-paper-text/70" : "text-ink-cacao"}`}
      >
        {label}
        {required && <span className="ml-0.5 text-pod-wine">*</span>}
      </label>

      {multiline ? (
        // the attributes that are passed on (name, placeholder, readOnly, onBlur...) are the same for a textarea
        <textarea {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} {...common} rows={rows} className={`${common.className} resize-none`} />
      ) : (
        <input {...rest} {...common} />
      )}

      {hint && (
        <p
          id={hintId}
          className={`pointer-events-none mt-1 font-sans text-xs ${dark ? "text-paper-text/70" : "text-ink-cacao/70"}`}
        >
          {hint}
        </p>
      )}

      {warning && (
        <p
          id={warningId}
          className={`mt-1 border-l-2 pl-2 font-sans text-xs font-medium ${
            dark ? "border-sun-gold text-sun-gold" : "border-gold-deep text-gold-deep"
          }`}
        >
          {warning}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 font-sans text-xs font-medium text-pod-wine"
        >
          {error}
        </p>
      )}
    </div>
  );
}
