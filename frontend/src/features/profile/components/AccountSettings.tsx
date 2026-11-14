// Account settings: a password change, the notifications switch and the log out button. The password change asks for the
// current password, ends the sign in of every other device, and keeps this one signed in with a new token.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useLang } from "../../../i18n/LanguageContext";
import { api } from "../../../lib/api";
import { ApiError } from "../../../lib/apiFetch";
import { setAuthToken } from "../../../lib/authToken";
import { readSession, readServerUser } from "../../../lib/session";
import { useForm } from "../../../lib/useForm";
import { newPassword, required } from "../../../lib/validation";
import { ArrowRightIcon, CheckIcon } from "../../../ui/Icons";
import { useAnnounce } from "../../../ui/LiveRegion";
import TextField from "../../../ui/TextField";
import { toAuthUser, useAuth } from "../../auth/AuthContext";

const rowClass = "group flex min-h-14 w-full items-center justify-between border-b border-ink-cacao/20 py-4 text-left";

function PasswordPanel({ onChanged }: { onChanged: () => void }) {
  const { t, lang } = useLang();
  const { user, updateUser } = useAuth();
  const announce = useAnnounce();
  const [problem, setProblem] = useState("");
  const problemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  const form = useForm({
    initial: { current: "", next: "" },
    rules: { current: [required], next: [required, newPassword] },
    onSubmit: async (values) => {
      setProblem("");
      if (values.current === values.next) {
        form.setFieldErrors({ next: t("profile.passwordPanel.same") });
        return;
      }
      try {
        const answer = await api.patch<unknown>("/users/me/password", { lang, json: { currentPassword: values.current, newPassword: values.next } });
        // the other devices were signed out, and this one gets a new sign in
        const session = readSession(answer);
        if (!session) throw new ApiError("The answer was not valid.");
        setAuthToken(session.accessToken);
        updateUser(toAuthUser(session.user, { companyName: user?.companyName, verificationStatus: user?.verificationStatus }));
        announce(t("profile.passwordPanel.changed"));
        onChanged();
      } catch (error) {
        if (error instanceof ApiError && error.code === "WRONG_PASSWORD") {
          form.setFieldErrors({ current: t("profile.passwordPanel.wrong") });
          return;
        }
        if (error instanceof ApiError && error.code === "VALIDATION_ERROR" && error.details.some((detail) => detail.field === "newPassword")) {
          form.setFieldErrors({ next: t("errors.password") });
          return;
        }
        if (error instanceof ApiError && (error.status === 429 || error.code === "RATE_LIMITED")) setProblem(t("auth.errors.tooMany"));
        else setProblem(error instanceof ApiError && error.status === 0 ? t("profile.errors.network") : t("profile.errors.save"));
      }
    },
  });

  useEffect(() => {
    requestAnimationFrame(() => form.formRef.current?.querySelector("input")?.focus());
    // only when it opens
  }, []);

  return (
    <form
      ref={form.formRef}
      id="password-panel"
      onSubmit={form.handleSubmit}
      noValidate
      aria-busy={form.submitting}
      className="space-y-6 border-b border-ink-cacao/20 bg-clay-surface px-5 py-5"
    >
      {problem && (
        <div ref={problemRef} role="alert" tabIndex={-1} className="border-l-4 border-pod-wine bg-stone-paper px-4 py-3 font-sans text-sm text-ink-cacao">
          {problem}
        </div>
      )}
      <TextField label={t("profile.passwordPanel.current")} type="password" autoComplete="current-password" required {...form.field("current")} />
      <TextField label={t("profile.passwordPanel.new")} type="password" autoComplete="new-password" required hint={t("auth.passwordHint")} {...form.field("next")} />
      <button
        type="submit"
        className="min-h-11 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-ink-cacao hover:text-paper-text"
      >
        {form.submitting ? t("profile.passwordPanel.saving") : t("profile.passwordPanel.submit")}
      </button>
    </form>
  );
}

