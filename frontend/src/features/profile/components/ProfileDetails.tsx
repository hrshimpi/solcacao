// The personal details: name, email (read only, it is how the person signs in), phone and the language of the emails.
// The values are read only until Edit profile is pressed, then they are saved with the server. A problem is shown on
// its field or above the form, and the typed values stay. The page gives the form a new key each time it opens or closes,
// so it always starts from what is saved.
import { useEffect, useRef, useState } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { api } from "../../../lib/api";
import { ApiError } from "../../../lib/apiFetch";
import { readServerUser } from "../../../lib/session";
import { useForm } from "../../../lib/useForm";
import { maxLength, phone as phoneRule, required } from "../../../lib/validation";
import { CheckIcon } from "../../../ui/Icons";
import { useAnnounce } from "../../../ui/LiveRegion";
import RadioRow from "../../../ui/RadioRow";
import TextField from "../../../ui/TextField";
import { toAuthUser, useAuth } from "../../auth/AuthContext";

interface ProfileDetailsProps {
  editing: boolean;
  justSaved: boolean;
  onSaved: () => void;
}

export default function ProfileDetails({ editing, justSaved, onSaved }: ProfileDetailsProps) {
  const { t, lang } = useLang();
  const { user, updateUser } = useAuth();
  const announce = useAnnounce();
  const [problem, setProblem] = useState("");
  const problemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  const form = useForm({
    initial: { name: user?.name ?? "", phone: user?.phone ?? "", language: user?.preferredLanguage ?? "en" },
    rules: { name: [required, maxLength(80)], phone: [phoneRule] },
    onSubmit: async (values) => {
      setProblem("");
      try {
        const answer = await api.patch<{ user: unknown }>("/users/me", {
          lang,
          json: { name: values.name.trim(), phone: values.phone.trim(), preferredLanguage: values.language },
        });
        const saved = readServerUser(answer.user);
        if (!saved) throw new ApiError("The answer was not valid.");
        updateUser(toAuthUser(saved, { companyName: user?.companyName, verificationStatus: user?.verificationStatus }));
        announce(t("profile.saved"));
        onSaved();
      } catch (error) {
        if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
          const fields: Partial<Record<"name" | "phone", string>> = {};
          for (const detail of error.details) {
            if (detail.field === "name") fields.name = t("errors.required");
            if (detail.field === "phone") fields.phone = t("errors.phone");
          }
          if (Object.keys(fields).length > 0) {
            form.setFieldErrors(fields);
            return;
          }
        }
        setProblem(error instanceof ApiError && error.status === 0 ? t("profile.errors.network") : t("profile.errors.save"));
      }
    },
  });

  // when the form opens, the keyboard goes to its first field
  useEffect(() => {
    if (editing) requestAnimationFrame(() => form.formRef.current?.querySelector<HTMLInputElement>("input:not([readonly])")?.focus());
    // only when it opens
  }, []);

  if (!user) return null;
  const language = form.field("language");

  return (
    <section aria-labelledby="profile-personal">
      <div className="flex items-center justify-between gap-4 border-b border-ink-cacao pb-4">
        <h2 id="profile-personal" className="font-spectral text-2xl font-semibold text-ink-cacao">
          {t("profile.personal")}
        </h2>
      </div>

      {justSaved && !editing && (
        <p className="mt-4 flex items-center gap-2 font-sans text-sm text-ink-cacao">
          <CheckIcon size={16} className="text-canopy-green" />
          {t("profile.saved")}
        </p>
      )}

      <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate aria-busy={form.submitting}>
        {editing && <p className="mt-4 font-sans text-xs text-ink-cacao/70">{t("common.requiredNote")}</p>}
        {problem && (
          <div ref={problemRef} role="alert" tabIndex={-1} className="mt-4 border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
            {problem}
          </div>
        )}
        <div className="grid gap-x-10 gap-y-6 py-6 sm:grid-cols-2">
          <TextField label={t("profile.name")} autoComplete="name" required readOnly={!editing} {...form.field("name")} />
          <TextField label={t("profile.email")} type="email" autoComplete="email" readOnly name="email" value={user.email} hint={editing ? t("profile.emailNote") : undefined} />
          <TextField label={t("profile.phone")} type="tel" autoComplete="tel" readOnly={!editing} placeholder={editing ? undefined : t("profile.phoneNone")} {...form.field("phone")} />
          {editing ? (
            <RadioRow
              legend={t("profile.language")}
              name="language"
              value={language.value}
              onChange={language.onChange}
              options={[
                { id: "en", label: t("profile.english") },
                { id: "es", label: t("profile.spanish") },
              ]}
            />
          ) : (
            <TextField label={t("profile.language")} readOnly name="language" value={t(user.preferredLanguage === "es" ? "profile.spanish" : "profile.english")} />
          )}
        </div>

        {editing && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="min-h-11 w-full bg-sun-gold px-7 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/85 sm:w-auto"
            >
              {form.submitting ? t("profile.saving") : t("profile.save")}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
