// A simple line drawing of the world with the cacao growing regions marked. It has a text description.
import { useLang } from "../../../i18n/LanguageContext";

const outline = { stroke: "#F3ECDD", strokeWidth: 0.8, fill: "none", opacity: 0.7 };

export default function OriginMap() {
  const { t } = useLang();

  return (
    <svg viewBox="0 0 320 180" role="img" aria-label={t("product.mapAlt")} className="w-full" fill="none">
      <path d="M45 40 L80 35 L95 55 L85 75 L70 90 L55 85 L40 70 Z" {...outline} />
      <path d="M75 98 L95 92 L105 110 L100 140 L85 155 L70 145 L65 120 Z" {...outline} />
      <path d="M135 32 L160 28 L168 45 L155 55 L140 50 Z" {...outline} />
      <path d="M145 60 L175 55 L185 80 L180 120 L160 135 L140 120 L135 90 Z" {...outline} />
      <path d="M185 30 L250 25 L265 50 L255 75 L220 80 L190 65 L180 45 Z" {...outline} />
      <circle cx="82" cy="108" r="3" fill="#EFA836" />
      <circle cx="88" cy="102" r="3" fill="#EFA836" />
      <circle cx="78" cy="115" r="2" fill="#EFA836" />
      <circle cx="165" cy="98" r="3" fill="#EFA836" />
      <line x1="0" y1="90" x2="320" y2="90" stroke="#F3ECDD" strokeWidth="0.4" strokeDasharray="3 4" opacity="0.4" />
    </svg>
  );
}
