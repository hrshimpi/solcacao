// The form to add or change a shipping address. A problem the server finds is shown on its field, or above the form.
import { useEffect, useRef, useState } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { api } from "../../../lib/api";
import { ApiError } from "../../../lib/apiFetch";
import { useForm } from "../../../lib/useForm";
import { maxLength, minLength, postalCode, required } from "../../../lib/validation";
import TextField from "../../../ui/TextField";

export interface Address {
  id: string;
  label: string;
  street: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface AddressFormProps {
  // the address that is changed, or nothing for a new one
  address?: Address;
  onSaved: (address: Address) => void;
  onCancel: () => void;
}

const fieldNames = ["label", "street", "street2", "city", "state", "postalCode", "country"] as const;
type Field = (typeof fieldNames)[number];

export default function AddressForm({ address, onSaved, onCancel }: AddressFormProps) {
  const { t, lang } = useLang();
  const [problem, setProblem] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const problemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  const form = useForm<Field>({
    initial: {
      label: address?.label ?? "",
      street: address?.street ?? "",
      street2: address?.street2 ?? "",
      city: address?.city ?? "",
      state: address?.state ?? "",
      postalCode: address?.postalCode ?? "",
      country: address?.country ?? "",
    },
    rules: {
      label: [required, maxLength(40)],
      street: [required, maxLength(120)],
      street2: [maxLength(120)],
      city: [required, maxLength(80)],
      state: [required, maxLength(80)],
      postalCode: [required, minLength(2), maxLength(20), postalCode],
      country: [required, minLength(2), maxLength(80)],
    },
    onSubmit: async (values) => {
      setProblem("");
      const body = Object.fromEntries(fieldNames.map((name) => [name, values[name].trim()]));
      try {
        const answer = address
          ? await api.patch<{ address: Address }>(`/users/me/addresses/${address.id}`, { lang, json: body })
          : await api.post<{ address: Address }>("/users/me/addresses", { lang, json: { ...body, ...(makeDefault ? { isDefault: true } : {}) } });
        onSaved(answer.address);
      } catch (error) {
        if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
          const fields: Partial<Record<Field, string>> = {};
          for (const detail of error.details) {
            const name = fieldNames.find((candidate) => candidate === detail.field);
            if (name) fields[name] = name === "postalCode" ? t("errors.postalCode") : t("errors.required");
          }
          if (Object.keys(fields).length > 0) {
            form.setFieldErrors(fields);
            return;
          }
        }
        if (error instanceof ApiError && error.code === "ADDRESS_LIMIT") setProblem(t("addresses.limit"));
        else setProblem(error instanceof ApiError && error.status === 0 ? t("addresses.errors.network") : t("addresses.errors.save"));
      }
    },
  });

  // the keyboard goes to the first field when the form opens
  useEffect(() => {
    requestAnimationFrame(() => form.formRef.current?.querySelector("input")?.focus());
    // only when it opens
  }, []);

  return (
    <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate aria-busy={form.submitting} aria-labelledby="address-form-title" className="border border-ink-cacao/30 bg-clay-surface p-5 sm:p-6">
      <h2 id="address-form-title" className="font-spectral text-xl font-semibold text-ink-cacao">
        {address ? t("addresses.form.editTitle") : t("addresses.form.addTitle")}
      </h2>
      <p className="mt-1 font-sans text-xs text-ink-cacao/70">{t("common.requiredNote")}</p>
      {problem && (
        <div ref={problemRef} role="alert" tabIndex={-1} className="mt-4 border-l-4 border-pod-wine bg-stone-paper px-4 py-3 font-sans text-sm text-ink-cacao">
          {problem}
        </div>
      )}
      <div className="grid gap-x-8 gap-y-6 py-6 sm:grid-cols-2">
        <TextField label={t("addresses.form.label")} required hint={t("addresses.form.labelHint")} {...form.field("label")} />
        <TextField label={t("addresses.form.street")} autoComplete="address-line1" required {...form.field("street")} />
        <TextField label={t("addresses.form.street2")} autoComplete="address-line2" {...form.field("street2")} />
        <TextField label={t("addresses.form.city")} autoComplete="address-level2" required {...form.field("city")} />
        <TextField label={t("addresses.form.state")} autoComplete="address-level1" required {...form.field("state")} />
        <TextField label={t("addresses.form.postalCode")} autoComplete="postal-code" required {...form.field("postalCode")} />
        <TextField label={t("addresses.form.country")} autoComplete="country-name" required {...form.field("country")} />
      </div>

      {!address && (
        <label className="flex min-h-11 items-center gap-3 font-sans text-sm text-ink-cacao">
          <input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} className="h-5 w-5 accent-ink-cacao" />
          {t("addresses.form.makeDefault")}
        </label>
      )}

      <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="min-h-11 border border-ink-cacao px-6 py-3 font-sans text-sm text-ink-cacao hover:bg-stone-paper">
          {t("addresses.form.cancel")}
        </button>
        <button type="submit" className="min-h-11 bg-sun-gold px-7 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/85">
          {form.submitting ? t("addresses.form.saving") : t("addresses.form.save")}
        </button>
      </div>
    </form>
  );
}
