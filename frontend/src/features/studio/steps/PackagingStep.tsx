// Step 2 of the studio: the packaging, one of four cards. The error shows when Continue was pressed with no choice.
import { useLang } from "../../../i18n/LanguageContext";
import ChoiceCards from "../components/ChoiceCards";
import { packagingIds, type PackagingId } from "../studioOptions";

interface PackagingStepProps {
  // the id of the step heading, which names the group of cards
  headingId: string;
  value: PackagingId | null;
  onChange: (packaging: PackagingId) => void;
  error?: string;
}

export default function PackagingStep({ headingId, value, onChange, error }: PackagingStepProps) {
  const { t } = useLang();

  return (
    <ChoiceCards
      name="packaging"
      labelledBy={headingId}
      value={value}
      onChange={onChange}
      error={error}
      className="grid-cols-1 md:grid-cols-2"
      choices={packagingIds.map((id) => ({
        id,
        label: t(`studio.packaging.${id}.label`),
        sub: t(`studio.packaging.${id}.sub`),
      }))}
    />
  );
}
