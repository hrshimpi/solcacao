// Asks for a link to choose a new password. The answer is always the same, whether the email has an account or not, so the
// page cannot be used to find out who has one.
import { useEffect, useRef, useState } from "react";
import { useLang } from "../../i18n/LanguageContext";
import { apiFetch } from "../../lib/apiFetch";
import { useForm } from "../../lib/useForm";
import { usePageTitle } from "../../lib/usePageTitle";
import { email, required } from "../../lib/validation";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import TextField from "../../ui/TextField";
import AuthShell from "./components/AuthShell";
import { signInMessage } from "./authMessages";

export default function ForgotPasswordPage() {
  const { t, lang } = useLang();
  const announce = useAnnounce();
  usePageTitle(t("titles.forgot"));

  const [problem, setProblem] = useState("");
  const [sentTo, setSentTo] = useState("");
  const problemRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  useEffect(() => {
    if (sentTo) sentRef.current?.focus();
  }, [sentTo]);

  const form = useForm({
    initial: { email: "" },
    rules: { email: [required, email] },
    onSubmit: async (values) => {
      setProblem("");
      const address = values.email.trim();
      try {
        await apiFetch("/auth/forgot-password", { lang, method: "POST", json: { email: address } });
        setSentTo(address);
        announce(t("auth.forgot.sentAnnounce"));
      } catch (error) {
        setProblem(signInMessage(error, t));
      }
    },
  });

  return (
    <AuthShell title={t("auth.forgot.title")}>
      {sentTo ? (
        <p ref={sentRef} tabIndex={-1} className="border-l-4 border-canopy-green bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
          {t("auth.forgot.sent", { email: sentTo })}
        </p>
      ) : (
        <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate aria-busy={form.submitting} className="space-y-6">
          <p className="font-sans text-sm text-ink-cacao/80">{t("auth.forgot.intro")}</p>
          {problem && (
            <div ref={problemRef} role="alert" tabIndex={-1} className="border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
              {problem}
            </div>
          )}
          <TextField label={t("auth.email")} type="email" autoComplete="email" required placeholder="you@domain.com" {...form.field("email")} />
          <button
            type="submit"
            className="mt-4 min-h-11 w-full bg-sun-gold py-3.5 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90"
          >
            {form.submitting ? t("auth.forgot.sending") : t("auth.forgot.send")}
          </button>
        </form>
      )}

      <p className="mt-6">
        <LocaleLink to="/account/login" className="inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
          {t("auth.forgot.back")}
        </LocaleLink>
      </p>
    </AuthShell>
  );
}
