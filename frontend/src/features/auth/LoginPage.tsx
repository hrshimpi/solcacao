// The sign in page. There is no account system yet, so a valid form only shows a preview message and goes home.
import { useState } from "react";
import { useNavigate } from "react-router";
import { useLang } from "../../i18n/LanguageContext";
import { useForm } from "../../lib/useForm";
import { usePageTitle } from "../../lib/usePageTitle";
import { email, required } from "../../lib/validation";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import TextField from "../../ui/TextField";
import AuthShell, { type AccountType } from "./components/AuthShell";

export default function LoginPage() {
  const { t, path } = useLang();
  const navigate = useNavigate();
  const announce = useAnnounce();
  usePageTitle(t("titles.login"));

  const [accountType, setAccountType] = useState<AccountType>("retail");

  const form = useForm({
    initial: { email: "", password: "" },
    rules: { email: [required, email], password: [required] },
    onSubmit: () => {
      announce(t("auth.signedIn"));
      navigate(path("/"));
    },
  });

  return (
    <AuthShell title={t("auth.signIn")} accountType={accountType} onAccountTypeChange={setAccountType}>
      <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="space-y-6">
        <TextField label={t("auth.email")} type="email" autoComplete="email" required placeholder="you@domain.com" {...form.field("email")} />
        <TextField label={t("auth.password")} type="password" autoComplete="current-password" required {...form.field("password")} />
        <button
          type="submit"
          className="mt-4 min-h-11 w-full bg-sun-gold py-3.5 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90"
        >
          {t("auth.signIn")}
        </button>
      </form>

      <p className="mt-6">
        <LocaleLink to="/account/register" className="inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
          {t("auth.newHere")}
        </LocaleLink>
      </p>
    </AuthShell>
  );
}
