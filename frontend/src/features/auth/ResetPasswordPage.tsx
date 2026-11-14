// Chooses a new password with the token of the link in the email (?token=). A link that is not valid, or has expired, says
// so and offers to ask for a new one. The link works once, so after the password is changed the person signs in with it.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useLang } from "../../i18n/LanguageContext";
import { ApiError, apiFetch } from "../../lib/apiFetch";
import { useForm } from "../../lib/useForm";
import { usePageTitle } from "../../lib/usePageTitle";
import { newPassword, required } from "../../lib/validation";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import TextField from "../../ui/TextField";
import AuthShell from "./components/AuthShell";
import { signInMessage } from "./authMessages";

// the shape of a token that we made: 32 random bytes in base64url. Anything else cannot be a real link.
const tokenShape = /^[A-Za-z0-9_-]{43}$/;

export default function ResetPasswordPage() {
  const { t, lang } = useLang();
  const [params] = useSearchParams();
  const announce = useAnnounce();
  usePageTitle(t("titles.reset"));

  const token = params.get("token") ?? "";
  const [linkIsBad, setLinkIsBad] = useState(!tokenShape.test(token));
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState(false);
  const problemRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  useEffect(() => {
    if (done || linkIsBad) messageRef.current?.focus();
  }, [done, linkIsBad]);

  const form = useForm({
    initial: { password: "" },
    rules: { password: [required, newPassword] },
    onSubmit: async (values) => {
      setProblem("");
      try {
        await apiFetch("/auth/reset-password", { lang, method: "POST", json: { token, password: values.password } });
        setDone(true);
        announce(t("auth.reset.doneAnnounce"));
      } catch (error) {
        if (error instanceof ApiError && error.code === "RESET_LINK_INVALID") {
          setLinkIsBad(true);
          return;
        }
        if (error instanceof ApiError && error.code === "VALIDATION_ERROR" && error.details.some((detail) => detail.field === "password")) {
          form.setFieldErrors({ password: t("errors.password") });
          return;
        }
        setProblem(signInMessage(error, t));
      }
    },
  });

  return (
    <AuthShell title={t("auth.reset.title")}>
      {done ? (
        <>
          <p ref={messageRef} tabIndex={-1} className="border-l-4 border-canopy-green bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
            {t("auth.reset.done")}
          </p>
          <p className="mt-6">
            <LocaleLink to="/account/login" className="inline-flex min-h-11 items-center bg-ink-cacao px-8 py-3 font-sans text-sm font-medium text-stone-paper hover:bg-pod-wine">
              {t("auth.reset.signIn")}
            </LocaleLink>
          </p>
        </>
      ) : linkIsBad ? (
        <>
          <p ref={messageRef} role="alert" tabIndex={-1} className="border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
            {t("auth.reset.invalid")}
          </p>
          <p className="mt-6">
            <LocaleLink to="/account/forgot-password" className="inline-flex min-h-11 items-center bg-ink-cacao px-8 py-3 font-sans text-sm font-medium text-stone-paper hover:bg-pod-wine">
              {t("auth.reset.askAgain")}
            </LocaleLink>
          </p>
        </>
      ) : (
        <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate aria-busy={form.submitting} className="space-y-6">
          <p className="font-sans text-sm text-ink-cacao/80">{t("auth.reset.intro")}</p>
          {problem && (
            <div ref={problemRef} role="alert" tabIndex={-1} className="border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
              {problem}
            </div>
          )}
          <TextField
            label={t("auth.reset.password")}
            type="password"
            autoComplete="new-password"
            required
            hint={t("auth.passwordHint")}
            {...form.field("password")}
          />
          <button
            type="submit"
            className="mt-4 min-h-11 w-full bg-sun-gold py-3.5 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90"
          >
            {form.submitting ? t("auth.reset.saving") : t("auth.reset.submit")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
