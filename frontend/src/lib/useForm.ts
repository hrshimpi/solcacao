// Hook that keeps form values, checks them on blur and on submit, and focuses the first problem.
// onSubmit can be async: while it runs the form is "submitting" and a second submit is ignored. Problems that only the
// server can find (an email that has an account) are shown on their field with setFieldErrors.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLang } from "../i18n/LanguageContext";
import { validateValue, type Rule } from "./validation";

interface Options<K extends string> {
  initial: Record<K, string>;
  rules: Partial<Record<K, Rule[]>>;
  onSubmit: (values: Record<K, string>) => void | Promise<void>;
}

export function useForm<K extends string>({ initial, rules, onSubmit }: Options<K>) {
  const { t } = useLang();
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<K, string>>>({});
  const [focusRequest, setFocusRequest] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  // set the moment a submit starts: the state only changes after the next render, and a quick second press would get through
  const busy = useRef(false);

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
      error: (touched[name] || submitted ? messageFor(name) : undefined) ?? serverErrors[name],
      onChange: (value: string) => {
        setValues((current) => ({ ...current, [name]: value }));
        // what the server said was about the old value
        setServerErrors((current) => (current[name] === undefined ? current : { ...current, [name]: undefined }));
      },
      onBlur: () => setTouched((current) => ({ ...current, [name]: true })),
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    setSubmitted(true);
    if (names.some((name) => messageFor(name))) {
      setFocusRequest((count) => count + 1);
      return;
    }

    busy.current = true;
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  // shows a problem on each of the named fields, and moves focus to the first of them
  function setFieldErrors(errors: Partial<Record<K, string>>) {
    setServerErrors(errors);
    setFocusRequest((count) => count + 1);
  }

  function reset() {
    setValues(initial);
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
  }

  return { values, field, handleSubmit, reset, formRef, submitting, setFieldErrors };
}
