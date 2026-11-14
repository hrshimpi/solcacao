// The profile page, for a signed in person (the route sends everybody else to the sign in page). The details are read only
// until Edit profile is pressed, then they are saved with the server. A business account also sees its business details.
import { useEffect, useRef, useState } from "react";
import { useLang } from "../../i18n/LanguageContext";
import { usePageTitle } from "../../lib/usePageTitle";
import { useAuth } from "../auth/AuthContext";
import AccountSettings from "./components/AccountSettings";
import AccountSummary from "./components/AccountSummary";
import AddressesLink from "./components/AddressesLink";
import BusinessDetails from "./components/BusinessDetails";
import OrdersLink from "./components/OrdersLink";
import ProfileDetails from "./components/ProfileDetails";
import WholesaleLinks from "./components/WholesaleLinks";

export default function ProfilePage() {
  const { t } = useLang();
  const { user } = useAuth();
  usePageTitle(t("titles.profile"));

  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // when the form closes, its buttons disappear, so focus goes back to the Edit profile button
  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  if (!user) return null;

  const since = new Date(user.createdAt);
  const memberSince = Number.isNaN(since.getTime()) ? null : since.getFullYear();

  return (
    <div className="bg-stone-paper">
      <div className="border-b border-ink-cacao">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6 md:py-14">
          <div>
            {memberSince !== null && <p className="mb-3 font-sans text-[11px] uppercase tracking-[0.18em] text-pod-wine">{t("profile.eyebrow", { year: memberSince })}</p>}
            <h1 className="font-spectral text-4xl font-semibold tracking-tight text-ink-cacao md:text-5xl">{t("profile.title")}</h1>
          </div>
          <button
            ref={editButton}
            type="button"
            onClick={() => {
              setJustSaved(false);
              setEditing((open) => !open);
            }}
            className={`min-h-11 self-start border px-6 py-3 font-sans text-sm font-medium sm:self-auto ${
              editing
                ? "border-ink-cacao text-ink-cacao hover:bg-clay-surface"
                : "border-sun-gold bg-sun-gold text-ink-cacao hover:bg-sun-gold/85"
            }`}
          >
            {editing ? t("profile.cancel") : t("profile.edit")}
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-10 sm:px-6 md:py-16 lg:grid-cols-[1fr_2fr] lg:gap-20">
        <AccountSummary user={user} />
        <div>
          <ProfileDetails
            key={editing ? "editing" : "reading"}
            editing={editing}
            justSaved={justSaved}
            onSaved={() => {
              setJustSaved(true);
              setEditing(false);
            }}
          />
          {user.accountType === "business" && <BusinessDetails />}
          <OrdersLink />
          <AddressesLink />
          <WholesaleLinks />
          <AccountSettings />
        </div>
      </div>
    </div>
  );
}
