// Account settings: a password reset panel, the notifications switch and the log out link.
import { useState } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { ArrowRightIcon } from "../../../ui/Icons";
import { useAnnounce } from "../../../ui/LiveRegion";
import LocaleLink from "../../../ui/LocaleLink";

const rowClass = "group flex min-h-14 w-full items-center justify-between border-b border-ink-cacao/20 py-4 text-left";

export default function AccountSettings() {
  const { t } = useLang();
  const announce = useAnnounce();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [notifications, setNotifications] = useState(true);

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
        onClick={() => setPasswordOpen((open) => !open)}
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

      {passwordOpen && (
        <div
          id="password-panel"
          className="flex flex-col justify-between gap-4 border-b border-ink-cacao/20 bg-clay-surface px-5 py-5 sm:flex-row sm:items-center"
        >
          <div>
            <p className="font-spectral font-semibold text-ink-cacao">{t("profile.passwordPanel")}</p>
            <p className="mt-1 font-sans text-xs text-ink-cacao/70">{t("profile.passwordBody")}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setResetSent(true);
              announce(t("profile.resetSentAnnounce"));
            }}
            className="min-h-11 shrink-0 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-ink-cacao hover:text-paper-text"
          >
            {resetSent ? t("profile.resetSent") : t("profile.send")}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-ink-cacao/20 py-4">
        <div className="pr-4">
          <p id="notifications-label" className="font-sans text-sm font-medium text-ink-cacao">
            {t("profile.notifications")}
          </p>
          <p id="notifications-hint" className="mt-1 font-sans text-xs text-ink-cacao/70">
            {t("profile.notificationsHint")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={notifications}
          aria-labelledby="notifications-label"
          aria-describedby="notifications-hint"
          onClick={() => setNotifications((on) => !on)}
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

      <LocaleLink to="/account/login" className={rowClass}>
        <span>
          <span className="block font-sans text-sm font-medium text-pod-wine">{t("profile.logout")}</span>
          <span className="mt-1 block font-sans text-xs text-ink-cacao/70">{t("profile.logoutHint")}</span>
        </span>
        <ArrowRightIcon className="text-pod-wine group-hover:translate-x-1" />
      </LocaleLink>
    </section>
  );
}
