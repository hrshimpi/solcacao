// The personal details form. The fields are read only until Edit profile is pressed.
import type { FormEvent, RefObject } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { CheckIcon } from "../../../ui/Icons";
import TextField from "../../../ui/TextField";

export type ProfileFields = "name" | "email" | "location" | "phone" | "bio";

interface FieldProps {
  name: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

interface ProfileDetailsProps {
  editing: boolean;
  justSaved: boolean;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (event: FormEvent) => void;
  field: (name: ProfileFields) => FieldProps;
  defaultBio: string;
}

export default function ProfileDetails({ editing, justSaved, formRef, onSubmit, field, defaultBio }: ProfileDetailsProps) {
  const { t } = useLang();
  const bio = field("bio");

  return (
    <section aria-labelledby="profile-personal">
      <div className="flex items-center justify-between gap-4 border-b border-ink-cacao pb-4">
        <h2 id="profile-personal" className="font-spectral text-2xl font-semibold text-ink-cacao">
          {t("profile.personal")}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-cacao/70">SC-ACCT-0417</span>
      </div>

      {justSaved && !editing && (
        <p className="mt-4 flex items-center gap-2 font-sans text-sm text-ink-cacao">
          <CheckIcon size={16} className="text-canopy-green" />
          {t("profile.saved")}
        </p>
      )}

      <form ref={formRef} onSubmit={onSubmit} noValidate>
        {editing && <p className="mt-4 font-sans text-xs text-ink-cacao/70">{t("common.requiredNote")}</p>}
        <div className="grid gap-x-10 gap-y-6 py-6 sm:grid-cols-2">
          <TextField label={t("profile.name")} autoComplete="name" required readOnly={!editing} {...field("name")} />
          <TextField label={t("profile.email")} type="email" autoComplete="email" required readOnly={!editing} {...field("email")} />
          <TextField label={t("profile.location")} autoComplete="address-level2" readOnly={!editing} {...field("location")} />
          <TextField label={t("profile.phone")} type="tel" autoComplete="tel" readOnly={!editing} {...field("phone")} />
        </div>
        <TextField
          label={t("profile.bio")}
          multiline
          rows={3}
          readOnly={!editing}
          {...bio}
          value={editing ? bio.value : bio.value || defaultBio}
        />

        {editing && (
          <div className="flex justify-end pt-6">
            <button
              type="submit"
              className="min-h-11 w-full bg-sun-gold px-7 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/85 sm:w-auto"
            >
              {t("profile.save")}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
