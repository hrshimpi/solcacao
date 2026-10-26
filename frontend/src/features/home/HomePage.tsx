// The home page, built from five sections. The featured products come from the API: the showcase
// shows them, and the "See a Batch Passport" link opens the first one.
import { useLang } from "../../i18n/LanguageContext";
import { usePageTitle } from "../../lib/usePageTitle";
import BrandStory from "./components/BrandStory";
import HomeHero from "./components/HomeHero";
import ProvenanceStats from "./components/ProvenanceStats";
import SeasonalShowcase from "./components/SeasonalShowcase";
import WholesaleTeaser from "./components/WholesaleTeaser";
import { useFeaturedProducts } from "./useFeaturedProducts";

export default function HomePage() {
  const { t } = useLang();
  usePageTitle(t("titles.home"));
  const featured = useFeaturedProducts();

  const firstProduct = featured.status === "ready" ? featured.products[0] : undefined;

  return (
    <>
      <HomeHero />
      <SeasonalShowcase state={featured} />
      <BrandStory passportSlug={firstProduct?.slug} />
      <ProvenanceStats />
      <WholesaleTeaser />
    </>
  );
}
