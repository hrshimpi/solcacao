// The profile page. Details are read only until Edit profile is pressed, then they can be changed and saved.
// Nothing is sent to a server yet, so the saved values only live while the page is open.
import { useEffect, useRef, useState } from "react";
import { useLang } from "../../i18n/LanguageContext";
import { useForm } from "../../lib/useForm";
import { usePageTitle } from "../../lib/usePageTitle";
import { email, maxLength, phone, required } from "../../lib/validation";
import { useAnnounce } from "../../ui/LiveRegion";
import AccountSettings from "./components/AccountSettings";
import ProfileDetails, { type ProfileFields } from "./components/ProfileDetails";
import ProfilePhoto from "./components/ProfilePhoto";
import WholesaleLinks from "./components/WholesaleLinks";

const startValues: Record<ProfileFields, string> = {
  name: "Isabel Vásquez",
  email: "isabel.vasquez@example.com",
  location: "Austin, Texas",
  phone: "+1 512 555 0184",
  bio: "",
};

export default function ProfilePage() {
  const { t } = useLang();
  const announce = useAnnounce();
  usePageTitle(t("titles.profile"));

  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(startValues);
  const [justSaved, setJustSaved] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  const form = useForm<ProfileFields>({
    initial: saved,
    rules: {
      name: [required, maxLength(80)],
      email: [required, email],
      location: [maxLength(80)],
      phone: [phone],
      bio: [maxLength(300)],
    },
    onSubmit: (values) => {
      setSaved(values);
      setEditing(false);
      setJustSaved(true);
      announce(t("profile.saved"));
    },
  });

  // when the form closes, its buttons disappear, so focus goes back to the Edit profile button
  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  function toggleEditing() {
    if (editing) {
      form.reset();
      setEditing(false);
      return;
    }
    // the sample bio comes from the dictionary, so it follows the language until the user writes their own
    if (!form.values.bio) form.field("bio").onChange(t("profile.bioText"));
    setJustSaved(false);
    setEditing(true);
    requestAnimationFrame(() => form.formRef.current?.querySelector("input")?.focus());
  }

  return (
    <div className="bg-stone-paper">
      <div className="border-b border-ink-cacao">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6 md:py-14">
          <div>
            <p className="mb-3 font-sans text-[11px] uppercase tracking-[0.18em] text-pod-wine">{t("profile.eyebrow")}</p>
            <h1 className="font-spectral text-4xl font-semibold tracking-tight text-ink-cacao md:text-5xl">{t("profile.title")}</h1>
          </div>
          <button
            ref={editButton}
            type="button"
            onClick={toggleEditing}
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
        <ProfilePhoto name={saved.name} email={saved.email} editing={editing} />
        <div>
          <ProfileDetails
            editing={editing}
            justSaved={justSaved}
            formRef={form.formRef}
            onSubmit={form.handleSubmit}
            field={form.field}
            defaultBio={t("profile.bioText")}
          />
          <WholesaleLinks />
          <AccountSettings />
        </div>
      </div>
    </div>
  );
}
