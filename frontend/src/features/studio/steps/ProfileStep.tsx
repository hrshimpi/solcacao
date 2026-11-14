// Step 1 of the studio: the cacao profile, one of six cards. The error shows when Continue was pressed with no choice.
import { useLang } from "../../../i18n/LanguageContext";
import ChoiceCards from "../components/ChoiceCards";
import { profileColors, profileIds, type ProfileId } from "../studioOptions";

interface ProfileStepProps {
  // the id of the step heading, which names the group of cards
  headingId: string;
  value: ProfileId | null;
  onChange: (profile: ProfileId) => void;
  error?: string;
}

export default function ProfileStep({ headingId, value, onChange, error }: ProfileStepProps) {
  const { t } = useLang();

  return (
    <ChoiceCards
      name="profile"
      labelledBy={headingId}
      value={value}
      onChange={onChange}
      error={error}
      className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
      choices={profileIds.map((id) => ({
        id,
        label: t(`studio.profiles.${id}.label`),
        sub: t(`studio.profiles.${id}.sub`),
        color: profileColors[id],
      }))}
    />
  );
}
