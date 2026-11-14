// Three wholesale features and the "trusted by" row.
import { useLang } from "../../../i18n/LanguageContext";

const logos = ["Hacienda Brands", "Colibrí Hotels", "Almanac Coffee", "Marabu Studio", "Terroir Foods"];

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export default function WholesaleFeatures() {
  const { t } = useLang();

  const features = [
    {
      title: t("wholesale.moldsTitle"),
      body: t("wholesale.moldsBody"),
      icon: (
        <FeatureIcon>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M14 14h7v7h-7z" strokeDasharray="2 2" />
        </FeatureIcon>
      ),
    },
    {
      title: t("wholesale.packagingTitle"),
      body: t("wholesale.packagingBody"),
      icon: (
        <FeatureIcon>
          <rect x="2" y="6" width="20" height="14" rx="0" />
          <path d="M2 10h20" />
          <circle cx="8" cy="14" r="1" fill="currentColor" />
        </FeatureIcon>
      ),
    },
    {
      title: t("wholesale.whiteLabelTitle"),
      body: t("wholesale.whiteLabelBody"),
      icon: (
        <FeatureIcon>
          <path d="M12 2L2 7l10 5 10-5-10-5Z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </FeatureIcon>
      ),
    },
  ];

  return (
    <>
      <section className="on-dark border-t border-paper-text/20 bg-ink-cacao text-paper-text">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <ul className="grid divide-y divide-paper-text/20 md:grid-cols-3 md:divide-x md:divide-y-0">
            {features.map((feature) => (
              <li key={feature.title} className="py-10 first:pt-0 md:px-10 md:py-0 md:first:pl-0 md:last:pr-0">
                <div className="mb-5 text-paper-text/80">{feature.icon}</div>
                <h2 className="mb-3 font-spectral text-xl font-semibold">{feature.title}</h2>
                <p className="font-sans text-sm leading-relaxed text-paper-text/80">{feature.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="trusted-by" className="on-dark bg-pod-wine py-14 text-paper-text">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="trusted-by" className="mb-8 text-center font-sans text-[11px] uppercase tracking-[0.2em] text-paper-text/80">
            {t("wholesale.trustedBy")}
          </h2>
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 md:gap-x-16">
            {logos.map((logo) => (
              <li key={logo} className="font-spectral text-lg italic text-paper-text/80">
                {logo}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
