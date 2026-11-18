// The column beside the details: the initials of the person, their name and email, the type of account and, for a business
// account, the company. There is no photo: nothing keeps one, so a picture here would only be for show.
import { useLang } from "../../../i18n/LanguageContext";
import type { AuthUser } from "../../auth/AuthContext";

// "Isabel Vasquez" is IV, "Marco" is M, and an account without a name uses the first letter of the email
export function initialsOf(user: Pick<AuthUser, "name" | "email">): string {
  const words = user.name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 0 ? words.slice(0, 2).map((word) => Array.from(word)[0]) : [Array.from(user.email)[0] ?? "?"];
  return letters.join("").toUpperCase();
}

export default function AccountSummary({ user }: { user: AuthUser }) {
  const { t } = useLang();

  return (
    <aside aria-label={t("profile.title")}>
      <div aria-hidden="true" className="flex aspect-square max-w-48 items-center justify-center bg-ink-cacao font-spectral text-6xl font-semibold text-paper-text">
        {initialsOf(user)}
      </div>

      <div className="mt-7 border-t border-ink-cacao/20 pt-5">
        <p className="font-spectral text-2xl font-semibold text-ink-cacao">{user.name || user.email}</p>
        <p className="mt-1 break-words font-sans text-sm text-ink-cacao/70">{user.email}</p>
        <p className="mt-4 font-sans text-[11px] uppercase tracking-widest text-pod-wine">{t(user.accountType === "business" ? "profile.type.business" : "profile.type.retail")}</p>
        {user.companyName && <p className="mt-1 font-sans text-sm text-ink-cacao">{user.companyName}</p>}
        <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ink-cacao/70">{t("profile.accountNumber", { id: `SC-${user.id.slice(-6).toUpperCase()}` })}</p>
      </div>
    </aside>
  );
}
