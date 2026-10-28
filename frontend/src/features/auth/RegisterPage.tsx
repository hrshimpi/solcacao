// The create account page. A business account also asks for the company name.
// The address ?type=business opens it on the business account, which is where the studio sends retail accounts.
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useLang } from "../../i18n/LanguageContext";
import { useForm } from "../../lib/useForm";
import { usePageTitle } from "../../lib/usePageTitle";
import { email, maxLength, minLength, required } from "../../lib/validation";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import TextField from "../../ui/TextField";
import { useAuth } from "./AuthContext";
import AuthShell, { type AccountType } from "./components/AuthShell";

export default function RegisterPage() {
  const { t, path } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signIn } = useAuth();
  const announce = useAnnounce();
  usePageTitle(t("titles.register"));

  const [accountType, setAccountType] = useState<AccountType>(params.get("type") === "business" ? "business" : "retail");

  const form = useForm({
    initial: { name: "", company: "", email: "", password: "" },
    rules: {
      name: [required, maxLength(80)],
      company: accountType === "business" ? [required, maxLength(80)] : [],
      email: [required, email],
      password: [required, minLength(8)],
    },
    onSubmit: (values) => {
      signIn({ email: values.email, accountType });
      announce(t("auth.created"));
      navigate(path("/"));
    },
  });

  return (
    <AuthShell title={t("auth.createAccount")} accountType={accountType} onAccountTypeChange={setAccountType}>
      <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="space-y-6">
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
          {t("auth.createAccount")}
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
