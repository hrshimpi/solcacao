// Hook that keeps form values, checks them on blur and on submit, and focuses the first problem.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLang } from "../i18n/LanguageContext";
import { validateValue, type Rule } from "./validation";

interface Options<K extends string> {
  initial: Record<K, string>;
  rules: Partial<Record<K, Rule[]>>;
  onSubmit: (values: Record<K, string>) => void;
}

export function useForm<K extends string>({ initial, rules, onSubmit }: Options<K>) {
  const { t } = useLang();
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const names = Object.keys(initial) as K[];

  function messageFor(name: K) {
    const error = validateValue(values[name], rules[name] ?? []);
    return error ? t(error.key, error.params) : undefined;
  }

  useEffect(() => {
    if (focusRequest > 0) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [focusRequest]);

  function field(name: K) {
    return {
      name,
      value: values[name],
      error: touched[name] || submitted ? messageFor(name) : undefined,
      onChange: (value: string) => setValues((current) => ({ ...current, [name]: value })),
      onBlur: () => setTouched((current) => ({ ...current, [name]: true })),
    };
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (names.some((name) => messageFor(name))) {
      setFocusRequest((count) => count + 1);
      return;
    }
    onSubmit(values);
  }

  function reset() {
    setValues(initial);
    setTouched({});
    setSubmitted(false);
  }

  return { values, field, handleSubmit, reset, formRef };
}
