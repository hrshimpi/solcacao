// The product photo with a row of small buttons to switch between the photos.
import { useState } from "react";
import { useLang } from "../../../i18n/LanguageContext";

interface ProductGalleryProps {
  images: string[];
  alt: string;
}

export default function ProductGallery({ images, alt }: ProductGalleryProps) {
  const { t } = useLang();
  const [active, setActive] = useState(0);

  return (
    <div className="space-y-3">
      <div className="aspect-[4/5] overflow-hidden border border-ink-cacao bg-clay-surface">
        <img src={images[active]} alt={alt} width={960} height={1200} className="h-full w-full object-cover" />
      </div>
      <ul className="flex gap-3">
        {images.map((image, index) => (
          <li key={image}>
            <button
              type="button"
              onClick={() => setActive(index)}
              aria-pressed={active === index}
              aria-label={t("product.showImage", { number: index + 1, total: images.length })}
              className={`block h-24 w-20 overflow-hidden border-2 ${
                active === index ? "border-pod-wine" : "border-ink-cacao/60"
              }`}
            >
              <img src={image} alt="" width={80} height={96} loading="lazy" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
