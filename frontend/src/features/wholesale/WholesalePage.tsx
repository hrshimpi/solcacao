// The wholesale landing page for hotels, retailers and companies.
import { useLang } from "../../i18n/LanguageContext";
import { usePageTitle } from "../../lib/usePageTitle";
import HowItWorks from "./components/HowItWorks";
import WholesaleFeatures from "./components/WholesaleFeatures";
import WholesaleHero from "./components/WholesaleHero";

export default function WholesalePage() {
  const { t } = useLang();
  usePageTitle(t("titles.wholesale"));

  return (
    <>
      <WholesaleHero />
      <WholesaleFeatures />
      <HowItWorks />
    </>
  );
}
