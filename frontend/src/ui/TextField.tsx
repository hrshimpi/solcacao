// A form field with a visible label, a hint, an error message and the right aria attributes.
import { useId, type HTMLInputTypeAttribute } from "react";

interface TextFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  // a gentle note about a value that is allowed, unlike an error it does not mark the field as invalid
  warning?: string;
  type?: HTMLInputTypeAttribute;
  autoComplete?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "email" | "tel";
  readOnly?: boolean;
  tone?: "light" | "dark";
}

export default function TextField({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  hint,
  warning,
  type = "text",
  autoComplete,
  required,
  multiline,
  rows = 4,
  placeholder,
  inputMode,
  readOnly,
  tone = "light",
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const warningId = `${id}-warning`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : "", warning ? warningId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;
  const dark = tone === "dark";

  const common = {
    id,
    name,
    value,
    required,
    readOnly,
    placeholder,
    autoComplete,
    onBlur,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    className: `block w-full bg-transparent py-1.5 font-sans text-sm ${
      dark ? "text-paper-text placeholder:text-paper-text/70" : "text-ink-cacao placeholder:text-ink-cacao/70"
    }`,
  };

  return (
    <div
      className={`border-b ${
        readOnly ? "border-ink-cacao/20" : dark ? "border-paper-text/60" : "border-ink-cacao/60"
      } ${error ? "border-pod-wine" : ""} pb-1`}
    >
      <label
        htmlFor={id}
        className={`mb-1 block font-sans text-[11px] uppercase tracking-widest ${dark ? "text-paper-text/70" : "text-ink-cacao/70"}`}
      >
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {multiline ? (
        <textarea {...common} rows={rows} className={`${common.className} resize-none`} />
      ) : (
        <input {...common} type={type} inputMode={inputMode} />
      )}
      {hint && (
        <p id={hintId} className={`mt-1 font-sans text-xs ${dark ? "text-paper-text/70" : "text-ink-cacao/70"}`}>
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
        <p id={errorId} className="mt-1 font-sans text-xs font-medium text-pod-wine">
          {error}
        </p>
      )}
    </div>
  );
}
