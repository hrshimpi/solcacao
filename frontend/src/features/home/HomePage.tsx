// The home page, built from five sections.
import { useLang } from "../../i18n/LanguageContext";
import { usePageTitle } from "../../lib/usePageTitle";
import BrandStory from "./components/BrandStory";
import HomeHero from "./components/HomeHero";
import ProvenanceStats from "./components/ProvenanceStats";
import SeasonalShowcase from "./components/SeasonalShowcase";
import WholesaleTeaser from "./components/WholesaleTeaser";

export default function HomePage() {
  const { t } = useLang();
  usePageTitle(t("titles.home"));

  return (
    <>
      <HomeHero />
      <SeasonalShowcase />
      <BrandStory />
      <ProvenanceStats />
      <WholesaleTeaser />
    </>
  );
}
