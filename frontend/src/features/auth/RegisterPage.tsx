// The create account page. A business account also asks for the company name.
// The address ?type=business opens it on the business account, which is where the studio sends retail accounts.
// The server checks the form again: an email that has an account is shown on the email field, and any other problem above the form.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useLang } from "../../i18n/LanguageContext";
import { useForm } from "../../lib/useForm";
import { usePageTitle } from "../../lib/usePageTitle";
import { email, maxLength, newPassword, required } from "../../lib/validation";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import TextField from "../../ui/TextField";
import { useAuth } from "./AuthContext";
import AuthShell, { type AccountType } from "./components/AuthShell";
import { registerProblem } from "./authMessages";

export default function RegisterPage() {
  const { t, path } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { register } = useAuth();
  const announce = useAnnounce();
  usePageTitle(t("titles.register"));

  const [accountType, setAccountType] = useState<AccountType>(params.get("type") === "business" ? "business" : "retail");
  const [problem, setProblem] = useState("");
  const problemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  const form = useForm({
    initial: { name: "", company: "", email: "", password: "" },
    rules: {
      name: [required, maxLength(80)],
      company: accountType === "business" ? [required, maxLength(120)] : [],
      email: [required, email],
      password: [required, newPassword],
    },
    onSubmit: async (values) => {
      setProblem("");
      try {
        await register({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          accountType,
          companyName: accountType === "business" ? values.company.trim() : undefined,
        });
        announce(t("auth.created"));
        navigate(path("/"));
      } catch (error) {
        const found = registerProblem(error, t);
        if (Object.keys(found.fields).length > 0) form.setFieldErrors(found.fields);
        if (found.form) setProblem(found.form);
      }
    },
  });

  return (
    <AuthShell title={t("auth.createAccount")} accountType={accountType} onAccountTypeChange={setAccountType}>
      <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate aria-busy={form.submitting} className="space-y-6">
        {problem && (
          <div ref={problemRef} role="alert" tabIndex={-1} className="border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
            {problem}
          </div>
        )}
        <p className="font-sans text-xs text-ink-cacao/70">{t("common.requiredNote")}</p>
        <TextField label={t("auth.fullName")} autoComplete="name" required placeholder="Isabel Vásquez" {...form.field("name")} />
        {accountType === "business" && (
          <TextField label={t("auth.company")} autoComplete="organization" required placeholder="Hacienda Brands" {...form.field("company")} />
        )}
        <TextField label={t("auth.email")} type="email" autoComplete="email" required placeholder="you@domain.com" {...form.field("email")} />
        <TextField
          label={t("auth.password")}
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
          {form.submitting ? t("auth.creating") : t("auth.createAccount")}
        </button>
      </form>

      <p className="mt-6">
        <LocaleLink to="/account/login" className="inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
          {t("auth.haveAccount")}
        </LocaleLink>
      </p>
    </AuthShell>
  );
}
