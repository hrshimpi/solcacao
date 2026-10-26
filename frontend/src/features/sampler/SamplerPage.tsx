// Build your own sampler: pick 4 to 6 specimens, then add them to the cart as one item.
import { useState } from "react";
import { getProducts } from "../../data/products";
import { useLang } from "../../i18n/LanguageContext";
import { usePageTitle } from "../../lib/usePageTitle";
import { useAnnounce } from "../../ui/LiveRegion";
import { useCart } from "../cart/CartContext";
import SamplerTile from "./components/SamplerTile";
import SamplerTray from "./components/SamplerTray";

const MIN_PIECES = 4;
const MAX_PIECES = 6;

export default function SamplerPage() {
  const { t, lang } = useLang();
  const { addSampler } = useCart();
  const announce = useAnnounce();
  usePageTitle(t("titles.sampler"));

  const products = getProducts(lang);
  const [chosenIds, setChosenIds] = useState<number[]>([]);

  // keep the tray in the order the specimens were picked
  const selected = chosenIds.flatMap((id) => products.find((product) => product.id === id) ?? []);
  const full = chosenIds.length >= MAX_PIECES;
  const missing = MIN_PIECES - chosenIds.length;

  function toggle(id: number) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const picked = chosenIds.includes(id);
    const next = picked ? chosenIds.filter((chosen) => chosen !== id) : [...chosenIds, id];
    setChosenIds(next);
    announce(t(picked ? "sampler.unpicked" : "sampler.picked", { name: product.name, count: next.length, max: MAX_PIECES }));
  }

  // after a Remove button disappears, focus goes back to the matching tile so keyboard users keep their place
  function remove(id: number) {
    toggle(id);
    requestAnimationFrame(() => document.getElementById(`sampler-tile-${id}`)?.focus());
  }

  return (
    <div className="bg-stone-paper">
      <div className="border-b border-ink-cacao">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <h1 className="font-spectral text-3xl font-semibold text-ink-cacao sm:text-4xl">{t("sampler.title")}</h1>
          <p className="mt-2 font-sans text-xs text-ink-cacao/70">{t("sampler.intro", { min: MIN_PIECES, max: MAX_PIECES })}</p>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-10 sm:px-6 md:grid-cols-[3fr_2fr]">
        <section aria-labelledby="sampler-pick">
          <h2 id="sampler-pick" className="mb-1 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
            {t("sampler.pickHeading")}
          </h2>
          <p className="mb-6 font-sans text-sm font-medium text-ink-cacao">{t("sampler.chosen", { count: chosenIds.length, max: MAX_PIECES })}</p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <SamplerTile
                key={product.id}
                product={product}
                selected={chosenIds.includes(product.id)}
                full={full}
                onToggle={() => toggle(product.id)}
              />
            ))}
          </ul>
        </section>

        <section aria-labelledby="sampler-tray">
          <h2 id="sampler-tray" className="mb-6 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
            {t("sampler.trayHeading")}
          </h2>
          <SamplerTray selected={selected} slots={MAX_PIECES} onRemove={remove} />

          {full && <p className="mb-4 text-center font-sans text-xs text-ink-cacao/70">{t("sampler.full")}</p>}
          {missing > 0 && (
            <p id="sampler-need" className="mb-4 text-center font-sans text-xs text-ink-cacao/70">
              {t("sampler.needMore", { count: missing })}
            </p>
          )}

          <button
            type="button"
            disabled={missing > 0}
            aria-describedby={missing > 0 ? "sampler-need" : undefined}
            onClick={() => addSampler(chosenIds)}
            className="min-h-11 w-full bg-sun-gold py-3.5 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("sampler.add")}
          </button>
        </section>
      </div>
    </div>
  );
}