export default function AccountSettings() {
  const { t, lang, path } = useLang();
  const { user, updateUser, signOut } = useAuth();
  const navigate = useNavigate();
  const announce = useAnnounce();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [notificationsProblem, setNotificationsProblem] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user) return null;
  const notifications = user.marketingEmails;

  async function toggleNotifications() {
    if (saving) return;
    setSaving(true);
    setNotificationsProblem(false);
    try {
      const answer = await api.patch<{ user: unknown }>("/users/me", { lang, json: { marketingEmails: !notifications } });
      const saved = readServerUser(answer.user);
      if (!saved) throw new ApiError("The answer was not valid.");
      updateUser({ marketingEmails: saved.marketingEmails });
    } catch {
      setNotificationsProblem(true);
    } finally {
      setSaving(false);
    }
  }

  async function logOut() {
    await signOut();
    announce(t("profile.logout"));
    navigate(path("/account/login"));
  }

  return (
    <section aria-labelledby="profile-settings" className="mt-14 md:mt-16">
      <div className="border-b border-ink-cacao pb-4">
        <h2 id="profile-settings" className="font-spectral text-2xl font-semibold text-ink-cacao">
          {t("profile.settings")}
        </h2>
        <p className="mt-1 font-sans text-xs text-ink-cacao/70">{t("profile.settingsNote")}</p>
      </div>

      <button
        type="button"
        onClick={() => {
          setPasswordChanged(false);
          setPasswordOpen((open) => !open);
        }}
        aria-expanded={passwordOpen}
        aria-controls="password-panel"
        className={rowClass}
      >
        <span>
          <span className="block font-sans text-sm font-medium text-ink-cacao">{t("profile.password")}</span>
          <span className="mt-1 block font-sans text-xs text-ink-cacao/70">{t("profile.passwordHint")}</span>
        </span>
        <ArrowRightIcon className={`text-ink-cacao/70 group-hover:text-pod-wine ${passwordOpen ? "rotate-90" : ""}`} />
      </button>

      {passwordChanged && (
        <p className="flex items-center gap-2 border-b border-ink-cacao/20 py-4 font-sans text-sm text-ink-cacao">
          <CheckIcon size={16} className="text-canopy-green" />
          {t("profile.passwordPanel.changed")}
        </p>
      )}

      {passwordOpen && (
        <PasswordPanel
          onChanged={() => {
            setPasswordOpen(false);
            setPasswordChanged(true);
          }}
        />
      )}

      <div className="flex items-center justify-between border-b border-ink-cacao/20 py-4">
        <div className="pr-4">
          <p id="notifications-label" className="font-sans text-sm font-medium text-ink-cacao">
            {t("profile.notifications")}
          </p>
          <p id="notifications-hint" className="mt-1 font-sans text-xs text-ink-cacao/70">
            {t("profile.notificationsHint")}
          </p>
          {notificationsProblem && (
            <p role="alert" className="mt-1 font-sans text-xs font-medium text-pod-wine">
              {t("profile.notificationsError")}
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={notifications}
          aria-labelledby="notifications-label"
          aria-describedby="notifications-hint"
          aria-busy={saving}
          onClick={toggleNotifications}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center"
        >
          <span
            className={`relative block h-6 w-11 border ${
              notifications ? "border-canopy-green bg-canopy-green" : "border-ink-cacao/60 bg-transparent"
            }`}
          >
            <span
              className={`absolute top-1 block h-3.5 w-3.5 ${notifications ? "left-6 bg-stone-paper" : "left-1 bg-ink-cacao/70"}`}
            />
          </span>
        </button>
      </div>

      <button type="button" onClick={logOut} className={rowClass}>
        <span>
          <span className="block font-sans text-sm font-medium text-pod-wine">{t("profile.logout")}</span>
          <span className="mt-1 block font-sans text-xs text-ink-cacao/70">{t("profile.logoutHint")}</span>
        </span>
        <ArrowRightIcon className="text-pod-wine group-hover:translate-x-1" />
      </button>
    </section>
  );
}
