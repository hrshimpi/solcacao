// The sign in page. The form is checked here first, then the server checks the email and the password. A problem is shown
// above the form, in the language of the page, and the typed values stay. After a good sign in the person goes back to the
// page that asked for it (?next=), or home, in the language they are using.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useLang } from "../../i18n/LanguageContext";
import { useForm } from "../../lib/useForm";
import { usePageTitle } from "../../lib/usePageTitle";
import { email, required } from "../../lib/validation";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import TextField from "../../ui/TextField";
import { useAuth } from "./AuthContext";
import AuthShell from "./components/AuthShell";
import { signInMessage } from "./authMessages";
import { safeNextPath } from "./nextPath";

export default function LoginPage() {
  const { t, path } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signIn } = useAuth();
  const announce = useAnnounce();
  usePageTitle(t("titles.login"));

  const [problem, setProblem] = useState("");
  const problemRef = useRef<HTMLDivElement>(null);

  // a new problem is read out and the keyboard goes to it
  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  const form = useForm({
    initial: { email: "", password: "" },
    rules: { email: [required, email], password: [required] },
    onSubmit: async (values) => {
      setProblem("");
      try {
        await signIn(values.email.trim(), values.password);
        const next = safeNextPath(params.get("next"));
        announce(t("auth.signedIn"));
        // replace when coming back to a page, so Back does not return to the sign in form
        navigate(path(next ?? "/"), { replace: next !== null });
      } catch (error) {
        setProblem(signInMessage(error, t));
      }
    },
  });

  return (
    <AuthShell title={t("auth.signIn")}>
      <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate aria-busy={form.submitting} className="space-y-6">
        {problem && (
          <div ref={problemRef} role="alert" tabIndex={-1} className="border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
            {problem}
          </div>
        )}
        <TextField label={t("auth.email")} type="email" autoComplete="email" required placeholder="you@domain.com" {...form.field("email")} />
        <TextField label={t("auth.password")} type="password" autoComplete="current-password" required {...form.field("password")} />
        <button
          type="submit"
          className="mt-4 min-h-11 w-full bg-sun-gold py-3.5 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90"
        >
          {form.submitting ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>

      <p className="mt-6">
        <LocaleLink to="/account/forgot-password" className="inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
          {t("auth.forgotLink")}
        </LocaleLink>
      </p>
      <p>
        <LocaleLink to="/account/register" className="inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
          {t("auth.newHere")}
        </LocaleLink>
      </p>
    </AuthShell>
  );
}
